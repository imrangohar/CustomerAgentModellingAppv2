import Papa from 'papaparse';

export interface CoaMappingRow {
  category: string;
  keywords: string;
  glAccountCode: string;
  glAccountName: string;
  costCenterRule: string;
  departmentRule: string;
  capexFlag: string;
  cogsFlag: string;
  prepaidRule: string;
  taxCodeRule: string;
  approverRole: string;
  exceptionQueue: string;
  notes: string;
}

export const coaMappingHeaders: (keyof CoaMappingRow)[] = [
  'category',
  'keywords',
  'glAccountCode',
  'glAccountName',
  'costCenterRule',
  'departmentRule',
  'capexFlag',
  'cogsFlag',
  'prepaidRule',
  'taxCodeRule',
  'approverRole',
  'exceptionQueue',
  'notes',
];

const starterRows: CoaMappingRow[] = [
  {
    category: 'Software / SaaS',
    keywords: 'subscription,license,saas',
    glAccountCode: '6750',
    glAccountName: 'Software Subscriptions',
    costCenterRule: 'Requester cost center',
    departmentRule: 'Department from approver',
    capexFlag: 'No',
    cogsFlag: 'No',
    prepaidRule: 'If service period > current month and amount > threshold',
    taxCodeRule: 'Service tax by jurisdiction',
    approverRole: 'Cost center owner',
    exceptionQueue: 'Controller Coding Queue',
    notes: 'Split implementation services separately',
  },
  {
    category: 'Cloud / Hosting',
    keywords: 'aws,azure,gcp,hosting,consumption',
    glAccountCode: '5110',
    glAccountName: 'Hosting Costs',
    costCenterRule: 'Cloud operations cost center',
    departmentRule: 'Engineering/IT',
    capexFlag: 'No',
    cogsFlag: 'Depends policy',
    prepaidRule: 'Typically no',
    taxCodeRule: 'Digital services tax rule',
    approverRole: 'IT finance owner',
    exceptionQueue: 'AP Coding Exceptions',
    notes: 'Allocate by usage driver where available',
  },
  {
    category: 'Professional Services',
    keywords: 'consulting,legal,audit,advisory',
    glAccountCode: '6340',
    glAccountName: 'Professional Services',
    costCenterRule: 'Requesting function',
    departmentRule: 'Department from requester',
    capexFlag: 'Maybe',
    cogsFlag: 'Maybe',
    prepaidRule: 'Retainer or forward service period',
    taxCodeRule: 'Withholding + service tax review',
    approverRole: 'Department head + Controller',
    exceptionQueue: 'Controller Review Queue',
    notes: 'SOW/contract evidence required for exceptions',
  },
  {
    category: 'Facilities / Utilities',
    keywords: 'rent,utilities,electricity,internet,maintenance',
    glAccountCode: '7010',
    glAccountName: 'Facilities Expense',
    costCenterRule: 'Site/location cost center',
    departmentRule: 'Facilities/Admin',
    capexFlag: 'No',
    cogsFlag: 'No',
    prepaidRule: 'Annual contracts may be prepaid',
    taxCodeRule: 'Utility tax handling by locale',
    approverRole: 'Facilities owner',
    exceptionQueue: 'AP Non-PO Queue',
    notes: 'Multi-location split may be required',
  },
];

export function createCoaMappingTemplateCsv(): string {
  return Papa.unparse(starterRows, { columns: coaMappingHeaders as string[] });
}

export function parseCoaMappingCsvToMatrixText(csvText: string): string {
  const parsed = Papa.parse<CoaMappingRow>(csvText, { header: true, skipEmptyLines: true });
  const lines = parsed.data
    .filter((r) => (r.category || '').trim())
    .map(
      (r) =>
        `${r.category || ''} | ${r.glAccountCode || ''} - ${r.glAccountName || ''} | CC: ${r.costCenterRule || ''} | Capex: ${r.capexFlag || ''} | COGS: ${r.cogsFlag || ''} | Prepaid: ${r.prepaidRule || ''} | Tax: ${r.taxCodeRule || ''} | Approver: ${r.approverRole || ''} | Exceptions: ${r.exceptionQueue || ''} | Notes: ${r.notes || ''}`
    );

  return lines.join('\n');
}
