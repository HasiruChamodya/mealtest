const express = require("express");
const router = express.Router();

const {
  getWards,
  getWardById,
  createWard,
  updateWard,
  toggleWardStatus,
  deleteWard,
} = require("../controllers/wardsController");

// You can protect these with authMiddleware if needed
// const { authenticateToken } = require("../middleware/authMiddleware");
// router.use(authenticateToken);

router.get("/", getWards);
router.get("/:id", getWardById);
router.post("/", createWard);
router.put("/:id", updateWard);
router.patch("/:id/toggle", toggleWardStatus);
router.delete("/:id", deleteWard);

module.exports = router;