const express = require("express");
const router = express.Router();
const db = require("../config/db");

router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT p.id,
             p.name,
             p.description,
             p.pickup_delivery_info AS pickup,
             u.name AS seller,
             u.place,
             c.name AS category,
             p.unit_price,
             s.qty_on_hand AS on_hand,
             s.qty_reserved AS reserved,
             DATE_FORMAT(p.harvest_or_restock_date, '%Y-%m-%d') AS ready_on
      FROM products p
      JOIN users u ON u.id = p.seller_id
      JOIN categories c ON c.id = p.category_id
      JOIN stock s ON s.product_id = p.id
      WHERE u.is_active = 1
      ORDER BY p.name
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load products" });
  }
});

module.exports = router;