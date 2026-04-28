import type { NextRequest } from 'next/server';

type PdfParseFn = (buffer: Buffer) => Promise<{ text: string; numpages: number }>;

// pdf-parse is CommonJS — use require() to avoid ESM/Turbopack interop issues
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse: PdfParseFn = require('pdf-parse');

export interface BlueprintRow {
  workPack: string;
  complianceArea: string;
  highRiskLines: number;
  approvedPct: number;
  rejectedPct: number;
  agentCoveragePct: number;
}

export interface BlueprintData {
  customer: string;
  analysisPeriod: string;
  reportDate: string;
  totalExpenseLines: number;
  approvedByAuditors: number;
  rejectedByAuditors: number;
  agentsReadyToDeploy: BlueprintRow[];
  sopRequireModification: BlueprintRow[];
  sopRequireCreation: BlueprintRow[];
  filename: string;
  savedAt: number;
}

declare const globalThis: { __blueprintData?: BlueprintData | null };

// ── PDF text parser ──────────────────────────────────────────────────────────

function extractBetween(lines: string[], startMarker: string, endMarkers: string[]): string[] {
  const startIdx = lines.findIndex(l => l.includes(startMarker));
  if (startIdx === -1) return [];
  let endIdx = lines.length;
  for (const marker of endMarkers) {
    const idx = lines.findIndex((l, i) => i > startIdx && l.includes(marker));
    if (idx > -1 && idx < endIdx) endIdx = idx;
  }
  return lines.slice(startIdx + 1, endIdx);
}

function parseTableRows(sectionLines: string[]): BlueprintRow[] {
  const rows: BlueprintRow[] = [];
  let currentWorkPack = '';
  let pendingTextLines: string[] = [];

  const workPackPattern = /Agent Work Pack|Custom Agents/i;

  // Skip column-header fragments and boilerplate lines that appear between data rows
  const skipPattern =
    /^(Compliance Area|High Risk\b|Expense Lines|Approved|manually by|Auditor %|Rejected|Agent$|Coverage %|Total\b|Human Work|The following|AppZen Confidential|For Agent|Standardize|Develop|Expand|Monitor|Collaborate|Immediately)/i;

  // PDF text concatenates each row without spaces:
  //   "General Receipt Verification98,64156%44%76%"
  // Multi-line rows split the label across prior lines and put numbers alone:
  //   "Meal Receipt: Ineligible Items (Tobacco, Gift"
  //   "Cards & Other Non-Alcohol Items)"
  //   "11,02882%18%72%"
  //
  // The number always uses comma-grouped thousands (e.g. "98,641"), so we
  // use \d{1,3}(?:,\d{3})+ to match it exactly — avoiding greedy overlap
  // with the percent digits that follow immediately.
  const numPattern = /^(.*?)(\d{1,3}(?:,\d{3})+)(\d{1,3})%(\d{1,3})%(\d{1,3})%$/;

  for (const line of sectionLines) {
    const trimmed = line.trim();

    if (!trimmed || skipPattern.test(trimmed)) {
      pendingTextLines = [];
      continue;
    }

    if (workPackPattern.test(trimmed)) {
      currentWorkPack = trimmed;
      pendingTextLines = [];
      continue;
    }

    const match = trimmed.match(numPattern);
    if (match) {
      const textPrefix = match[1].trim();
      const highRiskLines = parseInt(match[2].replace(/,/g, ''), 10);
      if (isNaN(highRiskLines) || highRiskLines === 0) {
        pendingTextLines = [];
        continue;
      }

      // Compliance area = all accumulated text lines + any text on the numbers line
      const allParts = textPrefix ? [...pendingTextLines, textPrefix] : [...pendingTextLines];
      const complianceArea = allParts.join(' ').trim();
      if (!complianceArea) {
        pendingTextLines = [];
        continue;
      }

      rows.push({
        workPack: currentWorkPack,
        complianceArea,
        highRiskLines,
        approvedPct: parseInt(match[3], 10),
        rejectedPct: parseInt(match[4], 10),
        agentCoveragePct: parseInt(match[5], 10),
      });
      pendingTextLines = [];
    } else {
      // Text-only line — accumulate as part of a multi-line compliance area name
      pendingTextLines.push(trimmed);
    }
  }

  return rows;
}

function parsePdfContent(text: string, filename: string): BlueprintData {
  const lines = text.split('\n');

  // ── Extract metadata ────────────────────────────────────────────────────────
  const customerLine = lines.find(l => /^Customer:\s/.test(l.trim()));
  const customer = customerLine ? customerLine.replace(/^Customer:\s*/i, '').trim() : 'Unknown';

  const periodLine = lines.find(l => l.includes('Analysis Period:'));
  const analysisPeriod = periodLine
    ? periodLine.replace(/.*Analysis Period:\s*/i, '').trim()
    : '';

  const reportLine = lines.find(l => l.includes('Report Generated:'));
  const reportDate = reportLine
    ? reportLine.replace(/.*Report Generated:\s*/i, '').trim()
    : '';

  const totalLine = lines.find(l => l.includes('Total Expense Lines (Annualized)'));
  const totalMatch = totalLine?.match(/([\d,]+)/);
  const totalExpenseLines = totalMatch ? parseInt(totalMatch[1].replace(/,/g, ''), 10) : 0;

  const approvedLine = lines.find(l => l.includes('Approved by Auditors'));
  const approvedMatch = approvedLine?.match(/([\d,]+)/);
  const approvedByAuditors = approvedMatch ? parseInt(approvedMatch[1].replace(/,/g, ''), 10) : 0;

  const rejectedLine = lines.find(l => l.includes('Rejected by Auditors'));
  const rejectedMatch = rejectedLine?.match(/([\d,]+)/);
  const rejectedByAuditors = rejectedMatch ? parseInt(rejectedMatch[1].replace(/,/g, ''), 10) : 0;

  // ── Extract three table sections ─────────────────────────────────────────
  const trimmedLines = lines.map(l => l.trim());

  const s1Lines = extractBetween(trimmedLines, 'Agents Ready to Deploy', [
    'Agent SOPs That Require Modification',
    'Agent SOPs That Require Creation',
  ]);
  const s2Lines = extractBetween(trimmedLines, 'Agent SOPs That Require Modification', [
    'Agent SOPs That Require Creation',
  ]);
  const s3Lines = extractBetween(trimmedLines, 'Agent SOPs That Require Creation', [
    'Impact',
    'Compliance Risk',
    'Recommendations',
  ]);

  return {
    customer,
    analysisPeriod,
    reportDate,
    totalExpenseLines,
    approvedByAuditors,
    rejectedByAuditors,
    agentsReadyToDeploy: parseTableRows(s1Lines),
    sopRequireModification: parseTableRows(s2Lines),
    sopRequireCreation: parseTableRows(s3Lines),
    filename,
    savedAt: Date.now(),
  };
}

// ── Route handlers ────────────────────────────────────────────────────────────

export async function GET() {
  const data = globalThis.__blueprintData ?? null;
  return Response.json({ ok: true, data });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return Response.json({ ok: false, error: 'No file provided.' }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return Response.json({ ok: false, error: 'Only PDF files are accepted.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await pdfParse(buffer);
    const blueprintData = parsePdfContent(parsed.text, file.name);

    globalThis.__blueprintData = blueprintData;

    return Response.json({ ok: true, data: blueprintData });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[blueprint POST] error:', detail);
    return Response.json({ ok: false, error: `Parse error: ${detail}` }, { status: 500 });
  }
}

export async function DELETE() {
  globalThis.__blueprintData = null;
  return Response.json({ ok: true });
}
