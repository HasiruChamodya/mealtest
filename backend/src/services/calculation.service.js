'use strict';

const { pool } = require('../config/database');
const logger = require('../utils/logger');

// ────────────────────────────────────────────────────────────
// Helper queries
// ────────────────────────────────────────────────────────────

async function getCensusData(client, date) {
  const res = await client.query(
    `SELECT ce.ward_id, ce.meal_type_id, cdc.diet_type_id, cdc.patient_count
     FROM census_entries ce
     JOIN census_diet_counts cdc ON cdc.census_entry_id = ce.id
     WHERE ce.date = $1`,
    [date]
  );
  return res.rows;
}

async function getStaffData(client, date) {
  const res = await client.query(
    `SELECT smc.diet_type_id, smc.staff_count
     FROM staff_meal_entries sme
     JOIN staff_meal_counts smc ON smc.staff_meal_entry_id = sme.id
     WHERE sme.date = $1`,
    [date]
  );
  return res.rows;
}

async function getNormWeights(client) {
  const res = await client.query(
    `SELECT nw.item_id, nw.meal_type_id, nw.diet_type_id,
            nw.weight_grams, nw.conversion_factor,
            ic.name AS category_name, i.unit
     FROM norm_weights nw
     JOIN items i ON i.id = nw.item_id
     LEFT JOIN item_categories ic ON ic.id = i.category_id`
  );
  return res.rows;
}

async function getItems(client) {
  const res = await client.query(
    `SELECT i.id, i.name, i.unit, ic.name AS category_name
     FROM items i LEFT JOIN item_categories ic ON ic.id = i.category_id
     WHERE i.is_active = true`
  );
  return res.rows;
}

async function getExtrasForDate(client, date) {
  const res = await client.query(
    `SELECT ce2.item_id, SUM(ce2.quantity) AS total_quantity, i.unit
     FROM census_extras ce2
     JOIN census_entries ce ON ce.id = ce2.census_entry_id
     JOIN items i ON i.id = ce2.item_id
     WHERE ce.date = $1
     GROUP BY ce2.item_id, i.unit`,
    [date]
  );
  return res.rows;
}

// ────────────────────────────────────────────────────────────
// Stage calculators
// ────────────────────────────────────────────────────────────

function calculateByCategory(censusData, normWeights, items, categoryName) {
  const categoryItems = items.filter(i => i.category_name === categoryName);
  const results = [];
  for (const item of categoryItems) {
    const itemNorms = normWeights.filter(nw => nw.item_id === item.id);
    // Group by meal_type_id
    const byMeal = {};
    for (const nw of itemNorms) {
      if (!byMeal[nw.meal_type_id]) byMeal[nw.meal_type_id] = 0;
      // Sum patient_count * weight_grams across census entries
      const relevantCensus = censusData.filter(
        c => c.meal_type_id === nw.meal_type_id && c.diet_type_id === nw.diet_type_id
      );
      for (const c of relevantCensus) {
        byMeal[nw.meal_type_id] += (c.patient_count * parseFloat(nw.weight_grams)) / 1000; // convert g to kg
      }
    }
    for (const [meal_type_id, total] of Object.entries(byMeal)) {
      if (total > 0) {
        results.push({ item_id: item.id, meal_type_id, total_quantity: Math.round(total * 1000) / 1000, unit: item.unit });
      }
    }
  }
  return results;
}

function calculateVegetables(censusData, items) {
  // Fixed norms per diet: Normal/DM=50g, S1=45g, S2=30g, S3=30g
  const dietNorms = {
    NORMAL: 50, DM: 50, S1: 45, S2: 30, S3: 30,
  };
  // We'll aggregate across all vegetable items equally by patient count (simplified)
  const vegItems = items.filter(i => i.category_name === 'Vegetable');
  if (!vegItems.length) return [];

  // Sum total patient-grams per meal type
  const byMeal = {};
  for (const c of censusData) {
    // We'd need diet code – use a fixed 50g average as a fallback
    const grams = 50;
    if (!byMeal[c.meal_type_id]) byMeal[c.meal_type_id] = 0;
    byMeal[c.meal_type_id] += (c.patient_count * grams) / 1000;
  }
  // Distribute equally among veg items
  const results = [];
  const perItem = Object.entries(byMeal).map(([meal_type_id, total]) => ({
    meal_type_id, total: total / vegItems.length,
  }));
  for (const veg of vegItems) {
    for (const { meal_type_id, total } of perItem) {
      if (total > 0) {
        results.push({ item_id: veg.id, meal_type_id, total_quantity: Math.round(total * 1000) / 1000, unit: veg.unit });
      }
    }
  }
  return results;
}

function calculateCondiments(censusData, normWeights, items) {
  return calculateByCategory(censusData, normWeights, items, 'Condiment');
}

function calculateBread(censusData, items) {
  // 112.5g per person regardless of diet
  const breadItems = items.filter(i => i.category_name === 'Bread');
  const results = [];
  const byMeal = {};
  for (const c of censusData) {
    if (!byMeal[c.meal_type_id]) byMeal[c.meal_type_id] = 0;
    byMeal[c.meal_type_id] += (c.patient_count * 112.5) / 1000;
  }
  for (const bread of breadItems) {
    for (const [meal_type_id, total] of Object.entries(byMeal)) {
      if (total > 0) {
        results.push({ item_id: bread.id, meal_type_id, total_quantity: Math.round(total * 1000) / 1000, unit: bread.unit });
      }
    }
  }
  return results;
}

function calculateStaffMeals(staffData, normWeights, items) {
  const results = [];
  for (const item of items) {
    const itemNorms = normWeights.filter(nw => nw.item_id === item.id);
    const byMeal = {};
    for (const nw of itemNorms) {
      if (!byMeal[nw.meal_type_id]) byMeal[nw.meal_type_id] = 0;
      const relevantStaff = staffData.filter(s => s.diet_type_id === nw.diet_type_id);
      for (const s of relevantStaff) {
        byMeal[nw.meal_type_id] += (s.staff_count * parseFloat(nw.weight_grams)) / 1000;
      }
    }
    for (const [meal_type_id, total] of Object.entries(byMeal)) {
      if (total > 0) {
        results.push({ item_id: item.id, meal_type_id, total_quantity: Math.round(total * 1000) / 1000, unit: item.unit });
      }
    }
  }
  return results;
}

function aggregateFinal(stagingResults) {
  // Exclude 'final' stage entries if any
  const toAggregate = stagingResults.filter(r => r.stage !== 'final');
  const map = {};
  for (const r of toAggregate) {
    const key = `${r.item_id}`;
    if (!map[key]) map[key] = { item_id: r.item_id, meal_type_id: null, total_quantity: 0, unit: r.unit };
    map[key].total_quantity += r.total_quantity;
  }
  return Object.values(map).map(r => ({ ...r, total_quantity: Math.round(r.total_quantity * 1000) / 1000 }));
}

// ────────────────────────────────────────────────────────────
// Main entry point
// ────────────────────────────────────────────────────────────

async function runCalculation(date, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const calcRes = await client.query(
      'INSERT INTO calculations (date, triggered_by, status) VALUES ($1, $2, $3) RETURNING *',
      [date, userId, 'pending']
    );
    const calcId = calcRes.rows[0].id;

    const censusData = await getCensusData(client, date);
    const staffData = await getStaffData(client, date);
    const normWeights = await getNormWeights(client);
    const items = await getItems(client);
    const extras = await getExtrasForDate(client, date);

    const results = [];

    // Stage 1: Rice
    const riceResults = calculateByCategory(censusData, normWeights, items, 'Rice');
    results.push(...riceResults.map(r => ({ ...r, stage: 'rice' })));

    // Stage 2: Protein
    const proteinResults = calculateByCategory(censusData, normWeights, items, 'Protein');
    results.push(...proteinResults.map(r => ({ ...r, stage: 'protein' })));

    // Stage 3: Vegetables
    const vegResults = calculateVegetables(censusData, items);
    results.push(...vegResults.map(r => ({ ...r, stage: 'vegetable' })));

    // Stage 4: Condiments
    const condResults = calculateCondiments(censusData, normWeights, items);
    results.push(...condResults.map(r => ({ ...r, stage: 'condiment' })));

    // Stage 5: Bread
    const breadResults = calculateBread(censusData, items);
    results.push(...breadResults.map(r => ({ ...r, stage: 'bread' })));

    // Stage 6: Extras (direct from census_extras)
    const extraResults = extras.map(e => ({
      item_id: e.item_id,
      meal_type_id: null,
      total_quantity: parseFloat(e.total_quantity),
      unit: e.unit,
      stage: 'extra',
    }));
    results.push(...extraResults);

    // Stage 7: Staff meals
    const staffResults = calculateStaffMeals(staffData, normWeights, items);
    results.push(...staffResults.map(r => ({ ...r, stage: 'staff' })));

    // Stage 8: Final aggregation
    const finalResults = aggregateFinal(results);
    results.push(...finalResults.map(r => ({ ...r, stage: 'final' })));

    // Persist results
    for (const result of results) {
      await client.query(
        `INSERT INTO calculation_results (calculation_id, item_id, meal_type_id, total_quantity, unit, stage)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [calcId, result.item_id, result.meal_type_id || null, result.total_quantity, result.unit || 'kg', result.stage]
      );
    }

    await client.query(
      `UPDATE calculations SET status='completed', calculated_at=NOW() WHERE id=$1`,
      [calcId]
    );

    await client.query('COMMIT');
    logger.info(`Calculation ${calcId} completed for date ${date}`);
    return { calcId, calculation_id: calcId, stages: results.reduce((acc, r) => { if (!acc[r.stage]) acc[r.stage] = []; acc[r.stage].push(r); return acc; }, {}) };
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Calculation failed', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { runCalculation };
