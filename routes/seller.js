const express = require("express");
const db = require("../config/db");
const { requireRole } = require("../middleware/auth");

const router = express.Router();

const transitions = {
  pending: ["confirmed", "rejected"],
  confirmed: ["packed", "rejected"],
  packed: ["dispatched", "collected", "rejected"],
  dispatched: ["collected"],
  collected: ["returned"]
};

router.get("/orders", requireRole("seller", "admin"), async (req, res) => {
  try {
    const isAdmin = req.session.user.role === "admin";
    const [rows] = await db.query(
      `SELECT o.id, o.status, o.total_amount, o.fulfilment, o.created_at,
              o.return_condition, o.refund_note,
              u.name AS buyer, p.name AS product, oi.qty
       FROM orders o
       JOIN users u ON u.id = o.buyer_id
       JOIN order_items oi ON oi.order_id = o.id
       JOIN products p ON p.id = oi.product_id
       WHERE (? = 1 OR p.seller_id = ?)
       ORDER BY o.id DESC, oi.id`,
      [isAdmin ? 1 : 0, req.session.user.id]
    );

    const byId = new Map();
    for (const r of rows) {
      if (!byId.has(r.id)) {
        byId.set(r.id, {
          id: r.id,
          status: r.status,
          total_amount: r.total_amount,
          fulfilment: r.fulfilment,
          created_at: r.created_at,
          return_condition: r.return_condition,
          refund_note: r.refund_note,
          buyer: r.buyer,
          items: []
        });
      }
      byId.get(r.id).items.push({ product: r.product, qty: r.qty });
    }
    res.json([...byId.values()]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load orders." });
  }
});

router.post("/orders/:id/status", requireRole("seller", "admin"), async (req, res) => {
  const orderId = Number(req.params.id);
  const newStatus = req.body.status;
  const condition = req.body.condition;
  const refundNote = String(req.body.refund_note || "").trim();
  const isAdmin = req.session.user.role === "admin";

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ error: "Invalid order." });
  }
  if (newStatus === "returned") {
    if (!["good", "damaged"].includes(condition)) {
      return res.status(400).json({ error: "Please say whether the returned produce is in good condition." });
    }
    if (refundNote.length > 255) {
      return res.status(400).json({ error: "The refund note can be at most 255 characters." });
    }
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [orders] = await conn.query(
      "SELECT id, status FROM orders WHERE id = ? FOR UPDATE",
      [orderId]
    );
    if (orders.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "This order does not exist." });
    }

    const current = orders[0].status;
    if (!(transitions[current] || []).includes(newStatus)) {
      await conn.rollback();
      return res.status(409).json({
        error: "An order that is " + current + " cannot be changed to " + newStatus + "."
      });
    }

    const [items] = await conn.query(
      `SELECT oi.product_id, oi.qty, p.seller_id
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?
       ORDER BY oi.product_id`,
      [orderId]
    );

    if (!isAdmin && items.some((i) => i.seller_id !== req.session.user.id)) {
      await conn.rollback();
      return res.status(403).json({ error: "This order is not for your products." });
    }

    const deducts = newStatus === "dispatched" || (newStatus === "collected" && current === "packed");

    for (const item of items) {
      await conn.query("SELECT product_id FROM stock WHERE product_id = ? FOR UPDATE", [item.product_id]);

      if (newStatus === "rejected") {
        await conn.query(
          "UPDATE stock SET qty_reserved = qty_reserved - ? WHERE product_id = ?",
          [item.qty, item.product_id]
        );
        await conn.query(
          `INSERT INTO stock_movements
             (product_id, change_on_hand, change_reserved, reason, reference_type, reference_id)
           VALUES (?, 0, ?, 'Released: order rejected', 'order', ?)`,
          [item.product_id, -item.qty, orderId]
        );
      }

      if (deducts) {
        await conn.query(
          "UPDATE stock SET qty_on_hand = qty_on_hand - ?, qty_reserved = qty_reserved - ? WHERE product_id = ?",
          [item.qty, item.qty, item.product_id]
        );
        await conn.query(
          `INSERT INTO stock_movements
             (product_id, change_on_hand, change_reserved, reason, reference_type, reference_id)
           VALUES (?, ?, ?, ?, 'order', ?)`,
          [item.product_id, -item.qty, -item.qty, "Sold: order " + newStatus, orderId]
        );
      }

      if (newStatus === "returned") {
        if (condition === "good") {
          await conn.query(
            "UPDATE stock SET qty_on_hand = qty_on_hand + ? WHERE product_id = ?",
            [item.qty, item.product_id]
          );
          await conn.query(
            `INSERT INTO stock_movements
               (product_id, change_on_hand, change_reserved, reason, reference_type, reference_id)
             VALUES (?, ?, 0, 'Returned: good condition, restocked', 'order', ?)`,
            [item.product_id, item.qty, orderId]
          );
        } else {
          await conn.query(
            `INSERT INTO stock_movements
               (product_id, change_on_hand, change_reserved, reason, reference_type, reference_id)
             VALUES (?, 0, 0, 'Returned: damaged, not restocked', 'order', ?)`,
            [item.product_id, orderId]
          );
        }
      }
    }

    if (newStatus === "returned") {
      await conn.query(
        "UPDATE orders SET status = ?, return_condition = ?, refund_note = ? WHERE id = ?",
        [newStatus, condition, refundNote || null, orderId]
      );
    } else {
      await conn.query("UPDATE orders SET status = ? WHERE id = ?", [newStatus, orderId]);
    }

    await conn.commit();
    res.json({ message: "Order is now " + newStatus + "." });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "Could not update the order. Nothing was changed." });
  } finally {
    conn.release();
  }
});

module.exports = router;