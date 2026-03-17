import { questionCatalog } from '@/lib/questionCatalog';
import { ScopeProfile } from '@/types/policyOnboarding';

const VAT_COUNTRIES = new Set(['Germany', 'UK', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Iceland']);

export function defaultScopeProfile(): ScopeProfile {
  return {
    companyName: 'Acme Manufacturing',
    rolloutTrack: 'Standard',
    phased: true,
    phase1Countries: ['US'],
    phase2Countries: ['Germany'],
    entityCountBand: '2-5',
    policyStandardization: 'global_overrides',
    apTeamSizeBand: '6-20',
    invoiceVolumeBand: '1-10k',
    erpPrimary: 'SAP',
    procurementPlatform: 'same',
    poUsageBand: '25-75',
    poMatchTypes: ['2-way', '3-way'],
    receiptsDiscipline: 'mixed',
    vertical: 'manufacturing',
    approvalsModel: 'mixed',
    doaExists: 'partial',
    complianceModules: {
      vat: false,
      nordicsB2G: false,
      indiaGst: false,
      ukFutureEInvoice: false,
    },
    layersEnabled: { l1: true, l2: true, l3: true, l4: true, l5: true, l6: true, l7: true },
    questionRules: {},
  };
}

export function applyScopeRules(scope: ScopeProfile): ScopeProfile {
  const phase1 = new Set(scope.phase1Countries);
  const complianceModules = {
    vat: scope.phase1Countries.some((c) => VAT_COUNTRIES.has(c)),
    nordicsB2G: scope.phase1Countries.some((c) => ['Sweden', 'Norway', 'Denmark', 'Finland', 'Iceland'].includes(c)),
    indiaGst: phase1.has('India'),
    ukFutureEInvoice: phase1.has('UK'),
  };

  const layersEnabled = {
    l1: true,
    l2: scope.poUsageBand !== 'none',
    l3: true,
    l4: true,
    l5: true,
    l6: true,
    l7: true,
  } as const;

  const mode: 'light' | 'standard' | 'enterprise' =
    scope.rolloutTrack === 'Enterprise' || scope.apTeamSizeBand === '100+'
      ? 'enterprise'
      : scope.rolloutTrack === 'Simple' && scope.apTeamSizeBand === '1-5'
        ? 'light'
        : 'standard';

  const questionRules: ScopeProfile['questionRules'] = {};

  for (const question of questionCatalog) {
    let visible = true;
    let required = question.requiredDefault;

    if (question.policyKey.startsWith('l2.') && !layersEnabled.l2) {
      visible = false;
      required = false;
    }

    if (question.policyKey.startsWith('sap.') && scope.erpPrimary !== 'SAP') {
      visible = false;
      required = false;
    }

    const erpTag = question.tags?.find((tag) => tag.startsWith('ERP:'));
    if (erpTag) {
      const selected = scope.erpPrimary;
      const expected = erpTag.replace('ERP:', '');
      if (selected !== expected) {
        visible = false;
        required = false;
      }
    }

    if (question.tags?.includes('VAT') && !complianceModules.vat) {
      visible = false;
      required = false;
    }

    if (question.tags?.includes('GST') && !complianceModules.indiaGst) {
      visible = false;
      required = false;
    }

    if (mode === 'light' && question.answerType === 'table' && !question.requiredDefault) {
      required = false;
    }

    if (
      ['manufacturing', 'distribution'].includes(scope.vertical) &&
      scope.poMatchTypes.includes('3-way') &&
      ['l2.receipts.requiredForPayment', 'l2.freight.treatment'].includes(question.policyKey)
    ) {
      required = true;
      visible = true;
    }

    if (scope.doaExists === 'yes' && ['l5.approvals.doa.upload', 'l5.approvals.doa.matrix'].includes(question.policyKey)) {
      required = true;
    }

    if (scope.doaExists === 'no' && question.policyKey === 'l5.approvals.doa.matrix') {
      required = false;
    }

    questionRules[question.policyKey] = { visible, required, mode };
  }

  return {
    ...scope,
    complianceModules,
    layersEnabled,
    questionRules,
  };
}

export function enabledQuestionKeys(scope: ScopeProfile): Set<string> {
  const keys = new Set<string>();
  for (const [policyKey, rule] of Object.entries(scope.questionRules)) {
    if (rule.visible) keys.add(policyKey);
  }
  return keys;
}
