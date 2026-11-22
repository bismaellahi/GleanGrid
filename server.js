require("dotenv").config();
const express = require("express");
const cookieSession = require("cookie-session");
const path = require("path");

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cookieSession({
    name: "gleangrid",
    keys: [process.env.SESSION_SECRET || "gleangrid-dev-secret"],
    maxAge: 1000 * 60 * 60 * 8,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  })
);
app.use((req, res, next) => {
  Object.defineProperty(req.session, "destroy", {
    value: (cb) => {
      req.session = null;
      if (cb) cb();
    },
    enumerable: false,
    configurable: true,
    writable: true
  });
  next();
});
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/products", require("./routes/products"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/seller", require("./routes/seller"));
app.use("/api/inventory", require("./routes/inventory"));
app.use("/api/pos", require("./routes/pos"));
app.use("/api/admin", require("./routes/admin"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log("GleanGrid server running on port " + PORT);
});

module.exports = app;