'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createToken } from '@/lib/collaboration';
import { computeLayerStatuses } from '@/lib/layerStatus';
import { applyScopeRules, defaultScopeProfile } from '@/lib/scopeRules';
import {
  AnswerRecord,
  Assignment,
  LayerStatus,
  ReferenceData,
  ScopeProfile,
  SopVersion,
  SourceRef,
} from '@/types/policyOnboarding';

interface UploadMeta {
  filename: string;
  fileType: string;
  uploadedAt: number;
}

interface OnboardingStore {
  scopeProfile: ScopeProfile;
  currentStep: number;
  answers: Record<string, AnswerRecord>;
  assignments: Assignment[];
  referenceData: ReferenceData;
  uploads: UploadMeta[];
  sopVersions: SopVersion[];
  setCurrentStep: (step: number) => void;
  setScopeProfile: (partial: Partial<ScopeProfile>) => void;
  recalculateScope: () => void;
  upsertAnswer: (
    policyKey: string,
    value: unknown,
    status: AnswerRecord['status'],
    source?: SourceRef,
    confidence?: number
  ) => void;
  bulkUpsertPrefilled: (records: Record<string, AnswerRecord>) => void;
  confirmAnswer: (policyKey: string) => void;
  assignQuestion: (payload: {
    policyKey: string;
    assignee: { name: string; email: string; persona: string };
    message: string;
    dueDate?: number;
    createdBy: { name: string; email: string };
  }) => Assignment;
  markAssignmentViewed: (id: string) => void;
  respondAssignment: (
    id: string,
    token: string,
    response: { value: unknown; comment?: string; attachments?: { filename: string; mime: string; base64: string }[]; email: string }
  ) => { ok: boolean; error?: string };
  acceptAssignment: (id: string, acceptedBy: { name: string; email: string }) => void;
  rejectAssignment: (id: string, rejectedBy: { name: string; email: string }, reason?: string) => void;
  setReferenceData: (data: Partial<ReferenceData>) => void;
  addUploadMeta: (meta: UploadMeta) => void;
  saveSopVersion: (title: string, content: string) => void;
  exportPackage: () => Record<string, unknown>;
  resetAll: () => void;
  getLayerStatuses: () => LayerStatus[];
}

const emptyRefData: ReferenceData = {
  coa: null,
  costCenters: null,
};

const initialScope = applyScopeRules(defaultScopeProfile());

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      scopeProfile: initialScope,
      currentStep: 0,
      answers: {},
      assignments: [],
      referenceData: emptyRefData,
      uploads: [],
      sopVersions: [],

      setCurrentStep: (step) => set({ currentStep: step }),

      setScopeProfile: (partial) =>
        set((state) => ({
          scopeProfile: applyScopeRules({ ...state.scopeProfile, ...partial }),
        })),

      recalculateScope: () =>
        set((state) => ({
          scopeProfile: applyScopeRules(state.scopeProfile),
        })),

      upsertAnswer: (policyKey, value, status, source, confidence) =>
        set((state) => {
          const prev = state.answers[policyKey];
          return {
            answers: {
              ...state.answers,
              [policyKey]: {
                policyKey,
                value,
                status,
                confidence: confidence ?? prev?.confidence,
                sources: source ? [source, ...(prev?.sources || [])] : prev?.sources || [{ type: 'manual' }],
                lastUpdatedAt: Date.now(),
                lastUpdatedBy: { name: 'Controller', email: 'controller@appzen.example' },
                history: [
                  ...(prev?.history || []),
                  {
                    timestamp: Date.now(),
                    changedBy: { name: 'Controller', email: 'controller@appzen.example' },
                    fromValue: prev?.value,
                    toValue: value,
                    reason: status === 'confirmed' ? 'Confirmed' : 'Updated',
                    sources: source ? [source] : [{ type: 'manual' }],
                  },
                ],
              },
            },
          };
        }),

      bulkUpsertPrefilled: (records) =>
        set((state) => {
          const merged = { ...state.answers };
          Object.entries(records).forEach(([policyKey, record]) => {
            const prev = merged[policyKey];
            merged[policyKey] = {
              ...record,
              policyKey,
              history: [...(prev?.history || []), ...(record.history || [])],
            };
          });
          return { answers: merged };
        }),

      confirmAnswer: (policyKey) =>
        set((state) => {
          const prev = state.answers[policyKey];
          if (!prev) return state;
          return {
            answers: {
              ...state.answers,
              [policyKey]: {
                ...prev,
                status: 'confirmed',
                lastUpdatedAt: Date.now(),
                history: [
                  ...prev.history,
                  {
                    timestamp: Date.now(),
                    changedBy: { name: 'Controller', email: 'controller@appzen.example' },
                    fromValue: prev.value,
                    toValue: prev.value,
                    reason: 'Accepted prefilled/response',
                    sources: prev.sources,
                  },
                ],
              },
            },
          };
        }),

      assignQuestion: ({ policyKey, assignee, message, dueDate, createdBy }) => {
        const assignment: Assignment = {
          id: `asg_${Date.now()}`,
          policyKey,
          assignee,
          message,
          dueDate,
          status: 'sent',
          createdAt: Date.now(),
          createdBy,
          auditTrail: [{ timestamp: Date.now(), event: 'assignment_created' }],
          token: createToken(),
        };

        set((state) => ({
          assignments: [assignment, ...state.assignments],
          answers: {
            ...state.answers,
            [policyKey]: {
              ...(state.answers[policyKey] || {
                policyKey,
                value: '',
                confidence: undefined,
                sources: [{ type: 'manual', note: 'Assigned for response' }],
                history: [],
              }),
              status: 'assigned',
              lastUpdatedAt: Date.now(),
            },
          },
        }));
        return assignment;
      },

      markAssignmentViewed: (id) =>
        set((state) => ({
          assignments: state.assignments.map((a) =>
            a.id === id
              ? {
                  ...a,
                  status: a.status === 'sent' ? 'viewed' : a.status,
                  auditTrail: [...a.auditTrail, { timestamp: Date.now(), event: 'assignment_viewed' }],
                }
              : a
          ),
        })),

      respondAssignment: (id, token, response) => {
        const assignment = get().assignments.find((a) => a.id === id);
        if (!assignment) return { ok: false, error: 'Assignment not found' };
        if (assignment.token !== token) return { ok: false, error: 'Invalid token' };

        set((state) => ({
          assignments: state.assignments.map((a) =>
            a.id === id
              ? {
                  ...a,
                  status: 'responded',
                  response: {
                    value: response.value,
                    comment: response.comment,
                    attachments: response.attachments,
                    receivedAt: Date.now(),
                    receivedFromEmail: response.email,
                  },
                  auditTrail: [...a.auditTrail, { timestamp: Date.now(), event: 'assignment_responded' }],
                }
              : a
          ),
          answers: {
            ...state.answers,
            [assignment.policyKey]: {
              ...(state.answers[assignment.policyKey] || {
                policyKey: assignment.policyKey,
                value: '',
                sources: [],
                history: [],
              }),
              value: response.value,
              status: 'responded',
              sources: [
                {
                  type: 'collaboration',
                  assignmentId: id,
                  responderEmail: response.email,
                  receivedAt: Date.now(),
                  bodySnippet: String(response.comment || response.value).slice(0, 160),
                },
                ...(state.answers[assignment.policyKey]?.sources || []),
              ],
              lastUpdatedAt: Date.now(),
            },
          },
        }));

        return { ok: true };
      },

      acceptAssignment: (id, acceptedBy) =>
        set((state) => {
          const assignment = state.assignments.find((a) => a.id === id);
          if (!assignment?.response) return state;
          return {
            assignments: state.assignments.map((a) =>
              a.id === id
                ? {
                    ...a,
                    status: 'accepted',
                    auditTrail: [...a.auditTrail, { timestamp: Date.now(), event: 'assignment_accepted', detail: acceptedBy }],
                  }
                : a
            ),
            answers: {
              ...state.answers,
              [assignment.policyKey]: {
                ...(state.answers[assignment.policyKey] || {
                  policyKey: assignment.policyKey,
                  value: assignment.response.value,
                  sources: [],
                  history: [],
                }),
                value: assignment.response.value,
                status: 'confirmed',
                lastUpdatedAt: Date.now(),
                lastUpdatedBy: acceptedBy,
              },
            },
          };
        }),

      rejectAssignment: (id, rejectedBy, reason) =>
        set((state) => ({
          assignments: state.assignments.map((a) =>
            a.id === id
              ? {
                  ...a,
                  status: 'sent',
                  auditTrail: [...a.auditTrail, { timestamp: Date.now(), event: 'assignment_rejected', detail: { rejectedBy, reason } }],
                }
              : a
          ),
        })),

      setReferenceData: (data) => set((state) => ({ referenceData: { ...state.referenceData, ...data } })),

      addUploadMeta: (meta) => set((state) => ({ uploads: [meta, ...state.uploads] })),

      saveSopVersion: (title, content) =>
        set((state) => ({
          sopVersions: [
            {
              id: `sop_${Date.now()}`,
              version: (state.sopVersions[0]?.version || 0) + 1,
              createdAt: Date.now(),
              title,
              content,
            },
            ...state.sopVersions,
          ],
        })),

      exportPackage: () => {
        const state = get();
        return {
          scopeProfile: state.scopeProfile,
          answers: state.answers,
          assignments: state.assignments,
          referenceData: {
            coa: state.referenceData.coa
              ? {
                  sourceFile: state.referenceData.coa.sourceFile,
                  importedAt: state.referenceData.coa.importedAt,
                  count: state.referenceData.coa.accounts.length,
                }
              : null,
            costCenters: state.referenceData.costCenters
              ? {
                  sourceFile: state.referenceData.costCenters.sourceFile,
                  importedAt: state.referenceData.costCenters.importedAt,
                  count: state.referenceData.costCenters.items.length,
                }
              : null,
          },
          layerStatuses: computeLayerStatuses(state.scopeProfile, state.answers),
          exportedAt: Date.now(),
        };
      },

      resetAll: () =>
        set({
          scopeProfile: applyScopeRules(defaultScopeProfile()),
          currentStep: 0,
          answers: {},
          assignments: [],
          referenceData: emptyRefData,
          uploads: [],
          sopVersions: [],
        }),

      getLayerStatuses: () => {
        const state = get();
        return computeLayerStatuses(state.scopeProfile, state.answers);
      },
    }),
    {
      name: 'policy-driven-ap-onboarding',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        scopeProfile: state.scopeProfile,
        currentStep: state.currentStep,
        answers: state.answers,
        assignments: state.assignments,
        referenceData: state.referenceData,
        uploads: state.uploads,
        sopVersions: state.sopVersions,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.scopeProfile = applyScopeRules(state.scopeProfile);
      },
    }
  )
);
