# Skomma Server — Installation

## Prerequisites

| Tool       | Minimum        | Purpose                          |
| ---------- | -------------- | -------------------------------- |
| Node.js    | 20.x           | Runtime                          |
| pnpm       | 10.x           | Package manager                  |
| MongoDB    | 6.x            | Primary database                 |
| Redis      | 6.x            | Queues / caching                 |

Check your versions:

```bash
node --version   # v20.x or newer
pnpm --version   # 10.x or newer
mongod --version
redis-server --version
```

## 1. Install dependencies

```bash
cd skomma_server
pnpm install
```

The project pins a few postinstall scripts (esbuild used by `tsup`/`tsx`, and
`msgpackr-extract` used by BullMQ). They are approved via `allowBuilds` in
`pnpm-workspace.yaml` and run automatically.

## 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` at minimum for these values:

| Variable                | Example                                            | Notes                          |
| ----------------------- | -------------------------------------------------- | ------------------------------ |
| `DATABASE_URL`          | `mongodb://127.0.0.1:27017/skomma`                 | MongoDB connection string      |
| `REDIS_URL`             | `redis://127.0.0.1:6379`                           | Redis connection string        |
| `JWT_SECRET`            | a long random string (≥ 16 chars)                  | Used to sign tokens            |
| `PORT`                  | `3000`                                             | HTTP port                      |
| `CORS_ORIGIN`           | `*` or `http://localhost:1420`                     | Comma-separated origins        |

Generate a strong secret on macOS/Linux/WSL:

```bash
openssl rand -hex 32
```

On Windows PowerShell:

```powershell
[System.Security.Cryptography.RandomNumberGenerator]::GetHexString(32)
```

## 3. Verify database connectivity

```bash
pnpm db:ping
```

Expected output: `MongoDB ping ok: {"ok":1}`.

## 4. Run the server

```bash
pnpm dev
```

The API listens on `http://127.0.0.1:3000`. Confirm:

```bash
curl http://127.0.0.1:3000/api/v1/health
```

## Troubleshooting

- **`Invalid environment variables`** at startup — check `.env`; `DATABASE_URL`
  and `JWT_SECRET` are required.
- **`querySrv ECONNREFUSED _mongodb._tcp.<cluster>.mongodb.net`** — Node's DNS
  resolver (c-ares) is failing the SRV lookup for a `mongodb+srv://` Atlas URL,
  even though `nslookup`/`Resolve-DnsName` resolve it fine (usually because Node
  picks a broken DNS server from the adapter list, e.g. router/virtual adapters).
  Fix: bypass SRV with a direct connection string:
  1. Resolve the SRV + TXT records:
     `Resolve-DnsName _mongodb._tcp.<cluster>.mongodb.net -Type SRV` and
     `Resolve-DnsName <cluster>.mongodb.net -Type TXT` (TXT gives `replicaSet=`).
  2. Build the direct URL:
     `mongodb://<user>:<password>@<host00>:27017,<host01>:27017,<host02>:27017/<db>?authSource=admin&replicaSet=<replicaSet>&tls=true&retryWrites=true`
  3. Put it in `DATABASE_URL` and run `pnpm db:ping` to confirm.
- **`MongoDB ping failed`** — MongoDB is not reachable at `DATABASE_URL`. Verify
  the instance is running and the connection string is correct.
- **Redis down but API up** — expected. The server logs a warning and continues;
  queue-based features will only work once Redis is reachable.
- **pnpm postinstall not running** — run `pnpm install` again; build scripts are
  controlled by `allowBuilds` in `pnpm-workspace.yaml`.
