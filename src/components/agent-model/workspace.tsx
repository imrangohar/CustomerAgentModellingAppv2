'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Building2, CircleAlert, CircleCheck, Download, LoaderCircle, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  aggregateRows,
  computeModelTotals,
  formatDateTime,
  normalizeWorkbookRows,
  summarizeCustomer,
  summarizeIndustry,
  uniqueCustomerNames,
  uniqueIndustryNames,
  type AgentModelMetadata,
  type AgentModelRow,
} from '@/lib/agentModel';

export type AgentModelPanel = 'admin' | 'customers' | 'blueprint' | 'prospect';

export interface BlueprintRow {
  workPack: string;
  complianceArea: string;
  highRiskLines: number;
  approvedPct: number;
  rejectedPct: number;
  agentCoveragePct: number;
}

export interface RecommendationSection {
  title: string;
  bullets: string[];
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
  recommendations?: RecommendationSection[];
  filename: string;
  savedAt: number;
}

interface ApiResponse {
  ok: boolean;
  source?: 'kv' | 'memory' | 'none';
  metadata?: AgentModelMetadata | null;
  error?: string;
}

interface CustomerOperationalAnswers {
  auditorCount: string;
  reimbursementCycleTime: '' | '1 Day' | '2 Days' | '4 Days' | '7 Days' | '14 Days' | 'other';
  reimbursementCycleTimeCustom: string;
}

type JsPdfCtor = new (options?: { unit?: string; format?: string }) => {
  addPage: () => void;
  addImage: (imageData: string, format: string, x: number, y: number, width: number, height: number) => void;
  save: (filename: string) => void;
};

type Html2CanvasFn = (
  element: HTMLElement,
  options?: {
    scale?: number;
    backgroundColor?: string;
    useCORS?: boolean;
    width?: number;
    height?: number;
    windowWidth?: number;
    windowHeight?: number;
    scrollX?: number;
    scrollY?: number;
  }
) => Promise<HTMLCanvasElement>;

declare global {
  interface Window {
    jspdf?: { jsPDF: JsPdfCtor };
    html2canvas?: Html2CanvasFn;
  }
}

const panelMeta: Record<AgentModelPanel, { label: string; subtitle: string }> = {
  admin: {
    label: 'Admin',
    subtitle: 'Upload and manage shared metadata for customer modelling.',
  },
  customers: {
    label: 'Customers',
    subtitle: 'Customer-level model analytics, rankings, heatmaps, and ROI impact.',
  },
  blueprint: {
    label: 'Customers (Blueprint)',
    subtitle: 'Hybrid Workforce Analysis — Agent readiness, SOP gaps, and ROI impact from uploaded PDF.',
  },
  prospect: {
    label: 'Prospects',
    subtitle: 'Industry-level model analytics, rankings, heatmaps, and ROI impact.',
  },
};

function statusBadge(kind: 'success' | 'warning' | 'error' | 'info', text: string) {
  const styles: Record<typeof kind, string> = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    error: 'border-rose-200 bg-rose-50 text-rose-700',
    info: 'border-blue-200 bg-blue-50 text-blue-700',
  };

  return <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold', styles[kind])}>{text}</span>;
}

function heatColor(value: number, max: number) {
  if (value === 0) return { backgroundColor: '#f8fafc', color: '#9ca3af' };
  const t = value / max;
  if (t <= 0.5) {
    const u = t / 0.5;
    return {
      backgroundColor: `rgb(${Math.round(248 + (254 - 248) * u)},${Math.round(250 + (243 - 250) * u)},${Math.round(
        252 + (199 - 252) * u
      )})`,
      color: '#374151',
    };
  }

  const u = (t - 0.5) / 0.5;
  return {
    backgroundColor: `rgb(${Math.round(254 + (251 - 254) * u)},${Math.round(243 + (146 - 243) * u)},${Math.round(
      199 + (60 - 199) * u
    )})`,
    color: u > 0.5 ? '#ffffff' : '#374151',
  };
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function loadJsPdf(): Promise<JsPdfCtor | null> {
  if (typeof window === 'undefined') return null;
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-jspdf-cdn="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Unable to load jsPDF script.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.async = true;
    script.dataset.jspdfCdn = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Unable to load jsPDF script.'));
    document.head.appendChild(script);
  });

  return window.jspdf?.jsPDF ?? null;
}

async function loadHtml2Canvas(): Promise<Html2CanvasFn | null> {
  if (typeof window === 'undefined') return null;
  if (window.html2canvas) return window.html2canvas;

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-html2canvas-cdn="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Unable to load html2canvas script.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.async = true;
    script.dataset.html2canvasCdn = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Unable to load html2canvas script.'));
    document.head.appendChild(script);
  });

  return window.html2canvas ?? null;
}

async function waitForImages(container: HTMLElement) {
  const images = Array.from(container.querySelectorAll('img'));
  await Promise.all(
    images.map(async (img) => {
      if (img.complete && img.naturalWidth > 0) return;
      await new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true });
        img.addEventListener('error', () => resolve(), { once: true });
      });
    })
  );
}

function sliceCanvasForPages(canvas: HTMLCanvasElement, pagePixelHeight: number): string[] {
  const images: string[] = [];
  let offsetY = 0;

  while (offsetY < canvas.height) {
    const sliceHeight = Math.min(pagePixelHeight, canvas.height - offsetY);
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeight;
    const ctx = pageCanvas.getContext('2d');
    if (!ctx) break;
    ctx.fillStyle = '#f5f6f8';
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
    images.push(pageCanvas.toDataURL('image/png'));
    offsetY += sliceHeight;
  }

  return images;
}

export function AgentModelWorkspace({ panel }: { panel: AgentModelPanel }) {
  const reportExportRef = useRef<HTMLDivElement>(null);
  const prospectExportRef = useRef<HTMLDivElement>(null);
  const blueprintExportRef = useRef<HTMLDivElement>(null);

  const [rows, setRows] = useState<AgentModelRow[]>([]);
  const [filename, setFilename] = useState<string>('');
  const [sheetName, setSheetName] = useState<string>('Sheet1');
  const [savedAt, setSavedAt] = useState<number | undefined>(undefined);
  const [source, setSource] = useState<'kv' | 'memory' | 'none'>('none');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ kind: 'success' | 'warning' | 'error' | 'info'; message: string } | null>(null);

  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [customerOperationalAnswers, setCustomerOperationalAnswers] = useState<Record<string, CustomerOperationalAnswers>>({});
  const [exporting, setExporting] = useState(false);

  const [industrySearch, setIndustrySearch] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [selectedSubIndustries, setSelectedSubIndustries] = useState<string[]>([]);
  const [industryOperationalAnswers, setIndustryOperationalAnswers] = useState<Record<string, CustomerOperationalAnswers>>({});
  const [prospectExporting, setProspectExporting] = useState(false);
  const [blueprintExporting, setBlueprintExporting] = useState(false);

  const [roiVolumeMode, setRoiVolumeMode] = useState<'top5' | 'all' | 'single'>('top5');
  const [roiSingleModel, setRoiSingleModel] = useState('');
  const [industryRoiVolumeMode, setIndustryRoiVolumeMode] = useState<'manual' | 'top5' | 'all' | 'single'>('top5');
  const [industryRoiSingleModel, setIndustryRoiSingleModel] = useState('');
  const [industryRoiManualVolume, setIndustryRoiManualVolume] = useState<string>('');

  const [timeMinutes, setTimeMinutes] = useState(3);
  const [creditsPerAction, setCreditsPerAction] = useState(2);
  const [fteCost, setFteCost] = useState(35000);
  const [costPerCredit, setCostPerCredit] = useState(0.30);

  // Blueprint panel state
  const [blueprintData, setBlueprintData] = useState<BlueprintData | null>(null);
  const [blueprintLoading, setBlueprintLoading] = useState(false);
  const [blueprintNotice, setBlueprintNotice] = useState<{ kind: 'success' | 'warning' | 'error' | 'info'; message: string } | null>(null);
  const [bpTableSelection, setBpTableSelection] = useState({ ready: true, modify: false, create: false });
  const [bpOperationalAnswers, setBpOperationalAnswers] = useState<CustomerOperationalAnswers>({
    auditorCount: '',
    reimbursementCycleTime: '',
    reimbursementCycleTimeCustom: '',
  });

  const customers = useMemo(() => uniqueCustomerNames(rows), [rows]);
  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((customer) => customer.toLowerCase().includes(q));
  }, [customers, search]);

  const selectedRows = useMemo(() => {
    if (!selectedCustomer) return [];
    return rows.filter((row) => row.customer_name === selectedCustomer);
  }, [rows, selectedCustomer]);

  const selectedOperationalAnswers: CustomerOperationalAnswers = selectedCustomer
    ? (customerOperationalAnswers[selectedCustomer] ?? { auditorCount: '', reimbursementCycleTime: '', reimbursementCycleTimeCustom: '' })
    : { auditorCount: '', reimbursementCycleTime: '', reimbursementCycleTimeCustom: '' };

  const summary = useMemo(() => summarizeCustomer(selectedRows), [selectedRows]);
  const allModels = useMemo(() => computeModelTotals(selectedRows), [selectedRows]);
  const top5 = useMemo(() => allModels.slice(0, 5), [allModels]);
  const top5TotalHighRisk = useMemo(() => top5.reduce((sum, item) => sum + item.total, 0), [top5]);
  const top5MaxTotal = useMemo(() => Math.max(...top5.map((item) => item.total), 1), [top5]);

  const roi = useMemo(() => {
    let baseVolume: number;
    if (roiVolumeMode === 'single') {
      const match = top5.find((m) => m.model === roiSingleModel);
      baseVolume = match ? match.total : 0;
    } else {
      baseVolume = roiVolumeMode === 'top5' ? top5TotalHighRisk : summary.totalHighRisk;
    }
    if (!baseVolume) return null;

    const timeSavedMins = baseVolume * timeMinutes;
    const timeSavedHours = timeSavedMins / 60;
    const fteEquivalent = timeSavedHours / 1920;
    const fteSavings = fteEquivalent * fteCost;
    const creditConsumption = baseVolume * creditsPerAction;

    const displayTime =
      timeSavedHours >= 24
        ? `${(timeSavedHours / 24).toLocaleString(undefined, { maximumFractionDigits: 1 })} days`
        : `${timeSavedHours.toLocaleString(undefined, { maximumFractionDigits: 1 })} hrs`;

    return {
      displayTime,
      timeSavedMins,
      fteEquivalent,
      fteSavings,
      creditConsumption,
    };
  }, [roiVolumeMode, roiSingleModel, top5, top5TotalHighRisk, summary.totalHighRisk, timeMinutes, fteCost, creditsPerAction]);

  const currentPanel = panelMeta[panel];

  const maxHeat = useMemo(() => {
    const stdRows = selectedRows.filter((row) => row.model_category.toLowerCase() === 'standard model');
    const max = stdRows.reduce((acc, row) => Math.max(acc, row.number_of_high_risk_line), 0);
    return Math.max(max, 1);
  }, [selectedRows]);

  const heatmap = useMemo(() => {
    const stdRows = selectedRows.filter((row) => row.model_category.toLowerCase() === 'standard model');
    if (!stdRows.length) return null;

    const models = [...new Set(stdRows.map((row) => row.model))].sort((a, b) => a.localeCompare(b));
    const expenseTypes = [...new Set(stdRows.map((row) => row.appzen_expense_type))];

    const matrix: Record<string, Record<string, number>> = {};
    models.forEach((model) => {
      matrix[model] = {};
      expenseTypes.forEach((expense) => {
        matrix[model][expense] = 0;
      });
    });

    stdRows.forEach((row) => {
      matrix[row.model][row.appzen_expense_type] += row.number_of_high_risk_line;
    });

    const totalsByExpense: Record<string, number> = {};
    expenseTypes.forEach((expense) => {
      totalsByExpense[expense] = models.reduce((sum, model) => sum + matrix[model][expense], 0);
    });

    const sortedExpenseTypes = [...expenseTypes].sort(
      (a, b) => totalsByExpense[b] - totalsByExpense[a] || a.localeCompare(b)
    );

    return { models, expenseTypes: sortedExpenseTypes, matrix };
  }, [selectedRows]);

  const exportHeatmapExpenseTypes = useMemo(() => {
    if (!heatmap) return [] as string[];
    const trimmed = [...heatmap.expenseTypes];
    while (trimmed.length > 1) {
      const last = trimmed[trimmed.length - 1];
      const maxInColumn = heatmap.models.reduce((max, model) => Math.max(max, heatmap.matrix[model][last] || 0), 0);
      if (maxInColumn >= 10) break;
      trimmed.pop();
    }
    return trimmed;
  }, [heatmap]);

  const exportHeatmapColumnGroups = useMemo(() => {
    if (!exportHeatmapExpenseTypes.length) return [] as string[][];
    const groups: string[][] = [];
    for (let i = 0; i < exportHeatmapExpenseTypes.length; i += 10) {
      groups.push(exportHeatmapExpenseTypes.slice(i, i + 10));
    }
    return groups;
  }, [exportHeatmapExpenseTypes]);

  // ── Blueprint tab memos ────────────────────────────────────────────────────
  const bpReadyTotal = useMemo(
    () => blueprintData?.agentsReadyToDeploy.reduce((s, r) => s + r.highRiskLines, 0) ?? 0,
    [blueprintData]
  );
  const bpModifyTotal = useMemo(
    () => blueprintData?.sopRequireModification.reduce((s, r) => s + r.highRiskLines, 0) ?? 0,
    [blueprintData]
  );
  const bpCreateTotal = useMemo(
    () => blueprintData?.sopRequireCreation.reduce((s, r) => s + r.highRiskLines, 0) ?? 0,
    [blueprintData]
  );
  const bpSelectedTotal = useMemo(() => {
    let t = 0;
    if (bpTableSelection.ready) t += bpReadyTotal;
    if (bpTableSelection.modify) t += bpModifyTotal;
    if (bpTableSelection.create) t += bpCreateTotal;
    return t;
  }, [bpReadyTotal, bpModifyTotal, bpCreateTotal, bpTableSelection]);

  const bpRoi = useMemo(() => {
    if (!bpSelectedTotal) return null;
    const timeSavedMins = bpSelectedTotal * timeMinutes;
    const timeSavedHours = timeSavedMins / 60;
    const fteEquivalent = timeSavedHours / 1920;
    const fteSavings = fteEquivalent * fteCost;
    const creditConsumption = bpSelectedTotal * creditsPerAction;
    const displayTime = timeSavedHours >= 24
      ? `${(timeSavedHours / 24).toLocaleString(undefined, { maximumFractionDigits: 1 })} days`
      : `${timeSavedHours.toLocaleString(undefined, { maximumFractionDigits: 1 })} hrs`;
    return { displayTime, timeSavedMins, fteEquivalent, fteSavings, creditConsumption };
  }, [bpSelectedTotal, timeMinutes, fteCost, creditsPerAction]);

  // ── Industry / Prospect tab memos ─────────────────────────────────────────
  const industryCustomerCounts = useMemo(() => {
    const counts = new Map<string, Set<string>>();
    for (const row of rows) {
      if (!row.industry) continue;
      if (!counts.has(row.industry)) counts.set(row.industry, new Set());
      if (row.customer_name) counts.get(row.industry)!.add(row.customer_name);
    }
    return counts;
  }, [rows]);

  const industries = useMemo(
    () => uniqueIndustryNames(rows).filter((ind) => (industryCustomerCounts.get(ind)?.size ?? 0) >= 5),
    [rows, industryCustomerCounts]
  );
  const filteredIndustries = useMemo(() => {
    const q = industrySearch.trim().toLowerCase();
    if (!q) return industries;
    return industries.filter((ind) => ind.toLowerCase().includes(q));
  }, [industries, industrySearch]);

  const industryAllRows = useMemo(() => {
    if (!selectedIndustry) return [];
    return rows.filter((row) => row.industry === selectedIndustry);
  }, [rows, selectedIndustry]);

  const availableSubIndustries = useMemo(
    () => [...new Set(industryAllRows.map((r) => r.sub_industry).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [industryAllRows]
  );

  const industryRows = useMemo(() => {
    if (selectedSubIndustries.length === 0) return industryAllRows;
    return industryAllRows.filter((row) => selectedSubIndustries.includes(row.sub_industry));
  }, [industryAllRows, selectedSubIndustries]);

  const industryStdRows = useMemo(
    () => industryRows.filter((row) => row.model_category.toLowerCase() === 'standard model'),
    [industryRows]
  );

  const selectedIndustryOperationalAnswers: CustomerOperationalAnswers = selectedIndustry
    ? (industryOperationalAnswers[selectedIndustry] ?? { auditorCount: '', reimbursementCycleTime: '', reimbursementCycleTimeCustom: '' })
    : { auditorCount: '', reimbursementCycleTime: '', reimbursementCycleTimeCustom: '' };

  const industrySummary = useMemo(() => summarizeIndustry(industryRows), [industryRows]);

  const industryAllModels = useMemo(() => computeModelTotals(industryStdRows), [industryStdRows]);
  const industryTop5 = useMemo(() => industryAllModels.slice(0, 5), [industryAllModels]);
  const industryTop5TotalHighRisk = useMemo(() => industryTop5.reduce((sum, item) => sum + item.total, 0), [industryTop5]);
  const industryTop5MaxTotal = useMemo(() => Math.max(...industryTop5.map((item) => item.total), 1), [industryTop5]);
  const industryStdTotalHighRisk = useMemo(
    () => industryStdRows.reduce((sum, r) => sum + r.number_of_high_risk_line, 0),
    [industryStdRows]
  );

  const industryRoi = useMemo(() => {
    let baseVolume: number;
    if (industryRoiVolumeMode === 'manual') {
      baseVolume = parseInt(industryRoiManualVolume.replace(/,/g, ''), 10) || 0;
    } else if (industryRoiVolumeMode === 'single') {
      const match = industryTop5.find((m) => m.model === industryRoiSingleModel);
      baseVolume = match ? match.total : 0;
    } else {
      baseVolume = industryRoiVolumeMode === 'top5' ? industryTop5TotalHighRisk : industrySummary.totalHighRisk;
    }
    if (!baseVolume) return null;
    const timeSavedMins = baseVolume * timeMinutes;
    const timeSavedHours = timeSavedMins / 60;
    const fteEquivalent = timeSavedHours / 1920;
    const fteSavings = fteEquivalent * fteCost;
    const creditConsumption = baseVolume * creditsPerAction;
    const displayTime =
      timeSavedHours >= 24
        ? `${(timeSavedHours / 24).toLocaleString(undefined, { maximumFractionDigits: 1 })} days`
        : `${timeSavedHours.toLocaleString(undefined, { maximumFractionDigits: 1 })} hrs`;
    return { displayTime, timeSavedMins, fteEquivalent, fteSavings, creditConsumption };
  }, [industryRoiVolumeMode, industryRoiManualVolume, industryRoiSingleModel, industryTop5, industryTop5TotalHighRisk, industrySummary.totalHighRisk, timeMinutes, fteCost, creditsPerAction]);

  const industryMaxHeat = useMemo(() => {
    const max = industryStdRows.reduce((acc, row) => Math.max(acc, row.number_of_high_risk_line), 0);
    return Math.max(max, 1);
  }, [industryStdRows]);

  const industryHeatmap = useMemo(() => {
    if (!industryStdRows.length) return null;
    const models = [...new Set(industryStdRows.map((row) => row.model))].sort((a, b) => a.localeCompare(b));
    const expenseTypes = [...new Set(industryStdRows.map((row) => row.appzen_expense_type))];
    const matrix: Record<string, Record<string, number>> = {};
    models.forEach((model) => {
      matrix[model] = {};
      expenseTypes.forEach((expense) => { matrix[model][expense] = 0; });
    });
    industryStdRows.forEach((row) => {
      matrix[row.model][row.appzen_expense_type] += row.number_of_high_risk_line;
    });
    const totalsByExpense: Record<string, number> = {};
    expenseTypes.forEach((expense) => {
      totalsByExpense[expense] = models.reduce((sum, model) => sum + matrix[model][expense], 0);
    });
    const sortedExpenseTypes = [...expenseTypes].sort(
      (a, b) => totalsByExpense[b] - totalsByExpense[a] || a.localeCompare(b)
    );
    return { models, expenseTypes: sortedExpenseTypes, matrix };
  }, [industryStdRows]);

  const industryExportHeatmapExpenseTypes = useMemo(() => {
    if (!industryHeatmap) return [] as string[];
    const trimmed = [...industryHeatmap.expenseTypes];
    while (trimmed.length > 1) {
      const last = trimmed[trimmed.length - 1];
      const maxInColumn = industryHeatmap.models.reduce((max, model) => Math.max(max, industryHeatmap.matrix[model][last] || 0), 0);
      if (maxInColumn >= 10) break;
      trimmed.pop();
    }
    return trimmed;
  }, [industryHeatmap]);

  const industryExportHeatmapColumnGroups = useMemo(() => {
    if (!industryExportHeatmapExpenseTypes.length) return [] as string[][];
    const groups: string[][] = [];
    for (let i = 0; i < industryExportHeatmapExpenseTypes.length; i += 10) {
      groups.push(industryExportHeatmapExpenseTypes.slice(i, i + 10));
    }
    return groups;
  }, [industryExportHeatmapExpenseTypes]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void fetchSharedMetadata(); void fetchBlueprintData(); }, []);

  async function fetchSharedMetadata() {
    setLoading(true);
    setErrors([]);
    try {
      const res = await fetch('/api/agent-model/metadata', { cache: 'no-store' });
      const payload = (await res.json()) as ApiResponse;
      if (!payload.ok) {
        setNotice({ kind: 'warning', message: payload.error || 'Unable to load shared metadata.' });
        return;
      }

      if (!payload.metadata?.rows?.length) {
        setRows([]);
        setSource(payload.source || 'none');
        setFilename('');
        setSavedAt(undefined);
        setSheetName('Sheet1');
        setSelectedCustomer('');
        setNotice({ kind: 'info', message: 'No shared metadata loaded yet. Upload Excel in Admin to begin.' });
        return;
      }

      hydrateFromMetadata(payload.metadata, payload.source || 'none');
      setNotice({ kind: 'success', message: `Loaded shared metadata (${payload.metadata.rows.length.toLocaleString()} rows).` });
    } catch {
      setNotice({ kind: 'error', message: 'Failed to reach metadata service.' });
    } finally {
      setLoading(false);
    }
  }

  function hydrateFromMetadata(metadata: AgentModelMetadata, storageSource: 'kv' | 'memory' | 'none') {
    const nextCustomers = uniqueCustomerNames(metadata.rows);
    const nextIndustries = uniqueIndustryNames(metadata.rows);
    setRows(metadata.rows);
    setFilename(metadata.filename);
    setSheetName(metadata.sheetName);
    setSavedAt(metadata.savedAt);
    setSource(storageSource);

    if (!selectedCustomer || !nextCustomers.includes(selectedCustomer)) {
      setSelectedCustomer(nextCustomers[0] || '');
    }
    if (!selectedIndustry || !nextIndustries.includes(selectedIndustry)) {
      setSelectedIndustry(nextIndustries[0] || '');
    }
  }

  async function handleUpload(file: File) {
    setLoading(true);
    setErrors([]);
    setNotice({ kind: 'info', message: `Parsing ${file.name}...` });

    try {
      setNotice({ kind: 'info', message: `Reading file…` });
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
      const currentSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[currentSheetName];

      setNotice({ kind: 'info', message: `Parsing rows…` });
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: '',
        raw: false,
      });

      const normalized = normalizeWorkbookRows(rawRows);
      if (normalized.missingColumns.length) {
        setErrors(normalized.missingColumns.map((col) => `Missing required column: ${col}`));
        setNotice({ kind: 'error', message: 'Required columns missing. Please fix the spreadsheet and retry.' });
        return;
      }

      setNotice({ kind: 'info', message: `Aggregating ${normalized.rows.length.toLocaleString()} rows…` });
      const aggregated = aggregateRows(normalized.rows);
      console.log(`[upload] raw rows: ${normalized.rows.length}, aggregated: ${aggregated.length}`);

      const metadata: AgentModelMetadata = {
        version: 1,
        filename: file.name,
        savedAt: Date.now(),
        sheetName: currentSheetName,
        rows: aggregated,
      };

      // ── Chunked upload — 2 000 rows per request (~1-2 MB each) ────────────
      const CHUNK = 2000;
      const totalChunks = Math.ceil(aggregated.length / CHUNK);

      for (let i = 0; i < totalChunks; i++) {
        const chunk = aggregated.slice(i * CHUNK, (i + 1) * CHUNK);
        const phase = i === 0 ? 'init' : 'append';
        setNotice({ kind: 'info', message: `Uploading chunk ${i + 1}/${totalChunks}…` });

        const res = await fetch('/api/agent-model/metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            phase === 'init'
              ? { _phase: 'init', version: metadata.version, filename: metadata.filename, savedAt: metadata.savedAt, sheetName: metadata.sheetName, rows: chunk }
              : { _phase: 'append', rows: chunk }
          ),
        });
        const resJson = (await res.json()) as ApiResponse;
        if (!resJson.ok) {
          setNotice({ kind: 'error', message: resJson.error || 'Chunk upload failed.' });
          return;
        }
      }

      setNotice({ kind: 'info', message: 'Finalizing…' });
      const finalRes = await fetch('/api/agent-model/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _phase: 'finalize' }),
      });
      const savePayload = (await finalRes.json()) as ApiResponse;

      if (!savePayload.ok) {
        setNotice({ kind: 'error', message: savePayload.error || 'Unable to save metadata to shared storage.' });
        return;
      }

      hydrateFromMetadata(metadata, savePayload.source || 'memory');
      setNotice({ kind: 'success', message: `Metadata uploaded: ${metadata.rows.length.toLocaleString()} rows from ${metadata.filename}.` });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error('[handleUpload] error:', detail);
      setNotice({ kind: 'error', message: `Upload error: ${detail}` });
    } finally {
      setLoading(false);
    }
  }

  async function clearMetadata() {
    setLoading(true);
    setErrors([]);
    try {
      await fetch('/api/agent-model/metadata', { method: 'DELETE' });
      setRows([]);
      setFilename('');
      setSavedAt(undefined);
      setSheetName('Sheet1');
      setSource('none');
      setSearch('');
      setSelectedCustomer('');
      setCustomerOperationalAnswers({});
      setIndustrySearch('');
      setSelectedIndustry('');
      setIndustryOperationalAnswers({});
      setNotice({ kind: 'info', message: 'Metadata cleared.' });
    } catch {
      setNotice({ kind: 'error', message: 'Unable to clear metadata right now.' });
    } finally {
      setLoading(false);
    }
  }

  async function fetchBlueprintData() {
    try {
      const res = await fetch('/api/agent-model/blueprint', { cache: 'no-store' });
      const payload = (await res.json()) as { ok: boolean; data?: BlueprintData | null };
      if (payload.ok && payload.data) {
        setBlueprintData(payload.data);
      }
    } catch {
      // silent — blueprint data is optional
    }
  }

  async function handlePdfUpload(file: File) {
    setBlueprintLoading(true);
    setBlueprintNotice({ kind: 'info', message: `Parsing ${file.name}…` });
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/agent-model/blueprint', { method: 'POST', body: formData });
      const payload = (await res.json()) as { ok: boolean; data?: BlueprintData; error?: string };
      if (!payload.ok || !payload.data) {
        setBlueprintNotice({ kind: 'error', message: payload.error || 'Failed to parse PDF.' });
        return;
      }
      setBlueprintData(payload.data);
      setBlueprintNotice({ kind: 'success', message: `Blueprint loaded: ${payload.data.customer} · ${file.name}` });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setBlueprintNotice({ kind: 'error', message: `Upload error: ${detail}` });
    } finally {
      setBlueprintLoading(false);
    }
  }

  async function clearBlueprintData() {
    setBlueprintLoading(true);
    try {
      await fetch('/api/agent-model/blueprint', { method: 'DELETE' });
      setBlueprintData(null);
      setBlueprintNotice({ kind: 'info', message: 'Blueprint data cleared.' });
    } catch {
      setBlueprintNotice({ kind: 'error', message: 'Unable to clear blueprint data.' });
    } finally {
      setBlueprintLoading(false);
    }
  }

  async function captureStreamlinedReportPages() {
    if (!reportExportRef.current) return null;
    const html2canvas = await loadHtml2Canvas();
    if (!html2canvas) return null;
    await waitForImages(reportExportRef.current);

    const canvas = await html2canvas(reportExportRef.current, {
      scale: 2,
      backgroundColor: '#f5f6f8',
      useCORS: true,
      width: reportExportRef.current.scrollWidth,
      height: reportExportRef.current.scrollHeight,
      windowWidth: reportExportRef.current.scrollWidth,
      windowHeight: reportExportRef.current.scrollHeight,
      scrollX: 0,
      scrollY: 0,
    });

    const pdfPageWidthPts = 595.28 - 40;
    const pdfPageHeightPts = 841.89 - 40;
    const pixelsPerPt = canvas.width / pdfPageWidthPts;
    const pagePixelHeight = Math.floor(pdfPageHeightPts * pixelsPerPt);
    const pageImages = sliceCanvasForPages(canvas, pagePixelHeight);

    return { pageImages, pdfPageWidthPts, pdfPageHeightPts };
  }

  async function downloadWordReport() {
    if (!selectedCustomer) return;
    setExporting(true);
    try {
      const report = await captureStreamlinedReportPages();
      if (!report) {
        setNotice({ kind: 'error', message: 'Unable to render report for Word export.' });
        return;
      }

      const html = `<!doctype html>
<html><head><meta charset="utf-8" />
<style>
  @page { size: A4; margin: 0.5in; }
  body { font-family: "Segoe UI", Arial, sans-serif; background: #ffffff; }
  .page { page-break-after: always; margin: 0; padding: 0; }
  .page:last-child { page-break-after: auto; }
  img { width: 100%; height: auto; display: block; border: 1px solid #dbe3ef; }
</style>
</head><body>
${report.pageImages.map((img) => `<div class="page"><img src="${img}" /></div>`).join('')}
</body></html>`;
      const blob = new Blob([html], { type: 'application/msword' });
      downloadBlob(`ai-agent-transformation-${selectedCustomer.replaceAll(' ', '-').toLowerCase()}.doc`, blob);
      setNotice({ kind: 'success', message: 'Word report downloaded.' });
    } catch {
      setNotice({ kind: 'error', message: 'Word export failed. Please try again.' });
    } finally {
      setExporting(false);
    }
  }

  async function downloadPdfReport() {
    if (!selectedCustomer) return;
    setExporting(true);
    try {
      const JsPDF = await loadJsPdf();
      if (!JsPDF) {
        setNotice({ kind: 'error', message: 'PDF library could not be loaded. Please try again.' });
        return;
      }

      const report = await captureStreamlinedReportPages();
      if (!report) {
        setNotice({ kind: 'error', message: 'Unable to render report for PDF export.' });
        return;
      }

      const doc = new JsPDF({ unit: 'pt', format: 'a4' });
      report.pageImages.forEach((pageImage, index) => {
        if (index > 0) doc.addPage();
        doc.addImage(pageImage, 'PNG', 20, 20, report.pdfPageWidthPts, report.pdfPageHeightPts);
      });

      doc.save(`ai-agent-transformation-${selectedCustomer.replaceAll(' ', '-').toLowerCase()}.pdf`);
      setNotice({ kind: 'success', message: 'PDF report downloaded.' });
    } catch {
      setNotice({ kind: 'error', message: 'PDF export failed. Please try again.' });
    } finally {
      setExporting(false);
    }
  }

  async function captureProspectReportPages() {
    if (!prospectExportRef.current) return null;
    const html2canvas = await loadHtml2Canvas();
    if (!html2canvas) return null;
    await waitForImages(prospectExportRef.current);
    const canvas = await html2canvas(prospectExportRef.current, {
      scale: 2,
      backgroundColor: '#f5f6f8',
      useCORS: true,
      width: prospectExportRef.current.scrollWidth,
      height: prospectExportRef.current.scrollHeight,
      windowWidth: prospectExportRef.current.scrollWidth,
      windowHeight: prospectExportRef.current.scrollHeight,
      scrollX: 0,
      scrollY: 0,
    });
    const pdfPageWidthPts = 595.28 - 40;
    const pdfPageHeightPts = 841.89 - 40;
    const pixelsPerPt = canvas.width / pdfPageWidthPts;
    const pagePixelHeight = Math.floor(pdfPageHeightPts * pixelsPerPt);
    const pageImages = sliceCanvasForPages(canvas, pagePixelHeight);
    return { pageImages, pdfPageWidthPts, pdfPageHeightPts };
  }

  async function downloadProspectWordReport() {
    if (!selectedIndustry) return;
    setProspectExporting(true);
    try {
      const report = await captureProspectReportPages();
      if (!report) {
        setNotice({ kind: 'error', message: 'Unable to render report for Word export.' });
        return;
      }
      const html = `<!doctype html>
<html><head><meta charset="utf-8" />
<style>
  @page { size: A4; margin: 0.5in; }
  body { font-family: "Segoe UI", Arial, sans-serif; background: #ffffff; }
  .page { page-break-after: always; margin: 0; padding: 0; }
  .page:last-child { page-break-after: auto; }
  img { width: 100%; height: auto; display: block; border: 1px solid #dbe3ef; }
</style>
</head><body>
${report.pageImages.map((img) => `<div class="page"><img src="${img}" /></div>`).join('')}
</body></html>`;
      const blob = new Blob([html], { type: 'application/msword' });
      downloadBlob(`industry-analysis-${selectedIndustry.replaceAll(' ', '-').toLowerCase()}.doc`, blob);
      setNotice({ kind: 'success', message: 'Word report downloaded.' });
    } catch {
      setNotice({ kind: 'error', message: 'Word export failed. Please try again.' });
    } finally {
      setProspectExporting(false);
    }
  }

  async function downloadProspectPdfReport() {
    if (!selectedIndustry) return;
    setProspectExporting(true);
    try {
      const JsPDF = await loadJsPdf();
      if (!JsPDF) {
        setNotice({ kind: 'error', message: 'PDF library could not be loaded. Please try again.' });
        return;
      }
      const report = await captureProspectReportPages();
      if (!report) {
        setNotice({ kind: 'error', message: 'Unable to render report for PDF export.' });
        return;
      }
      const doc = new JsPDF({ unit: 'pt', format: 'a4' });
      report.pageImages.forEach((pageImage, index) => {
        if (index > 0) doc.addPage();
        doc.addImage(pageImage, 'PNG', 20, 20, report.pdfPageWidthPts, report.pdfPageHeightPts);
      });
      doc.save(`industry-analysis-${selectedIndustry.replaceAll(' ', '-').toLowerCase()}.pdf`);
      setNotice({ kind: 'success', message: 'PDF report downloaded.' });
    } catch {
      setNotice({ kind: 'error', message: 'PDF export failed. Please try again.' });
    } finally {
      setProspectExporting(false);
    }
  }

  async function captureBlueprintReportPages() {
    if (!blueprintExportRef.current) return null;
    const html2canvas = await loadHtml2Canvas();
    if (!html2canvas) return null;
    await waitForImages(blueprintExportRef.current);
    const canvas = await html2canvas(blueprintExportRef.current, {
      scale: 2,
      backgroundColor: '#F7F6F2',
      useCORS: true,
      width: blueprintExportRef.current.scrollWidth,
      height: blueprintExportRef.current.scrollHeight,
      windowWidth: blueprintExportRef.current.scrollWidth,
      windowHeight: blueprintExportRef.current.scrollHeight,
      scrollX: 0,
      scrollY: 0,
    });
    const pdfPageWidthPts  = 595.28 - 40;
    const pdfPageHeightPts = 841.89 - 40;
    const pixelsPerPt      = canvas.width / pdfPageWidthPts;
    const pagePixelHeight  = Math.floor(pdfPageHeightPts * pixelsPerPt);
    const pageImages = sliceCanvasForPages(canvas, pagePixelHeight);
    return { pageImages, pdfPageWidthPts, pdfPageHeightPts };
  }

  async function downloadBlueprintWordReport() {
    if (!blueprintData) return;
    setBlueprintExporting(true);
    try {
      const report = await captureBlueprintReportPages();
      if (!report) { setBlueprintNotice({ kind: 'error', message: 'Unable to render report for Word export.' }); return; }
      const html = `<!doctype html>
<html><head><meta charset="utf-8" />
<style>
  @page { size: A4; margin: 0.5in; }
  body { font-family: "Segoe UI", Arial, sans-serif; background: #ffffff; }
  .page { page-break-after: always; margin: 0; padding: 0; }
  .page:last-child { page-break-after: auto; }
  img { width: 100%; height: auto; display: block; border: 1px solid #dbe3ef; }
</style>
</head><body>
${report.pageImages.map((img) => `<div class="page"><img src="${img}" /></div>`).join('')}
</body></html>`;
      const blob = new Blob([html], { type: 'application/msword' });
      downloadBlob(`blueprint-${blueprintData.customer.replaceAll(' ', '-').toLowerCase()}.doc`, blob);
      setBlueprintNotice({ kind: 'success', message: 'Word report downloaded.' });
    } catch {
      setBlueprintNotice({ kind: 'error', message: 'Word export failed. Please try again.' });
    } finally {
      setBlueprintExporting(false);
    }
  }

  async function downloadBlueprintPdfReport() {
    if (!blueprintData) return;
    setBlueprintExporting(true);
    try {
      const JsPDF = await loadJsPdf();
      if (!JsPDF) { setBlueprintNotice({ kind: 'error', message: 'PDF library could not be loaded.' }); return; }
      const report = await captureBlueprintReportPages();
      if (!report) { setBlueprintNotice({ kind: 'error', message: 'Unable to render report for PDF export.' }); return; }
      const doc = new JsPDF({ unit: 'pt', format: 'a4' });
      report.pageImages.forEach((pageImage, index) => {
        if (index > 0) doc.addPage();
        doc.addImage(pageImage, 'PNG', 20, 20, report.pdfPageWidthPts, report.pdfPageHeightPts);
      });
      doc.save(`blueprint-${blueprintData.customer.replaceAll(' ', '-').toLowerCase()}.pdf`);
      setBlueprintNotice({ kind: 'success', message: 'PDF report downloaded.' });
    } catch {
      setBlueprintNotice({ kind: 'error', message: 'PDF export failed. Please try again.' });
    } finally {
      setBlueprintExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>{currentPanel.label}</CardTitle>
          <CardDescription>{currentPanel.subtitle}</CardDescription>
        </CardHeader>
      </Card>

      {panel === 'admin' && (
        <>
        <Card>
          <CardHeader>
            <CardTitle>Metadata Upload</CardTitle>
            <CardDescription>
              Upload Step 1 Excel metadata once. It is saved in shared app storage and reused by all users and sessions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label
              className={cn(
                'flex min-h-[150px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-app-border bg-slate-50 px-5 py-6 text-center hover:border-slate-400 hover:bg-slate-100',
                loading && 'pointer-events-none opacity-70'
              )}
            >
              <Upload className="h-6 w-6 text-slate-500" />
              <p className="text-sm font-medium text-slate-900">Click to upload or drag and drop</p>
              <p className="text-xs text-slate-600">Accepts .xlsx/.xls (Sheet 1 used for parsing)</p>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handleUpload(file);
                    event.currentTarget.value = '';
                  }
                }}
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              {loading ? (
                <span className="inline-flex items-center gap-1 text-sm text-slate-600">
                  <LoaderCircle className="h-4 w-4 animate-spin" /> Processing
                </span>
              ) : null}
              {notice ? statusBadge(notice.kind, notice.message) : null}
              <Button variant="secondary" onClick={() => void fetchSharedMetadata()} disabled={loading}>
                Refresh
              </Button>
              <Button variant="secondary" onClick={() => void clearMetadata()} disabled={loading || rows.length === 0}>
                Clear metadata
              </Button>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              {rows.length
                ? `${filename} · ${rows.length.toLocaleString()} rows · ${customers.length.toLocaleString()} customers · ${formatDateTime(savedAt)} · source: ${source}`
                : 'No metadata loaded yet.'}
            </div>

            {errors.length > 0 ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <div className="mb-1 inline-flex items-center gap-1 font-semibold">
                  <CircleAlert className="h-4 w-4" /> Upload validation errors
                </div>
                <ul className="list-disc space-y-1 pl-5">
                  {errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* PDF Blueprint Upload */}
        <Card>
          <CardHeader>
            <CardTitle>Hybrid Workforce Analysis PDF</CardTitle>
            <CardDescription>Upload an AppZen Hybrid Workforce Analysis PDF to populate the Customers (Blueprint) section.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label
              className={cn(
                'flex min-h-[150px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-app-border bg-slate-50 px-5 py-6 text-center hover:border-slate-400 hover:bg-slate-100',
                blueprintLoading && 'pointer-events-none opacity-70'
              )}
            >
              <Upload className="h-6 w-6 text-slate-500" />
              <p className="text-sm font-medium text-slate-900">Click to upload or drag and drop</p>
              <p className="text-xs text-slate-600">Accepts .pdf (Hybrid Workforce Analysis Report format)</p>
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handlePdfUpload(file);
                    event.currentTarget.value = '';
                  }
                }}
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              {blueprintLoading ? (
                <span className="inline-flex items-center gap-1 text-sm text-slate-600">
                  <LoaderCircle className="h-4 w-4 animate-spin" /> Processing
                </span>
              ) : null}
              {blueprintNotice ? statusBadge(blueprintNotice.kind, blueprintNotice.message) : null}
              <Button variant="secondary" onClick={() => void fetchBlueprintData()} disabled={blueprintLoading}>
                Refresh
              </Button>
              <Button variant="secondary" onClick={() => void clearBlueprintData()} disabled={blueprintLoading || !blueprintData}>
                Clear blueprint
              </Button>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              {blueprintData
                ? `${blueprintData.filename} · Customer: ${blueprintData.customer} · ${blueprintData.analysisPeriod}`
                : 'No blueprint PDF loaded yet.'}
            </div>
          </CardContent>
        </Card>
        </>
      )}

      {panel === 'customers' && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Select Customer</CardTitle>
                <CardDescription>Use the shared metadata uploaded in Admin.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Search customers..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  disabled={customers.length === 0}
                />
                <select
                  className="h-10 w-full rounded-md border border-app-border bg-white px-3 text-sm"
                  value={selectedCustomer}
                  disabled={filteredCustomers.length === 0}
                  onChange={(event) => setSelectedCustomer(event.target.value)}
                >
                  <option value="">{rows.length ? 'Select a customer' : 'Upload metadata in Admin first'}</option>
                  {filteredCustomers.map((customer) => (
                    <option key={customer} value={customer}>
                      {customer}
                    </option>
                  ))}
                </select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Customer Details</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedCustomer ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="text-slate-500">Industry</span>
                      <span className="font-semibold text-slate-900">
                        {summary.industry}
                        {summary.industryMultiple ? ' (multiple values)' : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Sub-Industry</span>
                      <span className="font-semibold text-slate-900">
                        {summary.subIndustry}
                        {summary.subIndustryMultiple ? ' (multiple values)' : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                      <span className="text-slate-500">Annual Expense Reports</span>
                      <span className="font-semibold text-slate-900">
                        {summary.annualExpenseReports === null ? 'Not available' : summary.annualExpenseReports.toLocaleString()}
                        {summary.annualExpenseReportsMultiple ? ' (multiple values)' : ''}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Select a customer to view details.</p>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Customer Operating Inputs</CardTitle>
                <CardDescription>Capture operating assumptions for the selected customer.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Number of auditors processing and auditing expense reports</label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        disabled={!selectedCustomer}
                        value={Math.min(Number(selectedOperationalAnswers.auditorCount) || 0, 100)}
                        onChange={(e) => {
                          if (!selectedCustomer) return;
                          setCustomerOperationalAnswers((prev) => ({
                            ...prev,
                            [selectedCustomer]: {
                              ...(prev[selectedCustomer] ?? { auditorCount: '', reimbursementCycleTime: '', reimbursementCycleTimeCustom: '' }),
                              auditorCount: e.target.value,
                            },
                          }));
                        }}
                        className="w-full accent-violet-600 disabled:opacity-40"
                      />
                      <span className="text-sm font-semibold text-slate-700 w-8 text-right">
                        {Number(selectedOperationalAnswers.auditorCount) || 0}
                      </span>
                    </div>
                    {Number(selectedOperationalAnswers.auditorCount) >= 100 && (
                      <Input
                        type="number"
                        min={100}
                        placeholder="Enter exact number of auditors"
                        disabled={!selectedCustomer}
                        value={selectedOperationalAnswers.auditorCount}
                        onChange={(e) => {
                          if (!selectedCustomer) return;
                          setCustomerOperationalAnswers((prev) => ({
                            ...prev,
                            [selectedCustomer]: {
                              ...(prev[selectedCustomer] ?? { auditorCount: '', reimbursementCycleTime: '', reimbursementCycleTimeCustom: '' }),
                              auditorCount: e.target.value,
                            },
                          }));
                        }}
                      />
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Expense Reimbursement Cycle Time</label>
                  <select
                    className="h-10 w-full rounded-md border border-app-border bg-white px-3 text-sm disabled:bg-slate-50"
                    disabled={!selectedCustomer}
                    value={selectedOperationalAnswers.reimbursementCycleTime}
                    onChange={(event) => {
                      if (!selectedCustomer) return;
                      const nextValue = event.target.value as CustomerOperationalAnswers['reimbursementCycleTime'];
                      setCustomerOperationalAnswers((prev) => ({
                        ...prev,
                        [selectedCustomer]: {
                          ...(prev[selectedCustomer] ?? { auditorCount: '', reimbursementCycleTime: '', reimbursementCycleTimeCustom: '' }),
                          reimbursementCycleTime: nextValue,
                          reimbursementCycleTimeCustom: nextValue !== 'other' ? '' : (prev[selectedCustomer]?.reimbursementCycleTimeCustom ?? ''),
                        },
                      }));
                    }}
                  >
                    <option value="">{selectedCustomer ? 'Select cycle time' : 'Select a customer first'}</option>
                    <option value="1 Day">1 Day</option>
                    <option value="2 Days">2 Days</option>
                    <option value="4 Days">4 Days</option>
                    <option value="7 Days">7 Days</option>
                    <option value="14 Days">14 Days</option>
                    <option value="other">Other</option>
                  </select>
                  {selectedOperationalAnswers.reimbursementCycleTime === 'other' && (
                    <Input
                      placeholder="Enter custom cycle time"
                      disabled={!selectedCustomer}
                      value={selectedOperationalAnswers.reimbursementCycleTimeCustom}
                      onChange={(e) => {
                        if (!selectedCustomer) return;
                        setCustomerOperationalAnswers((prev) => ({
                          ...prev,
                          [selectedCustomer]: {
                            ...(prev[selectedCustomer] ?? { auditorCount: '', reimbursementCycleTime: '', reimbursementCycleTimeCustom: '' }),
                            reimbursementCycleTimeCustom: e.target.value,
                          },
                        }));
                      }}
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Top Models by High-Risk Lines</CardTitle>
                <CardDescription>Ranking, performance metrics, and model distribution for the selected customer.</CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedCustomer ? (
                  <p className="text-sm text-slate-500">Select a customer to see top model analytics.</p>
                ) : summary.totalHighRisk === 0 ? (
                  <p className="text-sm text-slate-500">No high-risk lines found for this customer.</p>
                ) : (
                  <div className="space-y-5">
                    <div className="overflow-x-auto rounded-xl border border-app-border">
                      <table className="w-full min-w-[700px] text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-3 py-2 text-left">Rank</th>
                            <th className="px-3 py-2 text-left">Model</th>
                            <th className="px-3 py-2 text-left">Total High-Risk Lines</th>
                            <th className="px-3 py-2 text-left">Total Returned Lines</th>
                            <th className="px-3 py-2 text-left">Distribution</th>
                          </tr>
                        </thead>
                        <tbody>
                          {top5.map((item, index) => {
                            const highRiskPct = (item.total / top5MaxTotal) * 100;
                            const returnedWithinPct = item.total > 0 ? (item.returned / item.total) * 100 : 0;
                            return (
                              <tr key={item.model} className="border-t border-slate-100">
                                <td className="px-3 py-2">
                                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold">
                                    {index + 1}
                                  </span>
                                </td>
                                <td className="px-3 py-2 font-medium text-slate-900">{item.model}</td>
                                <td className="px-3 py-2">{item.total.toLocaleString()}</td>
                                <td className="px-3 py-2">{item.returned.toLocaleString()}</td>
                                <td className="px-3 py-2">
                                  <div className="relative h-3 w-32 overflow-hidden rounded bg-slate-100">
                                    <div className="absolute inset-y-0 left-0 rounded bg-slate-300" style={{ width: `${highRiskPct.toFixed(1)}%` }} />
                                    <div className="absolute inset-y-0 left-0 rounded bg-slate-600" style={{ width: `${(highRiskPct * returnedWithinPct / 100).toFixed(1)}%` }} />
                                  </div>
                                  <p className="mt-0.5 text-[10px] text-slate-400">{returnedWithinPct.toFixed(1)}% returned</p>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-app-border">
                      <table className="w-full min-w-[760px] text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-3 py-2 text-left">Rank</th>
                            <th className="px-3 py-2 text-left">Model</th>
                            <th className="px-3 py-2 text-left">Automation Impact</th>
                            <th className="px-3 py-2 text-left">Rejection Rate</th>
                            <th className="px-3 py-2 text-left">Approval Rate</th>
                            <th className="px-3 py-2 text-left">Distribution</th>
                          </tr>
                        </thead>
                        <tbody>
                          {top5.map((item, index) => {
                            const autoImpact = summary.totalHighRisk ? ((item.total / summary.totalHighRisk) * 100).toFixed(1) : '0.0';
                            const rejectionRate = item.total ? ((item.returned / item.total) * 100).toFixed(1) : '0.0';
                            const approvalRate = item.total ? (((item.total - item.returned) / item.total) * 100).toFixed(1) : '0.0';
                            const rejectionBarPct = item.total > 0 ? (item.returned / item.total) * 100 : 0;
                            return (
                              <tr key={`perf-${item.model}`} className="border-t border-slate-100">
                                <td className="px-3 py-2">{index + 1}</td>
                                <td className="px-3 py-2 font-medium text-slate-900">{item.model}</td>
                                <td className="px-3 py-2">{autoImpact}%</td>
                                <td className="px-3 py-2">{rejectionRate}%</td>
                                <td className="px-3 py-2">{approvalRate}%</td>
                                <td className="px-3 py-2">
                                  <div className="relative h-3 w-32 overflow-hidden rounded bg-slate-100">
                                    <div className="absolute inset-y-0 left-0 rounded bg-emerald-400" style={{ width: `${(100 - rejectionBarPct).toFixed(1)}%` }} />
                                    <div className="absolute inset-y-0 right-0 rounded bg-red-300" style={{ width: `${rejectionBarPct.toFixed(1)}%` }} />
                                  </div>
                                  <p className="mt-0.5 text-[10px] text-slate-400">{(100 - rejectionBarPct).toFixed(1)}% approved</p>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">High-Risk Lines Heatmap · Model vs Expense Type</p>
                      {heatmap ? (
                        <div className="overflow-x-auto rounded-xl border border-app-border">
                          <table className="w-full min-w-[760px] text-xs">
                            <thead className="bg-slate-50 uppercase tracking-wide text-slate-500">
                              <tr>
                                <th className="px-3 py-2 text-left">Model</th>
                                {heatmap.expenseTypes.map((expense) => (
                                  <th key={expense} className="px-3 py-2 text-center">
                                    {expense.length > 16 ? `${expense.slice(0, 15)}...` : expense}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {heatmap.models.map((model) => (
                                <tr key={`heat-${model}`} className="border-t border-slate-100">
                                  <td className="bg-slate-50 px-3 py-2 font-medium text-slate-700">{model}</td>
                                  {heatmap.expenseTypes.map((expense) => {
                                    const value = heatmap.matrix[model][expense];
                                    const style = heatColor(value, maxHeat);
                                    return (
                                      <td key={`${model}-${expense}`} className="px-3 py-2 text-center font-semibold" style={style}>
                                        {value ? value.toLocaleString() : '–'}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">No standard models found for this customer.</p>
                      )}
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      Customer <strong className="text-slate-900">{selectedCustomer}</strong> has{' '}
                      <strong className="text-slate-900">{summary.totalRows.toLocaleString()}</strong> total rows and{' '}
                      <strong className="text-slate-900">{summary.totalHighRisk.toLocaleString()}</strong> high-risk lines.
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>ROI Impact Calculator</CardTitle>
                <CardDescription>Adjust assumptions to estimate operational impact for top high-risk model lines.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Volume basis toggle */}
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">High-Risk Volume Basis</p>
                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => setRoiVolumeMode('top5')}
                      className={cn(
                        'rounded-md px-4 py-1.5 text-xs font-semibold transition-colors',
                        roiVolumeMode === 'top5'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      )}
                    >
                      Top 5 Models
                      {top5TotalHighRisk > 0 && (
                        <span className={cn('ml-1.5 rounded-full px-1.5 py-0.5 text-xs', roiVolumeMode === 'top5' ? 'bg-slate-100 text-slate-600' : 'bg-slate-200 text-slate-500')}>
                          {top5TotalHighRisk.toLocaleString()}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRoiVolumeMode('all')}
                      className={cn(
                        'rounded-md px-4 py-1.5 text-xs font-semibold transition-colors',
                        roiVolumeMode === 'all'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      )}
                    >
                      All Models
                      {summary.totalHighRisk > 0 && (
                        <span className={cn('ml-1.5 rounded-full px-1.5 py-0.5 text-xs', roiVolumeMode === 'all' ? 'bg-slate-100 text-slate-600' : 'bg-slate-200 text-slate-500')}>
                          {summary.totalHighRisk.toLocaleString()}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRoiVolumeMode('single'); if (!roiSingleModel && top5[0]) setRoiSingleModel(top5[0].model); }}
                      className={cn(
                        'rounded-md px-4 py-1.5 text-xs font-semibold transition-colors',
                        roiVolumeMode === 'single'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      )}
                    >
                      Single Model
                    </button>
                  </div>
                  {roiVolumeMode === 'single' && top5.length > 0 && (
                    <select
                      value={roiSingleModel}
                      onChange={(e) => setRoiSingleModel(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    >
                      {top5.map((m) => (
                        <option key={m.model} value={m.model}>
                          {m.model} — {m.total.toLocaleString()} lines
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="text-xs text-slate-400">
                    {roiVolumeMode === 'top5'
                      ? 'Using top 5 models by high-risk line volume as the ROI basis.'
                      : roiVolumeMode === 'all'
                      ? 'Using total high-risk line volume across all models as the ROI basis.'
                      : roiSingleModel
                      ? `Using ${roiSingleModel} (${(top5.find((m) => m.model === roiSingleModel)?.total ?? 0).toLocaleString()} lines) as the ROI basis.`
                      : 'Select a model from the list above.'}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Time Saved per High-Risk Line</p>
                    <p className="mb-2 text-xs text-slate-500">Minutes per line</p>
                    <input
                      type="range"
                      min={1}
                      max={30}
                      step={1}
                      value={timeMinutes}
                      onChange={(event) => setTimeMinutes(Number(event.target.value))}
                      className="w-full"
                    />
                    <p className="mt-1 text-right text-sm font-semibold text-slate-700">{timeMinutes} min</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Agent Credit Consumption</p>
                    <p className="mb-2 text-xs text-slate-500">Credits per action</p>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      step={1}
                      value={creditsPerAction}
                      onChange={(event) => setCreditsPerAction(Number(event.target.value))}
                      className="w-full"
                    />
                    <p className="mt-1 text-right text-sm font-semibold text-slate-700">{creditsPerAction} cr</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">FTE Fully Loaded Cost</p>
                    <p className="mb-2 text-xs text-slate-500">USD per year</p>
                    <input
                      type="range"
                      min={20000}
                      max={200000}
                      step={1000}
                      value={fteCost}
                      onChange={(event) => setFteCost(Number(event.target.value))}
                      className="w-full"
                    />
                    <p className="mt-1 text-right text-sm font-semibold text-slate-700">${fteCost.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cost per Credit</p>
                    <p className="mb-2 text-xs text-slate-500">USD per credit</p>
                    <input
                      type="range"
                      min={0.01}
                      max={2.00}
                      step={0.01}
                      value={costPerCredit}
                      onChange={(event) => setCostPerCredit(Number(event.target.value))}
                      className="w-full"
                    />
                    <p className="mt-1 text-right text-sm font-semibold text-slate-700">${costPerCredit.toFixed(2)}</p>
                  </div>
                </div>

                {roi ? (
                  <div className="grid gap-3 md:grid-cols-5">
                    <div className="rounded-xl bg-slate-900 px-4 py-4 text-center text-white">
                      <p className="text-xs uppercase tracking-wide text-slate-300">Auditor Time Saved</p>
                      <p className="mt-1 text-xl font-semibold">{roi.displayTime}</p>
                      <p className="mt-1 text-xs text-slate-400">{roi.timeSavedMins.toLocaleString()} minutes total</p>
                    </div>
                    <div className="rounded-xl bg-slate-900 px-4 py-4 text-center text-white">
                      <p className="text-xs uppercase tracking-wide text-slate-300">FTE Equivalent</p>
                      <p className="mt-1 text-xl font-semibold">{roi.fteEquivalent.toFixed(2)}</p>
                      <p className="mt-1 text-xs text-slate-400">1,920 hrs / FTE / year</p>
                    </div>
                    <div className="rounded-xl bg-slate-900 px-4 py-4 text-center text-white">
                      <p className="text-xs uppercase tracking-wide text-slate-300">FTE Savings</p>
                      <p className="mt-1 text-xl font-semibold">${Math.round(roi.fteSavings).toLocaleString()}</p>
                      <p className="mt-1 text-xs text-slate-400">at ${fteCost.toLocaleString()} loaded cost</p>
                    </div>
                    <div className="rounded-xl bg-slate-900 px-4 py-4 text-center text-white">
                      <p className="text-xs uppercase tracking-wide text-slate-300">Credit Consumption</p>
                      <p className="mt-1 text-xl font-semibold">{roi.creditConsumption.toLocaleString()}</p>
                      <p className="mt-1 text-xs text-slate-400">{creditsPerAction} credits per action</p>
                    </div>
                    <div className="rounded-xl bg-slate-900 px-4 py-4 text-center text-white">
                      <p className="text-xs uppercase tracking-wide text-slate-300">Cost of Credit</p>
                      <p className="mt-1 text-xl font-semibold">${(roi.creditConsumption * costPerCredit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      <p className="mt-1 text-xs text-slate-400">${costPerCredit.toFixed(2)} per credit</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Select a customer to see ROI metrics.</p>
                )}

                {roi && (() => {
                  const roiValue = roi.fteSavings - (roi.creditConsumption * costPerCredit);
                  const roiPositive = roiValue >= 0;
                  return (
                    <div className={`overflow-hidden rounded-xl border-2 ${roiPositive ? 'border-green-400' : 'border-red-400'}`}>
                      <div className={`px-6 py-5 text-center ${roiPositive ? 'bg-green-500' : 'bg-red-500'}`}>
                        <p className="text-xs font-semibold uppercase tracking-widest text-white/80">Return on Investment</p>
                        <p className="mt-1 text-4xl font-bold text-white">${Math.abs(Math.round(roiValue)).toLocaleString()}</p>
                        <p className="mt-1 text-sm font-semibold text-white/90">{roiPositive ? 'Net Gain' : 'Net Cost'}</p>
                      </div>
                      <div className={`flex items-start gap-3 px-4 py-3 text-sm font-medium ${roiPositive ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                        <span className="mt-0.5 text-base">{roiPositive ? '✓' : '✗'}</span>
                        <span>
                          Return on Investment: <strong>${Math.abs(Math.round(roiValue)).toLocaleString()}</strong> {roiPositive ? 'net gain' : 'net cost'}.
                          {' '}FTE Savings Cost (${Math.round(roi.fteSavings).toLocaleString()}) − Cost of Credits (${Math.round(roi.creditConsumption * costPerCredit).toLocaleString()}).
                          {' '}{roiPositive ? 'Automation delivers a positive return.' : 'Credit costs currently exceed FTE savings.'}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {roi && selectedOperationalAnswers.auditorCount !== '' && (
                  (() => {
                    const auditors = Number(selectedOperationalAnswers.auditorCount);
                    const fteDelta = auditors - roi.fteEquivalent;
                    const isPositive = fteDelta >= 0;
                    return (
                      <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm font-medium ${isPositive ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
                        <span className="mt-0.5 text-base">{isPositive ? '✓' : '✗'}</span>
                        <span>
                          FTE headcount required: <strong>{fteDelta.toFixed(2)} FTE</strong>
                          {' '}({auditors} auditors entered − {roi.fteEquivalent.toFixed(2)} FTE equivalent).
                          {' '}{isPositive ? 'Automation covers the equivalent of these auditors, freeing capacity.' : 'Automation does not yet cover the full auditor headcount — additional efficiency gains needed.'}
                        </span>
                      </div>
                    );
                  })()
                )}

                {roi && selectedOperationalAnswers.reimbursementCycleTime && (
                  <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
                    <span className="mt-0.5 text-base">✓</span>
                    <span>
                      Decision Cycle Time Compression: expense processing cycle time reduced from{' '}
                      <strong>
                        {selectedOperationalAnswers.reimbursementCycleTime === 'other'
                          ? (selectedOperationalAnswers.reimbursementCycleTimeCustom || 'custom')
                          : selectedOperationalAnswers.reimbursementCycleTime}
                      </strong>{' '}
                      to <strong>1–2 hours with Agents</strong>.
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                  <Button variant="secondary" onClick={() => void downloadPdfReport()} disabled={!selectedCustomer || exporting}>
                    <Download className="h-4 w-4" />
                    Download PDF
                  </Button>
                  <Button variant="secondary" onClick={() => void downloadWordReport()} disabled={!selectedCustomer || exporting}>
                    <Download className="h-4 w-4" />
                    Download Word
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="pointer-events-none fixed -left-[100000px] top-0 z-[-1] w-[1200px] p-8" style={{ background: '#F7F6F2', fontFamily: "'Manrope', Arial, sans-serif" }} aria-hidden="true">
            <div ref={reportExportRef} className="space-y-4">
              {/* Branded header — Cacao background (brand primary dark) */}
              <div className="rounded-2xl overflow-hidden" style={{ background: '#3D3533' }}>
                <div className="px-8 pt-8 pb-5">
                  <div className="flex items-center justify-between">
                    {/* AppZen logo */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/appzen-logo.png" alt="AppZen" style={{ height: '32px', width: 'auto' }} />
                    <span style={{ color: '#B6B0A2', fontSize: '0.8rem' }}>{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                  <h1 className="mt-5" style={{ color: '#FEFDF9', fontSize: '2.25rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>AI Agent Transformation</h1>
                  <p className="mt-1" style={{ color: '#FEF76C', fontSize: '1.25rem', fontWeight: 600 }}>{selectedCustomer || 'No customer selected'}</p>
                </div>
                <div style={{ height: '1px', background: 'rgba(254,253,249,0.15)' }} />
                <div className="flex gap-8 px-8 py-4">
                  {summary.industry && <span style={{ color: '#B6B0A2', fontSize: '0.8rem' }}><span style={{ color: '#FEFDF9', fontWeight: 600 }}>Industry: </span>{summary.industry}</span>}
                  {summary.subIndustry && <span style={{ color: '#B6B0A2', fontSize: '0.8rem' }}><span style={{ color: '#FEFDF9', fontWeight: 600 }}>Sub-Industry: </span>{summary.subIndustry}</span>}
                  {summary.totalHighRisk > 0 && <span style={{ color: '#B6B0A2', fontSize: '0.8rem' }}><span style={{ color: '#FEFDF9', fontWeight: 600 }}>High-Risk Lines: </span>{summary.totalHighRisk.toLocaleString()}</span>}
                </div>
              </div>

              <Card style={{ background: '#FEFDF9', border: '1px solid #E2DDD2' }}>
                <CardHeader style={{ borderBottom: '1px solid #E2DDD2' }}>
                  <CardTitle style={{ color: '#3D3533', fontFamily: "'Manrope', Arial, sans-serif" }}>ROI Impact Calculator</CardTitle>
                </CardHeader>
                <CardContent>
                  {roi ? (
                    <div className="grid gap-3 grid-cols-5">
                      {/* Cacao tiles with Cassava labels */}
                      <div className="rounded-xl px-4 py-4 text-center" style={{ background: '#3D3533' }}>
                        <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#FEF76C', letterSpacing: '0.08em' }}>Auditor Time Saved</p>
                        <p className="mt-1 text-xl font-bold" style={{ color: '#FEFDF9' }}>{roi.displayTime}</p>
                        <p className="mt-1 text-xs" style={{ color: '#B6B0A2' }}>{roi.timeSavedMins.toLocaleString()} minutes total</p>
                      </div>
                      <div className="rounded-xl px-4 py-4 text-center" style={{ background: '#3D3533' }}>
                        <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#FEF76C', letterSpacing: '0.08em' }}>FTE Equivalent</p>
                        <p className="mt-1 text-xl font-bold" style={{ color: '#FEFDF9' }}>{roi.fteEquivalent.toFixed(2)}</p>
                        <p className="mt-1 text-xs" style={{ color: '#B6B0A2' }}>1,920 hrs / FTE / year</p>
                      </div>
                      <div className="rounded-xl px-4 py-4 text-center" style={{ background: '#3D3533' }}>
                        <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#FEF76C', letterSpacing: '0.08em' }}>FTE Savings</p>
                        <p className="mt-1 text-xl font-bold" style={{ color: '#FEFDF9' }}>${Math.round(roi.fteSavings).toLocaleString()}</p>
                        <p className="mt-1 text-xs" style={{ color: '#B6B0A2' }}>at ${fteCost.toLocaleString()} loaded cost</p>
                      </div>
                      {/* Stone tiles for consumption metrics */}
                      <div className="rounded-xl px-4 py-4 text-center" style={{ background: '#544D45' }}>
                        <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#E2DDD2', letterSpacing: '0.08em' }}>Credit Consumption</p>
                        <p className="mt-1 text-xl font-bold" style={{ color: '#FEFDF9' }}>{roi.creditConsumption.toLocaleString()}</p>
                        <p className="mt-1 text-xs" style={{ color: '#B6B0A2' }}>{creditsPerAction} credits per action</p>
                      </div>
                      <div className="rounded-xl px-4 py-4 text-center" style={{ background: '#544D45' }}>
                        <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#E2DDD2', letterSpacing: '0.08em' }}>Cost of Credit</p>
                        <p className="mt-1 text-xl font-bold" style={{ color: '#FEFDF9' }}>${(roi.creditConsumption * costPerCredit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <p className="mt-1 text-xs" style={{ color: '#B6B0A2' }}>${costPerCredit.toFixed(2)} per credit</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm" style={{ color: '#746C60' }}>Select a customer to see ROI metrics.</p>
                  )}

                  {roi && (() => {
                    const roiValue = roi.fteSavings - (roi.creditConsumption * costPerCredit);
                    const roiPositive = roiValue >= 0;
                    return (
                      <div className="mt-3 overflow-hidden rounded-xl" style={{ border: roiPositive ? '2px solid #0BDC4D' : '2px solid #F35F45' }}>
                        <div className="px-6 py-5 text-center" style={{ background: roiPositive ? '#0BDC4D' : '#F35F45' }}>
                          <p style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.8)' }}>Return on Investment</p>
                          <p style={{ marginTop: '4px', fontSize: '2.25rem', fontWeight: 700, color: '#ffffff' }}>${Math.abs(Math.round(roiValue)).toLocaleString()}</p>
                          <p style={{ marginTop: '4px', fontSize: '0.875rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{roiPositive ? 'Net Gain' : 'Net Cost'}</p>
                        </div>
                        <div className="flex items-start gap-3 px-4 py-3 text-sm font-medium" style={roiPositive
                          ? { background: '#C5ECD0', color: '#3D3533' }
                          : { background: '#FCD6CF', color: '#3D3533' }}>
                          <span style={{ marginTop: '2px' }}>{roiPositive ? '✓' : '✗'}</span>
                          <span>
                            Return on Investment: <strong>${Math.abs(Math.round(roiValue)).toLocaleString()}</strong> {roiPositive ? 'net gain' : 'net cost'}.
                            {' '}FTE Savings Cost (${Math.round(roi.fteSavings).toLocaleString()}) − Cost of Credits (${Math.round(roi.creditConsumption * costPerCredit).toLocaleString()}).
                            {' '}{roiPositive ? 'Automation delivers a positive return.' : 'Credit costs currently exceed FTE savings.'}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {roi && selectedOperationalAnswers.auditorCount !== '' && (() => {
                    const auditors = Number(selectedOperationalAnswers.auditorCount);
                    const fteDelta = auditors - roi.fteEquivalent;
                    const isPositive = fteDelta >= 0;
                    return (
                      <div className="mt-3 flex items-start gap-3 rounded-lg px-4 py-3 text-sm font-medium" style={isPositive
                        ? { background: '#C5ECD0', border: '1px solid #0BDC4D', color: '#3D3533' }
                        : { background: '#FCD6CF', border: '1px solid #F35F45', color: '#3D3533' }}>
                        <span className="mt-0.5 text-base">{isPositive ? '✓' : '✗'}</span>
                        <span>
                          FTE headcount required: <strong>{fteDelta.toFixed(2)} FTE</strong>
                          {' '}({auditors} auditors entered − {roi.fteEquivalent.toFixed(2)} FTE equivalent).
                          {' '}{isPositive ? 'Automation covers the equivalent of these auditors, freeing capacity.' : 'Automation does not yet cover the full auditor headcount — additional efficiency gains needed.'}
                        </span>
                      </div>
                    );
                  })()}

                  {roi && selectedOperationalAnswers.reimbursementCycleTime && (
                    <div className="mt-3 flex items-start gap-3 rounded-lg px-4 py-3 text-sm font-medium" style={{ background: '#C5ECD0', border: '1px solid #0BDC4D', color: '#3D3533' }}>
                      <span className="mt-0.5 text-base">✓</span>
                      <span>
                        Decision Cycle Time Compression: expense processing cycle time reduced from{' '}
                        <strong>
                          {selectedOperationalAnswers.reimbursementCycleTime === 'other'
                            ? (selectedOperationalAnswers.reimbursementCycleTimeCustom || 'custom')
                            : selectedOperationalAnswers.reimbursementCycleTime}
                        </strong>{' '}
                        to <strong>1–2 hours with Agents</strong>.
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card style={{ background: '#FEFDF9', border: '1px solid #E2DDD2' }}>
                <CardHeader style={{ borderBottom: '1px solid #E2DDD2' }}>
                  <CardTitle style={{ color: '#3D3533', fontFamily: "'Manrope', Arial, sans-serif" }}>Customer Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="text-slate-500">Industry</span>
                      <span className="font-semibold text-slate-900">
                        {summary.industry}
                        {summary.industryMultiple ? ' (multiple values)' : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Sub-Industry</span>
                      <span className="font-semibold text-slate-900">
                        {summary.subIndustry}
                        {summary.subIndustryMultiple ? ' (multiple values)' : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                      <span className="text-slate-500">Annual Expense Reports</span>
                      <span className="font-semibold text-slate-900">
                        {summary.annualExpenseReports === null ? 'Not available' : summary.annualExpenseReports.toLocaleString()}
                        {summary.annualExpenseReportsMultiple ? ' (multiple values)' : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                      <span className="text-slate-500">Number of auditors processing and auditing expense reports</span>
                      <span className="font-semibold text-slate-900">{selectedOperationalAnswers.auditorCount || 'Not specified'}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                      <span className="text-slate-500">Expense Reimbursement Cycle Time</span>
                      <span className="font-semibold text-slate-900">
                        {selectedOperationalAnswers.reimbursementCycleTime === 'other'
                          ? (selectedOperationalAnswers.reimbursementCycleTimeCustom || 'Other')
                          : (selectedOperationalAnswers.reimbursementCycleTime || 'Not specified')}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card style={{ background: '#FEFDF9', border: '1px solid #E2DDD2' }}>
                <CardHeader style={{ borderBottom: '1px solid #E2DDD2' }}>
                  <CardTitle style={{ color: '#3D3533', fontFamily: "'Manrope', Arial, sans-serif" }}>Top Models by High-Risk Lines</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-5">
                    <div className="overflow-x-auto rounded-xl border border-app-border">
                      <table className="w-full min-w-[700px] text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-3 py-2 text-left">Rank</th>
                            <th className="px-3 py-2 text-left">Model</th>
                            <th className="px-3 py-2 text-left">Total High-Risk Lines</th>
                            <th className="px-3 py-2 text-left">Total Returned Lines</th>
                            <th className="px-3 py-2 text-left">Distribution</th>
                          </tr>
                        </thead>
                        <tbody>
                          {top5.map((item, index) => {
                            const highRiskPct = (item.total / top5MaxTotal) * 100;
                            const returnedWithinPct = item.total > 0 ? (item.returned / item.total) * 100 : 0;
                            return (
                              <tr key={`exp-top-${item.model}`} className="border-t border-slate-100">
                                <td className="px-3 py-2">
                                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold">
                                    {index + 1}
                                  </span>
                                </td>
                                <td className="px-3 py-2 font-medium text-slate-900">{item.model}</td>
                                <td className="px-3 py-2">{item.total.toLocaleString()}</td>
                                <td className="px-3 py-2">{item.returned.toLocaleString()}</td>
                                <td className="px-3 py-2">
                                  <div className="relative h-3 w-32 overflow-hidden rounded bg-slate-100">
                                    <div className="absolute inset-y-0 left-0 rounded bg-slate-300" style={{ width: `${highRiskPct.toFixed(1)}%` }} />
                                    <div className="absolute inset-y-0 left-0 rounded bg-slate-600" style={{ width: `${(highRiskPct * returnedWithinPct / 100).toFixed(1)}%` }} />
                                  </div>
                                  <p className="mt-0.5 text-[10px] text-slate-400">{returnedWithinPct.toFixed(1)}% returned</p>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-app-border">
                      <table className="w-full min-w-[760px] text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-3 py-2 text-left">Rank</th>
                            <th className="px-3 py-2 text-left">Model</th>
                            <th className="px-3 py-2 text-left">Automation Impact</th>
                            <th className="px-3 py-2 text-left">Rejection Rate</th>
                            <th className="px-3 py-2 text-left">Approval Rate</th>
                            <th className="px-3 py-2 text-left">Distribution</th>
                          </tr>
                        </thead>
                        <tbody>
                          {top5.map((item, index) => {
                            const autoImpact = summary.totalHighRisk ? ((item.total / summary.totalHighRisk) * 100).toFixed(1) : '0.0';
                            const rejectionRate = item.total ? ((item.returned / item.total) * 100).toFixed(1) : '0.0';
                            const approvalRate = item.total ? (((item.total - item.returned) / item.total) * 100).toFixed(1) : '0.0';
                            const rejectionBarPct = item.total > 0 ? (item.returned / item.total) * 100 : 0;
                            return (
                              <tr key={`exp-perf-${item.model}`} className="border-t border-slate-100">
                                <td className="px-3 py-2">{index + 1}</td>
                                <td className="px-3 py-2 font-medium text-slate-900">{item.model}</td>
                                <td className="px-3 py-2">{autoImpact}%</td>
                                <td className="px-3 py-2">{rejectionRate}%</td>
                                <td className="px-3 py-2">{approvalRate}%</td>
                                <td className="px-3 py-2">
                                  <div className="relative h-3 w-32 overflow-hidden rounded bg-slate-100">
                                    <div className="absolute inset-y-0 left-0 rounded bg-emerald-400" style={{ width: `${(100 - rejectionBarPct).toFixed(1)}%` }} />
                                    <div className="absolute inset-y-0 right-0 rounded bg-red-300" style={{ width: `${rejectionBarPct.toFixed(1)}%` }} />
                                  </div>
                                  <p className="mt-0.5 text-[10px] text-slate-400">{(100 - rejectionBarPct).toFixed(1)}% approved</p>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        High-Risk Lines Heatmap · Model vs Expense Type
                      </p>
                      {heatmap ? (
                        <div className="space-y-3">
                          {exportHeatmapColumnGroups.map((group, groupIndex) => (
                            <div key={`exp-group-${groupIndex}`} className="rounded-xl border border-app-border">
                              <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                {groupIndex === 0
                                  ? 'Primary Heatmap View'
                                  : `Additional Heatmap Columns (Set ${groupIndex + 1})`}
                              </div>
                              <table className="w-full text-[11px]">
                                <thead className="bg-slate-50 uppercase tracking-wide text-slate-500">
                                  <tr>
                                    <th className="px-2 py-2 text-left">Model</th>
                                    {group.map((expense) => (
                                      <th key={`exp-${groupIndex}-${expense}`} className="px-2 py-2 text-center">
                                        {expense.length > 14 ? `${expense.slice(0, 13)}...` : expense}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {heatmap.models.map((model) => (
                                    <tr key={`exp-heat-${groupIndex}-${model}`} className="border-t border-slate-100">
                                      <td className="bg-slate-50 px-2 py-2 font-medium text-slate-700">{model}</td>
                                      {group.map((expense) => {
                                        const value = heatmap.matrix[model][expense];
                                        const style = heatColor(value, maxHeat);
                                        return (
                                          <td
                                            key={`exp-${groupIndex}-${model}-${expense}`}
                                            className="px-2 py-2 text-center font-semibold"
                                            style={style}
                                          >
                                            {value ? value.toLocaleString() : '-'}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))}
                          <p className="text-xs text-slate-500">
                            Export optimization: trailing low-signal columns (max value &lt; 10) are trimmed for readability.
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">No standard models found for this customer.</p>
                      )}
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      Customer <strong className="text-slate-900">{selectedCustomer}</strong> has{' '}
                      <strong className="text-slate-900">{summary.totalRows.toLocaleString()}</strong> total rows and{' '}
                      <strong className="text-slate-900">{summary.totalHighRisk.toLocaleString()}</strong> high-risk lines.
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Branded footer — Cacao */}
              <div className="rounded-2xl overflow-hidden" style={{ background: '#3D3533' }}>
                <div className="flex items-center justify-between px-8 py-5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/appzen-logo.png" alt="AppZen" style={{ height: '26px', width: 'auto' }} />
                  <span style={{ color: '#746C60', fontSize: '0.75rem' }}>AI Agent Transformation Report · Confidential</span>
                  <span style={{ color: '#746C60', fontSize: '0.75rem' }}>{new Date().getFullYear()} © AppZen</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {panel === 'prospect' && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Select Industry */}
            <Card>
              <CardHeader>
                <CardTitle>Select Industry</CardTitle>
                <CardDescription>Use the shared metadata uploaded in Admin.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Search industries..."
                  value={industrySearch}
                  onChange={(event) => setIndustrySearch(event.target.value)}
                  disabled={industries.length === 0}
                />
                <select
                  className="h-10 w-full rounded-md border border-app-border bg-white px-3 text-sm"
                  value={selectedIndustry}
                  disabled={filteredIndustries.length === 0}
                  onChange={(event) => { setSelectedIndustry(event.target.value); setSelectedSubIndustries([]); }}
                >
                  <option value="">{rows.length ? 'Select an industry' : 'Upload metadata in Admin first'}</option>
                  {filteredIndustries.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
                {selectedIndustry && availableSubIndustries.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Sub-Industry <span className="normal-case font-normal text-slate-400">(optional)</span>
                      </p>
                      {selectedSubIndustries.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedSubIndustries([])}
                          className="text-xs text-slate-400 hover:text-slate-600 underline"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="max-h-36 overflow-y-auto rounded-md border border-app-border bg-white p-2 space-y-1">
                      {availableSubIndustries.map((sub) => {
                        const checked = selectedSubIndustries.includes(sub);
                        return (
                          <label key={sub} className="flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-slate-50">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setSelectedSubIndustries((prev) =>
                                  checked ? prev.filter((s) => s !== sub) : [...prev, sub]
                                )
                              }
                              className="h-3.5 w-3.5 rounded border-slate-300 text-slate-800 accent-slate-800"
                            />
                            <span className="text-sm text-slate-700">{sub}</span>
                          </label>
                        );
                      })}
                    </div>
                    {selectedSubIndustries.length > 0 && (
                      <p className="text-xs text-slate-400">
                        Showing data for {selectedSubIndustries.length === 1 ? selectedSubIndustries[0] : `${selectedSubIndustries.length} sub-industries`}.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Industry Details */}
            <Card>
              <CardHeader>
                <CardTitle>Industry Details</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedIndustry ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="text-slate-500">Industry</span>
                      <span className="font-semibold text-slate-900">{industrySummary.industry}</span>
                    </div>
                    <div className="border-b border-slate-200 pb-2">
                      <span className="text-slate-500">Sub-Industries</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {industrySummary.subIndustries.map((sub) => (
                          <span key={sub} className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{sub}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2 pt-1">
                      <span className="text-slate-500">Avg High-Risk Lines (per customer)</span>
                      <span className="font-semibold text-slate-900">{industrySummary.avgHighRiskLinesPerCustomer.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-slate-500">Number of Customers</span>
                      <span className="font-semibold text-slate-900">{industrySummary.customerCount.toLocaleString()}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Select an industry to view details.</p>
                )}
              </CardContent>
            </Card>

            {/* Customer Operating Inputs */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Customer Operating Inputs</CardTitle>
                <CardDescription>Capture operating assumptions for the selected industry.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Number of auditors processing and auditing expense reports</label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        disabled={!selectedIndustry}
                        value={Math.min(Number(selectedIndustryOperationalAnswers.auditorCount) || 0, 100)}
                        onChange={(e) => {
                          if (!selectedIndustry) return;
                          setIndustryOperationalAnswers((prev) => ({
                            ...prev,
                            [selectedIndustry]: {
                              ...(prev[selectedIndustry] ?? { auditorCount: '', reimbursementCycleTime: '', reimbursementCycleTimeCustom: '' }),
                              auditorCount: e.target.value,
                            },
                          }));
                        }}
                        className="w-full accent-violet-600 disabled:opacity-40"
                      />
                      <span className="w-8 text-right text-sm font-semibold text-slate-700">
                        {Number(selectedIndustryOperationalAnswers.auditorCount) || 0}
                      </span>
                    </div>
                    {Number(selectedIndustryOperationalAnswers.auditorCount) >= 100 && (
                      <Input
                        type="number"
                        min={100}
                        placeholder="Enter exact number of auditors"
                        disabled={!selectedIndustry}
                        value={selectedIndustryOperationalAnswers.auditorCount}
                        onChange={(e) => {
                          if (!selectedIndustry) return;
                          setIndustryOperationalAnswers((prev) => ({
                            ...prev,
                            [selectedIndustry]: {
                              ...(prev[selectedIndustry] ?? { auditorCount: '', reimbursementCycleTime: '', reimbursementCycleTimeCustom: '' }),
                              auditorCount: e.target.value,
                            },
                          }));
                        }}
                      />
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Expense Reimbursement Cycle Time</label>
                  <select
                    className="h-10 w-full rounded-md border border-app-border bg-white px-3 text-sm disabled:bg-slate-50"
                    disabled={!selectedIndustry}
                    value={selectedIndustryOperationalAnswers.reimbursementCycleTime}
                    onChange={(event) => {
                      if (!selectedIndustry) return;
                      const nextValue = event.target.value as CustomerOperationalAnswers['reimbursementCycleTime'];
                      setIndustryOperationalAnswers((prev) => ({
                        ...prev,
                        [selectedIndustry]: {
                          ...(prev[selectedIndustry] ?? { auditorCount: '', reimbursementCycleTime: '', reimbursementCycleTimeCustom: '' }),
                          reimbursementCycleTime: nextValue,
                          reimbursementCycleTimeCustom: nextValue !== 'other' ? '' : (prev[selectedIndustry]?.reimbursementCycleTimeCustom ?? ''),
                        },
                      }));
                    }}
                  >
                    <option value="">{selectedIndustry ? 'Select cycle time' : 'Select an industry first'}</option>
                    <option value="1 Day">1 Day</option>
                    <option value="2 Days">2 Days</option>
                    <option value="4 Days">4 Days</option>
                    <option value="7 Days">7 Days</option>
                    <option value="14 Days">14 Days</option>
                    <option value="other">Other</option>
                  </select>
                  {selectedIndustryOperationalAnswers.reimbursementCycleTime === 'other' && (
                    <Input
                      placeholder="Enter custom cycle time"
                      disabled={!selectedIndustry}
                      value={selectedIndustryOperationalAnswers.reimbursementCycleTimeCustom}
                      onChange={(e) => {
                        if (!selectedIndustry) return;
                        setIndustryOperationalAnswers((prev) => ({
                          ...prev,
                          [selectedIndustry]: {
                            ...(prev[selectedIndustry] ?? { auditorCount: '', reimbursementCycleTime: '', reimbursementCycleTimeCustom: '' }),
                            reimbursementCycleTimeCustom: e.target.value,
                          },
                        }));
                      }}
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Top Models by High-Risk Lines */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Top Models by High-Risk Lines</CardTitle>
                <CardDescription>Ranking, performance metrics, and model distribution for the selected industry (standard models).</CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedIndustry ? (
                  <p className="text-sm text-slate-500">Select an industry to see top model analytics.</p>
                ) : industryTop5TotalHighRisk === 0 ? (
                  <p className="text-sm text-slate-500">No high-risk lines found for this industry.</p>
                ) : (
                  <div className="space-y-5">
                    <div className="overflow-x-auto rounded-xl border border-app-border">
                      <table className="w-full min-w-[700px] text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-3 py-2 text-left">Rank</th>
                            <th className="px-3 py-2 text-left">Model</th>
                            <th className="px-3 py-2 text-left">Total High-Risk Lines</th>
                            <th className="px-3 py-2 text-left">Total Returned Lines</th>
                            <th className="px-3 py-2 text-left">Distribution</th>
                          </tr>
                        </thead>
                        <tbody>
                          {industryTop5.map((item, index) => {
                            const highRiskPct = (item.total / industryTop5MaxTotal) * 100;
                            const returnedWithinPct = item.total > 0 ? (item.returned / item.total) * 100 : 0;
                            return (
                              <tr key={item.model} className="border-t border-slate-100">
                                <td className="px-3 py-2">
                                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold">{index + 1}</span>
                                </td>
                                <td className="px-3 py-2 font-medium text-slate-900">{item.model}</td>
                                <td className="px-3 py-2">{item.total.toLocaleString()}</td>
                                <td className="px-3 py-2">{item.returned.toLocaleString()}</td>
                                <td className="px-3 py-2">
                                  <div className="relative h-3 w-32 overflow-hidden rounded bg-slate-100">
                                    <div className="absolute inset-y-0 left-0 rounded bg-slate-300" style={{ width: `${highRiskPct.toFixed(1)}%` }} />
                                    <div className="absolute inset-y-0 left-0 rounded bg-slate-600" style={{ width: `${(highRiskPct * returnedWithinPct / 100).toFixed(1)}%` }} />
                                  </div>
                                  <p className="mt-0.5 text-[10px] text-slate-400">{returnedWithinPct.toFixed(1)}% returned</p>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-app-border">
                      <table className="w-full min-w-[760px] text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-3 py-2 text-left">Rank</th>
                            <th className="px-3 py-2 text-left">Model</th>
                            <th className="px-3 py-2 text-left">Automation Impact</th>
                            <th className="px-3 py-2 text-left">Rejection Rate</th>
                            <th className="px-3 py-2 text-left">Approval Rate</th>
                            <th className="px-3 py-2 text-left">Distribution</th>
                          </tr>
                        </thead>
                        <tbody>
                          {industryTop5.map((item, index) => {
                            const autoImpact = industryStdTotalHighRisk ? ((item.total / industryStdTotalHighRisk) * 100).toFixed(1) : '0.0';
                            const rejectionRate = item.total ? ((item.returned / item.total) * 100).toFixed(1) : '0.0';
                            const approvalRate = item.total ? (((item.total - item.returned) / item.total) * 100).toFixed(1) : '0.0';
                            const rejectionBarPct = item.total > 0 ? (item.returned / item.total) * 100 : 0;
                            return (
                              <tr key={`ind-perf-${item.model}`} className="border-t border-slate-100">
                                <td className="px-3 py-2">{index + 1}</td>
                                <td className="px-3 py-2 font-medium text-slate-900">{item.model}</td>
                                <td className="px-3 py-2">{autoImpact}%</td>
                                <td className="px-3 py-2">{rejectionRate}%</td>
                                <td className="px-3 py-2">{approvalRate}%</td>
                                <td className="px-3 py-2">
                                  <div className="relative h-3 w-32 overflow-hidden rounded bg-slate-100">
                                    <div className="absolute inset-y-0 left-0 rounded bg-emerald-400" style={{ width: `${(100 - rejectionBarPct).toFixed(1)}%` }} />
                                    <div className="absolute inset-y-0 right-0 rounded bg-red-300" style={{ width: `${rejectionBarPct.toFixed(1)}%` }} />
                                  </div>
                                  <p className="mt-0.5 text-[10px] text-slate-400">{(100 - rejectionBarPct).toFixed(1)}% approved</p>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">High-Risk Lines Heatmap · Model vs Expense Type</p>
                      {industryHeatmap ? (
                        <div className="overflow-x-auto rounded-xl border border-app-border">
                          <table className="w-full min-w-[760px] text-xs">
                            <thead className="bg-slate-50 uppercase tracking-wide text-slate-500">
                              <tr>
                                <th className="px-3 py-2 text-left">Model</th>
                                {industryHeatmap.expenseTypes.map((expense) => (
                                  <th key={expense} className="px-3 py-2 text-center">
                                    {expense.length > 16 ? `${expense.slice(0, 15)}...` : expense}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {industryHeatmap.models.map((model) => (
                                <tr key={`ind-heat-${model}`} className="border-t border-slate-100">
                                  <td className="bg-slate-50 px-3 py-2 font-medium text-slate-700">{model}</td>
                                  {industryHeatmap.expenseTypes.map((expense) => {
                                    const value = industryHeatmap.matrix[model][expense];
                                    const style = heatColor(value, industryMaxHeat);
                                    return (
                                      <td key={`${model}-${expense}`} className="px-3 py-2 text-center font-semibold" style={style}>
                                        {value ? value.toLocaleString() : '–'}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">No standard models found for this industry.</p>
                      )}
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      Industry <strong className="text-slate-900">{selectedIndustry}</strong> has{' '}
                      <strong className="text-slate-900">{industrySummary.customerCount.toLocaleString()}</strong> customers and{' '}
                      <strong className="text-slate-900">{industrySummary.totalHighRisk.toLocaleString()}</strong> high-risk lines.
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ROI Impact Calculator */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>ROI Impact Calculator</CardTitle>
                <CardDescription>Adjust assumptions to estimate operational impact for top high-risk model lines.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Volume basis toggle */}
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">High-Risk Volume Basis</p>
                  <div className="inline-flex flex-wrap rounded-lg border border-slate-200 bg-slate-100 p-1 gap-0.5">
                    <button
                      type="button"
                      onClick={() => setIndustryRoiVolumeMode('manual')}
                      className={cn(
                        'rounded-md px-4 py-1.5 text-xs font-semibold transition-colors',
                        industryRoiVolumeMode === 'manual'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      )}
                    >
                      Manual Entry
                    </button>
                    <button
                      type="button"
                      onClick={() => setIndustryRoiVolumeMode('top5')}
                      className={cn(
                        'rounded-md px-4 py-1.5 text-xs font-semibold transition-colors',
                        industryRoiVolumeMode === 'top5'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      )}
                    >
                      Top 5 Industry Models
                      {industryTop5TotalHighRisk > 0 && (
                        <span className={cn('ml-1.5 rounded-full px-1.5 py-0.5 text-xs', industryRoiVolumeMode === 'top5' ? 'bg-slate-100 text-slate-600' : 'bg-slate-200 text-slate-500')}>
                          {industryTop5TotalHighRisk.toLocaleString()}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIndustryRoiVolumeMode('all')}
                      className={cn(
                        'rounded-md px-4 py-1.5 text-xs font-semibold transition-colors',
                        industryRoiVolumeMode === 'all'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      )}
                    >
                      All Models
                      {industrySummary.totalHighRisk > 0 && (
                        <span className={cn('ml-1.5 rounded-full px-1.5 py-0.5 text-xs', industryRoiVolumeMode === 'all' ? 'bg-slate-100 text-slate-600' : 'bg-slate-200 text-slate-500')}>
                          {industrySummary.totalHighRisk.toLocaleString()}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIndustryRoiVolumeMode('single'); if (!industryRoiSingleModel && industryTop5[0]) setIndustryRoiSingleModel(industryTop5[0].model); }}
                      className={cn(
                        'rounded-md px-4 py-1.5 text-xs font-semibold transition-colors',
                        industryRoiVolumeMode === 'single'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      )}
                    >
                      Single Model
                    </button>
                  </div>
                  {industryRoiVolumeMode === 'manual' && (
                    <div className="mt-1 flex flex-col gap-1">
                      <label className="text-xs text-slate-500">Total high-risk lines currently flagged</label>
                      <input
                        type="number"
                        min={0}
                        placeholder="e.g. 12500"
                        value={industryRoiManualVolume}
                        onChange={(e) => setIndustryRoiManualVolume(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                      />
                    </div>
                  )}
                  {industryRoiVolumeMode === 'single' && industryTop5.length > 0 && (
                    <select
                      value={industryRoiSingleModel}
                      onChange={(e) => setIndustryRoiSingleModel(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    >
                      {industryTop5.map((m) => (
                        <option key={m.model} value={m.model}>
                          {m.model} — {m.total.toLocaleString()} lines
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="text-xs text-slate-400">
                    {industryRoiVolumeMode === 'manual'
                      ? industryRoiManualVolume && parseInt(industryRoiManualVolume, 10) > 0
                        ? `Using ${parseInt(industryRoiManualVolume, 10).toLocaleString()} manually entered high-risk lines as the ROI basis.`
                        : 'Enter the total number of high-risk lines currently flagged to calculate ROI.'
                      : industryRoiVolumeMode === 'top5'
                      ? 'Using top 5 industry models by high-risk line volume as the ROI basis.'
                      : industryRoiVolumeMode === 'all'
                      ? 'Using total high-risk line volume across all models as the ROI basis.'
                      : industryRoiSingleModel
                      ? `Using ${industryRoiSingleModel} (${(industryTop5.find((m) => m.model === industryRoiSingleModel)?.total ?? 0).toLocaleString()} lines) as the ROI basis.`
                      : 'Select a model from the list above.'}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Time Saved per High-Risk Line</p>
                    <p className="mb-2 text-xs text-slate-500">Minutes per line</p>
                    <input type="range" min={1} max={30} step={1} value={timeMinutes} onChange={(e) => setTimeMinutes(Number(e.target.value))} className="w-full" />
                    <p className="mt-1 text-right text-sm font-semibold text-slate-700">{timeMinutes} min</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Agent Credit Consumption</p>
                    <p className="mb-2 text-xs text-slate-500">Credits per action</p>
                    <input type="range" min={1} max={20} step={1} value={creditsPerAction} onChange={(e) => setCreditsPerAction(Number(e.target.value))} className="w-full" />
                    <p className="mt-1 text-right text-sm font-semibold text-slate-700">{creditsPerAction} cr</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">FTE Fully Loaded Cost</p>
                    <p className="mb-2 text-xs text-slate-500">USD per year</p>
                    <input type="range" min={20000} max={200000} step={1000} value={fteCost} onChange={(e) => setFteCost(Number(e.target.value))} className="w-full" />
                    <p className="mt-1 text-right text-sm font-semibold text-slate-700">${fteCost.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cost per Credit</p>
                    <p className="mb-2 text-xs text-slate-500">USD per credit</p>
                    <input type="range" min={0.01} max={2.00} step={0.01} value={costPerCredit} onChange={(e) => setCostPerCredit(Number(e.target.value))} className="w-full" />
                    <p className="mt-1 text-right text-sm font-semibold text-slate-700">${costPerCredit.toFixed(2)}</p>
                  </div>
                </div>

                {industryRoi ? (
                  <div className="grid gap-3 md:grid-cols-5">
                    <div className="rounded-xl bg-slate-900 px-4 py-4 text-center text-white">
                      <p className="text-xs uppercase tracking-wide text-slate-300">Auditor Time Saved</p>
                      <p className="mt-1 text-xl font-semibold">{industryRoi.displayTime}</p>
                      <p className="mt-1 text-xs text-slate-400">{industryRoi.timeSavedMins.toLocaleString()} minutes total</p>
                    </div>
                    <div className="rounded-xl bg-slate-900 px-4 py-4 text-center text-white">
                      <p className="text-xs uppercase tracking-wide text-slate-300">FTE Equivalent</p>
                      <p className="mt-1 text-xl font-semibold">{industryRoi.fteEquivalent.toFixed(2)}</p>
                      <p className="mt-1 text-xs text-slate-400">1,920 hrs / FTE / year</p>
                    </div>
                    <div className="rounded-xl bg-slate-900 px-4 py-4 text-center text-white">
                      <p className="text-xs uppercase tracking-wide text-slate-300">FTE Savings</p>
                      <p className="mt-1 text-xl font-semibold">${Math.round(industryRoi.fteSavings).toLocaleString()}</p>
                      <p className="mt-1 text-xs text-slate-400">at ${fteCost.toLocaleString()} loaded cost</p>
                    </div>
                    <div className="rounded-xl bg-slate-900 px-4 py-4 text-center text-white">
                      <p className="text-xs uppercase tracking-wide text-slate-300">Credit Consumption</p>
                      <p className="mt-1 text-xl font-semibold">{industryRoi.creditConsumption.toLocaleString()}</p>
                      <p className="mt-1 text-xs text-slate-400">{creditsPerAction} credits per action</p>
                    </div>
                    <div className="rounded-xl bg-slate-900 px-4 py-4 text-center text-white">
                      <p className="text-xs uppercase tracking-wide text-slate-300">Cost of Credit</p>
                      <p className="mt-1 text-xl font-semibold">${(industryRoi.creditConsumption * costPerCredit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      <p className="mt-1 text-xs text-slate-400">${costPerCredit.toFixed(2)} per credit</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Select an industry to see ROI metrics.</p>
                )}

                {industryRoi && (() => {
                  const roiValue = industryRoi.fteSavings - (industryRoi.creditConsumption * costPerCredit);
                  const roiPositive = roiValue >= 0;
                  return (
                    <div className={`overflow-hidden rounded-xl border-2 ${roiPositive ? 'border-green-400' : 'border-red-400'}`}>
                      <div className={`px-6 py-5 text-center ${roiPositive ? 'bg-green-500' : 'bg-red-500'}`}>
                        <p className="text-xs font-semibold uppercase tracking-widest text-white/80">Return on Investment</p>
                        <p className="mt-1 text-4xl font-bold text-white">${Math.abs(Math.round(roiValue)).toLocaleString()}</p>
                        <p className="mt-1 text-sm font-semibold text-white/90">{roiPositive ? 'Net Gain' : 'Net Cost'}</p>
                      </div>
                      <div className={`flex items-start gap-3 px-4 py-3 text-sm font-medium ${roiPositive ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                        <span className="mt-0.5 text-base">{roiPositive ? '✓' : '✗'}</span>
                        <span>
                          Return on Investment: <strong>${Math.abs(Math.round(roiValue)).toLocaleString()}</strong> {roiPositive ? 'net gain' : 'net cost'}.
                          {' '}FTE Savings Cost (${Math.round(industryRoi.fteSavings).toLocaleString()}) − Cost of Credits (${Math.round(industryRoi.creditConsumption * costPerCredit).toLocaleString()}).
                          {' '}{roiPositive ? 'Automation delivers a positive return.' : 'Credit costs currently exceed FTE savings.'}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {industryRoi && selectedIndustryOperationalAnswers.auditorCount !== '' && (() => {
                  const auditors = Number(selectedIndustryOperationalAnswers.auditorCount);
                  const fteDelta = auditors - industryRoi.fteEquivalent;
                  const isPositive = fteDelta >= 0;
                  return (
                    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm font-medium ${isPositive ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
                      <span className="mt-0.5 text-base">{isPositive ? '✓' : '✗'}</span>
                      <span>
                        FTE headcount required: <strong>{fteDelta.toFixed(2)} FTE</strong>
                        {' '}({auditors} auditors entered − {industryRoi.fteEquivalent.toFixed(2)} FTE equivalent).
                        {' '}{isPositive ? 'Automation covers the equivalent of these auditors, freeing capacity.' : 'Automation does not yet cover the full auditor headcount — additional efficiency gains needed.'}
                      </span>
                    </div>
                  );
                })()}

                {industryRoi && selectedIndustryOperationalAnswers.reimbursementCycleTime && (
                  <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
                    <span className="mt-0.5 text-base">✓</span>
                    <span>
                      Decision Cycle Time Compression: expense processing cycle time reduced from{' '}
                      <strong>
                        {selectedIndustryOperationalAnswers.reimbursementCycleTime === 'other'
                          ? (selectedIndustryOperationalAnswers.reimbursementCycleTimeCustom || 'custom')
                          : selectedIndustryOperationalAnswers.reimbursementCycleTime}
                      </strong>{' '}
                      to <strong>1–2 hours with Agents</strong>.
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                  <Button variant="secondary" onClick={() => void downloadProspectPdfReport()} disabled={!selectedIndustry || prospectExporting}>
                    <Download className="h-4 w-4" />
                    Download PDF
                  </Button>
                  <Button variant="secondary" onClick={() => void downloadProspectWordReport()} disabled={!selectedIndustry || prospectExporting}>
                    <Download className="h-4 w-4" />
                    Download Word
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Hidden prospect export template */}
          <div className="pointer-events-none fixed -left-[100000px] top-0 z-[-1] w-[1200px] p-8" style={{ background: '#F7F6F2', fontFamily: "'Manrope', Arial, sans-serif" }} aria-hidden="true">
            <div ref={prospectExportRef} className="space-y-4">
              {/* Branded header */}
              <div className="rounded-2xl overflow-hidden" style={{ background: '#3D3533' }}>
                <div className="px-8 pt-8 pb-5">
                  <div className="flex items-center justify-between">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/appzen-logo.png" alt="AppZen" style={{ height: '32px', width: 'auto' }} />
                    <span style={{ color: '#B6B0A2', fontSize: '0.8rem' }}>{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                  <h1 className="mt-5" style={{ color: '#FEFDF9', fontSize: '2.25rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>AI Agent Transformation</h1>
                  <p className="mt-1" style={{ color: '#FEF76C', fontSize: '1.25rem', fontWeight: 600 }}>Industry Analysis: {selectedIndustry || 'No industry selected'}</p>
                </div>
                <div style={{ height: '1px', background: 'rgba(254,253,249,0.15)' }} />
                <div className="flex gap-8 px-8 py-4">
                  {industrySummary.customerCount > 0 && <span style={{ color: '#B6B0A2', fontSize: '0.8rem' }}><span style={{ color: '#FEFDF9', fontWeight: 600 }}>Customers: </span>{industrySummary.customerCount}</span>}
                  {industrySummary.totalHighRisk > 0 && <span style={{ color: '#B6B0A2', fontSize: '0.8rem' }}><span style={{ color: '#FEFDF9', fontWeight: 600 }}>High-Risk Lines: </span>{industrySummary.totalHighRisk.toLocaleString()}</span>}
                  {industrySummary.subIndustries.length > 0 && <span style={{ color: '#B6B0A2', fontSize: '0.8rem' }}><span style={{ color: '#FEFDF9', fontWeight: 600 }}>Sub-Industries: </span>{industrySummary.subIndustries.join(', ')}</span>}
                </div>
              </div>

              {/* ROI Card */}
              <Card style={{ background: '#FEFDF9', border: '1px solid #E2DDD2' }}>
                <CardHeader style={{ borderBottom: '1px solid #E2DDD2' }}>
                  <CardTitle style={{ color: '#3D3533', fontFamily: "'Manrope', Arial, sans-serif" }}>ROI Impact Calculator</CardTitle>
                </CardHeader>
                <CardContent>
                  {industryRoi ? (
                    <div className="grid gap-3 grid-cols-5">
                      <div className="rounded-xl px-4 py-4 text-center" style={{ background: '#3D3533' }}>
                        <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#FEF76C', letterSpacing: '0.08em' }}>Auditor Time Saved</p>
                        <p className="mt-1 text-xl font-bold" style={{ color: '#FEFDF9' }}>{industryRoi.displayTime}</p>
                        <p className="mt-1 text-xs" style={{ color: '#B6B0A2' }}>{industryRoi.timeSavedMins.toLocaleString()} minutes total</p>
                      </div>
                      <div className="rounded-xl px-4 py-4 text-center" style={{ background: '#3D3533' }}>
                        <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#FEF76C', letterSpacing: '0.08em' }}>FTE Equivalent</p>
                        <p className="mt-1 text-xl font-bold" style={{ color: '#FEFDF9' }}>{industryRoi.fteEquivalent.toFixed(2)}</p>
                        <p className="mt-1 text-xs" style={{ color: '#B6B0A2' }}>1,920 hrs / FTE / year</p>
                      </div>
                      <div className="rounded-xl px-4 py-4 text-center" style={{ background: '#3D3533' }}>
                        <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#FEF76C', letterSpacing: '0.08em' }}>FTE Savings</p>
                        <p className="mt-1 text-xl font-bold" style={{ color: '#FEFDF9' }}>${Math.round(industryRoi.fteSavings).toLocaleString()}</p>
                        <p className="mt-1 text-xs" style={{ color: '#B6B0A2' }}>at ${fteCost.toLocaleString()} loaded cost</p>
                      </div>
                      <div className="rounded-xl px-4 py-4 text-center" style={{ background: '#544D45' }}>
                        <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#E2DDD2', letterSpacing: '0.08em' }}>Credit Consumption</p>
                        <p className="mt-1 text-xl font-bold" style={{ color: '#FEFDF9' }}>{industryRoi.creditConsumption.toLocaleString()}</p>
                        <p className="mt-1 text-xs" style={{ color: '#B6B0A2' }}>{creditsPerAction} credits per action</p>
                      </div>
                      <div className="rounded-xl px-4 py-4 text-center" style={{ background: '#544D45' }}>
                        <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#E2DDD2', letterSpacing: '0.08em' }}>Cost of Credit</p>
                        <p className="mt-1 text-xl font-bold" style={{ color: '#FEFDF9' }}>${(industryRoi.creditConsumption * costPerCredit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <p className="mt-1 text-xs" style={{ color: '#B6B0A2' }}>${costPerCredit.toFixed(2)} per credit</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm" style={{ color: '#746C60' }}>Select an industry to see ROI metrics.</p>
                  )}

                  {industryRoi && (() => {
                    const roiValue = industryRoi.fteSavings - (industryRoi.creditConsumption * costPerCredit);
                    const roiPositive = roiValue >= 0;
                    return (
                      <div className="mt-3 overflow-hidden rounded-xl" style={{ border: roiPositive ? '2px solid #0BDC4D' : '2px solid #F35F45' }}>
                        <div className="px-6 py-5 text-center" style={{ background: roiPositive ? '#0BDC4D' : '#F35F45' }}>
                          <p style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.8)' }}>Return on Investment</p>
                          <p style={{ marginTop: '4px', fontSize: '2.25rem', fontWeight: 700, color: '#ffffff' }}>${Math.abs(Math.round(roiValue)).toLocaleString()}</p>
                          <p style={{ marginTop: '4px', fontSize: '0.875rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{roiPositive ? 'Net Gain' : 'Net Cost'}</p>
                        </div>
                        <div className="flex items-start gap-3 px-4 py-3 text-sm font-medium" style={roiPositive
                          ? { background: '#C5ECD0', color: '#3D3533' }
                          : { background: '#FCD6CF', color: '#3D3533' }}>
                          <span style={{ marginTop: '2px' }}>{roiPositive ? '✓' : '✗'}</span>
                          <span>
                            Return on Investment: <strong>${Math.abs(Math.round(roiValue)).toLocaleString()}</strong> {roiPositive ? 'net gain' : 'net cost'}.
                            {' '}FTE Savings Cost (${Math.round(industryRoi.fteSavings).toLocaleString()}) − Cost of Credits (${Math.round(industryRoi.creditConsumption * costPerCredit).toLocaleString()}).
                            {' '}{roiPositive ? 'Automation delivers a positive return.' : 'Credit costs currently exceed FTE savings.'}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {industryRoi && selectedIndustryOperationalAnswers.auditorCount !== '' && (() => {
                    const auditors = Number(selectedIndustryOperationalAnswers.auditorCount);
                    const fteDelta = auditors - industryRoi.fteEquivalent;
                    const isPositive = fteDelta >= 0;
                    return (
                      <div className="mt-3 flex items-start gap-3 rounded-lg px-4 py-3 text-sm font-medium" style={isPositive
                        ? { background: '#C5ECD0', border: '1px solid #0BDC4D', color: '#3D3533' }
                        : { background: '#FCD6CF', border: '1px solid #F35F45', color: '#3D3533' }}>
                        <span className="mt-0.5 text-base">{isPositive ? '✓' : '✗'}</span>
                        <span>
                          FTE headcount required: <strong>{fteDelta.toFixed(2)} FTE</strong>
                          {' '}({auditors} auditors entered − {industryRoi.fteEquivalent.toFixed(2)} FTE equivalent).
                          {' '}{isPositive ? 'Automation covers the equivalent of these auditors, freeing capacity.' : 'Automation does not yet cover the full auditor headcount — additional efficiency gains needed.'}
                        </span>
                      </div>
                    );
                  })()}

                  {industryRoi && selectedIndustryOperationalAnswers.reimbursementCycleTime && (
                    <div className="mt-3 flex items-start gap-3 rounded-lg px-4 py-3 text-sm font-medium" style={{ background: '#C5ECD0', border: '1px solid #0BDC4D', color: '#3D3533' }}>
                      <span className="mt-0.5 text-base">✓</span>
                      <span>
                        Decision Cycle Time Compression: expense processing cycle time reduced from{' '}
                        <strong>
                          {selectedIndustryOperationalAnswers.reimbursementCycleTime === 'other'
                            ? (selectedIndustryOperationalAnswers.reimbursementCycleTimeCustom || 'custom')
                            : selectedIndustryOperationalAnswers.reimbursementCycleTime}
                        </strong>{' '}
                        to <strong>1–2 hours with Agents</strong>.
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Industry Details export card */}
              <Card style={{ background: '#FEFDF9', border: '1px solid #E2DDD2' }}>
                <CardHeader style={{ borderBottom: '1px solid #E2DDD2' }}>
                  <CardTitle style={{ color: '#3D3533', fontFamily: "'Manrope', Arial, sans-serif" }}>Industry Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="text-slate-500">Industry</span>
                      <span className="font-semibold text-slate-900">{industrySummary.industry}</span>
                    </div>
                    <div className="border-b border-slate-200 pb-2">
                      <span className="text-slate-500">Sub-Industries</span>
                      <p className="mt-1 font-semibold text-slate-900">{industrySummary.subIndustries.join(', ') || '—'}</p>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2 pt-2">
                      <span className="text-slate-500">Avg High-Risk Lines (per customer)</span>
                      <span className="font-semibold text-slate-900">{industrySummary.avgHighRiskLinesPerCustomer.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-slate-500">Number of Customers</span>
                      <span className="font-semibold text-slate-900">{industrySummary.customerCount.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                      <span className="text-slate-500">Number of auditors</span>
                      <span className="font-semibold text-slate-900">{selectedIndustryOperationalAnswers.auditorCount || 'Not specified'}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                      <span className="text-slate-500">Expense Reimbursement Cycle Time</span>
                      <span className="font-semibold text-slate-900">
                        {selectedIndustryOperationalAnswers.reimbursementCycleTime === 'other'
                          ? (selectedIndustryOperationalAnswers.reimbursementCycleTimeCustom || 'Other')
                          : (selectedIndustryOperationalAnswers.reimbursementCycleTime || 'Not specified')}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Top Models export card */}
              <Card style={{ background: '#FEFDF9', border: '1px solid #E2DDD2' }}>
                <CardHeader style={{ borderBottom: '1px solid #E2DDD2' }}>
                  <CardTitle style={{ color: '#3D3533', fontFamily: "'Manrope', Arial, sans-serif" }}>Top Models by High-Risk Lines</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-5">
                    <div className="overflow-x-auto rounded-xl border border-app-border">
                      <table className="w-full min-w-[700px] text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-3 py-2 text-left">Rank</th>
                            <th className="px-3 py-2 text-left">Model</th>
                            <th className="px-3 py-2 text-left">Total High-Risk Lines</th>
                            <th className="px-3 py-2 text-left">Total Returned Lines</th>
                            <th className="px-3 py-2 text-left">Distribution</th>
                          </tr>
                        </thead>
                        <tbody>
                          {industryTop5.map((item, index) => {
                            const highRiskPct = (item.total / industryTop5MaxTotal) * 100;
                            const returnedWithinPct = item.total > 0 ? (item.returned / item.total) * 100 : 0;
                            return (
                              <tr key={`pexp-top-${item.model}`} className="border-t border-slate-100">
                                <td className="px-3 py-2">
                                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold">{index + 1}</span>
                                </td>
                                <td className="px-3 py-2 font-medium text-slate-900">{item.model}</td>
                                <td className="px-3 py-2">{item.total.toLocaleString()}</td>
                                <td className="px-3 py-2">{item.returned.toLocaleString()}</td>
                                <td className="px-3 py-2">
                                  <div className="relative h-3 w-32 overflow-hidden rounded bg-slate-100">
                                    <div className="absolute inset-y-0 left-0 rounded bg-slate-300" style={{ width: `${highRiskPct.toFixed(1)}%` }} />
                                    <div className="absolute inset-y-0 left-0 rounded bg-slate-600" style={{ width: `${(highRiskPct * returnedWithinPct / 100).toFixed(1)}%` }} />
                                  </div>
                                  <p className="mt-0.5 text-[10px] text-slate-400">{returnedWithinPct.toFixed(1)}% returned</p>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-app-border">
                      <table className="w-full min-w-[760px] text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-3 py-2 text-left">Rank</th>
                            <th className="px-3 py-2 text-left">Model</th>
                            <th className="px-3 py-2 text-left">Automation Impact</th>
                            <th className="px-3 py-2 text-left">Rejection Rate</th>
                            <th className="px-3 py-2 text-left">Approval Rate</th>
                            <th className="px-3 py-2 text-left">Distribution</th>
                          </tr>
                        </thead>
                        <tbody>
                          {industryTop5.map((item, index) => {
                            const autoImpact = industryStdTotalHighRisk ? ((item.total / industryStdTotalHighRisk) * 100).toFixed(1) : '0.0';
                            const rejectionRate = item.total ? ((item.returned / item.total) * 100).toFixed(1) : '0.0';
                            const approvalRate = item.total ? (((item.total - item.returned) / item.total) * 100).toFixed(1) : '0.0';
                            const rejectionBarPct = item.total > 0 ? (item.returned / item.total) * 100 : 0;
                            return (
                              <tr key={`pexp-perf-${item.model}`} className="border-t border-slate-100">
                                <td className="px-3 py-2">{index + 1}</td>
                                <td className="px-3 py-2 font-medium text-slate-900">{item.model}</td>
                                <td className="px-3 py-2">{autoImpact}%</td>
                                <td className="px-3 py-2">{rejectionRate}%</td>
                                <td className="px-3 py-2">{approvalRate}%</td>
                                <td className="px-3 py-2">
                                  <div className="relative h-3 w-32 overflow-hidden rounded bg-slate-100">
                                    <div className="absolute inset-y-0 left-0 rounded bg-emerald-400" style={{ width: `${(100 - rejectionBarPct).toFixed(1)}%` }} />
                                    <div className="absolute inset-y-0 right-0 rounded bg-red-300" style={{ width: `${rejectionBarPct.toFixed(1)}%` }} />
                                  </div>
                                  <p className="mt-0.5 text-[10px] text-slate-400">{(100 - rejectionBarPct).toFixed(1)}% approved</p>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">High-Risk Lines Heatmap · Model vs Expense Type</p>
                      {industryHeatmap ? (
                        <div className="space-y-3">
                          {industryExportHeatmapColumnGroups.map((group, groupIndex) => (
                            <div key={`pexp-group-${groupIndex}`} className="rounded-xl border border-app-border">
                              <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                {groupIndex === 0 ? 'Primary Heatmap View' : `Additional Heatmap Columns (Set ${groupIndex + 1})`}
                              </div>
                              <table className="w-full text-[11px]">
                                <thead className="bg-slate-50 uppercase tracking-wide text-slate-500">
                                  <tr>
                                    <th className="px-2 py-2 text-left">Model</th>
                                    {group.map((expense) => (
                                      <th key={`pexp-${groupIndex}-${expense}`} className="px-2 py-2 text-center">
                                        {expense.length > 14 ? `${expense.slice(0, 13)}...` : expense}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {industryHeatmap.models.map((model) => (
                                    <tr key={`pexp-heat-${groupIndex}-${model}`} className="border-t border-slate-100">
                                      <td className="bg-slate-50 px-2 py-2 font-medium text-slate-700">{model}</td>
                                      {group.map((expense) => {
                                        const value = industryHeatmap.matrix[model][expense];
                                        const style = heatColor(value, industryMaxHeat);
                                        return (
                                          <td key={`pexp-${groupIndex}-${model}-${expense}`} className="px-2 py-2 text-center font-semibold" style={style}>
                                            {value ? value.toLocaleString() : '-'}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))}
                          <p className="text-xs text-slate-500">
                            Export optimization: trailing low-signal columns (max value &lt; 10) are trimmed for readability.
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">No standard models found for this industry.</p>
                      )}
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      Industry <strong className="text-slate-900">{selectedIndustry}</strong> has{' '}
                      <strong className="text-slate-900">{industrySummary.customerCount.toLocaleString()}</strong> customers and{' '}
                      <strong className="text-slate-900">{industrySummary.totalHighRisk.toLocaleString()}</strong> high-risk lines.
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Branded footer */}
              <div className="rounded-2xl overflow-hidden" style={{ background: '#3D3533' }}>
                <div className="flex items-center justify-between px-8 py-5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/appzen-logo.png" alt="AppZen" style={{ height: '26px', width: 'auto' }} />
                  <span style={{ color: '#746C60', fontSize: '0.75rem' }}>AI Agent Transformation Report · Confidential</span>
                  <span style={{ color: '#746C60', fontSize: '0.75rem' }}>{new Date().getFullYear()} © AppZen</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Blueprint Panel ─────────────────────────────────────────────────── */}
      {panel === 'blueprint' && (
        <>
          {!blueprintData ? (
            <Card>
              <CardHeader>
                <CardTitle>No Blueprint Data</CardTitle>
                <CardDescription>Upload a Hybrid Workforce Analysis PDF in Admin to populate this section.</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <>
              {/* Summary header */}
              <Card>
                <CardHeader>
                  <CardTitle>Customer: {blueprintData.customer}</CardTitle>
                  <CardDescription>Analysis Period: {blueprintData.analysisPeriod} · Generated: {blueprintData.reportDate}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                    {[
                      { label: 'Total Expense Lines (Annualized)', value: blueprintData.totalExpenseLines.toLocaleString() },
                      { label: 'Approved by Auditors', value: `${blueprintData.approvedByAuditors.toLocaleString()} (${blueprintData.totalExpenseLines ? Math.round(blueprintData.approvedByAuditors / blueprintData.totalExpenseLines * 100) : 0}%)` },
                      { label: 'Rejected by Auditors', value: `${blueprintData.rejectedByAuditors.toLocaleString()} (${blueprintData.totalExpenseLines ? Math.round(blueprintData.rejectedByAuditors / blueprintData.totalExpenseLines * 100) : 0}%)` },
                      { label: 'Total Agent-Automatable Lines', value: (bpReadyTotal + bpModifyTotal + bpCreateTotal).toLocaleString() },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Agents Ready to Deploy */}
              <Card>
                <CardHeader>
                  <CardTitle>Agents Ready to Deploy</CardTitle>
                  <CardDescription>
                    Areas where human audit work can be immediately transferred to AI Agents.
                    {bpReadyTotal > 0 && <span className="ml-2 font-semibold text-slate-700">{bpReadyTotal.toLocaleString()} high-risk lines</span>}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Compliance Area</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">High Risk Lines</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Approved %</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Rejected %</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Agent Coverage %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          let lastPack = '';
                          return blueprintData.agentsReadyToDeploy.map((row, i) => {
                            const packHeader = row.workPack !== lastPack ? (lastPack = row.workPack, row.workPack) : null;
                            return (
                              <>
                                {packHeader && (
                                  <tr key={`pack-${i}`} className="bg-slate-100">
                                    <td colSpan={5} className="px-4 py-2 text-xs font-semibold text-slate-700">{packHeader}</td>
                                  </tr>
                                )}
                                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                                  <td className="px-4 py-2.5 text-slate-800">{row.complianceArea}</td>
                                  <td className="px-4 py-2.5 text-right font-medium text-slate-900">{row.highRiskLines.toLocaleString()}</td>
                                  <td className="px-4 py-2.5 text-right text-slate-600">{row.approvedPct}%</td>
                                  <td className="px-4 py-2.5 text-right text-slate-600">{row.rejectedPct}%</td>
                                  <td className="px-4 py-2.5 text-right">
                                    <span className={cn('font-semibold', row.agentCoveragePct >= 80 ? 'text-green-700' : row.agentCoveragePct >= 60 ? 'text-amber-700' : 'text-red-700')}>
                                      {row.agentCoveragePct}%
                                    </span>
                                  </td>
                                </tr>
                              </>
                            );
                          });
                        })()}
                        <tr className="border-t-2 border-slate-300 bg-slate-100 font-semibold">
                          <td className="px-4 py-2.5 text-slate-800">Total</td>
                          <td className="px-4 py-2.5 text-right text-slate-900">{bpReadyTotal.toLocaleString()}</td>
                          <td colSpan={3} />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Agent SOPs That Require Modification */}
              <Card>
                <CardHeader>
                  <CardTitle>Agent SOPs That Require Modification</CardTitle>
                  <CardDescription>
                    Existing SOPs that do not fully capture human decision-making patterns and require refinement.
                    {bpModifyTotal > 0 && <span className="ml-2 font-semibold text-slate-700">{bpModifyTotal.toLocaleString()} high-risk lines</span>}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Compliance Area</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">High Risk Lines</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Approved %</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Rejected %</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Agent Coverage %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          let lastPack = '';
                          return blueprintData.sopRequireModification.map((row, i) => {
                            const packHeader = row.workPack !== lastPack ? (lastPack = row.workPack, row.workPack) : null;
                            return (
                              <>
                                {packHeader && (
                                  <tr key={`pack-${i}`} className="bg-slate-100">
                                    <td colSpan={5} className="px-4 py-2 text-xs font-semibold text-slate-700">{packHeader}</td>
                                  </tr>
                                )}
                                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                                  <td className="px-4 py-2.5 text-slate-800">{row.complianceArea}</td>
                                  <td className="px-4 py-2.5 text-right font-medium text-slate-900">{row.highRiskLines.toLocaleString()}</td>
                                  <td className="px-4 py-2.5 text-right text-slate-600">{row.approvedPct}%</td>
                                  <td className="px-4 py-2.5 text-right text-slate-600">{row.rejectedPct}%</td>
                                  <td className="px-4 py-2.5 text-right">
                                    <span className={cn('font-semibold', row.agentCoveragePct >= 80 ? 'text-green-700' : row.agentCoveragePct >= 60 ? 'text-amber-700' : 'text-red-700')}>
                                      {row.agentCoveragePct}%
                                    </span>
                                  </td>
                                </tr>
                              </>
                            );
                          });
                        })()}
                        <tr className="border-t-2 border-slate-300 bg-slate-100 font-semibold">
                          <td className="px-4 py-2.5 text-slate-800">Total</td>
                          <td className="px-4 py-2.5 text-right text-slate-900">{bpModifyTotal.toLocaleString()}</td>
                          <td colSpan={3} />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Agent SOPs That Require Creation */}
              <Card>
                <CardHeader>
                  <CardTitle>Agent SOPs That Require Creation</CardTitle>
                  <CardDescription>
                    Candidate Agent SOPs based on observed auditor behavior.
                    {bpCreateTotal > 0 && <span className="ml-2 font-semibold text-slate-700">{bpCreateTotal.toLocaleString()} high-risk lines</span>}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Compliance Area</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">High Risk Lines</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Approved %</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Rejected %</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Agent Coverage %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          let lastPack = '';
                          return blueprintData.sopRequireCreation.map((row, i) => {
                            const packHeader = row.workPack !== lastPack ? (lastPack = row.workPack, row.workPack) : null;
                            return (
                              <>
                                {packHeader && (
                                  <tr key={`pack-${i}`} className="bg-slate-100">
                                    <td colSpan={5} className="px-4 py-2 text-xs font-semibold text-slate-700">{packHeader}</td>
                                  </tr>
                                )}
                                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                                  <td className="px-4 py-2.5 text-slate-800">{row.complianceArea}</td>
                                  <td className="px-4 py-2.5 text-right font-medium text-slate-900">{row.highRiskLines.toLocaleString()}</td>
                                  <td className="px-4 py-2.5 text-right text-slate-600">{row.approvedPct}%</td>
                                  <td className="px-4 py-2.5 text-right text-slate-600">{row.rejectedPct}%</td>
                                  <td className="px-4 py-2.5 text-right">
                                    <span className={cn('font-semibold', row.agentCoveragePct >= 80 ? 'text-green-700' : row.agentCoveragePct >= 60 ? 'text-amber-700' : 'text-red-700')}>
                                      {row.agentCoveragePct}%
                                    </span>
                                  </td>
                                </tr>
                              </>
                            );
                          });
                        })()}
                        <tr className="border-t-2 border-slate-300 bg-slate-100 font-semibold">
                          <td className="px-4 py-2.5 text-slate-800">Total</td>
                          <td className="px-4 py-2.5 text-right text-slate-900">{bpCreateTotal.toLocaleString()}</td>
                          <td colSpan={3} />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Operating Inputs + ROI Impact Calculator */}
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Operating Inputs */}
                <Card>
                  <CardHeader>
                    <CardTitle>Customer Operating Inputs</CardTitle>
                    <CardDescription>Enter assumptions used to contextualise the ROI calculator below.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Number of Auditors</p>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={Math.min(Number(bpOperationalAnswers.auditorCount) || 0, 100)}
                          onChange={(e) => setBpOperationalAnswers((prev) => ({ ...prev, auditorCount: e.target.value }))}
                          className="flex-1"
                        />
                        <span className="w-8 text-right text-sm font-semibold text-slate-700">
                          {Number(bpOperationalAnswers.auditorCount) || 0}
                        </span>
                      </div>
                      {Number(bpOperationalAnswers.auditorCount) >= 100 && (
                        <Input
                          type="number"
                          min={100}
                          placeholder="Enter exact number of auditors"
                          value={bpOperationalAnswers.auditorCount}
                          onChange={(e) => setBpOperationalAnswers((prev) => ({ ...prev, auditorCount: e.target.value }))}
                        />
                      )}
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Expense Reimbursement Cycle Time</p>
                      <select
                        className="h-10 w-full rounded-md border border-app-border bg-white px-3 text-sm"
                        value={bpOperationalAnswers.reimbursementCycleTime}
                        onChange={(e) => {
                          const v = e.target.value as CustomerOperationalAnswers['reimbursementCycleTime'];
                          setBpOperationalAnswers((prev) => ({
                            ...prev,
                            reimbursementCycleTime: v,
                            reimbursementCycleTimeCustom: v !== 'other' ? '' : prev.reimbursementCycleTimeCustom,
                          }));
                        }}
                      >
                        <option value="">Select cycle time</option>
                        <option value="1 Day">1 Day</option>
                        <option value="2 Days">2 Days</option>
                        <option value="4 Days">4 Days</option>
                        <option value="7 Days">7 Days</option>
                        <option value="14 Days">14 Days</option>
                        <option value="other">Other</option>
                      </select>
                      {bpOperationalAnswers.reimbursementCycleTime === 'other' && (
                        <Input
                          placeholder="Enter custom cycle time"
                          value={bpOperationalAnswers.reimbursementCycleTimeCustom}
                          onChange={(e) => setBpOperationalAnswers((prev) => ({ ...prev, reimbursementCycleTimeCustom: e.target.value }))}
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* ROI Impact Calculator */}
                <Card>
                  <CardHeader>
                    <CardTitle>ROI Impact Calculator</CardTitle>
                    <CardDescription>Select tables to include and adjust assumptions to estimate operational impact.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {/* Table selection */}
                    <div className="flex flex-col gap-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">High-Risk Volume Basis</p>
                      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        {[
                          { key: 'ready' as const, label: 'Agents Ready to Deploy', total: bpReadyTotal, color: 'text-green-700' },
                          { key: 'modify' as const, label: 'Agent SOPs That Require Modification', total: bpModifyTotal, color: 'text-amber-700' },
                          { key: 'create' as const, label: 'Agent SOPs That Require Creation', total: bpCreateTotal, color: 'text-blue-700' },
                        ].map(({ key, label, total, color }) => (
                          <label key={key} className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1 hover:bg-slate-100">
                            <span className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={bpTableSelection[key]}
                                onChange={() => setBpTableSelection((prev) => ({ ...prev, [key]: !prev[key] }))}
                                className="h-3.5 w-3.5 rounded border-slate-300 accent-slate-800"
                              />
                              <span className="text-sm text-slate-700">{label}</span>
                            </span>
                            <span className={cn('text-xs font-semibold', color)}>{total.toLocaleString()} lines</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-slate-400">
                        {bpSelectedTotal > 0
                          ? `Using ${bpSelectedTotal.toLocaleString()} high-risk lines as the ROI basis.`
                          : 'Select at least one table to calculate ROI.'}
                      </p>
                    </div>

                    {/* Sliders — shared with Customers / Prospect */}
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Time Saved per High-Risk Line</p>
                        <p className="mb-2 text-xs text-slate-500">Minutes per line</p>
                        <input type="range" min={1} max={30} step={1} value={timeMinutes} onChange={(e) => setTimeMinutes(Number(e.target.value))} className="w-full" />
                        <p className="mt-1 text-right text-sm font-semibold text-slate-700">{timeMinutes} min</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Agent Credit Consumption</p>
                        <p className="mb-2 text-xs text-slate-500">Credits per action</p>
                        <input type="range" min={1} max={20} step={1} value={creditsPerAction} onChange={(e) => setCreditsPerAction(Number(e.target.value))} className="w-full" />
                        <p className="mt-1 text-right text-sm font-semibold text-slate-700">{creditsPerAction} cr</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">FTE Fully Loaded Cost</p>
                        <p className="mb-2 text-xs text-slate-500">USD per year</p>
                        <input type="range" min={20000} max={200000} step={1000} value={fteCost} onChange={(e) => setFteCost(Number(e.target.value))} className="w-full" />
                        <p className="mt-1 text-right text-sm font-semibold text-slate-700">${fteCost.toLocaleString()}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cost per Credit</p>
                        <p className="mb-2 text-xs text-slate-500">USD per credit</p>
                        <input type="range" min={0.01} max={2.00} step={0.01} value={costPerCredit} onChange={(e) => setCostPerCredit(Number(e.target.value))} className="w-full" />
                        <p className="mt-1 text-right text-sm font-semibold text-slate-700">${costPerCredit.toFixed(2)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* ROI output tiles — full width */}
              {bpRoi ? (
                <Card>
                  <CardContent className="space-y-4 pt-5">
                    <div className="grid gap-3 md:grid-cols-5">
                      <div className="rounded-xl bg-slate-900 px-4 py-4 text-center text-white">
                        <p className="text-xs uppercase tracking-wide text-slate-300">Auditor Time Saved</p>
                        <p className="mt-1 text-xl font-semibold">{bpRoi.displayTime}</p>
                        <p className="mt-1 text-xs text-slate-400">{bpRoi.timeSavedMins.toLocaleString()} minutes total</p>
                      </div>
                      <div className="rounded-xl bg-slate-900 px-4 py-4 text-center text-white">
                        <p className="text-xs uppercase tracking-wide text-slate-300">FTE Equivalent</p>
                        <p className="mt-1 text-xl font-semibold">{bpRoi.fteEquivalent.toFixed(2)}</p>
                        <p className="mt-1 text-xs text-slate-400">1,920 hrs / FTE / year</p>
                      </div>
                      <div className="rounded-xl bg-slate-900 px-4 py-4 text-center text-white">
                        <p className="text-xs uppercase tracking-wide text-slate-300">FTE Savings</p>
                        <p className="mt-1 text-xl font-semibold">${Math.round(bpRoi.fteSavings).toLocaleString()}</p>
                        <p className="mt-1 text-xs text-slate-400">at ${fteCost.toLocaleString()} loaded cost</p>
                      </div>
                      <div className="rounded-xl bg-slate-900 px-4 py-4 text-center text-white">
                        <p className="text-xs uppercase tracking-wide text-slate-300">Credit Consumption</p>
                        <p className="mt-1 text-xl font-semibold">{bpRoi.creditConsumption.toLocaleString()}</p>
                        <p className="mt-1 text-xs text-slate-400">{creditsPerAction} credits per action</p>
                      </div>
                      <div className="rounded-xl bg-slate-900 px-4 py-4 text-center text-white">
                        <p className="text-xs uppercase tracking-wide text-slate-300">Cost of Credits</p>
                        <p className="mt-1 text-xl font-semibold">${(bpRoi.creditConsumption * costPerCredit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <p className="mt-1 text-xs text-slate-400">${costPerCredit.toFixed(2)} per credit</p>
                      </div>
                    </div>

                    {/* ROI banner */}
                    {(() => {
                      const roiValue = bpRoi.fteSavings - (bpRoi.creditConsumption * costPerCredit);
                      const roiPositive = roiValue >= 0;
                      return (
                        <div className={`overflow-hidden rounded-xl border-2 ${roiPositive ? 'border-green-400' : 'border-red-400'}`}>
                          <div className={`px-6 py-5 text-center ${roiPositive ? 'bg-green-500' : 'bg-red-500'}`}>
                            <p className="text-xs font-semibold uppercase tracking-widest text-white/80">Return on Investment</p>
                            <p className="mt-1 text-4xl font-bold text-white">${Math.abs(Math.round(roiValue)).toLocaleString()}</p>
                            <p className="mt-1 text-sm font-semibold text-white/90">{roiPositive ? 'Net Gain' : 'Net Cost'}</p>
                          </div>
                          <div className={`flex items-start gap-3 px-4 py-3 text-sm font-medium ${roiPositive ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                            <span className="mt-0.5 text-base">{roiPositive ? '✓' : '✗'}</span>
                            <span>
                              Return on Investment: <strong>${Math.abs(Math.round(roiValue)).toLocaleString()}</strong> {roiPositive ? 'net gain' : 'net cost'}.
                              {' '}FTE Savings (${Math.round(bpRoi.fteSavings).toLocaleString()}) − Cost of Credits (${Math.round(bpRoi.creditConsumption * costPerCredit).toLocaleString()}).
                              {' '}{roiPositive ? 'Automation delivers a positive return.' : 'Credit costs currently exceed FTE savings.'}
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* FTE headcount comparison */}
                    {bpOperationalAnswers.auditorCount !== '' && (() => {
                      const auditors = Number(bpOperationalAnswers.auditorCount);
                      const fteDelta = auditors - bpRoi.fteEquivalent;
                      const isPositive = fteDelta >= 0;
                      return (
                        <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm font-medium ${isPositive ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
                          <span className="mt-0.5 text-base">{isPositive ? '✓' : '✗'}</span>
                          <span>
                            FTE headcount required: <strong>{fteDelta.toFixed(2)} FTE</strong>
                            {' '}({auditors} auditors entered − {bpRoi.fteEquivalent.toFixed(2)} FTE equivalent).
                            {' '}{isPositive ? 'Automation covers the equivalent of these auditors, freeing capacity.' : 'Automation does not yet cover the full auditor headcount — additional efficiency gains needed.'}
                          </span>
                        </div>
                      );
                    })()}

                    {/* Decision cycle time */}
                    {bpOperationalAnswers.reimbursementCycleTime && (
                      <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
                        <span className="mt-0.5 text-base">✓</span>
                        <span>
                          Decision Cycle Time Compression: expense processing cycle time reduced from{' '}
                          <strong>
                            {bpOperationalAnswers.reimbursementCycleTime === 'other'
                              ? (bpOperationalAnswers.reimbursementCycleTimeCustom || 'custom')
                              : bpOperationalAnswers.reimbursementCycleTime}
                          </strong>{' '}
                          to <strong>1–2 hours with Agents</strong>.
                        </span>
                      </div>
                    )}

                    {/* Export buttons */}
                    <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                      <Button variant="secondary" onClick={() => void downloadBlueprintPdfReport()} disabled={blueprintExporting}>
                        <Download className="h-4 w-4" />
                        {blueprintExporting ? 'Exporting…' : 'Download PDF'}
                      </Button>
                      <Button variant="secondary" onClick={() => void downloadBlueprintWordReport()} disabled={blueprintExporting}>
                        <Download className="h-4 w-4" />
                        {blueprintExporting ? 'Exporting…' : 'Download Word'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-4">
                    <p className="text-sm text-slate-500">Select at least one table above to see ROI metrics.</p>
                  </CardContent>
                </Card>
              )}

              {/* ── Chart + Recommendations ──────────────────────────────── */}
              <div className="grid gap-4 lg:grid-cols-2">

                {/* AI Agents vs Human Auditors stacked-bar chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>AI Agents and Human Auditors</CardTitle>
                    <CardDescription>Distribution of audit work before and after AI Agent deployment</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {(() => {
                      const total = blueprintData.totalExpenseLines || 1;
                      const readyPct  = Math.round(bpReadyTotal  / total * 100);
                      const modifyPct = Math.round(bpModifyTotal / total * 100);
                      const createPct = Math.round(bpCreateTotal / total * 100);
                      const humanPct  = Math.max(0, 100 - readyPct - modifyPct - createPct);
                      const BAR_H = 240;

                      // Top → bottom order so the bar reads: human (top), create, modify, ready (bottom)
                      const aiSegments = [
                        { key: 'human',  pct: humanPct,  color: '#F87171', label: 'Human Auditors' },
                        { key: 'create', pct: createPct, color: '#FB923C', label: 'Agent SOPs Require Creation' },
                        { key: 'modify', pct: modifyPct, color: '#FBBF24', label: 'Agent SOPs Require Modification' },
                        { key: 'ready',  pct: readyPct,  color: '#4ADE80', label: 'Agents Ready to Deploy' },
                      ];

                      return (
                        <div className="space-y-4">
                          {/* Y-axis + bars */}
                          <div className="flex items-stretch gap-1">
                            {/* Rotated Y-axis label */}
                            <div className="flex items-center justify-center" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', minWidth: '14px' }}>
                              <span className="text-[10px] text-slate-500 whitespace-nowrap">Percent of Work</span>
                            </div>
                            {/* Y-axis tick numbers */}
                            <div className="flex flex-col justify-between pb-0 pr-1" style={{ height: BAR_H }}>
                              {[100, 75, 50, 25, 0].map(v => (
                                <span key={v} className="text-[10px] text-slate-400 leading-none">{v}</span>
                              ))}
                            </div>
                            {/* Chart area */}
                            <div className="relative flex-1" style={{ height: BAR_H }}>
                              {/* Dashed gridlines */}
                              {[0, 25, 50, 75, 100].map(v => (
                                <div
                                  key={v}
                                  className="absolute left-0 right-0 border-t border-dashed border-slate-200"
                                  style={{ bottom: `${v}%` }}
                                />
                              ))}
                              {/* Bars */}
                              <div className="absolute inset-0 flex justify-around items-end px-4">
                                {/* Current State — 100 % human */}
                                <div className="flex flex-col items-center gap-1">
                                  <div
                                    className="w-24 flex flex-col overflow-hidden rounded-t-sm"
                                    style={{ height: BAR_H }}
                                  >
                                    <div className="flex flex-1 items-center justify-center" style={{ background: '#F87171' }}>
                                      <span className="text-base font-bold text-white">100%</span>
                                    </div>
                                  </div>
                                  <span className="text-[11px] font-medium text-slate-600 whitespace-nowrap">Current State</span>
                                </div>
                                {/* With AI Agents — stacked */}
                                <div className="flex flex-col items-center gap-1">
                                  <div
                                    className="w-24 flex flex-col overflow-hidden rounded-t-sm"
                                    style={{ height: BAR_H }}
                                  >
                                    {aiSegments.map(({ key, pct, color }) =>
                                      pct > 0 ? (
                                        <div
                                          key={key}
                                          className="flex items-center justify-center flex-shrink-0"
                                          style={{ height: `${pct}%`, background: color }}
                                        >
                                          {pct >= 5 && (
                                            <span className="text-xs font-bold text-white drop-shadow-sm">{pct}%</span>
                                          )}
                                        </div>
                                      ) : null
                                    )}
                                  </div>
                                  <span className="text-[11px] font-medium text-slate-600 whitespace-nowrap">With AI Agents</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Legend — 2-column grid */}
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-1">
                            {[
                              { label: 'Agents Ready to Deploy',             color: '#4ADE80' },
                              { label: 'Agent SOPs Require Creation',         color: '#FB923C' },
                              { label: 'Agent SOPs Require Modification',     color: '#FBBF24' },
                              { label: 'Human Auditors',                      color: '#F87171' },
                            ].map(({ label, color }) => (
                              <div key={label} className="flex items-center gap-1.5">
                                <div className="h-3 w-3 flex-shrink-0 rounded-sm" style={{ background: color }} />
                                <span className="text-xs text-slate-600">{label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* Recommendations */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recommendations</CardTitle>
                    <CardDescription>AppZen recommendations based on the blueprint analysis</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(blueprintData.recommendations ?? []).length > 0 ? (
                      <div className="space-y-5">
                        {(blueprintData.recommendations ?? []).map((section, si) => (
                          <div key={si}>
                            <h4 className="mb-2 text-sm font-semibold text-slate-800">{section.title}</h4>
                            <ul className="space-y-1.5">
                              {section.bullets.map((bullet, bi) => (
                                <li key={bi} className="flex items-start gap-2 text-sm text-slate-700">
                                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
                                  {bullet}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No recommendations found in this PDF.</p>
                    )}
                  </CardContent>
                </Card>

              </div>

              {/* ── Off-screen export container ───────────────────────────── */}
              <div className="pointer-events-none fixed -left-[100000px] top-0 z-[-1] w-[1200px] p-8" style={{ background: '#F7F6F2', fontFamily: "'Manrope', Arial, sans-serif" }} aria-hidden="true">
                <div ref={blueprintExportRef} className="space-y-4">

                  {/* Branded header */}
                  <div className="rounded-2xl overflow-hidden" style={{ background: '#3D3533' }}>
                    <div className="px-8 pt-8 pb-5">
                      <div className="flex items-center justify-between">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/appzen-logo.png" alt="AppZen" style={{ height: '32px', width: 'auto' }} />
                        <span style={{ color: '#B6B0A2', fontSize: '0.8rem' }}>{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      </div>
                      <h1 className="mt-5" style={{ color: '#FEFDF9', fontSize: '2.25rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Hybrid Workforce Analysis</h1>
                      <p className="mt-1" style={{ color: '#FEF76C', fontSize: '1.25rem', fontWeight: 600 }}>{blueprintData.customer}</p>
                    </div>
                    <div style={{ height: '1px', background: 'rgba(254,253,249,0.15)' }} />
                    <div className="flex gap-8 px-8 py-4">
                      {blueprintData.analysisPeriod && <span style={{ color: '#B6B0A2', fontSize: '0.8rem' }}><span style={{ color: '#FEFDF9', fontWeight: 600 }}>Analysis Period: </span>{blueprintData.analysisPeriod}</span>}
                      {blueprintData.reportDate && <span style={{ color: '#B6B0A2', fontSize: '0.8rem' }}><span style={{ color: '#FEFDF9', fontWeight: 600 }}>Generated: </span>{blueprintData.reportDate}</span>}
                    </div>
                  </div>

                  {/* Summary metrics */}
                  <Card style={{ background: '#FEFDF9', border: '1px solid #E2DDD2' }}>
                    <CardHeader style={{ borderBottom: '1px solid #E2DDD2' }}>
                      <CardTitle style={{ color: '#3D3533' }}>Executive Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-3">
                        {[
                          { label: 'Total Expense Lines (Annualized)', value: blueprintData.totalExpenseLines.toLocaleString() },
                          { label: 'Approved by Auditors',            value: `${blueprintData.approvedByAuditors.toLocaleString()} (${blueprintData.totalExpenseLines ? Math.round(blueprintData.approvedByAuditors / blueprintData.totalExpenseLines * 100) : 0}%)` },
                          { label: 'Rejected by Auditors',            value: `${blueprintData.rejectedByAuditors.toLocaleString()} (${blueprintData.totalExpenseLines ? Math.round(blueprintData.rejectedByAuditors / blueprintData.totalExpenseLines * 100) : 0}%)` },
                          { label: 'Agent-Automatable Lines',         value: (bpReadyTotal + bpModifyTotal + bpCreateTotal).toLocaleString() },
                        ].map(({ label, value }) => (
                          <div key={label} className="rounded-xl px-4 py-3" style={{ background: '#3D3533' }}>
                            <p style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#FEF76C' }}>{label}</p>
                            <p style={{ marginTop: '4px', fontSize: '1.25rem', fontWeight: 700, color: '#FEFDF9' }}>{value}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Three agent tables */}
                  {([
                    { title: 'Agents Ready to Deploy',               rows: blueprintData.agentsReadyToDeploy,   total: bpReadyTotal },
                    { title: 'Agent SOPs That Require Modification',  rows: blueprintData.sopRequireModification, total: bpModifyTotal },
                    { title: 'Agent SOPs That Require Creation',      rows: blueprintData.sopRequireCreation,    total: bpCreateTotal },
                  ] as const).map(({ title, rows, total }) => rows.length > 0 && (
                    <Card key={title} style={{ background: '#FEFDF9', border: '1px solid #E2DDD2' }}>
                      <CardHeader style={{ borderBottom: '1px solid #E2DDD2' }}>
                        <CardTitle style={{ color: '#3D3533' }}>{title}</CardTitle>
                        <CardDescription style={{ color: '#746C60' }}>{total.toLocaleString()} high-risk lines</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <table className="w-full text-sm">
                          <thead>
                            <tr style={{ background: '#F0EDE6', borderBottom: '1px solid #E2DDD2' }}>
                              <th className="px-4 py-2 text-left" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#746C60' }}>Work Pack / Compliance Area</th>
                              <th className="px-4 py-2 text-right" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#746C60' }}>High Risk Lines</th>
                              <th className="px-4 py-2 text-right" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#746C60' }}>Approved %</th>
                              <th className="px-4 py-2 text-right" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#746C60' }}>Rejected %</th>
                              <th className="px-4 py-2 text-right" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#746C60' }}>Agent Coverage %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              let lastPack = '';
                              return rows.map((row, i) => {
                                const packHeader = row.workPack !== lastPack ? (lastPack = row.workPack, row.workPack) : null;
                                return (
                                  <>
                                    {packHeader && (
                                      <tr key={`exp-pack-${title}-${i}`} style={{ background: '#F0EDE6' }}>
                                        <td colSpan={5} className="px-4 py-1.5" style={{ fontSize: '0.72rem', fontWeight: 600, color: '#544D45' }}>{packHeader}</td>
                                      </tr>
                                    )}
                                    <tr key={`exp-row-${title}-${i}`} style={{ borderBottom: '1px solid #F0EDE6' }}>
                                      <td className="px-4 py-2" style={{ color: '#3D3533' }}>{row.complianceArea}</td>
                                      <td className="px-4 py-2 text-right" style={{ fontWeight: 600, color: '#3D3533' }}>{row.highRiskLines.toLocaleString()}</td>
                                      <td className="px-4 py-2 text-right" style={{ color: '#746C60' }}>{row.approvedPct}%</td>
                                      <td className="px-4 py-2 text-right" style={{ color: '#746C60' }}>{row.rejectedPct}%</td>
                                      <td className="px-4 py-2 text-right" style={{ fontWeight: 600, color: row.agentCoveragePct >= 80 ? '#16a34a' : row.agentCoveragePct >= 60 ? '#b45309' : '#dc2626' }}>{row.agentCoveragePct}%</td>
                                    </tr>
                                  </>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  ))}

                  {/* ROI metrics */}
                  {bpRoi && (
                    <Card style={{ background: '#FEFDF9', border: '1px solid #E2DDD2' }}>
                      <CardHeader style={{ borderBottom: '1px solid #E2DDD2' }}>
                        <CardTitle style={{ color: '#3D3533' }}>ROI Impact</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-5 gap-3">
                          {[
                            { label: 'Auditor Time Saved',   value: bpRoi.displayTime,                                                                                         sub: `${bpRoi.timeSavedMins.toLocaleString()} minutes total` },
                            { label: 'FTE Equivalent',       value: bpRoi.fteEquivalent.toFixed(2),                                                                            sub: '1,920 hrs / FTE / year' },
                            { label: 'FTE Savings',          value: `$${Math.round(bpRoi.fteSavings).toLocaleString()}`,                                                       sub: `at $${fteCost.toLocaleString()} loaded cost` },
                            { label: 'Credit Consumption',   value: bpRoi.creditConsumption.toLocaleString(),                                                                  sub: `${creditsPerAction} credits per action` },
                            { label: 'Cost of Credits',      value: `$${(bpRoi.creditConsumption * costPerCredit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sub: `$${costPerCredit.toFixed(2)} per credit` },
                          ].map(({ label, value, sub }) => (
                            <div key={label} className="rounded-xl px-4 py-4 text-center" style={{ background: '#3D3533' }}>
                              <p style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#FEF76C' }}>{label}</p>
                              <p style={{ marginTop: '4px', fontSize: '1.25rem', fontWeight: 700, color: '#FEFDF9' }}>{value}</p>
                              <p style={{ marginTop: '4px', fontSize: '0.7rem', color: '#B6B0A2' }}>{sub}</p>
                            </div>
                          ))}
                        </div>
                        {(() => {
                          const roiValue = bpRoi.fteSavings - (bpRoi.creditConsumption * costPerCredit);
                          const roiPositive = roiValue >= 0;
                          return (
                            <div className="mt-3 overflow-hidden rounded-xl" style={{ border: `2px solid ${roiPositive ? '#0BDC4D' : '#F35F45'}` }}>
                              <div className="px-6 py-4 text-center" style={{ background: roiPositive ? '#0BDC4D' : '#F35F45' }}>
                                <p style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.8)' }}>Return on Investment</p>
                                <p style={{ marginTop: '4px', fontSize: '2rem', fontWeight: 700, color: '#fff' }}>${Math.abs(Math.round(roiValue)).toLocaleString()}</p>
                                <p style={{ marginTop: '4px', fontSize: '0.875rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{roiPositive ? 'Net Gain' : 'Net Cost'}</p>
                              </div>
                              <div className="flex items-start gap-3 px-4 py-3 text-sm font-medium" style={roiPositive ? { background: '#C5ECD0', color: '#3D3533' } : { background: '#FCD6CF', color: '#3D3533' }}>
                                <span>{roiPositive ? '✓' : '✗'}</span>
                                <span>FTE Savings (${Math.round(bpRoi.fteSavings).toLocaleString()}) − Cost of Credits (${Math.round(bpRoi.creditConsumption * costPerCredit).toLocaleString()}) = <strong>${Math.abs(Math.round(roiValue)).toLocaleString()} {roiPositive ? 'net gain' : 'net cost'}</strong>.</span>
                              </div>
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  )}

                  {/* Chart */}
                  <Card style={{ background: '#FEFDF9', border: '1px solid #E2DDD2' }}>
                    <CardHeader style={{ borderBottom: '1px solid #E2DDD2' }}>
                      <CardTitle style={{ color: '#3D3533' }}>AI Agents and Human Auditors</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const total = blueprintData.totalExpenseLines || 1;
                        const readyPct  = Math.round(bpReadyTotal  / total * 100);
                        const modifyPct = Math.round(bpModifyTotal / total * 100);
                        const createPct = Math.round(bpCreateTotal / total * 100);
                        const humanPct  = Math.max(0, 100 - readyPct - modifyPct - createPct);
                        const BAR_H = 220;
                        const aiSegs = [
                          { key: 'human',  pct: humanPct,  color: '#F87171' },
                          { key: 'create', pct: createPct, color: '#FB923C' },
                          { key: 'modify', pct: modifyPct, color: '#FBBF24' },
                          { key: 'ready',  pct: readyPct,  color: '#4ADE80' },
                        ];
                        return (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: BAR_H, paddingRight: '4px' }}>
                              {[100,75,50,25,0].map(v => <span key={v} style={{ fontSize: '10px', color: '#94A3B8' }}>{v}</span>)}
                            </div>
                            <div style={{ position: 'relative', flex: 1, height: BAR_H }}>
                              {[0,25,50,75,100].map(v => (
                                <div key={v} style={{ position: 'absolute', left: 0, right: 0, bottom: `${v}%`, borderTop: '1px dashed #E2E8F0' }} />
                              ))}
                              <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', padding: '0 48px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                  <div style={{ width: '96px', height: BAR_H, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '4px 4px 0 0' }}>
                                    <div style={{ flex: 1, background: '#F87171', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <span style={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>100%</span>
                                    </div>
                                  </div>
                                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Current State</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                  <div style={{ width: '96px', height: BAR_H, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '4px 4px 0 0' }}>
                                    {aiSegs.map(({ key, pct, color }) => pct > 0 ? (
                                      <div key={key} style={{ height: `${pct}%`, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        {pct >= 5 && <span style={{ color: '#fff', fontWeight: 700, fontSize: '12px' }}>{pct}%</span>}
                                      </div>
                                    ) : null)}
                                  </div>
                                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>With AI Agents</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', marginTop: '16px' }}>
                        {[
                          { label: 'Agents Ready to Deploy',           color: '#4ADE80' },
                          { label: 'Agent SOPs Require Creation',       color: '#FB923C' },
                          { label: 'Agent SOPs Require Modification',   color: '#FBBF24' },
                          { label: 'Human Auditors',                    color: '#F87171' },
                        ].map(({ label, color }) => (
                          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: color, flexShrink: 0 }} />
                            <span style={{ fontSize: '11px', color: '#475569' }}>{label}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Recommendations */}
                  {(blueprintData.recommendations ?? []).length > 0 && (
                    <Card style={{ background: '#FEFDF9', border: '1px solid #E2DDD2' }}>
                      <CardHeader style={{ borderBottom: '1px solid #E2DDD2' }}>
                        <CardTitle style={{ color: '#3D3533' }}>Recommendations</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {(blueprintData.recommendations ?? []).map((section, si) => (
                            <div key={si}>
                              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#3D3533', marginBottom: '6px' }}>{section.title}</h4>
                              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                {section.bullets.map((bullet, bi) => (
                                  <li key={bi} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '4px', fontSize: '0.875rem', color: '#544D45' }}>
                                    <span style={{ marginTop: '6px', width: '6px', height: '6px', borderRadius: '50%', background: '#94A3B8', flexShrink: 0 }} />
                                    {bullet}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Footer — text only */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #E2DDD2', padding: '12px 8px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Hybrid Workforce Analysis Report · Confidential</span>
                    <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{new Date().getFullYear()} © AppZen</span>
                  </div>

                </div>
              </div>

            </>
          )}
        </>
      )}

      {rows.length > 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <span className="inline-flex items-center gap-1 font-semibold">
            <CircleCheck className="h-4 w-4" /> Shared metadata is active
          </span>
          <span className="ml-1">
            {rows.length.toLocaleString()} rows from {filename || 'dataset'} ({sheetName}) are available to all users.
          </span>
        </div>
      ) : null}

      <div className="rounded-xl border border-app-border bg-white px-4 py-3 text-xs text-slate-500">
        <div className="inline-flex items-center gap-1">
          <Building2 className="h-3.5 w-3.5" />
          This page mirrors your uploaded HTML workflow with enterprise styling and shared metadata persistence.
        </div>
      </div>
    </div>
  );
}
