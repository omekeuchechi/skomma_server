# Skomma Server — Architecture

## Overview

Skomma is a 3D virtual commerce platform. Users sign in, walk a 3D world rendered
by the desktop client, browse shops and products, place orders, and manage
deliveries. The server exposes a REST API consumed by the desktop app and a
WebSocket channel for real-time chat.

```
┌─────────────────┐   HTTPS / WS    ┌──────────────────────────────┐
│ skomma_desktop  │ ──────────────► │        skomma_server         │
│ (Tauri + React  │                 │  Fastify app (port 3000)     │
│  + Babylon.js)  │ ◄────────────── │  ├─ REST routes (/api/v1)    │
└─────────────────┘                 │  └─ WebSocket (/chat/ws)     │
                                    └──────┬───────────────┬───────┘
                                           │               │
                                   ┌───────▼────┐   ┌──────▼─────┐
                                   │  MongoDB   │   │   Redis    │
                                   │ (data)     │   │ (queues)   │
                                   └────────────┘   └────────────┘
```

## Components

### 1. HTTP Layer (Fastify)

- `src/app.ts` assembles the Fastify instance: logger, CORS, JWT, WebSocket
  support, the global error handler, the 404 handler, and route registration.
- Every response follows a consistent shape:

  ```json
  { "status": "success", "message": "...", "data": { ... } }
  ```

  or on error:

  ```json
  { "status": "error", "message": "...", "statusCode": 400 }
  ```

- Route plugins live in per-domain folders (`auth/`, `orders/`, ...) and are
  aggregated in `src/routes/index.ts`. Each route file is a Fastify plugin
  registering routes for its domain.

### 2. Data Layer (MongoDB)

MongoDB is accessed directly through the native `mongodb` driver — no ORM.
- `src/database/client.ts` exports a lazily-created, hot-reload-safe
  `MongoClient` singleton and a `Db` handle derived from the connection string.
- There is no fixed schema; domain routes query collections by convention:
  `users`, `shops`, `categories`, `products`, `inventories`, `orders`,
  `addresses`, `carts`, `payments`, `deliveries`, `notifications`,
  `chat_messages`, `friends`, `world_chunks`, `npcs`, `player_states`,
  `analytics_events`.
- Cross-document references are MongoDB `ObjectId` values.

### 3. Cache & Background Jobs (Redis)

- `src/redis/client.ts` exposes an `ioredis` client with `lazyConnect: true` so
  the API starts even when Redis is temporarily down.
- `src/redis/queues.ts` defines BullMQ queues: `delivery`, `notifications`, and
  `analytics`. Workers can be attached later to consume jobs.

### 4. Authentication

- `src/plugins/jwt.ts` registers `@fastify/jwt` with the secret from config.
- `src/middleware/auth.ts` (`requireAuth`) verifies the Bearer token and stamps
  `request.userId`.
- Access tokens are short-lived (`JWT_EXPIRES_IN`, default `15m`); refresh
  tokens are longer-lived (`JWT_REFRESH_EXPIRES_IN`, default `30d`) and can be
  exchanged via `POST /auth/refresh`.
- Passwords are hashed with `bcryptjs` (10 rounds).

### 5. Configuration

- `src/config/env.ts` validates `process.env` with `zod` at startup and fails
  fast with a clear message. See `.env.example` for all variables.

### 6. Error Handling

- `src/middleware/errorHandler.ts` maps thrown `{ message, statusCode }` errors
  (and any unknown error) to the standard error body.
- `src/middleware/notFound.ts` returns a 404 for unknown routes.

## Data Flow Examples

**Register:** `POST /api/v1/auth/register`
1. Request body is validated with `zod` in `auth/routes.ts`.
2. `auth/service.ts` checks for duplicate email/username.
3. Password is hashed and the user document is inserted into `users`.
4. Access + refresh tokens are signed and returned.

**Create order:** `POST /api/v1/orders`
1. `requireAuth` resolves `request.userId`.
2. Lines are validated, the total is computed, and an order is inserted.
3. A matching `delivery` document is created with status `pending`.

## Scaling Notes

- Stateless HTTP API: horizontal scaling only needs shared MongoDB/Redis.
- Long-running work should move to BullMQ workers (queues already defined).
- Chat is currently an echo WebSocket; a pub/sub fan-out via Redis can replace
  it when multiple server instances are deployed.
