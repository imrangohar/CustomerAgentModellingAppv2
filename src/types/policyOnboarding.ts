export type LayerNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Persona =
  | 'Controller'
  | 'AP Ops'
  | 'Procurement'
  | 'Treasury'
  | 'Tax'
  | 'IT/Finance Systems'
  | 'Receiving';

export type AnswerType =
  | 'text'
  | 'number'
  | 'currency'
  | 'percent'
  | 'date'
  | 'singleSelect'
  | 'multiSelect'
  | 'table'
  | 'upload'
  | 'accountPicker'
  | 'costCenterPicker';

export interface Question {
  policyKey: string;
  layer: LayerNumber;
  title: string;
  helpText?: string;
  ownerPersona: Persona;
  requiredDefault: boolean;
  answerType: AnswerType;
  options?: { label: string; value: string }[];
  mappingOutputPath: string;
  defaultValue?: unknown;
  dependsOn?: string[];
  tags?: string[];
  section?: string;
}

export type SourceRef =
  | { type: 'sop_csv'; filename: string; rowId: string }
  | { type: 'document_extract'; filename: string; page?: number; snippet: string }
  | { type: 'manual'; note?: string }
  | {
      type: 'collaboration';
      assignmentId: string;
      responderEmail: string;
      receivedAt: number;
      bodySnippet: string;
    };

export interface ChangeEvent {
  timestamp: number;
  changedBy: { name: string; email: string };
  fromValue: unknown;
  toValue: unknown;
  reason?: string;
  sources: SourceRef[];
}

export interface AnswerRecord {
  policyKey: string;
  value: unknown;
  status: 'unanswered' | 'prefilled_needs_confirmation' | 'assigned' | 'responded' | 'confirmed';
  confidence?: number;
  sources: SourceRef[];
  lastUpdatedAt: number;
  lastUpdatedBy?: { name: string; email: string; persona?: string };
  history: ChangeEvent[];
}

export interface AttachmentRef {
  filename: string;
  mime: string;
  base64: string;
}

export interface Assignment {
  id: string;
  policyKey: string;
  assignee: { name: string; email: string; persona: string };
  message: string;
  dueDate?: number;
  status: 'draft' | 'sent' | 'viewed' | 'responded' | 'accepted' | 'rejected';
  createdAt: number;
  createdBy: { name: string; email: string };
  response?: {
    value: unknown;
    comment?: string;
    attachments?: AttachmentRef[];
    receivedAt: number;
    receivedFromEmail: string;
  };
  auditTrail: { timestamp: number; event: string; detail?: unknown }[];
  token: string;
}

export interface ReferenceData {
  coa: {
    accounts: { code: string; name: string; type: string; active: boolean; parentCode?: string }[];
    sourceFile: string;
    importedAt: number;
  } | null;
  costCenters: {
    items: {
      id: string;
      name: string;
      active: boolean;
      ownerEmail?: string;
      ownerName?: string;
      entity?: string;
    }[];
    sourceFile: string;
    importedAt: number;
  } | null;
}

export interface ScopeProfile {
  companyName: string;
  rolloutTrack: 'Simple' | 'Standard' | 'Enterprise';
  phased: boolean;
  phase1Countries: string[];
  phase2Countries: string[];
  entityCountBand: '1' | '2-5' | '6-20' | '21+';
  policyStandardization: 'global' | 'global_overrides' | 'per_entity';
  apTeamSizeBand: '1-5' | '6-20' | '21-50' | '51-100' | '100+';
  invoiceVolumeBand: '<1k' | '1-10k' | '10-50k' | '50k+';
  erpPrimary: 'SAP' | 'OracleEBS' | 'OracleFusion' | 'NetSuite' | 'Coupa' | 'Workday';
  procurementPlatform: 'same' | 'coupa_ariba_other' | 'none';
  poUsageBand: 'none' | '<25' | '25-75' | '>75';
  poMatchTypes: string[];
  receiptsDiscipline: 'strong' | 'mixed' | 'weak';
  vertical: 'manufacturing' | 'distribution' | 'services' | 'saas' | 'finserv' | 'other';
  approvalsModel: 'costCenterOwner' | 'managerChain' | 'roleGroups' | 'mixed';
  doaExists: 'yes' | 'partial' | 'no';
  complianceModules: {
    vat: boolean;
    nordicsB2G: boolean;
    indiaGst: boolean;
    ukFutureEInvoice: boolean;
  };
  layersEnabled: { l1: true; l2: boolean; l3: true; l4: true; l5: true; l6: true; l7: true };
  questionRules: Record<
    string,
    {
      visible: boolean;
      required: boolean;
      mode?: 'light' | 'standard' | 'enterprise';
    }
  >;
}

export interface LayerStatus {
  layer: LayerNumber;
  status: 'Pending' | 'Partial' | 'Complete';
  requiredTotal: number;
  requiredConfirmed: number;
  needsConfirmationCount: number;
  assignedCount: number;
  respondedNotAcceptedCount: number;
}

export interface SopVersion {
  id: string;
  version: number;
  createdAt: number;
  title: string;
  content: string;
}
