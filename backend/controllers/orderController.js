// controllers/orderController.js
const pool = require("../config/db");
const { writeAudit } = require("../utils/audit");

// POST /api/orders
exports.createOrder = async (req, res) => {
  try {
    const { calculation_id, notes } = req.body;

    if (!calculation_id) {
      return res.status(400).json({ message: "calculation_id is required" });
    }

    // Fetch the approved calculation
    const calcResult = await pool.query(
      "SELECT * FROM calculations WHERE id = $1",
      [calculation_id]
    );

    if (calcResult.rows.length === 0) {
      return res.status(404).json({ message: "Calculation not found" });
    }

    const calculation = calcResult.rows[0];

    if (!["approved", "completed"].includes(calculation.status)) {
      return res.status(400).json({ message: "Calculation must be completed or approved to create an order" });
    }

    // Build order items from final aggregation
    const finalAggregation = calculation.results?.stage6_final_aggregation || {};

    // Fetch current prices for all ingredients
    const ingredientIds = Object.values(finalAggregation).map((item) => item.ingredient_id);

    let items = [];
    let totalCost = 0;

    if (ingredientIds.length > 0) {
      const pricesResult = await pool.query(
        `SELECT DISTINCT ON (ingredient_id) ingredient_id, price_per_kg
         FROM item_prices
         WHERE ingredient_id = ANY($1::int[])
           AND effective_from <= CURRENT_DATE
           AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
         ORDER BY ingredient_id, effective_from DESC`,
        [ingredientIds]
      );

      const priceMap = {};
      for (const p of pricesResult.rows) {
        priceMap[p.ingredient_id] = Number(p.price_per_kg);
      }

      items = Object.values(finalAggregation).map((item) => {
        const pricePerKg = priceMap[item.ingredient_id] || 0;
        const cost = (item.total_kg || 0) * pricePerKg;
        totalCost += cost;

        return {
          ingredient_id: item.ingredient_id,
          name: item.name,
          quantity_kg: item.total_kg || 0,
          quantity_grams: item.total_grams || 0,
          price_per_kg: pricePerKg,
          cost: Math.round(cost * 100) / 100,
        };
      });
    }

    const result = await pool.query(
      `INSERT INTO orders (calculation_id, date, meal, items, total_cost, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        calculation_id,
        calculation.date,
        calculation.meal,
        JSON.stringify(items),
        Math.round(totalCost * 100) / 100,
        notes || null,
        req.user?.id || null,
      ]
    );

    await writeAudit({
      req,
      action: "CREATE_ORDER",
      entity: "orders",
      entity_id: String(result.rows[0].id),
      details: { calculation_id, date: calculation.date, meal: calculation.meal, totalCost },
      severity: "info",
      status_code: 201,
      success: true,
    });

    res.status(201).json({ message: "Order created successfully", order: result.rows[0] });
  } catch (error) {
    console.error("CREATE ORDER ERROR:", error);

    await writeAudit({
      req,
      action: "CREATE_ORDER",
      entity: "orders",
      details: { error: error.message },
      severity: "error",
      status_code: 500,
      success: false,
    });

    res.status(500).json({ message: "Failed to create order", error: error.message });
  }
};

// GET /api/orders
exports.listOrders = async (req, res) => {
  try {
    const { date, status } = req.query;
    const conditions = [];
    const params = [];

    if (date) {
      params.push(date);
      conditions.push(`o.date = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`o.status = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT o.*, u.full_name as created_by_name
       FROM orders o
       LEFT JOIN users u ON u.id = o.created_by
       ${whereClause}
       ORDER BY o.date DESC, o.created_at DESC`,
      params
    );

    res.json({ orders: result.rows });
  } catch (error) {
    console.error("LIST ORDERS ERROR:", error);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
};

// GET /api/orders/:id
exports.getOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT o.*, u.full_name as created_by_name
       FROM orders o
       LEFT JOIN users u ON u.id = o.created_by
       WHERE o.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json({ order: result.rows[0] });
  } catch (error) {
    console.error("GET ORDER ERROR:", error);
    res.status(500).json({ message: "Failed to fetch order" });
  }
};

// PATCH /api/orders/:id/status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["pending", "approved", "rejected", "delivered"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const existing = await pool.query("SELECT * FROM orders WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    const result = await pool.query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );

    await writeAudit({
      req,
      action: "UPDATE_ORDER_STATUS",
      entity: "orders",
      entity_id: String(id),
      old_value: { status: existing.rows[0].status },
      new_value: { status },
      details: { message: `Order status changed to ${status}` },
      severity: "info",
      status_code: 200,
      success: true,
    });

    res.json({ message: "Order status updated", order: result.rows[0] });
  } catch (error) {
    console.error("UPDATE ORDER STATUS ERROR:", error);
    res.status(500).json({ message: "Failed to update order status" });
  }
};
