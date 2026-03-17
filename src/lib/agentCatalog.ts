import type { AgentDefinition } from '@/lib/catalogTypes';
import { generatedAgentCatalog } from '@/lib/agentCatalog.generated';

const agentOverrides: Partial<Record<string, Partial<AgentDefinition>>> = {
  payment_status_inquiry: {
    description:
      'Automatically identifies vendor “where is my payment?” emails, extracts the invoice number/vendor, looks up payment status in the ERP/payment system, and drafts a personalized reply with the current status and expected payment timing. It also logs the inquiry for tracking and follow-up.',
    defaultInstructions:
      'Classify payment-status inquiry emails, extract vendor and invoice identifiers, look up payment status and expected timing in available ERP/payment data, and draft a concise professional vendor-safe response. Do not reveal internal-only details. If required identifiers are missing, request only the minimum missing information or route to AP.',
    inputs: ['Vendor email thread', 'Supplier identifier', 'Invoice number', 'Payment records'],
    outputs: ['Draft vendor reply with payment status/ETA', 'Inquiry tracking note', 'Escalation task when data is missing'],
  },
  duplicate_invoice_detection: {
    description:
      'Flags duplicate invoices at ingestion by comparing the incoming invoice (invoice #, vendor, amount, dates, and other identifiers) against invoice history and submissions across channels/threads. It prevents double-payment risk by alerting AP (and optionally notifying the vendor) immediately when a duplicate is detected.',
    defaultInstructions:
      'Classify incoming invoice submissions, extract invoice/vendor/amount/date entities, compare against historical invoice records across channels, and flag likely duplicates with rationale and confidence. Generate AP alert and optional vendor-safe notification. Avoid exposing internal fraud scoring details. If match confidence is ambiguous, route to AP review.',
    inputs: ['Incoming invoice metadata', 'Invoice history', 'Supplier master', 'Submission channel/thread context'],
    outputs: ['Duplicate detection alert', 'Confidence + matching evidence summary', 'Optional vendor-safe duplicate notice'],
  },
  tax_form_w9_compliance: {
    description:
      'Detects W-9 submissions, extracts key supplier tax/vendor setup details, acknowledges receipt, checks the form for completeness, and routes it to the appropriate team (procurement/vendor management) for onboarding and compliance. It tracks W-9 processing status so AP can respond confidently to vendors.',
    defaultInstructions:
      'Classify tax-form emails, extract supplier setup and W-9 entities, validate completeness against required fields, acknowledge receipt to vendor in professional language, and route to procurement/vendor management for compliance processing. Track status for AP visibility. Never expose sensitive tax data in outbound responses beyond required confirmation.',
    inputs: ['W-9 email/attachment', 'Supplier master data', 'Tax document status data'],
    outputs: ['Acknowledgement draft', 'Completeness result', 'Routing task to compliance/onboarding', 'Status update for AP'],
  },
  vendor_statement_reconciliation: {
    description:
      'Recognizes monthly vendor statements, parses statement attachments, and reconciles every listed invoice against ERP records (paid/unpaid/in-process/short-pay/credit-applied). It highlights discrepancies (missing credits, mismatched invoice status) and drafts a complete response back to the vendor with invoice-by-invoice payment status.',
    defaultInstructions:
      'Classify vendor statement emails, parse statement line items, reconcile each invoice against ERP status/payment/credit data, and produce discrepancy findings. Draft a complete vendor response with invoice-by-invoice status in clear business language. Do not include confidential internal comments. If reconciliation data is incomplete, request minimum missing references or route to AP.',
    inputs: ['Vendor statement attachment', 'Invoice status records', 'Payment linking', 'Credits data'],
    outputs: ['Reconciliation summary', 'Discrepancy list', 'Vendor-ready invoice-by-invoice response draft'],
  },
  bank_account_change_request: {
    description:
      'Detects requests to update supplier banking details, extracts the new bank information, and triggers verification protocols (vendor master validation + risk checks) before any update is made. It routes high-risk requests to the vendor management team and clearly marks “verification required” to reduce BEC/wire-fraud exposure.',
    defaultInstructions:
      'Classify bank-change requests, extract proposed banking details and supplier identity entities, run vendor master/risk verification checks, and mark verification-required state before any update. Route high-risk cases to vendor management. Keep vendor communication clear and policy-safe; do not disclose internal fraud controls. If required verification data is missing, request only minimum needed details.',
    inputs: ['Bank-change request email', 'Supplier contacts', 'Supplier banking baseline', 'Risk/compliance signals'],
    outputs: ['Verification-required decision', 'Risk routing action', 'Vendor-safe response draft'],
  },
  no_po_no_pay_policy: {
    description:
      'Identifies invoices missing a valid PO in environments enforcing “No PO, No Pay.” It checks the invoice for a PO number / match, and when absent it automatically routes to the correct approval workflow or rejects the invoice back to the supplier with clear instructions on providing a PO—reducing bottlenecks and payment delays.',
    defaultInstructions:
      'Classify invoice submissions for No-PO policy, extract PO and invoice identifiers, validate PO presence/match against policy data, and either route to approval workflow or generate a clear supplier-facing rejection/request-for-PO response. Keep language concise and policy-compliant. If PO validation inputs are missing, escalate to AP with captured context.',
    inputs: ['Invoice metadata', 'PO records', 'Goods receipt/policy data'],
    outputs: ['Policy decision (pass/reroute/reject)', 'Workflow routing action', 'Supplier instruction response draft'],
  },
  invoice_hold_reason_explainer: {
    description:
      'Handles “why is my invoice on hold?” follow-ups by extracting the invoice number, retrieving the hold reason from the ERP, translating internal hold codes into a vendor-friendly explanation, and providing actionable next steps (e.g., receipt pending / 3-way match issue) plus expected resolution timing to reduce repeated vendor chasing.',
    defaultInstructions:
      'Classify invoice-hold follow-ups, extract invoice identifiers, retrieve hold reason/status from ERP, translate internal codes into vendor-friendly explanation, and include actionable next steps and expected timing where available. Do not expose internal-only workflow notes. If hold context is incomplete, request minimal missing reference or route to AP queue.',
    inputs: ['Vendor hold inquiry email', 'Invoice exceptions/hold codes', 'Invoice and approval status data'],
    outputs: ['Vendor-friendly hold explanation', 'Next-step guidance', 'ETA-oriented response draft'],
  },
  remittance_proof_of_payment: {
    description:
      'Responds to remittance/proof-of-payment requests by locating the payment record, mapping the payment to the invoices it covered, and generating remittance advice that reconciles the vendor’s open invoices with the payment. It can attach or reference supporting proof (ACH/check details) so vendors can close out their receivables quickly.',
    defaultInstructions:
      'Classify remittance/proof-of-payment requests, extract vendor/payment/invoice references, locate payment record and mapped invoices, and generate reconciled remittance advice with supporting proof references where allowed. Keep responses concise and professional, and avoid disclosing sensitive internal banking details beyond approved fields. If key references are missing, request minimal missing information or route to AP.',
    inputs: ['Remittance request email', 'Payment records', 'Payment-to-invoice links', 'Proof-of-payment references'],
    outputs: ['Remittance advice draft', 'Invoice coverage reconciliation', 'Proof-of-payment reference/attachment list'],
  },
};

export const agentCatalog: AgentDefinition[] = generatedAgentCatalog.map((agent) => {
  const override = agentOverrides[agent.key];
  return {
    ...agent,
    ...override,
    dependsOnDomains: override?.dependsOnDomains ?? agent.dependsOnDomains,
    dependsOnFields: override?.dependsOnFields ?? agent.dependsOnFields,
  };
});

export type { AgentDefinition } from '@/lib/catalogTypes';
