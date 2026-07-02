const eventService = require('../services/eventService');
const notificationQueue = require('../services/queueWorker');

function handleCreateEvent(req, res) {
  try {
    const { event_type, recipient, data } = req.body || {};

    if (!event_type || !recipient) {
      return res.status(400).json({
        error: 'event_type and recipient are required',
      });
    }

    let result;
    try {
      result = eventService.createEventAndNotification({ event_type, recipient, data });
    } catch (dbErr) {
      console.error('Database insert failure:', dbErr.message);
      return res.status(500).json({ error: 'Internal server error' });
    }

    const { event_id, notification_id, tracking_id, status, channel } = result;

    // Push to the in-memory queue. This is fire-and-forget:
    // the worker processes it asynchronously after we respond.
    try {
      notificationQueue.push({
        event_id,
        notification_id,
        recipient,
        channel,
      });
    } catch (queueErr) {
      // Queue push failure should not fail the already-persisted request,
      // but we log it clearly for visibility.
      console.error('Queue processing failure:', queueErr.message);
    }

    return res.status(202).json({
      message: 'Event accepted for processing',
      tracking_id,
      notification_id,
      status,
    });
  } catch (err) {
    console.error('Unexpected error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  handleCreateEvent,
};
