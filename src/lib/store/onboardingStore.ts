'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { agentCatalog } from '@/lib/agentCatalog';
import { schemaCatalog } from '@/lib/schemaCatalog';
import {
  computeAgentReadiness,
  getAgentRequirements,
  type AgentReadiness,
} from '@/lib/readinessEngine';
import { ONBOARDING_STORAGE_KEY } from '@/lib/storage';
import {
  AgentConfig,
  CompanyDetails,
  InboxConfig,
  InboxTask,
  OnboardingState,
  UploadedDomainData,
} from '@/types/onboarding';

interface OnboardingStore extends OnboardingState {
  setCompany: (company: CompanyDetails) => void;
  setInboxes: (inboxes: InboxConfig[]) => void;
  updateInbox: (inboxId: string, updater: (inbox: InboxConfig) => InboxConfig) => void;
  addInbox: () => void;
  removeInbox: (inboxId: string) => void;
  setAgentEnabled: (agentId: AgentConfig['id'], enabled: boolean) => void;
  setUploadedData: (uploadedData: UploadedDomainData[]) => void;
  upsertUploadedDomain: (domain: UploadedDomainData) => void;
  setCurrentStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  activate: () => void;
  addInboxTask: (task: Omit<InboxTask, 'id' | 'createdAt'>) => void;
  seedDemo: () => void;
  resetAll: () => void;
}

const defaultCompany: CompanyDetails = {
  legalName: '',
  domain: '',
  country: '',
  industry: '',
  subIndustry: '',
  erpSystem: 'SAP',
  multiEntity: false,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
};

const createBlankInbox = (index = 1): InboxConfig => ({
  id: crypto.randomUUID(),
  email: '',
  friendlyName: `AP Inbox ${index}`,
  primaryUse: 'invoices',
  primaryUseOther: '',
  notes: '',
  allowSendingReplies: true,
  replyFromAddress: '',
  allowedSenderDomains: [],
  connection: {
    mode: 'test',
    provider: 'Google Workspace',
    oauthClientId: '',
    imapHost: '',
    imapPort: '993',
    permissions: {
      readEmails: true,
      readAttachments: true,
      sendEmails: true,
    },
    forwardingAddress: '',
    forwardingEnabled: false,
  },
});

const baseState = (): OnboardingState => ({
  currentStep: 1,
  company: defaultCompany,
  inboxes: [createBlankInbox(1)],
  agents: agentCatalog.map((agent) => ({ id: agent.key as AgentConfig['id'], enabled: true })),
  uploadedData: [],
  inboxTasks: [],
});

const TARGET_BLOCKED_AGENT = 'invoice_hold_reason_explainer';
const TARGET_DEGRADED_AGENT = 'bank_account_change_request';

const buildBaseCoverageHeaders = (): Map<string, Set<string>> => {
  const headersByDomain = new Map<string, Set<string>>();
  for (const domain of schemaCatalog) {
    for (const field of domain.fields) {
      if (field.usedByAgents.length === 0) continue;
      if (field.requirement === 'optional') continue;
      const headers = headersByDomain.get(domain.domainKey) ?? new Set<string>();
      headers.add(field.key);
      headersByDomain.set(domain.domainKey, headers);
    }
  }
  return headersByDomain;
};

const cloneCoverageHeaders = (input: Map<string, Set<string>>): Map<string, Set<string>> => {
  const copy = new Map<string, Set<string>>();
  for (const [domainKey, headers] of input.entries()) {
    copy.set(domainKey, new Set(headers));
  }
  return copy;
};

const headersToUploadedData = (headersByDomain: Map<string, Set<string>>): UploadedDomainData[] => {
  const now = Date.now();
  return Array.from(headersByDomain.entries()).map(([domainId, headers]) => ({
    domainId,
    fileName: `${domainId}.csv`,
    headers: Array.from(headers).sort(),
    recordCount: 1000,
    lastUploadAt: now,
  }));
};

const buildOmissionCandidates = (
  items: ReturnType<typeof getAgentRequirements>['mandatory' | 'recommended']
): Array<{ domainKey: string; fieldKey: string; uniquenessScore: number }> => {
  return items
    .map((item) => {
      const field = schemaCatalog
        .find((domain) => domain.domainKey === item.domainKey)
        ?.fields.find((f) => f.key === item.fieldKey);
      return {
        domainKey: item.domainKey,
        fieldKey: item.fieldKey,
        uniquenessScore: field?.usedByAgents.length ?? 99,
      };
    })
    .sort((a, b) => a.uniquenessScore - b.uniquenessScore);
};

const readinessMapByAgent = (readiness: AgentReadiness[]): Map<string, AgentReadiness> => {
  return new Map(readiness.map((item) => [item.agentKey, item]));
};

const printSeedDiff = (readiness: AgentReadiness[]): void => {
  console.warn('[seedDemo] Target readiness assertion failed. Diff by agent:');
  for (const item of readiness) {
    console.warn(
      `[seedDemo] ${item.agentKey} => ${item.status} | missingMandatory=[${item.missingMandatory
        .map((f) => `${f.domainKey}.${f.fieldKey}`)
        .join(', ')}] | missingRecommended=[${item.missingRecommended
        .map((f) => `${f.domainKey}.${f.fieldKey}`)
        .join(', ')}]`
    );
  }
};

const buildSeedUploadedData = (): UploadedDomainData[] => {
  const baseHeaders = buildBaseCoverageHeaders();
  const blockedRequirements = getAgentRequirements(TARGET_BLOCKED_AGENT);
  const degradedRequirements = getAgentRequirements(TARGET_DEGRADED_AGENT);

  const blockedCandidates = buildOmissionCandidates(blockedRequirements.mandatory);
  const degradedCandidates = buildOmissionCandidates(degradedRequirements.recommended);

  const candidatesBlocked =
    blockedCandidates.length > 0 ? blockedCandidates : [{ domainKey: '', fieldKey: '', uniquenessScore: 99 }];
  const candidatesDegraded =
    degradedCandidates.length > 0
      ? degradedCandidates
      : [{ domainKey: '', fieldKey: '', uniquenessScore: 99 }];

  let selectedCoverage = cloneCoverageHeaders(baseHeaders);

  for (const blocked of candidatesBlocked) {
    for (const degraded of candidatesDegraded) {
      const working = cloneCoverageHeaders(baseHeaders);
      if (blocked.domainKey && blocked.fieldKey) {
        working.get(blocked.domainKey)?.delete(blocked.fieldKey);
      }
      if (degraded.domainKey && degraded.fieldKey) {
        working.get(degraded.domainKey)?.delete(degraded.fieldKey);
      }

      const readiness = computeAgentReadiness(headersToUploadedData(working));
      const byAgent = readinessMapByAgent(readiness);
      const blockedKeys = readiness.filter((item) => item.status === 'blocked').map((item) => item.agentKey);
      const degradedKeys = readiness.filter((item) => item.status === 'degraded').map((item) => item.agentKey);

      const blockedOk = blockedKeys.length === 1 && blockedKeys[0] === TARGET_BLOCKED_AGENT;
      const degradedOk = degradedKeys.length === 1 && degradedKeys[0] === TARGET_DEGRADED_AGENT;
      const allOthersReady = readiness.every((item) => {
        if (item.agentKey === TARGET_BLOCKED_AGENT) return item.status === 'blocked';
        if (item.agentKey === TARGET_DEGRADED_AGENT) return item.status === 'degraded';
        return item.status === 'ready';
      });

      if (blockedOk && degradedOk && allOthersReady) {
        selectedCoverage = working;
        return headersToUploadedData(selectedCoverage);
      }

      if (!byAgent.has(TARGET_BLOCKED_AGENT) || !byAgent.has(TARGET_DEGRADED_AGENT)) {
        continue;
      }
    }
  }

  const fallbackUploaded = headersToUploadedData(selectedCoverage);
  const fallbackReadiness = computeAgentReadiness(fallbackUploaded);
  printSeedDiff(fallbackReadiness);
  return fallbackUploaded;
};

const demoSeed = (): OnboardingState => ({
  currentStep: 6,
  activatedAt: undefined,
  company: {
    legalName: 'Acme Industrial Components, Inc.',
    domain: 'acme-industrial.com',
    country: 'United States',
    industry: 'Manufacturing',
    subIndustry: 'Industrial Equipment',
    erpSystem: 'SAP',
    multiEntity: true,
    timezone: 'America/Chicago',
  },
  inboxes: [
    {
      id: crypto.randomUUID(),
      email: 'ap-invoices@acme-industrial.com',
      friendlyName: 'AP Invoices',
      primaryUse: 'invoices',
      primaryUseOther: '',
      notes: 'Central AP invoice intake mailbox.',
      allowSendingReplies: true,
      replyFromAddress: 'ap@acme-industrial.com',
      allowedSenderDomains: ['keysuppliers.com', 'freightco.com'],
      connection: {
        mode: 'test',
        provider: 'Microsoft 365',
        oauthClientId: '',
        imapHost: '',
        imapPort: '993',
        permissions: {
          readEmails: true,
          readAttachments: true,
          sendEmails: true,
        },
        forwardingAddress: 'acme-industrial+apinv@forward.appzen.example',
        forwardingEnabled: true,
        lastTestResult: 'pass',
      },
    },
    {
      id: crypto.randomUUID(),
      email: 'ap-payments@acme-industrial.com',
      friendlyName: 'AP Payments',
      primaryUse: 'payment inquiries',
      primaryUseOther: '',
      notes: 'Vendor payment status and remittance inbox.',
      allowSendingReplies: true,
      replyFromAddress: 'ap-payments@acme-industrial.com',
      allowedSenderDomains: ['keysuppliers.com'],
      connection: {
        mode: 'live',
        provider: 'Microsoft 365',
        oauthClientId: 'demo-client-id-12345',
        imapHost: '',
        imapPort: '993',
        permissions: {
          readEmails: true,
          readAttachments: true,
          sendEmails: true,
        },
        forwardingAddress: '',
        forwardingEnabled: false,
        lastTestResult: 'pass',
      },
    },
  ],
  agents: agentCatalog.map((agent) => ({ id: agent.key as AgentConfig['id'], enabled: true })),
  uploadedData: buildSeedUploadedData(),
  inboxTasks: [
    {
      id: crypto.randomUUID(),
      title: 'Respond to supplier payment inquiry',
      description: 'Vendor requests status for INV-55210.',
      category: 'Input Needed',
      inboxLabel: 'AP Payments',
      createdAt: Date.now(),
    },
    {
      id: crypto.randomUUID(),
      title: 'Tax form follow-up required',
      description: 'W-9 status missing for supplier SUP-1182.',
      category: 'Confirmation',
      inboxLabel: 'AP Invoices',
      createdAt: Date.now() - 3600 * 1000,
    },
  ],
});

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      ...baseState(),
      setCompany: (company) => set({ company }),
      setInboxes: (inboxes) => set({ inboxes }),
      updateInbox: (inboxId, updater) =>
        set({
          inboxes: get().inboxes.map((inbox) => (inbox.id === inboxId ? updater(inbox) : inbox)),
        }),
      addInbox: () =>
        set({
          inboxes: [...get().inboxes, createBlankInbox(get().inboxes.length + 1)],
        }),
      removeInbox: (inboxId) =>
        set({ inboxes: get().inboxes.filter((inbox) => inbox.id !== inboxId) }),
      setAgentEnabled: (agentId, enabled) =>
        set({
          agents: get().agents.map((agent) => (agent.id === agentId ? { ...agent, enabled } : agent)),
        }),
      setUploadedData: (uploadedData) => set({ uploadedData }),
      upsertUploadedDomain: (domain) => {
        const current = get().uploadedData;
        const next = current.some((item) => item.domainId === domain.domainId)
          ? current.map((item) => (item.domainId === domain.domainId ? domain : item))
          : [...current, domain];
        set({ uploadedData: next });
      },
      setCurrentStep: (step) => set({ currentStep: step }),
      nextStep: () => set({ currentStep: Math.min(6, get().currentStep + 1) }),
      prevStep: () => set({ currentStep: Math.max(1, get().currentStep - 1) }),
      activate: () => set({ activatedAt: Date.now() }),
      addInboxTask: (task) =>
        set({
          inboxTasks: [
            {
              ...task,
              id: crypto.randomUUID(),
              createdAt: Date.now(),
            },
            ...get().inboxTasks,
          ],
        }),
      seedDemo: () => set({ ...demoSeed() }),
      resetAll: () => set({ ...baseState() }),
    }),
    {
      name: ONBOARDING_STORAGE_KEY,
      version: 1,
    }
  )
);
