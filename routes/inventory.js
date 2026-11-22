const express = require("express");
const db = require("../config/db");
const { requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/categories", requireRole("seller", "admin"), async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, name FROM categories ORDER BY name");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load categories." });
  }
});

router.get("/", requireRole("seller", "admin"), async (req, res) => {
  try {
    const isAdmin = req.session.user.role === "admin";
    const [rows] = await db.query(
      `SELECT p.id, p.name, c.name AS category, p.unit_price,
              s.qty_on_hand AS on_hand, s.qty_reserved AS reserved,
              DATE_FORMAT(p.harvest_or_restock_date, '%Y-%m-%d') AS ready_on
       FROM products p
       JOIN categories c ON c.id = p.category_id
       JOIN stock s ON s.product_id = p.id
       WHERE (? = 1 OR p.seller_id = ?)
       ORDER BY p.name`,
      [isAdmin ? 1 : 0, req.session.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load your products." });
  }
});

router.post("/", requireRole("seller", "admin"), async (req, res) => {
  const name = (req.body.name || "").trim();
  const categoryId = Number(req.body.category_id);
  const price = Number(req.body.unit_price);
  const qty = Number(req.body.qty);
  const readyOn = req.body.ready_on || null;

  if (!name) {
    return res.status(400).json({ error: "Please enter a product name." });
  }
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return res.status(400).json({ error: "Please choose a category." });
  }
  if (!(price > 0)) {
    return res.status(400).json({ error: "Price must be greater than zero." });
  }
  if (!Number.isInteger(qty) || qty < 0) {
    return res.status(400).json({ error: "Quantity must be a whole number, zero or more." });
  }
  if (readyOn && !/^\d{4}-\d{2}-\d{2}$/.test(readyOn)) {
    return res.status(400).json({ error: "Ready date is not valid." });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [product] = await conn.query(
      "INSERT INTO products (seller_id, category_id, name, unit_price, harvest_or_restock_date) VALUES (?, ?, ?, ?, ?)",
      [req.session.user.id, categoryId, name, price, readyOn]
    );

    await conn.query(
      "INSERT INTO stock (product_id, qty_on_hand, qty_reserved) VALUES (?, ?, 0)",
      [product.insertId, qty]
    );

    if (qty > 0) {
      await conn.query(
        `INSERT INTO stock_movements
           (product_id, change_on_hand, change_reserved, reason, reference_type, reference_id)
         VALUES (?, ?, 0, 'Initial stock', 'product', ?)`,
        [product.insertId, qty, product.insertId]
      );
    }

    await conn.commit();
    res.json({ message: name + " was added.", id: product.insertId });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "Could not add the product. Nothing was changed." });
  } finally {
    conn.release();
  }
});

router.post("/:id/restock", requireRole("seller", "admin"), async (req, res) => {
  const productId = Number(req.params.id);
  const qty = Number(req.body.qty);

  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ error: "Invalid product." });
  }
  if (!Number.isInteger(qty) || qty <= 0) {
    return res.status(400).json({ error: "Quantity must be a whole number greater than zero." });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [owner] = await conn.query("SELECT seller_id FROM products WHERE id = ?", [productId]);
    if (owner.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "This product does not exist." });
    }
    if (req.session.user.role !== "admin" && owner[0].seller_id !== req.session.user.id) {
      await conn.rollback();
      return res.status(403).json({ error: "This is not your product." });
    }

    await conn.query("SELECT product_id FROM stock WHERE product_id = ? FOR UPDATE", [productId]);
    await conn.query(
      "UPDATE stock SET qty_on_hand = qty_on_hand + ? WHERE product_id = ?",
      [qty, productId]
    );
    await conn.query(
      `INSERT INTO stock_movements
         (product_id, change_on_hand, change_reserved, reason, reference_type, reference_id)
       VALUES (?, ?, 0, 'Restocked by seller', 'product', ?)`,
      [productId, qty, productId]
    );

    await conn.commit();
    res.json({ message: qty + " kg added to stock." });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "Could not update the stock. Nothing was changed." });
  } finally {
    conn.release();
  }
});

module.exports = router;