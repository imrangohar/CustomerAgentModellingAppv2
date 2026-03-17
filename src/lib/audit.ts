import { AnswerRecord, SourceRef } from '@/types/policyOnboarding';

export function withAnswerChange(
  current: AnswerRecord | undefined,
  nextValue: unknown,
  changedBy: { name: string; email: string; persona?: string },
  reason: string,
  status: AnswerRecord['status'],
  sources: SourceRef[]
): AnswerRecord {
  const now = Date.now();
  return {
    policyKey: current?.policyKey || '',
    value: nextValue,
    status,
    confidence: current?.confidence,
    sources: sources.length ? sources : current?.sources || [],
    lastUpdatedAt: now,
    lastUpdatedBy: changedBy,
    history: [
      ...(current?.history || []),
      {
        timestamp: now,
        changedBy: { name: changedBy.name, email: changedBy.email },
        fromValue: current?.value,
        toValue: nextValue,
        reason,
        sources,
      },
    ],
  };
}
