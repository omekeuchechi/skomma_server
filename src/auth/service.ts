import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { ObjectId, type Collection } from 'mongodb';
import { db } from '@/database/client';
import { env } from '@/config/env';

export interface UserDocument {
  _id?: ObjectId;
  email: string;
  username: string;
  passwordHash: string;
  displayName: string;
  avatarUrl?: string;
  walletBalance: number;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
  displayName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

const users = (): Collection<UserDocument> => db.collection<UserDocument>('users');

function httpError(message: string, statusCode: number): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
}

function safeUser(doc: UserDocument): Record<string, unknown> {
  const { _id, passwordHash: _passwordHash, ...rest } = doc;
  return { id: _id ? _id.toHexString() : undefined, ...rest };
}

function createTokens(app: FastifyInstance, userId: string): {
  accessToken: string;
  refreshToken: string;
} {
  const accessToken = app.jwt.sign({ sub: userId }, { expiresIn: env.JWT_EXPIRES_IN });
  const refreshToken = app.jwt.sign({ sub: userId }, { expiresIn: env.JWT_REFRESH_EXPIRES_IN });
  return { accessToken, refreshToken };
}

export async function registerUser(
  app: FastifyInstance,
  input: RegisterInput,
): Promise<{ user: Record<string, unknown> } & ReturnType<typeof createTokens>> {
  const existing = await users().findOne({
    $or: [{ email: input.email.toLowerCase() }, { username: input.username }],
  });
  if (existing) {
    throw httpError('Email or username already in use', 409);
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const now = new Date();
  const doc: UserDocument = {
    email: input.email.toLowerCase(),
    username: input.username,
    passwordHash,
    displayName: input.displayName,
    walletBalance: 0,
    role: 'user',
    createdAt: now,
    updatedAt: now,
  };

  // Insert user first
  const result = await users().insertOne(doc);

  // Try to create tokens
  let tokens: ReturnType<typeof createTokens>;
  try {
    tokens = createTokens(app, result.insertedId.toHexString());
  } catch (error) {
    // Rollback: delete the user if token creation fails
    app.log.error({ err: error }, 'Failed to create tokens, rolling back user creation');
    await users().deleteOne({ _id: result.insertedId });
    throw httpError('Failed to create authentication tokens', 500);
  }

  return { user: safeUser(doc), ...tokens };
}

export async function loginUser(
  app: FastifyInstance,
  input: LoginInput,
): Promise<{ user: Record<string, unknown> } & ReturnType<typeof createTokens>> {
  const doc = await users().findOne({ email: input.email.toLowerCase() });
  if (!doc || !doc._id) {
    throw httpError('Invalid email or password', 401);
  }

  const valid = await bcrypt.compare(input.password, doc.passwordHash);
  if (!valid) {
    throw httpError('Invalid email or password', 401);
  }

  const tokens = createTokens(app, doc._id.toHexString());
  return { user: safeUser(doc), ...tokens };
}

export async function refreshTokens(
  app: FastifyInstance,
  refreshToken: string,
): Promise<ReturnType<typeof createTokens>> {
  try {
    const payload = app.jwt.verify(refreshToken) as { sub: string };
    const doc = await users().findOne({ _id: new ObjectId(payload.sub) });
    if (!doc) {
      throw httpError('User no longer exists', 401);
    }
    return createTokens(app, payload.sub);
  } catch (_error) {
    throw httpError('Invalid refresh token', 401);
  }
}
