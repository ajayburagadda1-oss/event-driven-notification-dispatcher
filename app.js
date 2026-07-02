const db = require('../db/database');

function markCompleted(notification_id) {
  const stmt = db.prepare(
    `UPDATE notifications SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  );
  return stmt.run(notification_id);
}

function markFailed(notification_id) {
  const stmt = db.prepare(
    `UPDATE notifications SET status = 'failed', retry_count = retry_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  );
  return stmt.run(notification_id);
}

function getNotificationById(notification_id) {
  const stmt = db.prepare(`SELECT * FROM notifications WHERE id = ?`);
  return stmt.get(notification_id);
}

module.exports = {
  markCompleted,
  markFailed,
  getNotificationById,
};
