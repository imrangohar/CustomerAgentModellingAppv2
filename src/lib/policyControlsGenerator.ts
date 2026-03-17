import { layerLabels, questionCatalog } from '@/lib/questionCatalog';
import { AnswerRecord, ScopeProfile } from '@/types/policyOnboarding';

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not configured';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatStatus(answer?: AnswerRecord): string {
  if (!answer) return 'Pending';
  if (answer.status === 'confirmed') return 'Confirmed';
  if (answer.status === 'prefilled_needs_confirmation') return 'Needs confirmation';
  if (answer.status === 'responded') return 'Responded (awaiting acceptance)';
  if (answer.status === 'assigned') return 'Assigned';
  return 'Pending';
}

export function generatePolicyControlsText(scope: ScopeProfile, answers: Record<string, AnswerRecord>): string {
  const lines: string[] = [];

  lines.push('Policy and Controls - AP Processing');
  lines.push(`Company: ${scope.companyName}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`ERP/P2P System: ${scope.erpPrimary}`);
  lines.push('');

  const activeLayers = [1, 2, 3, 4, 5, 7] as const;

  for (const layer of activeLayers) {
    if (!scope.layersEnabled[`l${layer}` as keyof ScopeProfile['layersEnabled']]) continue;

    const layerQuestions = questionCatalog
      .filter((q) => q.layer === layer)
      .filter((q) => scope.questionRules[q.policyKey]?.visible)
      .sort((a, b) => (qRequired(scope, b.policyKey) ? 1 : 0) - (qRequired(scope, a.policyKey) ? 1 : 0));

    if (layerQuestions.length === 0) continue;

    lines.push(`## ${layerLabels[layer]}`);

    const sections = new Map<string, typeof layerQuestions>();
    for (const q of layerQuestions) {
      const section = q.section || 'General';
      sections.set(section, [...(sections.get(section) || []), q]);
    }

    for (const [section, questions] of sections.entries()) {
      lines.push(`### ${section}`);
      for (const q of questions) {
        const answer = answers[q.policyKey];
        lines.push(`- Control: ${q.title}`);
        lines.push(`  Status: ${formatStatus(answer)}`);
        lines.push(`  Policy: ${formatValue(answer?.value)}`);
      }
      lines.push('');
    }
  }

  lines.push('End of Document');
  return lines.join('\n');
}

function qRequired(scope: ScopeProfile, policyKey: string): boolean {
  return Boolean(scope.questionRules[policyKey]?.required);
}
