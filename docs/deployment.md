# Skomma Server — Deployment

## Build the production bundle

```bash
pnpm build
```

`tsup` emits a self-contained CommonJS bundle to `dist/index.js` (with source
maps). Path aliases are resolved at build time.

```bash
pnpm start         # node dist/index.js
```

## Environment checklist

Set these on the deployment target (no `.env` file should be committed):

| Variable           | Production guidance                                          |
| ------------------ | ------------------------------------------------------------ |
| `NODE_ENV`         | `production` (disables the `pino-pretty` transport)          |
| `HOST`             | `0.0.0.0` to bind all interfaces behind a reverse proxy      |
| `PORT`             | e.g. `3000`                                                  |
| `DATABASE_URL`     | MongoDB Atlas or managed instance connection string          |
| `REDIS_URL`        | Managed Redis (Upstash, Redis Cloud, ...)                    |
| `JWT_SECRET`       | Long random secret, kept out of version control              |
| `CORS_ORIGIN`      | The exact desktop/tauri origin, e.g. `http://localhost:1420` |

## Running under a process manager

The server runs as a plain Node process. Use any process manager:

```bash
npm i -g pm2
pm2 start dist/index.js --name skomma-server
pm2 save
```

Or with systemd, point `ExecStart` at `/path/to/skomma_server/dist/index.js`.

## Reverse proxy (optional)

Terminate TLS at a reverse proxy (Caddy, nginx) and proxy to the Node port.
Enable WebSocket upgrade for `/api/v1/chat/ws`:

```nginx
location /api/v1/chat/ws {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

## Production considerations

- **Logging**: in `production` mode pino emits JSON logs to stdout; forward them
  to your log collector.
- **MongoDB indexes**: create indexes on the hot query paths:
  - `products`: `{ shopId: 1 }`, `{ slug: 1 }` (unique), `{ isActive: 1 }`
  - `orders`: `{ userId: 1, createdAt: -1 }`, `{ status: 1 }`
  - `notifications`: `{ userId: 1, read: 1 }`
  - `chat_messages`: `{ channel: 1, sentAt: -1 }`
  - `world_chunks`: `{ x: 1, z: 1 }` (unique)
  - `users`: `{ email: 1 }`, `{ username: 1 }` (both unique)
- **Secrets**: store `JWT_SECRET` and `DATABASE_URL` in your platform's secret
  manager; never in the repo.
- **Scaling**: the API is stateless — add instances behind the proxy as needed.
  Long-running jobs belong in BullMQ workers consuming `delivery`,
  `notifications`, and `analytics` queues.

## Health checks

Use for orchestrator readiness/liveness probes:

```bash
curl http://127.0.0.1:3000/api/v1/health        # liveness + db status
curl http://127.0.0.1:3000/api/v1/health/ready  # readiness
```
