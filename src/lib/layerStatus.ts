import { questionCatalog } from '@/lib/questionCatalog';
import { AnswerRecord, LayerStatus, ScopeProfile } from '@/types/policyOnboarding';

export function computeLayerStatuses(
  scope: ScopeProfile,
  answers: Record<string, AnswerRecord>
): LayerStatus[] {
  return [1, 2, 3, 4, 5, 6, 7].map((layer) => {
    const layerQuestions = questionCatalog.filter((q) => q.layer === layer && scope.questionRules[q.policyKey]?.visible);
    const requiredQuestions = layerQuestions.filter((q) => scope.questionRules[q.policyKey]?.required);

    let requiredConfirmed = 0;
    let needsConfirmationCount = 0;
    let assignedCount = 0;
    let respondedNotAcceptedCount = 0;

    for (const q of requiredQuestions) {
      const answer = answers[q.policyKey];
      if (!answer) continue;
      if (answer.status === 'confirmed') requiredConfirmed += 1;
      if (answer.status === 'prefilled_needs_confirmation') needsConfirmationCount += 1;
      if (answer.status === 'assigned') assignedCount += 1;
      if (answer.status === 'responded') respondedNotAcceptedCount += 1;
    }

    const requiredTotal = requiredQuestions.length;

    let status: LayerStatus['status'] = 'Pending';
    const hasWork = requiredConfirmed + needsConfirmationCount + assignedCount + respondedNotAcceptedCount > 0;
    if (requiredTotal > 0 && requiredConfirmed === requiredTotal) {
      status = 'Complete';
    } else if (hasWork) {
      status = 'Partial';
    }

    return {
      layer: layer as LayerStatus['layer'],
      status,
      requiredTotal,
      requiredConfirmed,
      needsConfirmationCount,
      assignedCount,
      respondedNotAcceptedCount,
    };
  });
}
