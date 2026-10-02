import { buildApp } from '@/app';
import { env } from '@/config/env';
import { connectDatabase, disconnectDatabase } from '@/database/client';
import { logger } from '@/utils/logger';

async function main(): Promise<void> {
  await connectDatabase();
  logger.info('Connected to MongoDB');

  const app = await buildApp();
  await app.ready();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, shutting down`);
    await app.close();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ port: env.PORT, host: env.HOST });
}

main().catch((error: unknown) => {
  logger.error(error, 'Failed to start server');
  process.exit(1);
});
