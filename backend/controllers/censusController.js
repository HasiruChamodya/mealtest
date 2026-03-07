const censusModel = require("../models/CensusModel");
const { writeAudit } = require("../utils/audit");

// GET /api/census
exports.getCensusList = async (req, res) => {
  try {
    const { date, wardId } = req.query;
    const censusData = await censusModel.getAllCensus(date, wardId);

    await writeAudit({
      req,
      action: "GET_CENSUS",
      entity: "ward_census",
      details: { count: censusData.length, filters: { date, wardId } },
      severity: "info",
      status_code: 200,
      success: true,
    });

    res.status(200).json({ census: censusData });
  } catch (error) {
    console.error("GET CENSUS ERROR:", error);

    await writeAudit({
      req,
      action: "GET_CENSUS",
      entity: "ward_census",
      details: { error: error.message },
      severity: "warning",
      status_code: 500,
      success: false,
    });

    res.status(500).json({ message: "Failed to fetch census data" });
  }
};

// POST /api/census
exports.createCensus = async (req, res) => {
  try {
    const { wardId, date, diets, staff, special, extras, customExtras, status, totalPatients } = req.body;

    if (!wardId || !date) {
      await writeAudit({
        req,
        action: "CREATE_CENSUS",
        entity: "ward_census",
        details: { error: "wardId and date are required" },
        severity: "warning",
        status_code: 400,
        success: false,
      });

      return res.status(400).json({ message: "wardId and date are required" });
    }

    const newCensus = await censusModel.createCensus({
      wardId, date, diets, staff, special, extras, customExtras, status, totalPatients
    });

    await writeAudit({
      req,
      action: "CREATE_CENSUS",
      entity: "ward_census",
      entity_id: String(newCensus.id),
      new_value: newCensus,
      details: { message: "Census created successfully", wardId, date },
      severity: "info",
      status_code: 201,
      success: true,
    });

    res.status(201).json({
      message: "Census created successfully",
      census: newCensus,
    });
  } catch (error) {
    console.error("CREATE CENSUS ERROR:", error);

    await writeAudit({
      req,
      action: "CREATE_CENSUS",
      entity: "ward_census",
      details: { error: error.message, wardId: req.body?.wardId || null },
      severity: "error",
      status_code: error.code === "23505" ? 409 : 500,
      success: false,
    });

    if (error.code === "23505") {
      return res.status(409).json({ message: "Census for this ward and date already exists" });
    }

    res.status(500).json({ message: "Failed to create census" });
  }
};

// PUT /api/census/:id
exports.updateCensus = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const oldCensus = await censusModel.getCensusById(id);

    if (!oldCensus) {
      await writeAudit({
        req,
        action: "UPDATE_CENSUS",
        entity: "ward_census",
        entity_id: String(id),
        details: { error: "Census record not found" },
        severity: "warning",
        status_code: 404,
        success: false,
      });

      return res.status(404).json({ message: "Census not found" });
    }

    if (oldCensus.status === 'locked') {
        return res.status(403).json({ message: "Cannot edit a locked census" });
    }

    const updatedCensus = await censusModel.updateCensus(id, data);

    await writeAudit({
      req,
      action: "UPDATE_CENSUS",
      entity: "ward_census",
      entity_id: String(id),
      old_value: oldCensus,
      new_value: updatedCensus,
      details: { message: "Census updated successfully" },
      severity: "info",
      status_code: 200,
      success: true,
    });

    res.status(200).json({
      message: "Census updated successfully",
      census: updatedCensus,
    });
  } catch (error) {
    console.error("UPDATE CENSUS ERROR:", error);

    await writeAudit({
      req,
      action: "UPDATE_CENSUS",
      entity: "ward_census",
      entity_id: String(req.params?.id),
      details: { error: error.message },
      severity: "error",
      status_code: 500,
      success: false,
    });

    res.status(500).json({ message: "Failed to update census" });
  }
};

// PATCH /api/census/:id/status
exports.updateCensusStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["draft", "submitted", "locked"];
    if (!validStatuses.includes(status)) {
      await writeAudit({
        req,
        action: "CHANGE_CENSUS_STATUS",
        entity: "ward_census",
        entity_id: String(id),
        details: { error: "Invalid status value", received: status },
        severity: "warning",
        status_code: 400,
        success: false,
      });

      return res.status(400).json({ message: "Invalid status value" });
    }

    const oldCensus = await censusModel.getCensusById(id);

    if (!oldCensus) {
      return res.status(404).json({ message: "Census not found" });
    }

    const updatedCensus = await censusModel.updateCensusStatus(id, status);

    await writeAudit({
      req,
      action: "CHANGE_CENSUS_STATUS",
      entity: "ward_census",
      entity_id: String(id),
      old_value: { status: oldCensus.status },
      new_value: { status: updatedCensus.status },
      details: { message: `Census status changed to ${status}` },
      severity: "info",
      status_code: 200,
      success: true,
    });

    res.status(200).json({
      message: "Census status updated successfully",
      census: updatedCensus,
    });
  } catch (error) {
    console.error("TOGGLE CENSUS STATUS ERROR:", error);

    await writeAudit({
      req,
      action: "CHANGE_CENSUS_STATUS",
      entity: "ward_census",
      entity_id: String(req.params?.id),
      details: { error: error.message },
      severity: "error",
      status_code: 500,
      success: false,
    });

    res.status(500).json({ message: "Failed to update census status" });
  }
};