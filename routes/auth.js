const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../config/db");

const router = express.Router();

router.post("/register", async (req, res) => {
  const { name, password, role, place } = req.body;
  const email = (req.body.email || "").trim().toLowerCase();

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "Please fill in your name, email, password and role." });
  }
  if (!["buyer", "seller"].includes(role)) {
    return res.status(400).json({ error: "Role must be buyer or seller." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  try {
    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: "This email is already registered. Try logging in." });
    }

    const hash = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO users (name, email, password_hash, role, place) VALUES (?, ?, ?, ?, ?)",
      [name.trim(), email, hash, role, place || null]
    );

    res.json({ message: "Account created. You can log in now." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create the account. Please try again." });
  }
});

router.post("/login", async (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase();
  const password = req.body.password || "";

  if (!email || !password) {
    return res.status(400).json({ error: "Please enter your email and password." });
  }

  try {
    const [rows] = await db.query(
      "SELECT id, name, role, password_hash, is_active FROM users WHERE email = ?",
      [email]
    );
    const user = rows[0];
    const ok = user && (await bcrypt.compare(password, user.password_hash));

    if (!ok) {
      return res.status(401).json({ error: "Email or password is wrong." });
    }
    if (!user.is_active) {
      return res.status(403).json({ error: "This account has been disabled. Please contact the admin." });
    }

    req.session.user = { id: user.id, name: user.name, role: user.role };
    res.json({ message: "Logged in.", user: req.session.user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not log in. Please try again." });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Logged out." });
  });
});

router.get("/me", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Not logged in." });
  }
  try {
    const [rows] = await db.query("SELECT is_active FROM users WHERE id = ?", [req.session.user.id]);
    if (rows.length === 0 || !rows[0].is_active) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: "Not logged in." });
    }
    res.json(req.session.user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
});

module.exports = router;