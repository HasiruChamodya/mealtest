// controllers/calculationController.js
const pool = require("../config/db");
const { writeAudit } = require("../utils/audit");

// POST /api/calculations/trigger
exports.triggerCalculation = async (req, res) => {
  try {
    const { date, meal } = req.body;

    if (!date || !meal) {
      return res.status(400).json({ message: "date and meal are required" });
    }

    const validMeals = ["Breakfast", "Lunch", "Dinner"];
    if (!validMeals.includes(meal)) {
      return res.status(400).json({ message: "meal must be Breakfast, Lunch, or Dinner" });
    }

    // Fetch all submitted census entries for the given date
    const censusResult = await pool.query(
      `SELECT * FROM ward_census WHERE date = $1 AND status IN ('submitted', 'locked')`,
      [date]
    );

    if (censusResult.rows.length === 0) {
      return res.status(400).json({ message: "No submitted census data found for this date" });
    }

    // Aggregate patient counts by diet type across all wards
    const dietCounts = {}; // { dietType: totalCount }
    const staffCounts = {}; // { staffType: totalCount }
    const extraItems = {}; // { itemName: totalCount }

    for (const census of censusResult.rows) {
      // Aggregate diets
      const diets = census.diets || {};
      for (const [dietType, count] of Object.entries(diets)) {
        dietCounts[dietType] = (dietCounts[dietType] || 0) + Number(count || 0);
      }

      // Aggregate staff
      const staff = census.staff || {};
      for (const [staffType, count] of Object.entries(staff)) {
        staffCounts[staffType] = (staffCounts[staffType] || 0) + Number(count || 0);
      }

      // Aggregate extras (raw sum, no multiplication)
      const extras = census.extras || {};
      for (const [itemName, count] of Object.entries(extras)) {
        extraItems[itemName] = (extraItems[itemName] || 0) + Number(count || 0);
      }

      // Aggregate custom extras
      const customExtras = census.custom_extras || [];
      for (const extra of customExtras) {
        if (extra.name && extra.quantity) {
          const key = extra.name;
          extraItems[key] = (extraItems[key] || 0) + Number(extra.quantity || 0);
        }
      }
    }

    // Fetch norm weights for the given meal
    const normWeightsResult = await pool.query(
      `SELECT nw.ingredient_id, nw.diet, nw.meal, nw.grams, i.name as ingredient_name
       FROM norm_weights nw
       JOIN ingredients i ON i.id = nw.ingredient_id
       WHERE nw.meal = $1`,
      [meal]
    );

    // Fetch fractional formulas
    const fractionalResult = await pool.query(
      `SELECT * FROM fractional_formulas`
    );
    const fractionalFormulas = {};
    for (const formula of fractionalResult.rows) {
    fractionalFormulas[formula.ingredient.toLowerCase().replace(/\s+/g, " ").trim()] = formula.fractions || {};
    }

    // Calculate ingredient totals
    // Group norm weights by ingredient
    const ingredientNorms = {}; // { ingredientId: { name, norms: { diet: grams } } }
    for (const nw of normWeightsResult.rows) {
      if (!ingredientNorms[nw.ingredient_id]) {
        ingredientNorms[nw.ingredient_id] = { name: nw.ingredient_name, norms: {} };
      }
      ingredientNorms[nw.ingredient_id].norms[nw.diet] = Number(nw.grams);
    }

    const ingredientResults = {}; // { ingredientId: { name, totalGrams, breakdown } }

    for (const [ingredientId, data] of Object.entries(ingredientNorms)) {
      let totalGrams = 0;
      const breakdown = {};

      for (const [dietType, count] of Object.entries(dietCounts)) {
        const grams = data.norms[dietType] || 0;
        let adjusted = grams;

        // Apply fractional formula if applicable
    const formulaKey = data.name.toLowerCase().replace(/\s+/g, " ").trim();
        if (fractionalFormulas[formulaKey] && fractionalFormulas[formulaKey][dietType] !== undefined) {
          const fraction = Number(fractionalFormulas[formulaKey][dietType]);
          adjusted = grams * fraction;
        }

        const subtotal = adjusted * count;
        breakdown[dietType] = {
          count,
          grams_per_person: adjusted,
          subtotal_grams: subtotal,
        };
        totalGrams += subtotal;
      }

      ingredientResults[ingredientId] = {
        ingredient_id: Number(ingredientId),
        name: data.name,
        total_grams: Math.round(totalGrams * 100) / 100,
        total_kg: Math.round((totalGrams / 1000) * 1000) / 1000,
        breakdown,
      };
    }

    // Staff meal calculations
    const staffIngredientResults = {};
    for (const [staffType, count] of Object.entries(staffCounts)) {
      if (count <= 0) continue;
      for (const [ingredientId, data] of Object.entries(ingredientNorms)) {
        const grams = data.norms["Staff"] || data.norms[staffType] || 0;
        const subtotal = grams * count;

        if (!staffIngredientResults[ingredientId]) {
          staffIngredientResults[ingredientId] = {
            ingredient_id: Number(ingredientId),
            name: data.name,
            total_grams: 0,
            breakdown: {},
          };
        }

        staffIngredientResults[ingredientId].total_grams += subtotal;
        staffIngredientResults[ingredientId].breakdown[staffType] = {
          count,
          grams_per_person: grams,
          subtotal_grams: subtotal,
        };
      }
    }
    for (const item of Object.values(staffIngredientResults)) {
      item.total_kg = Math.round((item.total_grams / 1000) * 1000) / 1000;
      item.total_grams = Math.round(item.total_grams * 100) / 100;
    }

    // Final aggregation: patient + staff
    const finalAggregation = {};
    const allIngredientIds = new Set([
      ...Object.keys(ingredientResults),
      ...Object.keys(staffIngredientResults),
    ]);

    for (const ingredientId of allIngredientIds) {
      const patientGrams = ingredientResults[ingredientId]?.total_grams || 0;
      const staffGrams = staffIngredientResults[ingredientId]?.total_grams || 0;
      const totalGrams = patientGrams + staffGrams;
      const name =
        ingredientResults[ingredientId]?.name ||
        staffIngredientResults[ingredientId]?.name ||
        `Ingredient ${ingredientId}`;

      finalAggregation[ingredientId] = {
        ingredient_id: Number(ingredientId),
        name,
        patient_grams: Math.round(patientGrams * 100) / 100,
        staff_grams: Math.round(staffGrams * 100) / 100,
        total_grams: Math.round(totalGrams * 100) / 100,
        total_kg: Math.round((totalGrams / 1000) * 1000) / 1000,
      };
    }

    // Build structured results
    const results = {
      stage1_patient_diet_counts: dietCounts,
      stage2_staff_counts: staffCounts,
      stage3_patient_ingredients: ingredientResults,
      stage4_staff_ingredients: staffIngredientResults,
      stage5_extra_items: extraItems,
      stage6_final_aggregation: finalAggregation,
    };

    const totalPatients = Object.values(dietCounts).reduce((a, b) => a + b, 0);
    const totalStaff = Object.values(staffCounts).reduce((a, b) => a + b, 0);

    const summary = {
      date,
      meal,
      wards_included: censusResult.rows.length,
      total_patients: totalPatients,
      total_staff: totalStaff,
      total_ingredients_calculated: Object.keys(finalAggregation).length,
      extra_items_count: Object.keys(extraItems).length,
    };

    // Upsert calculation record
    const calcResult = await pool.query(
      `INSERT INTO calculations (date, meal, status, triggered_by, results, summary, updated_at)
       VALUES ($1, $2, 'completed', $3, $4, $5, NOW())
       ON CONFLICT (date, meal) DO UPDATE
       SET status = 'completed', triggered_by = $3, results = $4, summary = $5, updated_at = NOW()
       RETURNING *`,
      [date, meal, req.user?.id || null, JSON.stringify(results), JSON.stringify(summary)]
    );

    await writeAudit({
      req,
      action: "TRIGGER_CALCULATION",
      entity: "calculations",
      entity_id: String(calcResult.rows[0].id),
      details: { date, meal, wards: censusResult.rows.length, totalPatients },
      severity: "info",
      status_code: 201,
      success: true,
    });

    res.status(201).json({
      message: "Calculation completed successfully",
      calculation: calcResult.rows[0],
    });
  } catch (error) {
    console.error("TRIGGER CALCULATION ERROR:", error);

    await writeAudit({
      req,
      action: "TRIGGER_CALCULATION",
      entity: "calculations",
      details: { error: error.message },
      severity: "error",
      status_code: 500,
      success: false,
    });

    res.status(500).json({ message: "Failed to trigger calculation", error: error.message });
  }
};

// GET /api/calculations
exports.listCalculations = async (req, res) => {
  try {
    const { date, meal, status } = req.query;
    const conditions = [];
    const params = [];

    if (date) {
      params.push(date);
      conditions.push(`c.date = $${params.length}`);
    }
    if (meal) {
      params.push(meal);
      conditions.push(`c.meal = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`c.status = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT c.*, u.full_name as triggered_by_name
       FROM calculations c
       LEFT JOIN users u ON u.id = c.triggered_by
       ${whereClause}
       ORDER BY c.date DESC, c.meal ASC`,
      params
    );

    res.json({ calculations: result.rows });
  } catch (error) {
    console.error("LIST CALCULATIONS ERROR:", error);
    res.status(500).json({ message: "Failed to fetch calculations" });
  }
};

// GET /api/calculations/:id
exports.getCalculation = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT c.*, u.full_name as triggered_by_name
       FROM calculations c
       LEFT JOIN users u ON u.id = c.triggered_by
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Calculation not found" });
    }

    res.json({ calculation: result.rows[0] });
  } catch (error) {
    console.error("GET CALCULATION ERROR:", error);
    res.status(500).json({ message: "Failed to fetch calculation" });
  }
};

// PATCH /api/calculations/:id/status
exports.updateCalculationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["pending", "completed", "approved", "sent_to_kitchen"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const existing = await pool.query("SELECT * FROM calculations WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "Calculation not found" });
    }

    const result = await pool.query(
      `UPDATE calculations SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );

    await writeAudit({
      req,
      action: "UPDATE_CALCULATION_STATUS",
      entity: "calculations",
      entity_id: String(id),
      old_value: { status: existing.rows[0].status },
      new_value: { status },
      details: { message: `Status changed to ${status}` },
      severity: "info",
      status_code: 200,
      success: true,
    });

    res.json({ message: "Status updated", calculation: result.rows[0] });
  } catch (error) {
    console.error("UPDATE CALCULATION STATUS ERROR:", error);
    res.status(500).json({ message: "Failed to update calculation status" });
  }
};
