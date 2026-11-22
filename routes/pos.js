const express = require("express");
const db = require("../config/db");
const { requireRole } = require("../middleware/auth");

const router = express.Router();

router.post("/sales", requireRole("seller", "admin"), async (req, res) => {
  const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
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
    return res.status(400).json({ error: "Add at least one item to the sale." });
  }

  const items = [...merged.entries()].sort((a, b) => a[0] - b[0]);
  const isAdmin = req.session.user.role === "admin";

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const lines = [];
    let total = 0;

    for (const [productId, qty] of items) {
      const [prod] = await conn.query(
        "SELECT name, unit_price, seller_id FROM products WHERE id = ?",
        [productId]
      );
      if (prod.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "One of the products does not exist." });
      }
      if (!isAdmin && prod[0].seller_id !== req.session.user.id) {
        await conn.rollback();
        return res.status(403).json({ error: "You can only sell your own products." });
      }

      const [stock] = await conn.query(
        "SELECT qty_on_hand, qty_reserved FROM stock WHERE product_id = ? FOR UPDATE",
        [productId]
      );
      const available = stock[0].qty_on_hand - stock[0].qty_reserved;

      if (qty > available) {
        await conn.rollback();
        return res.status(409).json({
          error: "Only " + available + " kg of " + prod[0].name + " is available. Reserved stock cannot be sold at the counter."
        });
      }

      lines.push({ productId, qty, name: prod[0].name, price: prod[0].unit_price });
      total += qty * prod[0].unit_price;
    }

    total = Math.round(total * 100) / 100;

    const [sale] = await conn.query(
      "INSERT INTO pos_sales (seller_id, total_amount) VALUES (?, ?)",
      [req.session.user.id, total]
    );

    for (const line of lines) {
      await conn.query(
        "INSERT INTO pos_sale_items (sale_id, product_id, qty, unit_price) VALUES (?, ?, ?, ?)",
        [sale.insertId, line.productId, line.qty, line.price]
      );
      await conn.query(
        "UPDATE stock SET qty_on_hand = qty_on_hand - ? WHERE product_id = ?",
        [line.qty, line.productId]
      );
      await conn.query(
        `INSERT INTO stock_movements
           (product_id, change_on_hand, change_reserved, reason, reference_type, reference_id)
         VALUES (?, ?, 0, 'Sold at counter', 'pos_sale', ?)`,
        [line.productId, -line.qty, sale.insertId]
      );
    }

    await conn.commit();
    res.json({
      message: "Sale recorded.",
      sale_id: sale.insertId,
      total,
      lines: lines.map((l) => ({ name: l.name, qty: l.qty, price: l.price }))
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "Could not record the sale. Nothing was changed." });
  } finally {
    conn.release();
  }
});

router.get("/sales", requireRole("seller", "admin"), async (req, res) => {
  try {
    const isAdmin = req.session.user.role === "admin";
    const [rows] = await db.query(
      `SELECT s.id, s.total_amount, s.created_at, p.name AS product, i.qty
       FROM pos_sales s
       JOIN pos_sale_items i ON i.sale_id = s.id
       JOIN products p ON p.id = i.product_id
       WHERE (? = 1 OR s.seller_id = ?)
       ORDER BY s.id DESC
       LIMIT 40`,
      [isAdmin ? 1 : 0, req.session.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load counter sales." });
  }
});

module.exports = router;