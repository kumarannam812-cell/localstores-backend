const express = require("express");
const router = express.Router();
const db = require("../db");

// Get notifications for a specific target (all, or specific user/seller)
router.get("/:targetType/:targetId", (req, res) => {
  const { targetType, targetId } = req.params;

  console.log(`🔔 GET NOTIFICATIONS - Type: ${targetType}, ID: ${targetId}`);

  let sql = "SELECT * FROM notifications WHERE (target_type = 'all')";
  const params = [];

  if (targetType === 'user' || targetType === 'seller') {
    sql += " OR (target_type = ? AND target_id = ?)";
    params.push(targetType, targetId);
  }

  sql += " ORDER BY created_at DESC LIMIT 50";

  db.query(sql, params, (err, notifications) => {
    if (err) {
      console.error("❌ Notification Fetch Error:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }
    res.json(notifications || []);
  });
});

// Mark as read
router.post("/mark-read", (req, res) => {
  const { ids } = req.body; // Array of IDs

  if (!ids || !Array.isArray(ids)) {
    return res.status(400).json({ error: "Notification IDs expected" });
  }

  const placeholders = ids.map(() => "?").join(",");
  const sql = `UPDATE notifications SET is_read = 1 WHERE id IN (${placeholders})`;

  db.query(sql, ids, (err) => {
    if (err) {
      console.error("❌ Notification Update Error:", err.sqlMessage);
      return res.status(500).json({ error: err.sqlMessage });
    }
    res.json({ success: true });
  });
});

// Helper function to insert notifications (exported for internal use if needed, but and endpoints are standard)
// Actually we'll just use db.query directly in other routes for simplicity or create a helper module.

module.exports = router;
