import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '@/middleware/auth';
import {
  createAsset,
  getAssetById,
  getAssetByIdAndCategory,
  getAssetsByCategory,
  getAllAssets,
  updateAsset,
  deleteAsset,
  toAssetResponse,
  toAssetResponseArray,
  AssetCategory,
} from './models';
import { ok, fail } from '@/utils/response';

const assetIdParamsSchema = z.object({
  assetId: z.string().min(1),
});

const categoryParamsSchema = z.object({
  category: z.enum([
    'sprite',
    'tile',
    'item',
    'ui',
    'background',
    'effect',
  ]),
});

const createAssetSchema = z.object({
  assetId: z.string().min(1).max(64),
  category: z.enum([
    'sprite',
    'tile',
    'item',
    'ui',
    'background',
    'effect',
  ]),
  name: z.string().min(1).max(128),
  url: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  version: z.number().int().positive().optional(),
  active: z.boolean().optional(),
  metadata: z
    .object({
      width: z.number().optional(),
      height: z.number().optional(),
      frameCount: z.number().optional(),
      animationSpeed: z.number().optional(),
      tileSize: z.number().optional(),
      isAnimated: z.boolean().optional(),
    })
    .optional(),
});

const updateAssetSchema = createAssetSchema.partial();

function validationIssues(issues: z.ZodIssue[]): Array<{ field: string; message: string }> {
  return issues.map((issue) => ({
    field: typeof issue.path[0] === 'string' ? issue.path[0] : 'unknown',
    message: issue.message,
  }));
}

export default async function assetsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/assets', { preHandler: requireAuth }, async (_request, reply) => {
    const assetsList = await getAllAssets(true);
    return ok(reply, toAssetResponseArray(assetsList), 'All assets');
  });

  app.get(
    '/assets/:category',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = categoryParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return fail(reply, 'Invalid category', 400, validationIssues(parsed.error.issues));
      }

      const assetsList = await getAssetsByCategory(parsed.data.category as AssetCategory, true);
      return ok(reply, toAssetResponseArray(assetsList), `Assets for category ${parsed.data.category}`);
    }
  );

  app.get(
    '/assets/:category/:assetId',
    { preHandler: requireAuth },
    async (request, reply) => {
      const categoryParsed = categoryParamsSchema.safeParse(request.params);
      const assetIdParsed = assetIdParamsSchema.safeParse(request.params);
      if (!categoryParsed.success || !assetIdParsed.success) {
        return fail(reply, 'Invalid parameters', 400);
      }

      const asset = await getAssetByIdAndCategory(
        assetIdParsed.data.assetId,
        categoryParsed.data.category as AssetCategory
      );
      if (!asset) {
        return fail(reply, 'Asset not found', 404);
      }

      return ok(reply, toAssetResponse(asset), 'Asset found');
    }
  );

  app.post('/assets', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = createAssetSchema.safeParse(request.body);
    if (!parsed.success) {
      return fail(reply, 'Invalid asset data', 400, validationIssues(parsed.error.issues));
    }

    const existing = await getAssetById(parsed.data.assetId);
    if (existing) {
      return fail(reply, 'Asset with this ID already exists', 409);
    }

    const asset = await createAsset(parsed.data);
    return ok(reply, toAssetResponse(asset), 'Asset created', 201);
  });

  app.patch(
    '/assets/:assetId',
    { preHandler: requireAuth },
    async (request, reply) => {
      const assetIdParsed = assetIdParamsSchema.safeParse(request.params);
      if (!assetIdParsed.success) {
        return fail(reply, 'Invalid asset ID', 400);
      }

      const parsed = updateAssetSchema.safeParse(request.body);
      if (!parsed.success) {
        return fail(reply, 'Invalid asset data', 400, validationIssues(parsed.error.issues));
      }

      if (parsed.data.assetId && parsed.data.assetId !== assetIdParsed.data.assetId) {
        const existing = await getAssetById(parsed.data.assetId);
        if (existing) {
          return fail(reply, 'Asset with this ID already exists', 409);
        }
      }

      const asset = await updateAsset(assetIdParsed.data.assetId, parsed.data);
      if (!asset) {
        return fail(reply, 'Asset not found', 404);
      }

      return ok(reply, toAssetResponse(asset), 'Asset updated');
    }
  );

  app.delete(
    '/assets/:assetId',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = assetIdParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return fail(reply, 'Invalid asset ID', 400);
      }

      const deleted = await deleteAsset(parsed.data.assetId);
      if (!deleted) {
        return fail(reply, 'Asset not found', 404);
      }

      return ok(reply, null, 'Asset deleted');
    }
  );
}