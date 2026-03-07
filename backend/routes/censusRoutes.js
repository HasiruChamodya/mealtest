const express = require("express");
const router = express.Router();
const censusController = require("../controllers/censusController");
const { requireAuth } = require("../middleware/authMiddleware");

// Retrieve all census records (supports ?date=YYYY-MM-DD & ?wardId=WD1)
router.get("/", requireAuth, censusController.getCensusList);

// Create a new census draft/submission
router.post("/", requireAuth, censusController.createCensus);

// Update an existing census
router.put("/:id", requireAuth, censusController.updateCensus);

// Update the status (e.g., changing from 'draft' to 'submitted' or 'locked')
router.patch("/:id/status", requireAuth, censusController.updateCensusStatus);

module.exports = router;