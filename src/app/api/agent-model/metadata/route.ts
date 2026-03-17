import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { AGENT_MODEL_REQUIRED_COLS, type AgentModelMetadata } from '@/lib/agentModel';

const KV_KEY = 'agent-model:metadata:v1';

declare global {
  // eslint-disable-next-line no-var
  var __agentModelMetadataFallback: AgentModelMetadata | undefined;
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

async function readMetadata(): Promise<{ data: AgentModelMetadata | null; source: 'kv' | 'memory' | 'none' }> {
  try {
    const value = await kv.get<AgentModelMetadata>(KV_KEY);
    if (value && validatePayload(value)) {
      return { data: value, source: 'kv' };
    }
  } catch {
    // fallback below
  }

  if (globalThis.__agentModelMetadataFallback && validatePayload(globalThis.__agentModelMetadataFallback)) {
    return { data: globalThis.__agentModelMetadataFallback, source: 'memory' };
  }

  return { data: null, source: 'none' };
}

async function writeMetadata(payload: AgentModelMetadata): Promise<'kv' | 'memory'> {
  try {
    await kv.set(KV_KEY, payload);
    return 'kv';
  } catch {
    globalThis.__agentModelMetadataFallback = payload;
    return 'memory';
  }
}

async function clearMetadata(): Promise<'kv' | 'memory'> {
  try {
    await kv.del(KV_KEY);
    delete globalThis.__agentModelMetadataFallback;
    return 'kv';
  } catch {
    delete globalThis.__agentModelMetadataFallback;
    return 'memory';
  }
}

export async function GET() {
  const result = await readMetadata();
  return NextResponse.json({ ok: true, source: result.source, metadata: result.data });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!validatePayload(body)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Invalid metadata payload. Ensure file includes required columns and rows in normalized schema format.',
        },
        { status: 400 }
      );
    }

    const source = await writeMetadata(body);
    return NextResponse.json({ ok: true, source });
  } catch {
    return NextResponse.json({ ok: false, error: 'Unable to save metadata payload.' }, { status: 500 });
  }
}

export async function DELETE() {
  const source = await clearMetadata();
  return NextResponse.json({ ok: true, source });
}
