import Redis from 'ioredis';
import { env } from '@/config/env';

export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on('error', (error) => {
  console.warn('Redis connection error (server continues):', error.message);
});

export default redis;
