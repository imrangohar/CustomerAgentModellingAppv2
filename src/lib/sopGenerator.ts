import { layerLabels, questionCatalog } from '@/lib/questionCatalog';
import { computeLayerStatuses } from '@/lib/layerStatus';
import { AnswerRecord, ScopeProfile } from '@/types/policyOnboarding';

function formatAnswer(answer?: AnswerRecord): string {
  if (!answer || answer.status === 'unanswered') return 'TBD (Owner persona, status Pending)';
  if (answer.status === 'responded') return 'Awaiting confirmation';
  if (answer.value === '' || answer.value === null || answer.value === undefined) return 'TBD (Owner persona, status Pending)';
  if (Array.isArray(answer.value)) return answer.value.join(', ');
  if (typeof answer.value === 'object') return JSON.stringify(answer.value);
  return String(answer.value);
}

export function generateSopText(scope: ScopeProfile, answers: Record<string, AnswerRecord>): string {
  const layerStatuses = computeLayerStatuses(scope, answers);
  const lines: string[] = [];

  lines.push(`# Policy-Driven Autonomous AP SOP`);
  lines.push(`Company: ${scope.companyName}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Phase 1 Countries: ${scope.phase1Countries.join(', ') || 'None'}`);
  lines.push(`Phase 2 Countries: ${scope.phase2Countries.join(', ') || 'None'}`);
  lines.push('');

  for (const layer of [1, 2, 3, 4, 5, 6, 7] as const) {
    if (!scope.layersEnabled[`l${layer}` as keyof ScopeProfile['layersEnabled']]) continue;
    const layerQuestions = questionCatalog.filter((q) => q.layer === layer && scope.questionRules[q.policyKey]?.visible);
    const layerStatus = layerStatuses.find((l) => l.layer === layer);
    lines.push(`## ${layerLabels[layer]} [${layerStatus?.status || 'Pending'}]`);

    const sections = new Map<string, typeof layerQuestions>();
    for (const q of layerQuestions) {
      const key = q.section || 'General';
      sections.set(key, [...(sections.get(key) || []), q]);
    }

    for (const [section, questions] of sections.entries()) {
      lines.push(`### ${section}`);
      for (const q of questions) {
        lines.push(`- ${q.title}: ${formatAnswer(answers[q.policyKey])}`);
      }
    }
    lines.push('');
  }

  lines.push('## Annexes');
  if (scope.complianceModules.vat) lines.push('- EU VAT Annex: Enabled');
  if (scope.complianceModules.indiaGst) lines.push('- India GST Annex: Enabled');
  if (scope.complianceModules.nordicsB2G) lines.push('- Nordics B2G e-invoice Annex: Enabled');
  if (scope.complianceModules.ukFutureEInvoice) lines.push('- UK Future e-invoice Annex: Enabled');
  if (scope.erpPrimary === 'SAP') lines.push('- SAP Annex: GR-based IV, SES, delivery costs, WHT, baseline date, ERS, ArchiveLink/SAP Connect');

  return lines.join('\n');
}
