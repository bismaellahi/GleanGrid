const express = require("express");
const db = require("../config/db");
const { requireRole } = require("../middleware/auth");

const router = express.Router();

router.post("/", requireRole("buyer"), async (req, res) => {
  const productId = Number(req.body.product_id);
  const qty = Number(req.body.qty);

  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ error: "Please choose a product." });
  }
  if (!Number.isInteger(qty) || qty <= 0) {
    return res.status(400).json({ error: "Quantity must be a whole number greater than zero." });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [prod] = await conn.query(
      "SELECT name, unit_price FROM products WHERE id = ?",
      [productId]
    );
    if (prod.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "This product does not exist." });
    }

    const [stock] = await conn.query(
      "SELECT qty_on_hand, qty_reserved FROM stock WHERE product_id = ? FOR UPDATE",
      [productId]
    );
    const available = stock[0].qty_on_hand - stock[0].qty_reserved;

    if (qty > available) {
      await conn.rollback();
      return res.status(409).json({
        error: "Only " + available + " kg is available right now. Please lower the quantity."
      });
    }

    await conn.query(
      "UPDATE stock SET qty_reserved = qty_reserved + ? WHERE product_id = ?",
      [qty, productId]
    );

    const total = qty * prod[0].unit_price;
    const [order] = await conn.query(
      "INSERT INTO orders (buyer_id, status, total_amount) VALUES (?, 'pending', ?)",
      [req.session.user.id, total]
    );

    await conn.query(
      "INSERT INTO order_items (order_id, product_id, qty, unit_price) VALUES (?, ?, ?, ?)",
      [order.insertId, productId, qty, prod[0].unit_price]
    );

    await conn.query(
      `INSERT INTO stock_movements
         (product_id, change_on_hand, change_reserved, reason, reference_type, reference_id)
       VALUES (?, 0, ?, 'Reserved: order placed', 'order', ?)`,
      [productId, qty, order.insertId]
    );

    await conn.commit();
    res.json({ message: "Order placed.", order_id: order.insertId, total });
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
      `SELECT o.id, o.status, o.total_amount, o.created_at, p.name, oi.qty
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN products p ON p.id = oi.product_id
       WHERE o.buyer_id = ?
       ORDER BY o.id DESC`,
      [req.session.user.id]
    );
    res.json(rows);
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