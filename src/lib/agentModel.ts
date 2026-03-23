export const AGENT_MODEL_REQUIRED_COLS = [
  'customer_name',
  'industry',
  'sub_industry',
  'model',
  'number_of_high_risk_line',
  'number_of_returned_line',
  'appzen_expense_type',
  'model_category',
] as const;

export type AgentModelRequiredColumn = (typeof AGENT_MODEL_REQUIRED_COLS)[number];

export interface AgentModelRow {
  customer_name: string;
  industry: string;
  sub_industry: string;
  model: string;
  ea_committed_volume?: number;
  number_of_high_risk_line: number;
  number_of_returned_line: number;
  appzen_expense_type: string;
  model_category: string;
}

export interface AgentModelMetadata {
  version: 1;
  savedAt: number;
  filename: string;
  sheetName: string;
  rows: AgentModelRow[];
}

export interface CustomerSummary {
  industry: string;
  subIndustry: string;
  industryMultiple: boolean;
  subIndustryMultiple: boolean;
  annualExpenseReports: number | null;
  annualExpenseReportsMultiple: boolean;
  totalRows: number;
  totalHighRisk: number;
}

export interface IndustrySummary {
  industry: string;
  subIndustries: string[];
  avgHighRiskLinesPerCustomer: number;
  customerCount: number;
  totalHighRisk: number;
  totalRows: number;
}

export interface ModelTotal {
  model: string;
  total: number;
  returned: number;
}

export function parseNum(value: unknown): number {
  const parsed = Number.parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function normalizeWorkbookRows(rawRows: Record<string, unknown>[]): {
  rows: AgentModelRow[];
  missingColumns: string[];
} {
  const normalized = rawRows.map((row) => {
    const out: Record<string, unknown> = {};
    Object.keys(row).forEach((key) => {
      out[key.trim().toLowerCase()] = row[key];
    });
    return out;
  });

  const missingColumns = AGENT_MODEL_REQUIRED_COLS.filter((col) => !(col in (normalized[0] || {})));

  const rows: AgentModelRow[] = normalized.map((row) => ({
    customer_name: String(row.customer_name || '').trim(),
    industry: String(row.industry || '').trim(),
    sub_industry: String(row.sub_industry || '').trim(),
    model: String(row.model || '').trim() || '(Unspecified)',
    ea_committed_volume:
      row.ea_committed_volume === undefined || row.ea_committed_volume === null || String(row.ea_committed_volume).trim() === ''
        ? undefined
        : parseNum(row.ea_committed_volume),
    number_of_high_risk_line: parseNum(row.number_of_high_risk_line),
    number_of_returned_line: parseNum(row.number_of_returned_line),
    appzen_expense_type: String(row.appzen_expense_type || '').trim() || '(Unspecified)',
    model_category: String(row.model_category || '').trim(),
  }));

  return { rows, missingColumns };
}

/**
 * Aggregate rows by their dimensional key (customer + model + expense type + category).
 * Sums high-risk and returned line counts so large raw datasets (e.g. 70k+ rows) are
 * collapsed to a much smaller set before being stored/transmitted.
 */
export function aggregateRows(rows: AgentModelRow[]): AgentModelRow[] {
  const map = new Map<string, AgentModelRow>();
  for (const row of rows) {
    const key = `${row.customer_name}||${row.industry}||${row.sub_industry}||${row.model}||${row.appzen_expense_type}||${row.model_category}`;
    const existing = map.get(key);
    if (existing) {
      existing.number_of_high_risk_line += row.number_of_high_risk_line;
      existing.number_of_returned_line += row.number_of_returned_line;
    } else {
      map.set(key, { ...row });
    }
  }
  return Array.from(map.values());
}

export function uniqueCustomerNames(rows: AgentModelRow[]): string[] {
  return [...new Set(rows.map((row) => row.customer_name).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function uniqueIndustryNames(rows: AgentModelRow[]): string[] {
  return [...new Set(rows.map((row) => row.industry).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function mode(values: string[]): string {
  const counts: Record<string, number> = {};
  values.forEach((value) => {
    counts[value] = (counts[value] || 0) + 1;
  });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : '';
}

export function summarizeCustomer(rows: AgentModelRow[]): CustomerSummary {
  const industries = rows.map((row) => row.industry).filter(Boolean);
  const subIndustries = rows.map((row) => row.sub_industry).filter(Boolean);
  const committedVolumes = rows
    .map((row) => row.ea_committed_volume)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const uniqueVolumes = [...new Set(committedVolumes)];
  const annualExpenseReports = committedVolumes.length
    ? Number(
        Object.entries(
          committedVolumes.reduce<Record<string, number>>((acc, value) => {
            const key = String(value);
            acc[key] = (acc[key] || 0) + 1;
            return acc;
          }, {})
        ).sort((a, b) => b[1] - a[1])[0][0]
      )
    : null;

  return {
    industry: mode(industries) || '(Unknown)',
    subIndustry: mode(subIndustries) || '(Unknown)',
    industryMultiple: new Set(industries).size > 1,
    subIndustryMultiple: new Set(subIndustries).size > 1,
    annualExpenseReports,
    annualExpenseReportsMultiple: uniqueVolumes.length > 1,
    totalRows: rows.length,
    totalHighRisk: rows.reduce((sum, row) => sum + row.number_of_high_risk_line, 0),
  };
}

export function summarizeIndustry(industryRows: AgentModelRow[]): IndustrySummary {
  const industry = industryRows[0]?.industry || '';
  const subIndustries = [...new Set(industryRows.map((r) => r.sub_industry).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const customerCount = new Set(industryRows.map((r) => r.customer_name).filter(Boolean)).size;
  const totalHighRisk = industryRows.reduce((sum, r) => sum + r.number_of_high_risk_line, 0);
  const avgHighRiskLinesPerCustomer = customerCount > 0 ? Math.round(totalHighRisk / customerCount) : 0;
  return {
    industry,
    subIndustries,
    avgHighRiskLinesPerCustomer,
    customerCount,
    totalHighRisk,
    totalRows: industryRows.length,
  };
}

export function computeModelTotals(rows: AgentModelRow[]): ModelTotal[] {
  const byModel = new Map<string, { total: number; returned: number }>();
  rows.forEach((row) => {
    if (!byModel.has(row.model)) {
      byModel.set(row.model, { total: 0, returned: 0 });
    }
    const entry = byModel.get(row.model)!;
    entry.total += row.number_of_high_risk_line;
    entry.returned += row.number_of_returned_line;
  });

  return [...byModel.entries()]
    .map(([model, value]) => ({ model, ...value }))
    .sort((a, b) => b.total - a.total || a.model.localeCompare(b.model));
}

export function formatDateTime(timestamp?: number): string {
  if (!timestamp) return 'Unknown';
  return new Date(timestamp).toLocaleString();
}
