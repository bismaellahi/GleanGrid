const express = require("express");
const db = require("../config/db");
const { requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/overview", requireRole("admin"), async (req, res) => {
  try {
    const [[counts]] = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM users) AS users,
         (SELECT COUNT(*) FROM products) AS products,
         (SELECT COUNT(*) FROM orders) AS orders,
         (SELECT COUNT(*) FROM pos_sales) AS pos_sales`
    );

    const [lowStock] = await db.query(
      `SELECT p.id, p.name, u.name AS seller,
              s.qty_on_hand AS on_hand, s.qty_reserved AS reserved
       FROM products p
       JOIN users u ON u.id = p.seller_id
       JOIN stock s ON s.product_id = p.id
       WHERE s.qty_on_hand - s.qty_reserved <= 20
       ORDER BY s.qty_on_hand - s.qty_reserved, p.name`
    );

    const [users] = await db.query(
      "SELECT id, name, email, role, place, created_at FROM users ORDER BY id"
    );

    const [orders] = await db.query(
      `SELECT o.id, o.status, o.total_amount, o.created_at,
              u.name AS buyer, p.name AS product, oi.qty
       FROM orders o
       JOIN users u ON u.id = o.buyer_id
       JOIN order_items oi ON oi.order_id = o.id
       JOIN products p ON p.id = oi.product_id
       ORDER BY o.id DESC
       LIMIT 20`
    );

    res.json({ counts, low_stock: lowStock, users, orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load the admin overview." });
  }
});

module.exports = router;