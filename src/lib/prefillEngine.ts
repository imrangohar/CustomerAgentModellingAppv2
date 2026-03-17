import Papa from 'papaparse';
import { keywordToPolicyKey } from '@/lib/prefillMappings';
import { AnswerRecord, SourceRef } from '@/types/policyOnboarding';

export interface UploadParseResult {
  prefilledAnswers: Record<string, AnswerRecord>;
  coa?: {
    accounts: { code: string; name: string; type: string; active: boolean; parentCode?: string }[];
    sourceFile: string;
    importedAt: number;
  };
  costCenters?: {
    items: {
      id: string;
      name: string;
      active: boolean;
      ownerEmail?: string;
      ownerName?: string;
      entity?: string;
    }[];
    sourceFile: string;
    importedAt: number;
  };
  doaRows?: Record<string, unknown>[];
}

const normalize = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function makePrefilled(policyKey: string, value: unknown, confidence: number, source: SourceRef): AnswerRecord {
  return {
    policyKey,
    value,
    status: 'prefilled_needs_confirmation',
    confidence,
    sources: [source],
    lastUpdatedAt: Date.now(),
    history: [],
  };
}

export function parseSopConfigCsv(csvText: string, filename: string): Record<string, AnswerRecord> {
  const out: Record<string, AnswerRecord> = {};
  const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true });
  parsed.data.forEach((row, idx) => {
    const policyKey = (row.policyKey || '').trim();
    if (!policyKey) return;
    const valueType = (row.valueType || row.valuetype || 'text').toLowerCase();
    let parsedValue: unknown = row.value ?? '';
    if (valueType === 'number' || valueType === 'currency' || valueType === 'percent') {
      const n = Number(row.value);
      parsedValue = Number.isFinite(n) ? n : row.value ?? '';
    } else if (valueType === 'multiselect') {
      parsedValue = (row.value || '')
        .split('|')
        .map((v) => v.trim())
        .filter(Boolean);
    } else if (valueType === 'json' || valueType === 'table') {
      try {
        parsedValue = JSON.parse(row.value || '');
      } catch {
        parsedValue = row.value ?? '';
      }
    }

    out[policyKey] = makePrefilled(policyKey, parsedValue, 1, {
      type: 'sop_csv',
      filename,
      rowId: String(idx + 2),
    });
  });
  return out;
}

export function parseCoaCsv(csvText: string, filename: string) {
  const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true });
  return {
    accounts: parsed.data.map((r) => ({
      code: (r.code || '').trim(),
      name: (r.name || '').trim(),
      type: (r.type || 'Expense').trim(),
      active: (r.active || 'true').toLowerCase() !== 'false',
      parentCode: (r.parentCode || r.parent_code || '').trim() || undefined,
    })),
    sourceFile: filename,
    importedAt: Date.now(),
  };
}

export function parseCostCentersCsv(csvText: string, filename: string) {
  const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true });
  return {
    items: parsed.data.map((r) => ({
      id: (r.id || '').trim(),
      name: (r.name || '').trim(),
      active: (r.active || 'true').toLowerCase() !== 'false',
      ownerEmail: (r.ownerEmail || '').trim() || undefined,
      ownerName: (r.ownerName || '').trim() || undefined,
      entity: (r.entity || '').trim() || undefined,
    })),
    sourceFile: filename,
    importedAt: Date.now(),
  };
}

export function parseDoaCsv(csvText: string) {
  const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true });
  return parsed.data;
}

export async function extractDocumentText(file: File): Promise<string> {
  const text = await file.text();
  // Best-effort client-side extraction for prototype. Binary formats are parsed as raw text.
  if (file.name.toLowerCase().endsWith('.pdf') || file.name.toLowerCase().endsWith('.docx')) {
    return text.slice(0, 20000);
  }
  return text;
}

export function inferAnswersFromDocumentText(text: string, filename: string): Record<string, AnswerRecord> {
  const normalized = normalize(text);
  const out: Record<string, AnswerRecord> = {};

  for (const mapping of keywordToPolicyKey) {
    const hit = mapping.keywords.find((kw) => normalized.includes(normalize(kw)));
    if (!hit) continue;

    const snippetIndex = normalized.indexOf(normalize(hit));
    const snippet = text.slice(Math.max(0, snippetIndex - 80), snippetIndex + 180).replace(/\s+/g, ' ').trim();

    out[mapping.policyKey] = makePrefilled(mapping.policyKey, `Suggested from ${filename}: ${hit}`, 0.68, {
      type: 'document_extract',
      filename,
      snippet: snippet || `Matched keyword: ${hit}`,
    });
  }

  return out;
}
