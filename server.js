require("dotenv").config();
const express = require("express");
const session = require("express-session");
const path = require("path");

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "gleangrid-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 }
  })
);

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