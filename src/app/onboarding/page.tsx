'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Download, FileText, Mail, Upload } from 'lucide-react';
import { LayerStatusCards } from '@/components/LayerStatusCards';
import { QuestionRow } from '@/components/QuestionRow';
import { Stepper } from '@/components/Stepper';
import { BulkAssignDialog } from '@/components/BulkAssignDialog';
import { PageHeader } from '@/components/ui-extensions/page-header';
import { questionCatalog, layerLabels } from '@/lib/questionCatalog';
import { createCoaMappingTemplateCsv, parseCoaMappingCsvToMatrixText } from '@/lib/coaMappingTemplate';
import { downloadSopPdf } from '@/lib/pdfExport';
import { generatePolicyControlsText } from '@/lib/policyControlsGenerator';
import {
  extractDocumentText,
  inferAnswersFromDocumentText,
  parseCoaCsv,
  parseCostCentersCsv,
  parseDoaCsv,
  parseSopConfigCsv,
} from '@/lib/prefillEngine';
import { applyScopeRules } from '@/lib/scopeRules';
import { useOnboardingStore } from '@/store/onboardingStore';
import { LayerNumber, Question } from '@/types/policyOnboarding';

const scopeSchema = z.object({
  companyName: z.string().min(1),
  rolloutTrack: z.enum(['Simple', 'Standard', 'Enterprise']),
  phased: z.boolean(),
  entityCountBand: z.enum(['1', '2-5', '6-20', '21+']),
  policyStandardization: z.enum(['global', 'global_overrides', 'per_entity']),
  apTeamSizeBand: z.enum(['1-5', '6-20', '21-50', '51-100', '100+']),
  invoiceVolumeBand: z.enum(['<1k', '1-10k', '10-50k', '50k+']),
  erpPrimary: z.enum(['SAP', 'OracleEBS', 'OracleFusion', 'NetSuite', 'Coupa', 'Workday']),
  procurementPlatform: z.enum(['same', 'coupa_ariba_other', 'none']),
  poUsageBand: z.enum(['none', '<25', '25-75', '>75']),
  poMatchTypes: z.array(z.string()),
  receiptsDiscipline: z.enum(['strong', 'mixed', 'weak']),
  vertical: z.enum(['manufacturing', 'distribution', 'services', 'saas', 'finserv', 'other']),
  approvalsModel: z.enum(['costCenterOwner', 'managerChain', 'roleGroups', 'mixed']),
  doaExists: z.enum(['yes', 'partial', 'no']),
});

type ScopeForm = z.infer<typeof scopeSchema>;

const steps = [
  {
    title: 'Onboarding Scope & Setup',
    description: 'Define company profile, ERP/P2P context, and baseline rollout settings.',
  },
  {
    title: 'Policy Inputs & Prefill',
    description: 'Upload policies, COA, and templates to prefill and accelerate configuration.',
  },
  {
    title: 'Intake & Classification Controls',
    description: 'Set invoice intake rules, document handling, and triage policies.',
  },
  {
    title: 'Non-PO Compliance Guardrails',
    description: 'Define controls to prevent PO-required spend from slipping into non-PO flow.',
  },
  {
    title: 'PO Matching Decision Framework',
    description: 'Configure 2-way/3-way matching rules, tolerances, and mismatch handling.',
  },
  {
    title: 'GL Coding & COA Policy',
    description: 'Map categories to accounts and define capex, COGS, prepaid, and tax coding logic.',
  },
  {
    title: 'Approvals & Delegation',
    description: 'Set approval ownership, DoA alignment, and escalation behavior.',
  },
  {
    title: 'Integration & Systems Setup',
    description: 'Capture ERP integration, interface controls, and operational ownership.',
  },
  {
    title: 'Review, Activate & Export',
    description: 'Validate completion, assign remaining actions, and activate the prototype.',
  },
] as const;

const stepToLayerMap: Partial<Record<number, LayerNumber>> = {
  2: 1,
  3: 3,
  4: 2,
  5: 4,
  6: 5,
  7: 7,
};

const layerToStepMap: Partial<Record<LayerNumber, number>> = {
  1: 2,
  2: 4,
  3: 3,
  4: 5,
  5: 6,
  7: 7,
};

function fieldValueToText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return '';
}

function LayerQuestions({
  layer,
  autoSuggestPersona,
}: {
  layer: LayerNumber;
  autoSuggestPersona?: boolean;
}) {
  const {
    scopeProfile,
    answers,
    referenceData,
    upsertAnswer,
    confirmAnswer,
    assignQuestion,
  } = useOnboardingStore();

  const questions = useMemo(
    () =>
      questionCatalog
        .filter((q) => q.layer === layer && scopeProfile.questionRules[q.policyKey]?.visible)
        .filter((q) => {
          if (layer !== 7) return true;
          const erpTag = q.tags?.find((tag) => tag.startsWith('ERP:'));
          if (!erpTag) return true;
          return erpTag === `ERP:${scopeProfile.erpPrimary}`;
        })
        .sort((a, b) => Number(scopeProfile.questionRules[b.policyKey]?.required) - Number(scopeProfile.questionRules[a.policyKey]?.required)),
    [layer, scopeProfile]
  );

  const grouped = questions.reduce<Record<string, Question[]>>((acc, question) => {
    const section = question.section || 'General';
    if (!acc[section]) acc[section] = [];
    acc[section].push(question);
    return acc;
  }, {});

  useEffect(() => {
    questions.forEach((question) => {
      const hasAnswer = Boolean(answers[question.policyKey]);
      if (hasAnswer || question.defaultValue === undefined) return;
      const defaultValue =
        question.policyKey === 'l7.integration.erpSystem' ? scopeProfile.erpPrimary : question.defaultValue;
      upsertAnswer(question.policyKey, defaultValue, 'prefilled_needs_confirmation', {
        type: 'manual',
        note: 'Best-practice default',
      }, 0.9);
    });
  }, [answers, questions, upsertAnswer, scopeProfile.erpPrimary]);

  useEffect(() => {
    if (layer !== 7) return;
    const erpAnswer = answers['l7.integration.erpSystem'];
    if (erpAnswer?.value === scopeProfile.erpPrimary) return;
    upsertAnswer(
      'l7.integration.erpSystem',
      scopeProfile.erpPrimary,
      erpAnswer?.status === 'confirmed' ? 'confirmed' : 'prefilled_needs_confirmation',
      { type: 'manual', note: 'Synced from Step 1 ERP/P2P selection' },
      1
    );
  }, [layer, answers, scopeProfile.erpPrimary, upsertAnswer]);

  return (
    <div className="space-y-5">
      {layer === 4 ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="text-sm font-semibold text-blue-900">COA Category Mapping Helper</div>
          <p className="mt-1 text-xs text-blue-800">
            Download a starter CSV, map categories to GL accounts/cost center rules, and upload to prefill the coding matrix.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-md border border-blue-300 bg-white px-3 py-1.5 text-xs text-blue-900"
              onClick={() => {
                const csv = createCoaMappingTemplateCsv();
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'coa_category_account_mapping_template.csv';
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-3.5 w-3.5" /> Download Template
            </button>
            <label
              htmlFor="coaMappingUpload"
              className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-blue-300 bg-white px-3 py-1.5 text-xs text-blue-900"
            >
              <Upload className="h-3.5 w-3.5" /> Upload Filled Mapping
            </label>
            <input
              id="coaMappingUpload"
              type="file"
              className="hidden"
              accept=".csv,text/csv"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                const matrix = parseCoaMappingCsvToMatrixText(text);
                upsertAnswer(
                  'l4.coding.categoryAccountMatrix',
                  matrix,
                  'prefilled_needs_confirmation',
                  { type: 'sop_csv', filename: file.name, rowId: 'all' },
                  0.95
                );
              }}
            />
          </div>
        </div>
      ) : null}
      {layer === 7 ? (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <div className="text-sm font-semibold text-indigo-900">ERP/P2P-Specific Integration Discovery</div>
          <p className="mt-1 text-xs text-indigo-800">
            Showing targeted integration questions for <span className="font-semibold">{scopeProfile.erpPrimary}</span> to accelerate technical onboarding.
          </p>
        </div>
      ) : null}
      {Object.entries(grouped).map(([section, sectionQuestions]) => (
        <div key={section} className="space-y-3">
          <div className="text-sm font-semibold text-slate-700">{section}</div>
          {sectionQuestions.map((question) => {
            const answer = answers[question.policyKey];
            return (
              <QuestionRow
                key={question.policyKey}
                question={question}
                value={answer?.value}
                status={answer?.status || 'unanswered'}
                confidence={answer?.confidence}
                onChange={(next) =>
                  upsertAnswer(question.policyKey, next, answer?.status === 'confirmed' ? 'confirmed' : 'prefilled_needs_confirmation', {
                    type: 'manual',
                    note: 'Manual edit',
                  })
                }
                onConfirm={() => confirmAnswer(question.policyKey)}
                onAssign={(payload) => {
                  const assignment = assignQuestion({
                    policyKey: question.policyKey,
                    assignee: { name: payload.name, email: payload.email, persona: payload.persona },
                    message: payload.message,
                    dueDate: payload.dueDate,
                    createdBy: { name: 'Controller', email: 'controller@appzen.example' },
                  });
                  const link = `${window.location.origin}/collaboration/respond?assignmentId=${assignment.id}&token=${assignment.token}`;
                  const emailText = `Subject: AP Onboarding Input Needed - ${question.title}\n\n${payload.message}\n\nRespond: ${link}`;
                  navigator.clipboard.writeText(emailText).catch(() => undefined);
                  alert(`Assignment created. Email text copied.\n\nmailto:${payload.email}?subject=${encodeURIComponent(`AP Onboarding Input Needed - ${question.title}`)}\n\nShare link:\n${link}`);
                }}
                sources={answer?.sources || []}
                history={answer?.history || []}
                accounts={referenceData.coa?.accounts || []}
                costCenters={referenceData.costCenters?.items || []}
              />
            );
          })}
        </div>
      ))}

      {autoSuggestPersona ? (
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          onClick={() => {
            questions.forEach((q) => {
              const a = answers[q.policyKey];
              if (!a || a.status === 'unanswered') {
                assignQuestion({
                  policyKey: q.policyKey,
                  assignee: {
                    name: `${q.ownerPersona} Owner`,
                    email: `${q.ownerPersona.toLowerCase().replace(/[^a-z]/g, '')}@example.com`,
                    persona: q.ownerPersona,
                  },
                  message: `Please provide policy answer for ${q.title}`,
                  createdBy: { name: 'Controller', email: 'controller@appzen.example' },
                });
              }
            });
          }}
        >
          Assign remaining to suggested personas
        </button>
      ) : null}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const {
    scopeProfile,
    currentStep,
    answers,
    uploads,
    assignments,
    setCurrentStep,
    setScopeProfile,
    recalculateScope,
    bulkUpsertPrefilled,
    setReferenceData,
    addUploadMeta,
    upsertAnswer,
    assignQuestion,
    getLayerStatuses,
  } = useOnboardingStore();

  const [uploadType, setUploadType] = useState('SOP Config CSV');
  const [uploadMessage, setUploadMessage] = useState('');
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkAssignInfo, setBulkAssignInfo] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const scopeForm = useForm<ScopeForm>({
    resolver: zodResolver(scopeSchema),
    defaultValues: {
      companyName: scopeProfile.companyName,
      rolloutTrack: scopeProfile.rolloutTrack,
      phased: scopeProfile.phased,
      entityCountBand: scopeProfile.entityCountBand,
      policyStandardization: scopeProfile.policyStandardization,
      apTeamSizeBand: scopeProfile.apTeamSizeBand,
      invoiceVolumeBand: scopeProfile.invoiceVolumeBand,
      erpPrimary: scopeProfile.erpPrimary,
      procurementPlatform: scopeProfile.procurementPlatform,
      poUsageBand: scopeProfile.poUsageBand,
      poMatchTypes: scopeProfile.poMatchTypes,
      receiptsDiscipline: scopeProfile.receiptsDiscipline,
      vertical: scopeProfile.vertical,
      approvalsModel: scopeProfile.approvalsModel,
      doaExists: scopeProfile.doaExists,
    },
  });
  const watchedErpPrimary = useWatch({ control: scopeForm.control, name: 'erpPrimary' });

  useEffect(() => {
    if (!isMounted || currentStep !== 0) return;
    if (!watchedErpPrimary || watchedErpPrimary === scopeProfile.erpPrimary) return;
    setScopeProfile({ erpPrimary: watchedErpPrimary });
  }, [watchedErpPrimary, scopeProfile.erpPrimary, setScopeProfile, currentStep, isMounted]);

  const layerStatuses = getLayerStatuses();
  const visibleLayerStatuses = layerStatuses.filter((s) => s.layer !== 6);

  const stepItems = steps.map((step, idx) => {
    if (idx < 2 || idx > 7) {
      return { id: idx, label: step.title, description: step.description, displayStep: idx + 1 };
    }
    const layer = stepToLayerMap[idx] as LayerNumber;
    const status = layerStatuses.find((x) => x.layer === layer);
    const state = status?.status || 'Pending';
    const detail = status ? `${status.requiredConfirmed}/${status.requiredTotal} confirmed` : undefined;
    return { id: idx, label: step.title, description: step.description, displayStep: idx + 1, chip: state, detail };
  });

  const assignableSteps = steps
    .map((step, idx) => ({ stepId: idx, label: `Step ${idx + 1}: ${step.title}` }))
    .filter((s) => stepToLayerMap[s.stepId] !== undefined);

  const defaultBulkSteps = stepToLayerMap[currentStep] !== undefined ? [currentStep] : [];

  const assignQuestionsForSteps = (payload: {
    selectedSteps: number[];
    assignee: { name: string; email: string; persona: string };
    message: string;
    dueDate?: number;
  }) => {
    const policyKeys = new Set<string>();

    payload.selectedSteps.forEach((stepId) => {
      const layer = stepToLayerMap[stepId];
      if (!layer) return;
      questionCatalog
        .filter((q) => q.layer === layer && scopeProfile.questionRules[q.policyKey]?.visible)
        .forEach((q) => policyKeys.add(q.policyKey));
    });

    let assignedCount = 0;
    [...policyKeys].forEach((policyKey) => {
      const existing = answers[policyKey];
      if (existing?.status === 'confirmed' || existing?.status === 'assigned') return;
      assignQuestion({
        policyKey,
        assignee: payload.assignee,
        message: payload.message,
        dueDate: payload.dueDate,
        createdBy: { name: 'Controller', email: 'controller@appzen.example' },
      });
      assignedCount += 1;
    });

    setBulkAssignInfo(`Assigned ${assignedCount} question(s) across ${payload.selectedSteps.length} step(s) to ${payload.assignee.name}.`);
  };

  const handleUpload = async (file: File) => {
    const text = await file.text();
    addUploadMeta({ filename: file.name, fileType: uploadType, uploadedAt: Date.now() });

    try {
      if (uploadType === 'SOP Config CSV') {
        const prefilled = parseSopConfigCsv(text, file.name);
        bulkUpsertPrefilled(prefilled);
        setUploadMessage(`Imported ${Object.keys(prefilled).length} SOP config answers.`);
      } else if (uploadType === 'CoA CSV') {
        setReferenceData({ coa: parseCoaCsv(text, file.name) });
        setUploadMessage('Imported Chart of Accounts for accountPicker questions.');
      } else if (uploadType === 'Cost Center CSV') {
        setReferenceData({ costCenters: parseCostCentersCsv(text, file.name) });
        setUploadMessage('Imported Cost Centers for costCenterPicker questions.');
      } else if (uploadType === 'DoA CSV/XLSX') {
        const rows = parseDoaCsv(text);
        upsertAnswer('l5.approvals.doa.matrix', rows, 'prefilled_needs_confirmation', {
          type: 'sop_csv',
          filename: file.name,
          rowId: 'all',
        });
        setUploadMessage(`Imported ${rows.length} DoA rows.`);
      } else {
        const raw = file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.pdf') ? await extractDocumentText(file) : text;
        const inferred = inferAnswersFromDocumentText(raw, file.name);
        bulkUpsertPrefilled(inferred);
        setUploadMessage(`Extracted ${Object.keys(inferred).length} suggested answers from document.`);
      }
    } catch (error) {
      setUploadMessage(`Upload parse failed: ${String(error)}`);
    }
  };

  const runDemoMode = async () => {
    setIsDemoLoading(true);
    setUploadMessage('Running demo mode: loading sample policy pack...');

    try {
      const demoFiles: Array<{ fileType: string; filename: string; path: string }> = [
        { fileType: 'SOP Config CSV', filename: 'sop_config_demo.csv', path: '/demo/sop_config_demo.csv' },
        { fileType: 'CoA CSV', filename: 'coa_demo.csv', path: '/demo/coa_demo.csv' },
        { fileType: 'Cost Center CSV', filename: 'cost_centers_demo.csv', path: '/demo/cost_centers_demo.csv' },
        { fileType: 'DoA CSV/XLSX', filename: 'doa_demo.csv', path: '/demo/doa_demo.csv' },
        { fileType: 'Accounting Policy', filename: 'accounting_policy_demo.txt', path: '/demo/accounting_policy_demo.txt' },
        { fileType: 'AP SOP', filename: 'ap_sop_demo.txt', path: '/demo/ap_sop_demo.txt' },
        { fileType: 'Procurement Policy', filename: 'procurement_policy_demo.txt', path: '/demo/procurement_policy_demo.txt' },
      ];

      for (const file of demoFiles) {
        const res = await fetch(file.path);
        if (!res.ok) continue;
        const text = await res.text();
        addUploadMeta({ filename: file.filename, fileType: file.fileType, uploadedAt: Date.now() });

        if (file.fileType === 'SOP Config CSV') {
          const prefilled = parseSopConfigCsv(text, file.filename);
          bulkUpsertPrefilled(prefilled);
        } else if (file.fileType === 'CoA CSV') {
          setReferenceData({ coa: parseCoaCsv(text, file.filename) });
        } else if (file.fileType === 'Cost Center CSV') {
          setReferenceData({ costCenters: parseCostCentersCsv(text, file.filename) });
        } else if (file.fileType === 'DoA CSV/XLSX') {
          const rows = parseDoaCsv(text);
          upsertAnswer('l5.approvals.doa.matrix', rows, 'prefilled_needs_confirmation', {
            type: 'sop_csv',
            filename: file.filename,
            rowId: 'all',
          });
        } else {
          const inferred = inferAnswersFromDocumentText(text, file.filename);
          bulkUpsertPrefilled(inferred);
        }
      }

      setUploadMessage('Demo mode complete: sample policy documents and CSVs loaded.');
    } catch (error) {
      setUploadMessage(`Demo mode failed: ${String(error)}`);
    } finally {
      setIsDemoLoading(false);
    }
  };

  const prefilledEntries = Object.values(answers).filter((a) => a.status === 'prefilled_needs_confirmation');
  const prefillReviewRows = prefilledEntries
    .map((entry) => {
      const question = questionCatalog.find((q) => q.policyKey === entry.policyKey);
      return {
        policyKey: entry.policyKey,
        title: question?.title || 'Question',
        layer: question?.layer,
        confidence: entry.confidence || 0,
        sourceType: entry.sources[0]?.type || 'manual',
        valuePreview: fieldValueToText(entry.value).slice(0, 140),
      };
    })
    .sort((a, b) => b.confidence - a.confidence);

  const highConfidenceCount = prefillReviewRows.filter((r) => r.confidence >= 0.8).length;
  const mediumConfidenceCount = prefillReviewRows.filter((r) => r.confidence >= 0.5 && r.confidence < 0.8).length;
  const lowConfidenceCount = prefillReviewRows.filter((r) => r.confidence < 0.5).length;
  const sopMappedCount = prefillReviewRows.filter((r) => r.sourceType === 'sop_csv').length;
  const docExtractedCount = prefillReviewRows.filter((r) => r.sourceType === 'document_extract').length;

  const highImpactPolicyKeys = [
    'l1.intake.documentTypes',
    'l2.matching.levelByCategory',
    'l3.nonpo.poRequiredDecisionRule',
    'l4.coding.categoryAccountMatrix',
    'l4.coding.capexDecisionRule',
    'l5.approvals.model',
  ];
  const highImpactItems = highImpactPolicyKeys.map((policyKey) => {
    const question = questionCatalog.find((q) => q.policyKey === policyKey);
    const answer = answers[policyKey];
    return {
      policyKey,
      title: question?.title || policyKey,
      status: answer?.status || 'unanswered',
      layer: question?.layer,
    };
  });

  if (!isMounted) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Policy-Driven Autonomous AP Setup</h1>
          <p className="mt-1 text-sm text-slate-600">Loading onboarding workspace...</p>
        </div>
        <div className="rounded-xl border bg-white p-6 text-sm text-slate-500">Preparing saved onboarding data.</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Policy-Driven Autonomous AP Setup"
        subtitle="Configure AP settings, controls, automations, and agents to enforce policy-aligned compliance from day one."
        actions={
          <>
            <button className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50" onClick={() => setBulkAssignOpen(true)}>
              Assign by Step
            </button>
            <button className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50" onClick={() => router.push('/sop')}>
              Preview SOP
            </button>
            <button className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50" disabled={currentStep === 0} onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}>
              Back
            </button>
            <button className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800" disabled={currentStep === 8} onClick={() => setCurrentStep(Math.min(8, currentStep + 1))}>
              Next
            </button>
          </>
        }
      />
      {bulkAssignInfo ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">{bulkAssignInfo}</div>
      ) : null}

      <Stepper steps={stepItems} currentStep={currentStep} onStepClick={setCurrentStep} />
      <BulkAssignDialog
        open={bulkAssignOpen}
        onClose={() => setBulkAssignOpen(false)}
        steps={assignableSteps}
        defaultSelectedSteps={defaultBulkSteps}
        onAssign={assignQuestionsForSteps}
      />

      {currentStep >= 2 && currentStep <= 7 ? (
        <div className="grid gap-3 md:grid-cols-3">
          {(() => {
            const layer = stepToLayerMap[currentStep] as LayerNumber;
            const s = layerStatuses.find((x) => x.layer === layer);
            return (
              <>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-xs text-slate-500">Required Confirmed</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">
                    {s?.requiredConfirmed || 0}/{s?.requiredTotal || 0}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-xs text-slate-500">Needs Confirmation</div>
                  <div className="mt-1 text-2xl font-semibold text-amber-700">{s?.needsConfirmationCount || 0}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-xs text-slate-500">Assigned / Responded</div>
                  <div className="mt-1 text-2xl font-semibold text-violet-700">
                    {(s?.assignedCount || 0) + (s?.respondedNotAcceptedCount || 0)}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      ) : null}

      {currentStep === 0 ? (
        <section className="space-y-4 rounded-xl border bg-white p-5">
          <h2 className="text-lg font-semibold">Step 1: {steps[0].title}</h2>
          <p className="text-sm text-slate-600">{steps[0].description}</p>
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={scopeForm.handleSubmit((values) => {
              const nextScope = applyScopeRules({
                ...scopeProfile,
                ...values,
              });
              setScopeProfile(nextScope);
              recalculateScope();
              setCurrentStep(1);
            })}
          >
            <div className="space-y-1">
              <label htmlFor="companyName" className="text-xs font-medium text-slate-700">Company Name</label>
              <input id="companyName" className="w-full rounded border px-3 py-2 text-sm" placeholder="Company" {...scopeForm.register('companyName')} />
            </div>
            <div className="space-y-1">
              <label htmlFor="rolloutTrack" className="text-xs font-medium text-slate-700">Rollout Track</label>
              <select id="rolloutTrack" className="w-full rounded border px-3 py-2 text-sm" {...scopeForm.register('rolloutTrack')}>
                <option>Simple</option><option>Standard</option><option>Enterprise</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="erpPrimary" className="text-xs font-medium text-slate-700">ERP/P2P System</label>
              <select id="erpPrimary" className="w-full rounded border px-3 py-2 text-sm" {...scopeForm.register('erpPrimary')}>
                <option value="SAP">SAP</option>
                <option value="OracleEBS">Oracle EBS</option>
                <option value="OracleFusion">Oracle Fusion</option>
                <option value="NetSuite">NetSuite</option>
                <option value="Coupa">Coupa</option>
                <option value="Workday">Workday</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="poUsageBand" className="text-xs font-medium text-slate-700">PO Usage Band</label>
              <select id="poUsageBand" className="w-full rounded border px-3 py-2 text-sm" {...scopeForm.register('poUsageBand')}>
                <option value="none">none</option><option value="<25">&lt;25</option><option value="25-75">25-75</option><option value=">75">&gt;75</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="apTeamSizeBand" className="text-xs font-medium text-slate-700">AP Team Size</label>
              <select id="apTeamSizeBand" className="w-full rounded border px-3 py-2 text-sm" {...scopeForm.register('apTeamSizeBand')}>
                <option>1-5</option><option>6-20</option><option>21-50</option><option>51-100</option><option>100+</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="vertical" className="text-xs font-medium text-slate-700">Industry Vertical</label>
              <select id="vertical" className="w-full rounded border px-3 py-2 text-sm" {...scopeForm.register('vertical')}>
                <option>manufacturing</option><option>distribution</option><option>services</option><option>saas</option><option>finserv</option><option>other</option>
              </select>
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white" type="submit">Apply Tailoring</button>
            </div>
          </form>
          <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            Enabled sections: {Object.entries(scopeProfile.layersEnabled).filter(([, v]) => v).map(([k]) => k.toUpperCase()).join(', ')}
            <br />
            Compliance modules: VAT {scopeProfile.complianceModules.vat ? 'on' : 'off'} | GST {scopeProfile.complianceModules.indiaGst ? 'on' : 'off'}
          </div>
        </section>
      ) : null}

      {currentStep === 1 ? (
        <section className="space-y-4 rounded-xl border bg-white p-5">
          <h2 className="text-lg font-semibold">Step 2: {steps[1].title}</h2>
          <p className="text-sm text-slate-600">{steps[1].description}</p>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            Use this stage to validate what was extracted, confirm high-confidence policies quickly, and resolve critical controls before moving section by section.
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label htmlFor="uploadType" className="text-xs font-medium text-slate-700">Upload Type</label>
              <select id="uploadType" value={uploadType} onChange={(e) => setUploadType(e.target.value)} className="w-full rounded border px-3 py-2 text-sm">
                {['Accounting Policy', 'AP SOP', 'Procurement Policy', 'DoA CSV/XLSX', 'SOP Config CSV', 'CoA CSV', 'Cost Center CSV', 'Other'].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="uploadFile" className="text-xs font-medium text-slate-700">File</label>
              <label htmlFor="uploadFile" className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm">
                <Upload className="h-4 w-4" /> Upload file
              </label>
              <input
                id="uploadFile"
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                }}
              />
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">{uploadMessage || 'No uploads yet'}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
              onClick={runDemoMode}
              disabled={isDemoLoading}
            >
              {isDemoLoading ? 'Loading Demo Pack...' : 'Demo Mode: Auto-load Sample Policy Pack'}
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded border p-3">
              <div className="text-xs text-slate-500">Prefilled Policies</div>
              <div className="mt-1 text-2xl font-semibold">{prefilledEntries.length}</div>
              <div className="mt-2 text-xs text-slate-600">Suggestions ready for controller confirmation.</div>
            </div>
            <div className="rounded border p-3">
              <div className="text-xs text-slate-500">High Confidence</div>
              <div className="mt-1 text-2xl font-semibold text-emerald-700">{highConfidenceCount}</div>
              <div className="mt-2 text-xs text-slate-600">Safe candidates for bulk accept.</div>
            </div>
            <div className="rounded border p-3">
              <div className="text-xs text-slate-500">Needs Review</div>
              <div className="mt-1 text-2xl font-semibold text-amber-700">{mediumConfidenceCount + lowConfidenceCount}</div>
              <div className="mt-2 text-xs text-slate-600">Medium/low confidence policy suggestions.</div>
            </div>
            <div className="rounded border p-3">
              <div className="text-xs text-slate-500">Import Signals</div>
              <div className="mt-1 text-sm font-medium text-slate-800">CSV: {sopMappedCount} · Docs: {docExtractedCount}</div>
              <div className="mt-2 text-xs text-slate-600">Track source quality before confirmation.</div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded border p-3">
              <div className="text-sm font-semibold">Controller Priority Review</div>
              <div className="mt-2 space-y-2">
                {highImpactItems.map((item) => (
                  <div key={item.policyKey} className="rounded border border-slate-200 p-2 text-xs">
                    <div className="font-semibold">{item.title}</div>
                    <div className="text-slate-600">
                      Section {item.layer ? layerLabels[item.layer] : '-'} · Status:{' '}
                      <span className={item.status === 'confirmed' ? 'text-emerald-700' : 'text-amber-700'}>{item.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded border p-3">
              <div className="text-sm font-semibold">Prefill Review Queue</div>
              <div className="mt-2 space-y-2 text-xs">
                <div className="rounded border border-slate-200 bg-slate-50 p-2">
                  CoA: {useOnboardingStore.getState().referenceData.coa?.accounts.length || 0} accounts · Cost Centers:{' '}
                  {useOnboardingStore.getState().referenceData.costCenters?.items.length || 0} · Uploads: {uploads.length}
                </div>
                {prefillReviewRows.slice(0, 10).map((row) => (
                  <div key={row.policyKey} className="rounded border border-slate-200 p-2">
                    <div className="font-semibold">{row.title}</div>
                    <div className="text-slate-600">
                      Section {row.layer ? layerLabels[row.layer] : '-'} · Confidence {Math.round(row.confidence * 100)}% · Source {row.sourceType}
                    </div>
                    <div className="mt-1 text-slate-500">{row.valuePreview || 'No preview available'}</div>
                    <div className="mt-1">
                      <button className="rounded border px-2 py-1" onClick={() => useOnboardingStore.getState().confirmAnswer(row.policyKey)}>Accept</button>
                    </div>
                  </div>
                ))}
                {prefillReviewRows.length === 0 ? <div className="text-xs text-slate-500">No prefilled answers yet.</div> : null}
              </div>
            </div>
          </div>

          <div>
            <button
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              onClick={() => {
                prefilledEntries
                  .filter((e) => (e.confidence || 0) >= 0.8)
                  .forEach((e) => useOnboardingStore.getState().confirmAnswer(e.policyKey));
              }}
            >
              Bulk accept high confidence (&gt;=0.8)
            </button>
          </div>
        </section>
      ) : null}

      {currentStep >= 2 && currentStep <= 7 ? (
        <section className="space-y-4 rounded-xl border bg-white p-5">
          <h2 className="text-lg font-semibold">Step {currentStep + 1}: {steps[currentStep].title}</h2>
          <p className="text-sm text-slate-600">{steps[currentStep].description}</p>
          {currentStep === 4 && !scopeProfile.layersEnabled.l2 ? (
            <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              PO &amp; Matching section is hidden because PO usage is set to &quot;none&quot; in Step 1.
            </div>
          ) : (
            <LayerQuestions layer={stepToLayerMap[currentStep] as LayerNumber} />
          )}
        </section>
      ) : null}

      {currentStep === 8 ? (
        <section className="space-y-4 rounded-xl border bg-white p-5">
          <h2 className="text-lg font-semibold">Step 9: {steps[8].title}</h2>
          <p className="text-sm text-slate-600">{steps[8].description}</p>
          <LayerStatusCards statuses={visibleLayerStatuses} />

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2">Section</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Counts</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleLayerStatuses.map((s) => (
                  <tr key={s.layer} className="border-t odd:bg-white even:bg-slate-50/40">
                    <td className="px-3 py-2">{layerLabels[s.layer]}</td>
                    <td className="px-3 py-2">{s.status}</td>
                    <td className="px-3 py-2 text-xs">
                      Confirmed {s.requiredConfirmed}/{s.requiredTotal} • Needs conf {s.needsConfirmationCount} • Assigned {s.assignedCount}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          className="rounded border px-2 py-1 text-xs"
                          onClick={() => layerToStepMap[s.layer] !== undefined && setCurrentStep(layerToStepMap[s.layer] as number)}
                        >
                          Review missing
                        </button>
                        <button
                          className="rounded border px-2 py-1 text-xs"
                          onClick={() => layerToStepMap[s.layer] !== undefined && setCurrentStep(layerToStepMap[s.layer] as number)}
                        >
                          Assign remaining
                        </button>
                        <button className="rounded border px-2 py-1 text-xs" onClick={() => router.push('/sop')}>View SOP section</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm"
              onClick={() => {
                const content = generatePolicyControlsText(scopeProfile, answers);
                const safeCompany = scopeProfile.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                downloadSopPdf(
                  `policy_controls_${safeCompany}_${new Date().toISOString().slice(0, 10)}.pdf`,
                  'Policy and Controls - AP Processing',
                  content
                );
              }}
            >
              <Download className="h-4 w-4" /> Export Policy and Controls
            </button>
            <button className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={() => router.push('/collaboration')}>
              <Mail className="h-4 w-4" /> Open collaboration dashboard ({assignments.length})
            </button>
            <button className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm text-white" onClick={() => router.push('/inbox')}>
              <FileText className="h-4 w-4" /> Activate
            </button>
          </div>
        </section>
      ) : null}

      <div className="flex justify-between">
        <button className="rounded border px-3 py-2 text-sm" disabled={currentStep === 0} onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}>Back</button>
        <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" disabled={currentStep === 8} onClick={() => setCurrentStep(Math.min(8, currentStep + 1))}>Next</button>
      </div>
    </div>
  );
}
