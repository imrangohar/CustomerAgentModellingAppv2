'use server';

import { type AgentModelMetadata, AGENT_MODEL_REQUIRED_COLS } from '@/lib/agentModel';

const KV_KEY = 'agent-model:metadata:v1';

declare global {
  // eslint-disable-next-line no-var
  var __agentModelMetadataFallback: AgentModelMetadata | undefined;
}

async function getKv() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    throw new Error('KV not configured');
  }
  const { kv } = await import('@vercel/kv');
  return kv;
}

function isRowLike(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasRequiredColumns(rows: unknown[]): boolean {
  if (!rows.length || !isRowLike(rows[0])) return false;
  const first = rows[0] as Record<string, unknown>;
  return AGENT_MODEL_REQUIRED_COLS.every((col) => col in first);
}

function validatePayload(payload: unknown): payload is AgentModelMetadata {
  if (!payload || typeof payload !== 'object') return false;
  const candidate = payload as Partial<AgentModelMetadata>;
  if (!Array.isArray(candidate.rows) || !hasRequiredColumns(candidate.rows)) return false;
  if (typeof candidate.filename !== 'string' || typeof candidate.sheetName !== 'string') return false;
  if (typeof candidate.savedAt !== 'number') return false;
  return true;
}

export async function saveMetadataAction(
  metadata: AgentModelMetadata
): Promise<{ ok: boolean; source?: 'kv' | 'memory'; error?: string }> {
  if (!validatePayload(metadata)) {
    return { ok: false, error: 'Invalid metadata payload. Ensure file includes required columns.' };
  }

  try {
    const kv = await getKv();
    await kv.set(KV_KEY, metadata);
    return { ok: true, source: 'kv' };
  } catch {
    // KV not configured — use in-memory fallback
    globalThis.__agentModelMetadataFallback = metadata;
    return { ok: true, source: 'memory' };
  }
}
