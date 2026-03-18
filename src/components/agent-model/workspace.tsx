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
  type AgentModelMetadata,
  type AgentModelRow,
  uniqueCustomerNames,
} from '@/lib/agentModel';

export type AgentModelPanel = 'admin' | 'customers' | 'prospect';

interface ApiResponse {
  ok: boolean;
  source?: 'kv' | 'memory' | 'none';
  metadata?: AgentModelMetadata | null;
  error?: string;
}

interface CustomerOperationalAnswers {
  auditorCount: string;
  reimbursementCycleTime: '' | '5 mins' | '10 mins' | '15 mins' | '30 mins' | '60 mins' | 'other';
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
  prospect: {
    label: 'Prospect',
    subtitle: 'Prospect modelling area for future extension.',
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

  const [timeMinutes, setTimeMinutes] = useState(2);
  const [creditsPerAction, setCreditsPerAction] = useState(1);
  const [fteCost, setFteCost] = useState(35000);
  const [costPerCredit, setCostPerCredit] = useState(0.30);

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
  const top5MaxReturned = useMemo(() => Math.max(...top5.map((item) => item.returned), 1), [top5]);

  const roi = useMemo(() => {
    if (!top5TotalHighRisk) return null;

    const timeSavedMins = top5TotalHighRisk * timeMinutes;
    const timeSavedHours = timeSavedMins / 60;
    const fteEquivalent = timeSavedHours / 1920;
    const fteSavings = fteEquivalent * fteCost;
    const creditConsumption = top5TotalHighRisk * creditsPerAction;

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
  }, [top5TotalHighRisk, timeMinutes, fteCost, creditsPerAction]);

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

  useEffect(() => {
    void fetchSharedMetadata();
  }, []);

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
    setRows(metadata.rows);
    setFilename(metadata.filename);
    setSheetName(metadata.sheetName);
    setSavedAt(metadata.savedAt);
    setSource(storageSource);

    if (selectedCustomer && nextCustomers.includes(selectedCustomer)) {
      return;
    }
    setSelectedCustomer(nextCustomers[0] || '');
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
      setNotice({ kind: 'info', message: 'Metadata cleared.' });
    } catch {
      setNotice({ kind: 'error', message: 'Unable to clear metadata right now.' });
    } finally {
      setLoading(false);
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

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>{currentPanel.label}</CardTitle>
          <CardDescription>{currentPanel.subtitle}</CardDescription>
        </CardHeader>
      </Card>

      {panel === 'admin' && (
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
                  <label className="text-sm font-medium text-slate-700">Auditor Decision Cycle Time</label>
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
                    <option value="5 mins">5 mins</option>
                    <option value="10 mins">10 mins</option>
                    <option value="15 mins">15 mins</option>
                    <option value="30 mins">30 mins</option>
                    <option value="60 mins">60 mins</option>
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
                    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm font-medium ${roiPositive ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
                      <span className="mt-0.5 text-base">{roiPositive ? '✓' : '✗'}</span>
                      <span>
                        Return on Investment: <strong>${Math.abs(Math.round(roiValue)).toLocaleString()}</strong> {roiPositive ? 'net gain' : 'net cost'}.
                        {' '}FTE Savings Cost (${Math.round(roi.fteSavings).toLocaleString()}) − Cost of Credits (${Math.round(roi.creditConsumption * costPerCredit).toLocaleString()}).
                        {' '}{roiPositive ? 'Automation delivers a positive return.' : 'Credit costs currently exceed FTE savings.'}
                      </span>
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
                      Decision Cycle Time Compression: auditor cycle time reduced from{' '}
                      <strong>
                        {selectedOperationalAnswers.reimbursementCycleTime === 'other'
                          ? (selectedOperationalAnswers.reimbursementCycleTimeCustom || 'custom')
                          : selectedOperationalAnswers.reimbursementCycleTime}
                      </strong>{' '}
                      to <strong>1–2 mins with Agents</strong>.
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
                      <div className="mt-3 flex items-start gap-3 rounded-lg px-4 py-3 text-sm font-medium" style={roiPositive
                        ? { background: '#C5ECD0', border: '1px solid #0BDC4D', color: '#3D3533' }
                        : { background: '#FCD6CF', border: '1px solid #F35F45', color: '#3D3533' }}>
                        <span className="mt-0.5 text-base">{roiPositive ? '✓' : '✗'}</span>
                        <span>
                          Return on Investment: <strong>${Math.abs(Math.round(roiValue)).toLocaleString()}</strong> {roiPositive ? 'net gain' : 'net cost'}.
                          {' '}FTE Savings Cost (${Math.round(roi.fteSavings).toLocaleString()}) − Cost of Credits (${Math.round(roi.creditConsumption * costPerCredit).toLocaleString()}).
                          {' '}{roiPositive ? 'Automation delivers a positive return.' : 'Credit costs currently exceed FTE savings.'}
                        </span>
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
                        Decision Cycle Time Compression: auditor cycle time reduced from{' '}
                        <strong>
                          {selectedOperationalAnswers.reimbursementCycleTime === 'other'
                            ? (selectedOperationalAnswers.reimbursementCycleTimeCustom || 'custom')
                            : selectedOperationalAnswers.reimbursementCycleTime}
                        </strong>{' '}
                        to <strong>1–2 mins with Agents</strong>.
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
                      <span className="text-slate-500">Auditor Decision Cycle Time</span>
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
        <Card>
          <CardHeader>
            <CardTitle>Prospect Workspace</CardTitle>
            <CardDescription>Reserved area for prospect modelling workflows.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm text-slate-600">
              Prospect workspace placeholder. Add prospect-specific modelling workflows here while keeping customer analytics and ROI flows under the Customers section.
            </div>
          </CardContent>
        </Card>
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
