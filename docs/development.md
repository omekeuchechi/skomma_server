# Skomma Server — Development

## Workflow

```bash
pnpm dev           # hot-reloading server on http://127.0.0.1:3000
```

`tsx watch` restarts the process on file changes.

Before pushing changes, run the full gate:

```bash
pnpm typecheck     # strict TypeScript
pnpm lint          # ESLint (flat config)
pnpm format        # Prettier
pnpm build         # tsup production bundle
```

## Adding a new endpoint

1. Pick the domain folder under `src/` (or create a new one, e.g. `src/vendors/`).
2. Create/append to `src/<domain>/routes.ts` as a Fastify plugin:

   ```ts
   import type { FastifyInstance } from 'fastify';
   import { ok } from '@/utils/response';

   export default async function vendorsRoutes(app: FastifyInstance): Promise<void> {
     app.get('/vendors', async (_request, reply) => {
       return ok(reply, [{ name: 'Example' }], 'Vendors');
     });
   }
   ```

3. Register it in `src/routes/index.ts`:

   ```ts
   import vendorsRoutes from '@/vendors/routes';
   // ...
   await app.register(vendorsRoutes);
   ```

4. Protect a route by adding the `requireAuth` preHandler:

   ```ts
   app.get('/vendors/mine', { preHandler: requireAuth }, async (request, reply) => {
     // request.userId is now available
   });
   ```

## Conventions

- **Responses** always go through `ok()` / `fail()` helpers in
  `src/utils/response.ts`. Never return ad-hoc shapes.
- **Input validation** uses `zod` schemas inside the route file. On failure,
  return `fail(reply, message, 400)`.
- **Errors**: throw `new Error(message)` with a `statusCode` property, or use the
  `httpError` helper pattern from `src/auth/service.ts`; the global error handler
  converts them to the standard error body.
- **Database access**: import `db` from `@/database/client` and query the
  collection by its convention name.
- **No secrets in code**: all configuration comes from validated env vars.
- **Path aliases**: use `@/...` (mapped to `src/...` in `tsconfig.json`).

## Manual API testing

Register a user:

```bash
curl -X POST http://127.0.0.1:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@skomma.test","username":"dev","password":"password123","displayName":"Dev"}'
```

Use the returned `accessToken` for protected calls:

```bash
curl http://127.0.0.1:3000/api/v1/users/me \
  -H "Authorization: Bearer <accessToken>"
```

WebSocket echo test (PowerShell):

```powershell
$ws = [System.Net.WebSockets.ClientWebSocket]::new()
$ws.ConnectAsync([Uri]"ws://127.0.0.1:3000/api/v1/chat/ws", [Threading.CancellationToken]::None).Wait()
$buf = [Text.Encoding]::UTF8.GetBytes("hello")
$seg = [ArraySegment[byte]]::new($buf)
$ws.SendAsync($seg, [Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).Wait()
Start-Sleep -Milliseconds 500
$out = [byte[]]::new(512)
$result = $ws.ReceiveAsync([ArraySegment[byte]]::new($out), [Threading.CancellationToken]::None).Result
[Text.Encoding]::UTF8.GetString($out, 0, $result.Count)
```

## Code style

- **Formatting**: Prettier (`.prettierrc.json`, `.prettierignore`).
- **Linting**: ESLint flat config in `eslint.config.mjs` (TS recommended rules).
  Unused variables must start with `_` to be ignored.
- **Imports**: absolute path aliases preferred (`@/domain/routes`).
