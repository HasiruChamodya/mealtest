// controllers/priceController.js
const pool = require("../config/db");
const { writeAudit } = require("../utils/audit");

// GET /api/prices
exports.getPrices = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (ip.ingredient_id)
         ip.id, ip.ingredient_id, i.name as ingredient_name,
         ip.price_per_kg, ip.effective_from, ip.effective_to,
         ip.created_at, u.full_name as updated_by_name
       FROM item_prices ip
       JOIN ingredients i ON i.id = ip.ingredient_id
       LEFT JOIN users u ON u.id = ip.updated_by
       WHERE ip.effective_from <= CURRENT_DATE
         AND (ip.effective_to IS NULL OR ip.effective_to >= CURRENT_DATE)
       ORDER BY ip.ingredient_id, ip.effective_from DESC`
    );

    res.json({ prices: result.rows });
  } catch (error) {
    console.error("GET PRICES ERROR:", error);
    res.status(500).json({ message: "Failed to fetch prices" });
  }
};

// POST /api/prices
exports.setPrice = async (req, res) => {
  try {
    const { ingredient_id, price_per_kg, effective_from } = req.body;

    if (!ingredient_id || price_per_kg === undefined) {
      return res.status(400).json({ message: "ingredient_id and price_per_kg are required" });
    }

    if (Number(price_per_kg) < 0) {
      return res.status(400).json({ message: "price_per_kg must be non-negative" });
    }

    const effectiveDate = effective_from || new Date().toISOString().split("T")[0];

    const result = await pool.query(
      `INSERT INTO item_prices (ingredient_id, price_per_kg, effective_from, updated_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (ingredient_id, effective_from) DO UPDATE
       SET price_per_kg = $2, updated_by = $4
       RETURNING *`,
      [ingredient_id, price_per_kg, effectiveDate, req.user?.id || null]
    );

    await writeAudit({
      req,
      action: "SET_PRICE",
      entity: "item_prices",
      entity_id: String(result.rows[0].id),
      details: { ingredient_id, price_per_kg, effective_from: effectiveDate },
      severity: "info",
      status_code: 201,
      success: true,
    });

    res.status(201).json({ message: "Price set successfully", price: result.rows[0] });
  } catch (error) {
    console.error("SET PRICE ERROR:", error);

    await writeAudit({
      req,
      action: "SET_PRICE",
      entity: "item_prices",
      details: { error: error.message },
      severity: "error",
      status_code: 500,
      success: false,
    });

    res.status(500).json({ message: "Failed to set price", error: error.message });
  }
};

// GET /api/prices/history/:ingredientId
exports.getPriceHistory = async (req, res) => {
  try {
    const { ingredientId } = req.params;

    const result = await pool.query(
      `SELECT ip.*, i.name as ingredient_name, u.full_name as updated_by_name
       FROM item_prices ip
       JOIN ingredients i ON i.id = ip.ingredient_id
       LEFT JOIN users u ON u.id = ip.updated_by
       WHERE ip.ingredient_id = $1
       ORDER BY ip.effective_from DESC`,
      [ingredientId]
    );

    res.json({ history: result.rows });
  } catch (error) {
    console.error("GET PRICE HISTORY ERROR:", error);
    res.status(500).json({ message: "Failed to fetch price history" });
  }
};
