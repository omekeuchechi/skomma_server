import { MongoClient, type Db } from 'mongodb';
import { env } from '@/config/env';
import { logger } from '@/utils/logger';

const globalForMongo = globalThis as unknown as { mongoClient?: MongoClient };

export const mongoClient: MongoClient =
  globalForMongo.mongoClient ??
  new MongoClient(env.DATABASE_URL, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
    retryReads: true,
    retryWrites: true,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForMongo.mongoClient = mongoClient;
}

export const db: Db = mongoClient.db();

export type MongoConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting';

let connectionState: MongoConnectionState = 'disconnected';
let connectPromise: Promise<void> | null = null;

function setState(state: MongoConnectionState): void {
  if (connectionState !== state) {
    connectionState = state;
    logger.info({ state }, 'MongoDB connection state changed');
  }
}

export function getConnectionState(): MongoConnectionState {
  return connectionState;
}

export function isConnected(): boolean {
  return connectionState === 'connected';
}

mongoClient.on('topologyOpening', () => {
  setState('connecting');
});

mongoClient.on('topologyClosed', () => {
  setState('disconnected');
});

mongoClient.on('serverHeartbeatSucceeded', () => {
  if (connectionState !== 'connected') {
    setState('connected');
  }
});

mongoClient.on('serverHeartbeatFailed', (event) => {
  logger.warn(
    { failure: event.failure?.message ?? 'unknown' },
    'MongoDB server heartbeat failed',
  );
  if (connectionState === 'connected') {
    setState('reconnecting');
  }
});

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export interface ConnectOptions {
  retries?: number;
  retryDelayMs?: number;
}

export async function connectDatabase(options?: ConnectOptions): Promise<void> {
  if (isConnected()) {
    return;
  }
  if (connectPromise) {
    return connectPromise;
  }

  const maxRetries = options?.retries ?? Number.POSITIVE_INFINITY;
  const baseDelay = options?.retryDelayMs ?? 1000;
  let attempt = 0;

  const attemptConnect = async (): Promise<void> => {
    try {
      setState('connecting');
      await mongoClient.connect();
      setState('connected');
    } catch (error) {
      attempt += 1;
      if (attempt >= maxRetries) {
        throw error;
      }
      const delay = Math.min(baseDelay * 2 ** Math.min(attempt, 6), 30_000);
      logger.warn(
        { attempt, delay },
        `MongoDB connect failed, retrying in ${delay}ms`,
      );
      await sleep(delay);
      await attemptConnect();
    }
  };

  connectPromise = attemptConnect().finally(() => {
    connectPromise = null;
  });

  return connectPromise;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoClient.close();
  setState('disconnected');
}

export default db;
