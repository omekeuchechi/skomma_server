import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { registerUser, loginUser, refreshTokens } from './service';
import { ok, fail } from '@/utils/response';

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(24),
  password: z.string().min(8).max(72),
  displayName: z.string().min(1).max(60),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

function validationIssues(issues: z.ZodIssue[]): Array<{ field: string; message: string }> {
  return issues.map((issue) => ({
    field: typeof issue.path[0] === 'string' ? issue.path[0] : 'unknown',
    message: issue.message,
  }));
}

export default async function authRoutes(app: FastifyInstance): Promise<void> {
  // Log that app.jwt is available
  // app.log.info('Auth routes registered, JWT available:');

  app.post('/auth/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return fail(reply, 'Invalid registration payload', 400, validationIssues(parsed.error.issues));
    }

    const result = await registerUser(app, parsed.data);
    return ok(reply, result, 'Account created', 201);
  });

  app.post('/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return fail(reply, 'Invalid credentials', 400, validationIssues(parsed.error.issues));
    }

    const result = await loginUser(app, parsed.data);
    return ok(reply, result, 'Authenticated');
  });

  app.post('/auth/refresh', async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return fail(reply, 'Invalid refresh token', 400, validationIssues(parsed.error.issues));
    }

    const result = await refreshTokens(app, parsed.data.refreshToken);
    return ok(reply, result, 'Tokens refreshed');
  });
}
