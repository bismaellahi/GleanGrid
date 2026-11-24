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
      "SELECT id, name, email, role, place, is_active, created_at FROM users ORDER BY id"
    );

    const [orderRows] = await db.query(
      `SELECT o.id, o.status, o.total_amount, o.fulfilment, o.created_at, u.name AS buyer
       FROM orders o
       JOIN users u ON u.id = o.buyer_id
       ORDER BY o.id DESC
       LIMIT 20`
    );
    const orders = orderRows.map((o) => ({ ...o, items: [] }));
    if (orders.length > 0) {
      const [itemRows] = await db.query(
        `SELECT oi.order_id, p.name AS product, oi.qty
         FROM order_items oi
         JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id IN (?)
         ORDER BY oi.id`,
        [orders.map((o) => o.id)]
      );
      for (const item of itemRows) {
        const order = orders.find((o) => o.id === item.order_id);
        if (order) order.items.push({ product: item.product, qty: item.qty });
      }
    }

    const [categories] = await db.query(
      `SELECT c.id, c.name, COUNT(p.id) AS products
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
       GROUP BY c.id, c.name
       ORDER BY c.name`
    );

    res.json({ counts, low_stock: lowStock, users, orders, categories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load the admin overview." });
  }
});

router.post("/users/:id/active", requireRole("admin"), async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: "Invalid user." });
  }
  if (typeof req.body.active !== "boolean") {
    return res.status(400).json({ error: "Please say whether to enable or disable the account." });
  }
  if (userId === req.session.user.id) {
    return res.status(400).json({ error: "You cannot change your own account." });
  }

  try {
    const [rows] = await db.query("SELECT role, name FROM users WHERE id = ?", [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "This user does not exist." });
    }
    if (rows[0].role === "admin") {
      return res.status(403).json({ error: "Admin accounts cannot be changed here." });
    }

    await db.query("UPDATE users SET is_active = ? WHERE id = ?", [req.body.active ? 1 : 0, userId]);
    res.json({ message: rows[0].name + (req.body.active ? " was enabled." : " was disabled.") });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update the account." });
  }
});

router.post("/categories", requireRole("admin"), async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name || name.length > 60) {
    return res.status(400).json({ error: "Category name must be 1 to 60 characters." });
  }
  try {
    await db.query("INSERT INTO categories (name) VALUES (?)", [name]);
    res.json({ message: name + " was added." });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "This category already exists." });
    }
    console.error(err);
    res.status(500).json({ error: "Could not add the category." });
  }
});

router.post("/categories/:id/rename", requireRole("admin"), async (req, res) => {
  const categoryId = Number(req.params.id);
  const name = String(req.body.name || "").trim();
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return res.status(400).json({ error: "Invalid category." });
  }
  if (!name || name.length > 60) {
    return res.status(400).json({ error: "Category name must be 1 to 60 characters." });
  }
  try {
    const [result] = await db.query("UPDATE categories SET name = ? WHERE id = ?", [name, categoryId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "This category does not exist." });
    }
    res.json({ message: "Category renamed to " + name + "." });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Another category already has this name." });
    }
    console.error(err);
    res.status(500).json({ error: "Could not rename the category." });
  }
});

module.exports = router;