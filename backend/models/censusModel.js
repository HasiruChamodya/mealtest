const pool = require("../config/db");

const mapCensusRow = (row) => ({
  id: row.id,
  wardId: row.ward_id,
  date: row.date,
  diets: row.diets,
  staff: row.staff,
  special: row.special,
  extras: row.extras,
  customExtras: row.custom_extras,
  status: row.status,
  totalPatients: row.total_patients,
  submittedAt: row.submitted_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const getAllCensus = async (date = null, wardId = null) => {
  let query = `
    SELECT 
      id, ward_id, date, diets, staff, special, extras, custom_extras, 
      status, total_patients, submitted_at, created_at, updated_at
    FROM ward_census
    WHERE 1=1
  `;
  const values = [];
  let paramIndex = 1;

  if (date) {
    query += ` AND date = $${paramIndex}`;
    values.push(date);
    paramIndex++;
  }
  
  if (wardId) {
    query += ` AND ward_id = $${paramIndex}`;
    values.push(wardId);
    paramIndex++;
  }

  query += ` ORDER BY created_at DESC`;
  const result = await pool.query(query, values);
  return result.rows.map(mapCensusRow);
};

const getCensusById = async (id) => {
  const query = `
    SELECT * FROM ward_census WHERE id = $1
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0] ? mapCensusRow(result.rows[0]) : null;
};

const createCensus = async (data) => {
  const query = `
    INSERT INTO ward_census (
      ward_id, date, diets, staff, special, extras, custom_extras, status, total_patients
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `;
  const values = [
    data.wardId,
    data.date,
    data.diets,
    data.staff,
    data.special,
    data.extras,
    data.customExtras || [],
    data.status || 'draft',
    data.totalPatients || 0
  ];
  const result = await pool.query(query, values);
  return mapCensusRow(result.rows[0]);
};

const updateCensus = async (id, data) => {
  const query = `
    UPDATE ward_census
    SET
      diets = $1,
      staff = $2,
      special = $3,
      extras = $4,
      custom_extras = $5,
      total_patients = $6,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $7
    RETURNING *
  `;
  const values = [
    data.diets,
    data.staff,
    data.special,
    data.extras,
    data.customExtras || [],
    data.totalPatients || 0,
    id
  ];
  const result = await pool.query(query, values);
  return result.rows[0] ? mapCensusRow(result.rows[0]) : null;
};

const updateCensusStatus = async (id, status) => {
  const isSubmitted = status === 'submitted';
  const query = `
    UPDATE ward_census
    SET
      status = $1,
      submitted_at = ${isSubmitted ? 'CURRENT_TIMESTAMP' : 'submitted_at'},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `;
  const result = await pool.query(query, [status, id]);
  return result.rows[0] ? mapCensusRow(result.rows[0]) : null;
};

module.exports = {
  getAllCensus,
  getCensusById,
  createCensus,
  updateCensus,
  updateCensusStatus,
};