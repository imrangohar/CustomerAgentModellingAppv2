export type AgentId =
  | 'payment_status_inquiry'
  | 'duplicate_invoice_detection'
  | 'tax_form_w9_compliance'
  | 'vendor_statement_reconciliation'
  | 'bank_account_change_request'
  | 'no_po_no_pay_policy'
  | 'invoice_hold_reason_explainer'
  | 'remittance_proof_of_payment';

export type ReadinessStatus = 'ready' | 'degraded' | 'blocked';

export type FieldLevel = 'mandatory' | 'recommended' | 'optional';

export interface CompanyDetails {
  legalName: string;
  domain: string;
  country: string;
  industry: string;
  subIndustry: string;
  erpSystem: 'SAP' | 'Oracle' | 'NetSuite' | 'D365' | 'CSV' | 'Other';
  multiEntity: boolean;
  timezone: string;
}

export interface InboxConnection {
  mode: 'live' | 'test';
  provider: 'Google Workspace' | 'Microsoft 365' | 'IMAP' | 'Other';
  oauthClientId: string;
  imapHost: string;
  imapPort: string;
  permissions: {
    readEmails: boolean;
    readAttachments: boolean;
    sendEmails: boolean;
  };
  forwardingAddress: string;
  forwardingEnabled: boolean;
  lastTestResult?: 'pass' | 'fail';
}

export interface InboxConfig {
  id: string;
  email: string;
  friendlyName: string;
  primaryUse:
    | 'invoices'
    | 'payment inquiries'
    | 'statements'
    | 'tax forms'
    | 'bank changes'
    | 'general ap'
    | 'other';
  primaryUseOther: string;
  notes: string;
  allowSendingReplies: boolean;
  replyFromAddress: string;
  allowedSenderDomains: string[];
  connection: InboxConnection;
}

export interface AgentConfig {
  id: AgentId;
  enabled: boolean;
}

export interface UploadedDomainData {
  domainId: string;
  fileName: string;
  headers: string[];
  recordCount: number;
  lastUploadAt: number;
}

export interface InboxTask {
  id: string;
  title: string;
  description: string;
  category: 'Input Needed' | 'Confirmation' | 'Submitted' | 'Payments';
  inboxLabel: string;
  createdAt: number;
}

export interface OnboardingState {
  currentStep: number;
  company: CompanyDetails;
  inboxes: InboxConfig[];
  agents: AgentConfig[];
  uploadedData: UploadedDomainData[];
  activatedAt?: number;
  inboxTasks: InboxTask[];
}
