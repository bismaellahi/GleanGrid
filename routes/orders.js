const express = require("express");
const db = require("../config/db");
const { requireRole } = require("../middleware/auth");

const router = express.Router();

function allowsFulfilment(info, fulfilment) {
  if (info === "Pickup only") return fulfilment === "pickup";
  if (info === "Delivery only") return fulfilment === "delivery";
  return true;
}

function groupOrders(rows) {
  const byId = new Map();
  for (const r of rows) {
    if (!byId.has(r.id)) {
      byId.set(r.id, {
        id: r.id,
        status: r.status,
        total_amount: r.total_amount,
        fulfilment: r.fulfilment,
        created_at: r.created_at,
        items: []
      });
    }
    byId.get(r.id).items.push({ name: r.name, qty: r.qty });
  }
  return [...byId.values()];
}

router.post("/", requireRole("buyer"), async (req, res) => {
  const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
  const fulfilment = req.body.fulfilment;

  if (!["pickup", "delivery"].includes(fulfilment)) {
    return res.status(400).json({ error: "Please choose pickup or delivery." });
  }

  const merged = new Map();
  for (const item of rawItems) {
    const productId = Number(item.product_id);
    const qty = Number(item.qty);
    if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ error: "Each item needs a product and a whole number quantity greater than zero." });
    }
    merged.set(productId, (merged.get(productId) || 0) + qty);
  }
  if (merged.size === 0) {
    return res.status(400).json({ error: "Your cart is empty." });
  }

  const items = [...merged.entries()].sort((a, b) => a[0] - b[0]);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const lines = [];
    for (const [productId, qty] of items) {
      const [prod] = await conn.query(
        `SELECT p.name, p.unit_price, p.seller_id, p.pickup_delivery_info, u.is_active
         FROM products p
         JOIN users u ON u.id = p.seller_id
         WHERE p.id = ?`,
        [productId]
      );
      if (prod.length === 0 || !prod[0].is_active) {
        await conn.rollback();
        return res.status(404).json({ error: "One of the products in your cart is no longer available." });
      }
      if (!allowsFulfilment(prod[0].pickup_delivery_info, fulfilment)) {
        await conn.rollback();
        return res.status(409).json({
          error: prod[0].name + " is " + prod[0].pickup_delivery_info.toLowerCase() + ". Change your choice or remove it from the cart."
        });
      }

      const [stock] = await conn.query(
        "SELECT qty_on_hand, qty_reserved FROM stock WHERE product_id = ? FOR UPDATE",
        [productId]
      );
      const available = stock[0].qty_on_hand - stock[0].qty_reserved;
      if (qty > available) {
        await conn.rollback();
        return res.status(409).json({
          error: "Only " + available + " kg of " + prod[0].name + " is available right now. Please lower the quantity."
        });
      }

      lines.push({ productId, qty, price: prod[0].unit_price, sellerId: prod[0].seller_id });
    }

    const bySeller = new Map();
    for (const line of lines) {
      if (!bySeller.has(line.sellerId)) bySeller.set(line.sellerId, []);
      bySeller.get(line.sellerId).push(line);
    }

    const orderIds = [];
    let grandTotal = 0;

    for (const group of bySeller.values()) {
      const total = Math.round(group.reduce((sum, l) => sum + l.qty * l.price, 0) * 100) / 100;
      grandTotal += total;

      const [order] = await conn.query(
        "INSERT INTO orders (buyer_id, status, total_amount, fulfilment) VALUES (?, 'pending', ?, ?)",
        [req.session.user.id, total, fulfilment]
      );
      orderIds.push(order.insertId);

      for (const line of group) {
        await conn.query(
          "INSERT INTO order_items (order_id, product_id, qty, unit_price) VALUES (?, ?, ?, ?)",
          [order.insertId, line.productId, line.qty, line.price]
        );
        await conn.query(
          "UPDATE stock SET qty_reserved = qty_reserved + ? WHERE product_id = ?",
          [line.qty, line.productId]
        );
        await conn.query(
          `INSERT INTO stock_movements
             (product_id, change_on_hand, change_reserved, reason, reference_type, reference_id)
           VALUES (?, 0, ?, 'Reserved: order placed', 'order', ?)`,
          [line.productId, line.qty, order.insertId]
        );
      }
    }

    await conn.commit();
    grandTotal = Math.round(grandTotal * 100) / 100;
    const message = orderIds.length === 1
      ? "Order placed. Total: Rs " + grandTotal + "."
      : orderIds.length + " orders placed, one for each seller. Total: Rs " + grandTotal + ".";
    res.json({ message, order_ids: orderIds, total: grandTotal });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "Could not place the order. Nothing was changed." });
  } finally {
    conn.release();
  }
});

router.get("/mine", requireRole("buyer"), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT o.id, o.status, o.total_amount, o.fulfilment, o.created_at,
              p.name, oi.qty
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN products p ON p.id = oi.product_id
       WHERE o.buyer_id = ?
       ORDER BY o.id DESC, oi.id`,
      [req.session.user.id]
    );
    res.json(groupOrders(rows));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load your orders." });
  }
});

router.post("/:id/cancel", requireRole("buyer"), async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ error: "Invalid order." });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [orders] = await conn.query(
      "SELECT id, status, buyer_id FROM orders WHERE id = ? FOR UPDATE",
      [orderId]
    );
    if (orders.length === 0 || orders[0].buyer_id !== req.session.user.id) {
      await conn.rollback();
      return res.status(404).json({ error: "This order does not exist." });
    }
    if (!["pending", "confirmed"].includes(orders[0].status)) {
      await conn.rollback();
      return res.status(409).json({ error: "Only orders that are not packed yet can be cancelled." });
    }

    const [items] = await conn.query(
      "SELECT product_id, qty FROM order_items WHERE order_id = ? ORDER BY product_id",
      [orderId]
    );

    for (const item of items) {
      await conn.query("SELECT product_id FROM stock WHERE product_id = ? FOR UPDATE", [item.product_id]);
      await conn.query(
        "UPDATE stock SET qty_reserved = qty_reserved - ? WHERE product_id = ?",
        [item.qty, item.product_id]
      );
      await conn.query(
        `INSERT INTO stock_movements
           (product_id, change_on_hand, change_reserved, reason, reference_type, reference_id)
         VALUES (?, 0, ?, 'Released: order cancelled', 'order', ?)`,
        [item.product_id, -item.qty, orderId]
      );
    }

    await conn.query("UPDATE orders SET status = 'cancelled' WHERE id = ?", [orderId]);
    await conn.commit();
    res.json({ message: "Order cancelled." });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "Could not cancel the order. Nothing was changed." });
  } finally {
    conn.release();
  }
});

module.exports = router;