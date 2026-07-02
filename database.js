const db = require('../db/database');

const DEFAULT_CHANNEL = 'email';

/**
 * Persists an incoming event and creates a pending notification record
 * inside a single transaction so both succeed or both fail together.
 */
function createEventAndNotification({ event_type, recipient, data }) {
  const payload = JSON.stringify(data || {});

  const insertEvent = db.prepare(
    `INSERT INTO events (event_type, payload) VALUES (?, ?)`
  );
  const insertNotification = db.prepare(
    `INSERT INTO notifications (event_id, recipient, channel, status, retry_count)
     VALUES (?, ?, ?, 'pending', 0)`
  );

  const runTransaction = db.transaction((eventType, recipientVal, payloadVal) => {
    const eventResult = insertEvent.run(eventType, payloadVal);
    const event_id = eventResult.lastInsertRowid;

    const notificationResult = insertNotification.run(event_id, recipientVal, DEFAULT_CHANNEL);
    const notification_id = notificationResult.lastInsertRowid;

    return { event_id, notification_id };
  });

  const { event_id, notification_id } = runTransaction(event_type, recipient, payload);

  return {
    event_id,
    notification_id,
    tracking_id: notification_id,
    status: 'pending',
    channel: DEFAULT_CHANNEL,
  };
}

module.exports = {
  createEventAndNotification,
};
