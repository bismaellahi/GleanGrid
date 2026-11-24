const db = require("../config/db");

async function checkActive(req, res) {
  if (!req.session.user) {
    res.status(401).json({ error: "Please log in first." });
    return false;
  }
  const [rows] = await db.query("SELECT is_active FROM users WHERE id = ?", [req.session.user.id]);
  if (rows.length === 0 || !rows[0].is_active) {
    req.session.destroy(() => {});
    res.status(403).json({ error: "This account has been disabled." });
    return false;
  }
  return true;
}

function requireLogin(req, res, next) {
  checkActive(req, res)
    .then((ok) => {
      if (ok) next();
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: "Something went wrong." });
    });
}

function requireRole(...roles) {
  return (req, res, next) => {
    checkActive(req, res)
      .then((ok) => {
        if (!ok) return;
        if (!roles.includes(req.session.user.role)) {
          return res.status(403).json({ error: "You do not have permission to do this." });
        }
        next();
      })
      .catch((err) => {
        console.error(err);
        res.status(500).json({ error: "Something went wrong." });
      });
  };
}

module.exports = { requireLogin, requireRole };