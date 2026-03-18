import { NextResponse } from 'next/server';
import { AGENT_MODEL_REQUIRED_COLS, type AgentModelMetadata, type AgentModelRow } from '@/lib/agentModel';

const KV_KEY = 'agent-model:metadata:v1';

declare global {
  // eslint-disable-next-line no-var
  var __agentModelMetadataFallback: AgentModelMetadata | undefined;
  // eslint-disable-next-line no-var
  var __agentModelStaging: AgentModelMetadata | undefined;
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

async function readMetadata(): Promise<{ data: AgentModelMetadata | null; source: 'kv' | 'memory' | 'none' }> {
  try {
    const kv = await getKv();
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
    const kv = await getKv();
    await kv.set(KV_KEY, payload);
    return 'kv';
  } catch {
    globalThis.__agentModelMetadataFallback = payload;
    return 'memory';
  }
}

async function clearMetadata(): Promise<'kv' | 'memory'> {
  try {
    const kv = await getKv();
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
    const text = await req.text();
    const body = JSON.parse(text) as {
      _phase?: 'init' | 'append' | 'finalize';
      rows?: AgentModelRow[];
    } & Partial<AgentModelMetadata>;

    // ── Chunked: append more rows to staging ──────────────────────────────
    if (body._phase === 'append') {
      if (!globalThis.__agentModelStaging) {
        return NextResponse.json({ ok: false, error: 'No active upload session. Send init first.' }, { status: 400 });
      }
      if (Array.isArray(body.rows)) {
        globalThis.__agentModelStaging.rows.push(...body.rows);
      }
      return NextResponse.json({ ok: true, pending: globalThis.__agentModelStaging.rows.length });
    }

    // ── Chunked: finalize staging → permanent storage ─────────────────────
    if (body._phase === 'finalize') {
      const staged = globalThis.__agentModelStaging;
      if (!staged) {
        return NextResponse.json({ ok: false, error: 'No active upload session to finalize.' }, { status: 400 });
      }
      delete globalThis.__agentModelStaging;
      if (!validatePayload(staged)) {
        return NextResponse.json({ ok: false, error: 'Assembled payload failed validation.' }, { status: 400 });
      }
      const source = await writeMetadata(staged);
      return NextResponse.json({ ok: true, source });
    }

    // ── Chunked: init — store first chunk in staging ───────────────────────
    if (body._phase === 'init') {
      const { _phase: _, ...rest } = body;
      globalThis.__agentModelStaging = {
        version: 1,
        filename: rest.filename ?? '',
        savedAt: rest.savedAt ?? Date.now(),
        sheetName: rest.sheetName ?? '',
        rows: Array.isArray(rest.rows) ? [...rest.rows] : [],
      };
      return NextResponse.json({ ok: true, pending: globalThis.__agentModelStaging.rows.length });
    }

    // ── Single-shot (small payload) ────────────────────────────────────────
    if (!validatePayload(body)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid metadata payload. Ensure file includes required columns.' },
        { status: 400 }
      );
    }
    const source = await writeMetadata(body as AgentModelMetadata);
    return NextResponse.json({ ok: true, source });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[agent-model/metadata POST]', message);
    return NextResponse.json({ ok: false, error: `Upload failed: ${message}` }, { status: 500 });
  }
}

export async function DELETE() {
  const source = await clearMetadata();
  return NextResponse.json({ ok: true, source });
}
