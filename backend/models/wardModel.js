const pool = require("../config/db");

const mapWardRow = (row) => ({
  id: row.id,
  code: row.code,
  name: row.name,
  beds: row.beds,
  cots: row.cots,
  icu: row.icu,
  incubators: row.incubators,
  active: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const getAllWards = async () => {
  const query = `
    SELECT * FROM wards
    ORDER BY code ASC
  `;
  const result = await pool.query(query);
  return result.rows.map(mapWardRow);
};

const getWardById = async (id) => {
  const query = `
    SELECT * FROM wards WHERE id = $1
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0] ? mapWardRow(result.rows[0]) : null;
};

const createWard = async (data) => {
  const query = `
    INSERT INTO wards (
      code, name, beds, cots, icu, incubators, is_active
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;
  const values = [
    data.code,
    data.name,
    data.beds || 0,
    data.cots || 0,
    data.icu || 0,
    data.incubators || 0,
    data.active !== undefined ? data.active : true,
  ];
  const result = await pool.query(query, values);
  return mapWardRow(result.rows[0]);
};

const updateWard = async (id, data) => {
  const query = `
    UPDATE wards
    SET
      code = $1,
      name = $2,
      beds = $3,
      cots = $4,
      icu = $5,
      incubators = $6,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $7
    RETURNING *
  `;
  const values = [
    data.code,
    data.name,
    data.beds || 0,
    data.cots || 0,
    data.icu || 0,
    data.incubators || 0,
    id,
  ];
  const result = await pool.query(query, values);
  return result.rows[0] ? mapWardRow(result.rows[0]) : null;
};

const toggleWardStatus = async (id, isActive) => {
  const query = `
    UPDATE wards
    SET
      is_active = $1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `;
  const result = await pool.query(query, [isActive, id]);
  return result.rows[0] ? mapWardRow(result.rows[0]) : null;
};

module.exports = {
  getAllWards,
  getWardById,
  createWard,
  updateWard,
  toggleWardStatus,
};