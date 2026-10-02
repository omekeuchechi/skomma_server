import { ObjectId, type Collection } from 'mongodb';
import { db } from '@/database/client';

export type AssetCategory = 'sprite' | 'tile' | 'item' | 'ui' | 'background' | 'effect';

export interface AssetMetadata {
  width?: number;
  height?: number;
  frameCount?: number;
  animationSpeed?: number;
  // 2D specific properties
  tileSize?: number;
  isAnimated?: boolean;
}

export interface AssetDocument {
  _id?: ObjectId;
  assetId: string;
  category: AssetCategory;
  name: string;
  url: string;
  thumbnailUrl?: string;
  version: number;
  active: boolean;
  metadata: AssetMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAssetInput {
  assetId: string;
  category: AssetCategory;
  name: string;
  url: string;
  thumbnailUrl?: string;
  version?: number;
  active?: boolean;
  metadata?: Partial<AssetMetadata>;
}

export interface AssetResponse {
  assetId: string;
  category: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
  version: number;
}

const assets = (): Collection<AssetDocument> => db.collection<AssetDocument>('assets');

export async function createAssetIndexes(): Promise<void> {
  await assets().createIndex({ assetId: 1 }, { unique: true });
  await assets().createIndex({ category: 1, active: 1 });
}

export async function createAsset(input: CreateAssetInput): Promise<AssetDocument> {
  const now = new Date();
  const doc: AssetDocument = {
    assetId: input.assetId,
    category: input.category,
    name: input.name,
    url: input.url,
    thumbnailUrl: input.thumbnailUrl,
    version: input.version ?? 1,
    active: input.active ?? true,
    metadata: {
      width: 32,
      height: 32,
      frameCount: 1,
      animationSpeed: 1,
      ...input.metadata,
    },
    createdAt: now,
    updatedAt: now,
  };

  const result = await assets().insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

export async function getAssetById(assetId: string): Promise<AssetDocument | null> {
  return assets().findOne({ assetId });
}

export async function getAssetByIdAndCategory(
  assetId: string,
  category: AssetCategory
): Promise<AssetDocument | null> {
  return assets().findOne({ assetId, category });
}

export async function getAssetsByCategory(
  category: AssetCategory,
  activeOnly = true
): Promise<AssetDocument[]> {
  const query = activeOnly ? { category, active: true } : { category };
  return assets().find(query).sort({ createdAt: 1 }).toArray();
}

export async function getAllAssets(activeOnly = true): Promise<AssetDocument[]> {
  const query = activeOnly ? { active: true } : {};
  return assets().find(query).sort({ category: 1, createdAt: 1 }).toArray();
}

export async function updateAsset(
  assetId: string,
  updates: Partial<CreateAssetInput>
): Promise<AssetDocument | null> {
  const result = await assets().findOneAndUpdate(
    { assetId },
    { $set: { ...updates, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  return result;
}

export async function deleteAsset(assetId: string): Promise<boolean> {
  const result = await assets().deleteOne({ assetId });
  return result.deletedCount > 0;
}

export function toAssetResponse(doc: AssetDocument): AssetResponse {
  return {
    assetId: doc.assetId,
    category: doc.category,
    name: doc.name,
    url: doc.url,
    thumbnailUrl: doc.thumbnailUrl,
    version: doc.version,
  };
}

export function toAssetResponseArray(docs: AssetDocument[]): AssetResponse[] {
  return docs.map(toAssetResponse);
}