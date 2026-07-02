const EventEmitter = require('events');
const notificationService = require('./notificationService');

/**
 * Simple in-memory queue built on Node's EventEmitter.
 * push() enqueues a notification task; the worker processes
 * tasks sequentially in the background, decoupled from the HTTP request.
 */
class NotificationQueue extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
    this.isProcessing = false;

    // Whenever a task is pushed, try to kick off processing.
    this.on('task_pushed', () => this._processNext());
  }

  push(task) {
    this.queue.push(task);
    this.emit('task_pushed');
  }

  async _processNext() {
    if (this.isProcessing) return; // avoid overlapping workers
    if (this.queue.length === 0) return;

    this.isProcessing = true;
    const task = this.queue.shift();

    try {
      await this._simulateSend(task);
    } catch (err) {
      console.error('Unexpected worker error:', err.message);
    } finally {
      this.isProcessing = false;
      // If more tasks arrived while we were processing, continue.
      if (this.queue.length > 0) {
        this._processNext();
      }
    }
  }

  _simulateSend(task) {
    const { notification_id, recipient, channel } = task;
    const delay = Math.floor(Math.random() * (1000 - 500 + 1)) + 500; // 500-1000ms
    const FAILURE_RATE = 0.1; // 10%

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
          // Notification update failure - log and move on so the worker keeps running.
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
