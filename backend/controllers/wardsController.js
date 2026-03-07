const pool = require("../config/db");
const { writeAudit } = require("../utils/audit");

/* ================= GET ALL WARDS ================= */
exports.getWards = async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, ward_name, bed_count, cot_count, active, created_at
       FROM wards
       ORDER BY id DESC`
    );

    await writeAudit({
      req,
      module: "WARDS",
      action: "GET_WARDS",
      entity: "ward",
      success: true,
      status_code: 200,
      duration_ms: req._duration_ms,
      details: { count: r.rowCount },
    });

    res.json({ wards: r.rows });
  } catch (err) {
    console.error(err);

    await writeAudit({
      req,
      module: "WARDS",
      action: "GET_WARDS_FAILED",
      entity: "ward",
      success: false,
      status_code: 500,
      duration_ms: req._duration_ms,
      details: { error: err.message },
    });

    res.status(500).json({ message: "Failed to fetch wards" });
  }
};

/* ================= GET SINGLE WARD ================= */
exports.getWardById = async (req, res) => {
  try {
    const { id } = req.params;

    const r = await pool.query(
      `SELECT id, ward_name, bed_count, cot_count, active
       FROM wards
       WHERE id = $1`,
      [id]
    );

    if (r.rowCount === 0) {
      await writeAudit({
        req,
        module: "WARDS",
        action: "GET_WARD_NOT_FOUND",
        entity: "ward",
        entity_id: id,
        success: false,
        status_code: 404,
      });

      return res.status(404).json({ message: "Ward not found" });
    }

    await writeAudit({
      req,
      module: "WARDS",
      action: "GET_WARD",
      entity: "ward",
      entity_id: id,
      success: true,
      status_code: 200,
    });

    res.json({ ward: r.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error retrieving ward" });
  }
};

/* ================= CREATE WARD ================= */
exports.createWard = async (req, res) => {
  try {
    const { ward_name, bed_count = 0, cot_count = 0 } = req.body;

    if (!ward_name?.trim()) {
      await writeAudit({
        req,
        module: "WARDS",
        action: "CREATE_WARD_FAILED",
        entity: "ward",
        success: false,
        status_code: 400,
        details: { reason: "ward_name_required" },
      });

      return res.status(400).json({ message: "ward_name is required" });
    }

    const r = await pool.query(
      `INSERT INTO wards (ward_name, bed_count, cot_count, active)
       VALUES ($1,$2,$3,true)
       RETURNING id, ward_name, bed_count, cot_count, active`,
      [ward_name.trim(), Number(bed_count), Number(cot_count)]
    );

    await writeAudit({
      req,
      module: "WARDS",
      action: "CREATE_WARD",
      entity: "ward",
      entity_id: r.rows[0].id,
      success: true,
      status_code: 201,
      details: r.rows[0],
    });

    res.status(201).json({ ward: r.rows[0] });
  } catch (err) {
    console.error(err);

    await writeAudit({
      req,
      module: "WARDS",
      action: "CREATE_WARD_FAILED",
      entity: "ward",
      success: false,
      status_code: 500,
      details: { error: err.message },
    });

    res.status(500).json({ message: "Failed to create ward" });
  }
};

/* ================= UPDATE WARD ================= */
exports.updateWard = async (req, res) => {
  try {
    const { id } = req.params;
    const { ward_name, bed_count, cot_count } = req.body;

    const r = await pool.query(
      `UPDATE wards
       SET ward_name=$1,
           bed_count=$2,
           cot_count=$3,
           updated_at=NOW()
       WHERE id=$4
       RETURNING id, ward_name, bed_count, cot_count, active`,
      [ward_name, bed_count, cot_count, id]
    );

    if (r.rowCount === 0) {
      return res.status(404).json({ message: "Ward not found" });
    }

    await writeAudit({
      req,
      module: "WARDS",
      action: "UPDATE_WARD",
      entity: "ward",
      entity_id: id,
      success: true,
      status_code: 200,
      details: r.rows[0],
    });

    res.json({ ward: r.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update ward" });
  }
};

/* ================= TOGGLE ACTIVE ================= */
exports.toggleWardStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const r = await pool.query(
      `UPDATE wards
       SET active = NOT active,
           updated_at = NOW()
       WHERE id=$1
       RETURNING id, ward_name, active`,
      [id]
    );

    if (r.rowCount === 0) {
      return res.status(404).json({ message: "Ward not found" });
    }

    await writeAudit({
      req,
      module: "WARDS",
      action: "TOGGLE_WARD_STATUS",
      entity: "ward",
      entity_id: id,
      success: true,
      status_code: 200,
      details: r.rows[0],
    });

    res.json({ ward: r.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to change status" });
  }
};

/* ================= DELETE WARD ================= */
exports.deleteWard = async (req, res) => {
  try {
    const { id } = req.params;

    const r = await pool.query(
      `DELETE FROM wards WHERE id=$1 RETURNING id`,
      [id]
    );

    if (r.rowCount === 0) {
      return res.status(404).json({ message: "Ward not found" });
    }

    await writeAudit({
      req,
      module: "WARDS",
      action: "DELETE_WARD",
      entity: "ward",
      entity_id: id,
      success: true,
      status_code: 200,
    });

    res.json({ message: "Ward deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete ward" });
  }
};