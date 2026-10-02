# Skomma Server

Backend API for **Skomma**, a 3D virtual commerce platform. The server provides
REST endpoints and a WebSocket channel for authentication, marketplace, inventory,
orders, delivery, payments, notifications, chat, friends, the 3D world, NPCs, and
analytics.

## Tech Stack

| Concern         | Technology                                       |
| --------------- | ------------------------------------------------ |
| Runtime         | Node.js 20+                                      |
| Language        | TypeScript (strict)                              |
| HTTP framework  | Fastify 5                                        |
| Database        | MongoDB (native `mongodb` driver)                |
| Cache / queues  | Redis via `ioredis`, `bullmq` for background jobs |
| Auth            | `@fastify/jwt` (access + refresh tokens)         |
| Validation      | `zod`                                            |
| Logging         | `pino` (+ `pino-pretty` in development)          |
| Build / dev     | `tsup` (build), `tsx` (dev), ESLint, Prettier    |

## Getting Started

Prerequisites: **Node.js 20+**, **pnpm 10+**, a running **MongoDB** instance and a
**Redis** instance.

```bash
pnpm install
cp .env.example .env   # fill in DATABASE_URL, REDIS_URL, JWT_SECRET
pnpm dev              # starts the API on http://127.0.0.1:3000
```

Verify the server responds:

```bash
curl http://127.0.0.1:3000/api/v1/health
```

## Scripts

| Script              | Description                                  |
| ------------------- | -------------------------------------------- |
| `pnpm dev`          | Run with hot reload (`tsx watch`)            |
| `pnpm build`        | Bundle to `dist/` with `tsup`                |
| `pnpm start`        | Run the production bundle (`node dist`)      |
| `pnpm typecheck`    | `tsc --noEmit`                               |
| `pnpm lint`         | ESLint (flat config)                         |
| `pnpm format`       | Prettier write                               |
| `pnpm format:check` | Prettier check                               |
| `pnpm db:ping`      | Verify the MongoDB connection string         |

## API Overview

All routes are mounted under `/api/v1`.

- **Auth** — `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`
- **Users** — `GET /users/me`, `GET /users/:id`
- **Products** — `GET /products`, `GET /products/:id`
- **Marketplace** — `GET /marketplace/listings`, `POST /marketplace/listings`
- **Inventory** — `GET /inventory/me`, `POST /inventory/me/items`
- **Orders** — `GET /orders/me`, `POST /orders`
- **Delivery** — `GET /delivery/:orderId`
- **Payments** — `POST /payments`, `GET /payments/order/:orderId`
- **Notifications** — `GET /notifications/me`, `PATCH /notifications/:id/read`
- **Chat** — `GET /chat/history`, `POST /chat/messages`, `WS /chat/ws`
- **Friends** — `GET /friends/me`, `POST /friends/requests`
- **World** — `GET /world/status`
- **Chunks** — `GET /chunks/:x/:z`
- **NPCs** — `GET /npc/:areaId`
- **Analytics** — `GET /analytics/overview`, `POST /analytics/track`
- **Health** — `GET /health`, `GET /health/ready`

Protected endpoints require the header `Authorization: Bearer <accessToken>`.

## Project Structure

```
skomma_server/
├── docs/                    # architecture, install, dev, deployment guides
├── src/
│   ├── app.ts               # Fastify app assembly
│   ├── index.ts             # entry point (connect DB, start HTTP)
│   ├── config/              # zod-validated environment
│   ├── database/            # MongoClient singleton + helpers
│   ├── redis/               # ioredis client + BullMQ queues
│   ├── plugins/             # cors, jwt, websocket registration
│   ├── middleware/          # requireAuth, errorHandler, notFound
│   ├── routes/              # health + aggregate route registration
│   ├── scripts/             # db:ping helper
│   └── <domain>/            # auth, users, products, marketplace, ...
│       └── routes.ts        # per-domain route plugin
├── .env.example
├── package.json
├── tsconfig.json
└── eslint.config.mjs
```

## Documentation

See the `docs/` folder:

- [Architecture](docs/architecture.md)
- [Installation](docs/installation.md)
- [Development](docs/development.md)
- [Deployment](docs/deployment.md)

## License

Proprietary — part of the Skomma startup project.
