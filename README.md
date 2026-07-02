# Event-Driven Notification Dispatcher

A lightweight, asynchronous notification system built with Express.js, Node.js, and SQLite. Business events (e.g. `order_placed`) are accepted over HTTP, persisted immediately, and processed by a background worker without blocking the API response.

## Project Overview

The service exposes a single endpoint, `POST /api/v1/events`, that:

1. Validates the incoming event.
2. Saves the event to the `events` table.
3. Creates a `pending` notification record in the `notifications` table.
4. Pushes a notification task onto an in-memory queue.
5. Immediately returns `202 Accepted` with a tracking ID — **without** waiting for the notification to actually be "sent."
6. A background worker later picks the task off the queue, simulates sending it (500–1000ms delay, 10% simulated failure rate), and updates the notification's status to `completed` or `failed`.

## Tech Stack

| Component        | Choice                                  |
|-------------------|------------------------------------------|
| Backend framework | Express.js                               |
| Runtime           | Node.js (v22.5+)                         |
| Database          | SQLite via the built-in `node:sqlite` module (`DatabaseSync`) |
| Queue mechanism   | In-memory queue built on Node's `EventEmitter` |

> **Note on the SQLite driver:** the assignment listed `sqlite3` / `better-sqlite3` as suggested packages. This project instead uses Node's built-in `node:sqlite` module (stable in recent Node 22.x releases), which gives identical synchronous, transactional behavior with zero native compilation and zero extra dependencies. If you'd rather use `better-sqlite3`, swap it in at `src/db/database.js` — the rest of the app talks to `db.prepare().run()/get()`, so no other file needs to change. `node:sqlite` currently logs an experimental-feature warning on startup; this is expected and harmless.

## Installation

```bash
npm install
cp .env.example .env
```

## Database Setup

No manual setup step is required. On startup, `src/db/database.js` opens (or creates) the SQLite file at the path in `DB_PATH` and runs `src/db/schema.sql`, which creates the `events` and `notifications` tables if they don't already exist.

## Running the Application

```bash
npm start
```

The server starts on the port defined in `.env` (default `3000`):

```
Notification dispatcher listening on port 3000
```

## API Endpoint

### `POST /api/v1/events`

**Request body**

```json
{
  "event_type": "order_placed",
  "recipient": "user@example.com",
  "data": {
    "order_id": 101
  }
}
```

**Success response — `202 Accepted`**

```json
{
  "message": "Event accepted for processing",
  "tracking_id": 1,
  "notification_id": 1,
  "status": "pending"
}
```

**Validation error — `400 Bad Request`** (missing `event_type` or `recipient`, or invalid JSON)

```json
{ "error": "event_type and recipient are required" }
```

**Server error — `500 Internal Server Error`**

```json
{ "error": "Internal server error" }
```

### Example curl request

```bash
curl -X POST http://localhost:3000/api/v1/events \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "order_placed",
    "recipient": "user@example.com",
    "data": { "order_id": 101 }
  }'
```

## How the Asynchronous Queue Works

- `src/services/queueWorker.js` defines `NotificationQueue`, a small class built on Node's `EventEmitter`.
- `push(task)` adds a task to an internal array and emits a `task_pushed` event.
- A single background worker loop (`_processNext`) listens for that event and processes tasks **one at a time**, so it never runs two sends concurrently.
- Each task simulates sending a notification with `setTimeout` (random delay between 500–1000ms) and a 10% random failure rate.
- On completion, the worker updates the notification's `status` to `completed`, or to `failed` (incrementing `retry_count`) if the simulated send fails.
- Because `push()` returns immediately (it only enqueues + emits an event), the controller can respond to the client with `202 Accepted` right away — the actual "sending" happens afterward, off the request/response cycle.

This is intentionally simple and in-process, per the assignment constraints (no Redis/RabbitMQ/Kafka/BullMQ). It's suitable for a single-instance deployment; it is **not** durable across restarts (see Limitations).

## Project Structure

```
project-root/
├── src/
│   ├── app.js                     # Express app, middleware, error handlers
│   ├── server.js                  # Entry point
│   ├── controllers/
│   │   └── eventController.js     # Request validation + orchestration
│   ├── services/
│   │   ├── eventService.js        # Event + notification persistence
│   │   ├── notificationService.js # Status update helpers
│   │   └── queueWorker.js         # In-memory queue + background worker
│   ├── db/
│   │   ├── database.js            # SQLite connection + schema bootstrap
│   │   └── schema.sql
│   └── routes/
│       └── eventRoutes.js
├── architecture-diagram.png
├── package.json
├── README.md
└── .env.example
```

## Assumptions & Limitations

- **In-memory queue is not durable.** If the process restarts while tasks are queued, those pending tasks are lost (though their `notifications` rows remain `pending` in the DB and could be re-queued on boot in a future iteration).
- **Single-process only.** The queue lives in the Node process's memory, so this design does not horizontally scale across multiple instances without a shared external queue.
- **Notification "sending" is simulated.** No real email/SMS provider is integrated; `setTimeout` + a random failure flag stands in for that call, per the assignment spec.
- **`retry_count` is incremented but not automatically retried.** The assignment asked for the count to be tracked on failure; automatic re-queueing on failure was not in scope but would be a natural next step.
- **`channel` defaults to `"email"`** for every notification, as specified.
- **better-sqlite3 alternative:** if your evaluation environment specifically requires the `better-sqlite3` package rather than `node:sqlite`, it's a drop-in swap in `src/db/database.js`.
