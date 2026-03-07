require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const auditRoutes = require("./routes/auditRoutes");
const hospitalAdminRoutes = require("./routes/hospitalAdminRoutes");
const wardsRoutes = require("./routes/wardsRoutes");
const { auditRequestMiddleware } = require("./middleware/auditRequestMiddleware");
const dietPlansRoutes = require("./routes/dietPlansRoutes");
const censusRoutes = require("./routes/censusRoutes");
const calculationRoutes = require("./routes/calculationRoutes");
const orderRoutes = require("./routes/orderRoutes");
const priceRoutes = require("./routes/priceRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const kitchenRoutes = require("./routes/kitchenRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const reportRoutes = require("./routes/reportRoutes");

const app = express();

/* ✅ CORS (do NOT use app.options("*") / "/*" on your setup) */
app.use(
  cors({
    origin: "http://localhost:8080",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-request-id", "x-correlation-id"],
  })
);

app.use(express.json());
app.use(auditRequestMiddleware);

// routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api", hospitalAdminRoutes);
app.use("/api/wards", wardsRoutes);
app.use("/api/diet-plans", dietPlansRoutes);
app.use("/api/census", censusRoutes);
app.use("/api/calculations", calculationRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/prices", priceRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/kitchen", kitchenRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportRoutes);

// quick health check
app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/db-check", async (req, res) => {
  const r = await pool.query("SELECT current_database() as db, current_user as user;");
  res.json(r.rows[0]);
});

// global error handler (simple)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));