const EventEmitter = require('events');
const notificationService = require('./notificationService');

class NotificationQueue extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
    this.isProcessing = false;

    this.on('task_pushed', () => this._processNext());
  }

  push(task) {
    this.queue.push(task);
    this.emit('task_pushed');
  }

  async _processNext() {
    if (this.isProcessing) return;
    if (this.queue.length === 0) return;

    this.isProcessing = true;
    const task = this.queue.shift();

    try {
      await this._simulateSend(task);
    } catch (err) {
      console.error('Unexpected worker error:', err.message);
    } finally {
      this.isProcessing = false;
      if (this.queue.length > 0) {
        this._processNext();
      }
    }
  }

  _simulateSend(task) {
    const { notification_id, recipient, channel } = task;
    const delay = Math.floor(Math.random() * (1000 - 500 + 1)) + 500;
    const FAILURE_RATE = 0.1;

    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          const failed = Math.random() < FAILURE_RATE;

          if (failed) {
            notificationService.markFailed(notification_id);
            console.log(
              `[worker] notification_id=${notification_id} channel=${channel} to=${recipient} -> FAILED`
            );
          } else {
            notificationService.markCompleted(notification_id);
            console.log(
              `[worker] notification_id=${notification_id} channel=${channel} to=${recipient} -> COMPLETED`
            );
          }
        } catch (err) {
          console.error(`[worker] failed to update notification ${notification_id}:`, err.message);
        } finally {
          resolve();
        }
      }, delay);
    });
  }
}

const notificationQueue = new NotificationQueue();

module.exports = notificationQueue;
