import { LayerNumber, Question } from '@/types/policyOnboarding';

const yesNo = [
  { label: 'Yes', value: 'yes' },
  { label: 'No', value: 'no' },
];

const q = (layer: LayerNumber, policyKey: string, title: string, section: string, extra: Partial<Question> = {}): Question => ({
  layer,
  policyKey,
  title,
  section,
  ownerPersona: 'Controller',
  requiredDefault: true,
  answerType: 'text',
  mappingOutputPath: policyKey,
  ...extra,
});

export const questionCatalog: Question[] = [
  q(1, 'l1.intake.documentTypes', 'What document types should the intake system recognize and route?', 'Q1 Scope at Intake', {
    answerType: 'multiSelect',
    options: [
      { label: 'Supplier invoice (AP invoice)', value: 'supplier_invoice' },
      { label: 'Credit memo (vendor credit)', value: 'credit_memo' },
      { label: 'Debit memo (vendor debit)', value: 'debit_memo' },
      { label: 'Vendor statement', value: 'vendor_statement' },
      { label: 'Tax forms (W-9/W-8)', value: 'tax_forms' },
      { label: 'Bank account change request', value: 'bank_change_request' },
      { label: 'Remittance / proof-of-payment request', value: 'remittance_request' },
      { label: 'Payment status inquiry', value: 'payment_status_inquiry' },
      { label: 'Other', value: 'other' },
    ],
    defaultValue: [
      'supplier_invoice',
      'credit_memo',
      'debit_memo',
      'vendor_statement',
      'tax_forms',
      'bank_change_request',
      'remittance_request',
      'payment_status_inquiry',
      'other',
    ],
    ownerPersona: 'AP Ops',
  }),
  q(1, 'l1.intake.otherDocumentRule', 'For documents that are not invoices (or are ambiguous), what should happen by default?', 'Q1 Scope at Intake', {
    answerType: 'singleSelect',
    options: [
      { label: 'Hold in Needs Review queue', value: 'hold_needs_review' },
      { label: 'Auto-reject with guidance', value: 'auto_reject' },
      { label: 'Auto-route to specified queue', value: 'auto_route_queue' },
      { label: 'Ignore', value: 'ignore' },
    ],
    defaultValue: 'hold_needs_review',
    ownerPersona: 'AP Ops',
  }),
  q(1, 'l1.intake.supplierIdentityVerification', 'How do we verify supplier identity for invoices received by email?', 'Q2 Identity Validation', {
    answerType: 'singleSelect',
    options: [
      { label: 'Accept from any sender; validate later', value: 'accept_any_validate_later' },
      { label: 'Accept only known supplier domains/contacts', value: 'known_only' },
      { label: 'Accept but flag unknown domains for review', value: 'accept_flag_unknown' },
    ],
    defaultValue: 'accept_flag_unknown',
    ownerPersona: 'AP Ops',
  }),
  q(1, 'l1.intake.minimumRequiredFields', 'What are the minimum fields required for an invoice to proceed past intake?', 'Q2 Identity Validation', {
    answerType: 'multiSelect',
    options: [
      { label: 'Supplier (name or supplier ID)', value: 'supplier' },
      { label: 'Invoice number (or approved fallback reference)', value: 'invoice_reference' },
      { label: 'Invoice date', value: 'invoice_date' },
      { label: 'Invoice amount and currency', value: 'amount_currency' },
      { label: 'Bill-to legal entity', value: 'bill_to_entity' },
      { label: 'Remit-to / payment info', value: 'remit_to' },
      { label: 'PO number (if PO invoice)', value: 'po_number' },
      { label: 'Service period', value: 'service_period' },
      { label: 'Attachment (invoice image/PDF)', value: 'attachment' },
    ],
    defaultValue: [
      'supplier',
      'invoice_reference',
      'invoice_date',
      'amount_currency',
      'bill_to_entity',
      'attachment',
      'po_number',
    ],
    ownerPersona: 'AP Ops',
  }),
  q(1, 'l1.intake.invoiceUniquenessRule', 'How do we define unique invoice number for duplicate prevention?', 'Q3 Invoice Number Rules', {
    answerType: 'singleSelect',
    options: [
      { label: 'Unique per supplier + invoice number', value: 'supplier_invoice_number' },
      { label: 'Unique per supplier + number + invoice date', value: 'supplier_number_date' },
      { label: 'Global uniqueness across all suppliers', value: 'global' },
    ],
    defaultValue: 'supplier_invoice_number',
    ownerPersona: 'Controller',
  }),
  q(1, 'l1.intake.missingInvoiceNumberFallback', 'If invoice number is missing, what approved reference do we use?', 'Q3 Invoice Number Rules', {
    answerType: 'singleSelect',
    options: [
      { label: 'Supplier account number + invoice date + amount', value: 'supplier_account_date_amount' },
      { label: 'Statement/reference number from document', value: 'statement_reference' },
      { label: 'Create system-generated reference', value: 'system_generated_reference' },
      { label: 'Hold and request supplier to reissue', value: 'hold_request_reissue' },
    ],
    defaultValue: 'supplier_account_date_amount',
    ownerPersona: 'AP Ops',
  }),
  q(1, 'l1.intake.invoiceDatePolicy', 'Which date should be captured as the invoice document date?', 'Q4 Invoice Dates', {
    answerType: 'singleSelect',
    options: [
      { label: 'Supplier invoice date only', value: 'supplier_date_only' },
      { label: 'Received date only', value: 'received_date_only' },
      { label: 'Store both; supplier invoice date is primary', value: 'store_both_supplier_primary' },
    ],
    defaultValue: 'store_both_supplier_primary',
    ownerPersona: 'Controller',
  }),
  q(1, 'l1.intake.lateSubmissionPolicy', 'If supplier invoice date is earlier than received date, what should we do?', 'Q4 Invoice Dates', {
    answerType: 'singleSelect',
    options: [
      { label: 'Accept supplier date and use received date for SLA', value: 'accept_supplier_date' },
      { label: 'Override to received date', value: 'override_to_received' },
      { label: 'Hold for review when lag exceeds threshold', value: 'hold_if_lag_threshold' },
    ],
    defaultValue: 'accept_supplier_date',
    ownerPersona: 'Controller',
  }),
  q(1, 'l1.intake.lateInvoiceRule', 'When is an invoice considered late and requires special handling?', 'Q4 Invoice Dates', {
    answerType: 'singleSelect',
    options: [
      { label: 'Lag days threshold', value: 'lag_days_threshold' },
      { label: 'Late only matters at period end', value: 'period_end_only' },
      { label: 'Lag threshold OR received after close cutoff', value: 'lag_and_close_cutoff' },
    ],
    defaultValue: 'lag_and_close_cutoff',
    ownerPersona: 'Controller',
  }),
  q(1, 'l1.intake.lateInvoiceLagDays', 'Late invoice lag threshold (days)', 'Q4 Invoice Dates', {
    answerType: 'number',
    defaultValue: 60,
    ownerPersona: 'Controller',
  }),
  q(1, 'l1.intake.closedPeriodPolicy', 'If invoice date is in a closed accounting period, what is the policy?', 'Q4 Invoice Dates', {
    answerType: 'singleSelect',
    options: [
      { label: 'Post to current open period', value: 'post_current_period' },
      { label: 'Reopen period with controller approval', value: 'reopen_period' },
      { label: 'Route to accrual/cutoff if material, else current period', value: 'accrual_if_material' },
    ],
    defaultValue: 'accrual_if_material',
    ownerPersona: 'Controller',
  }),
  q(1, 'l1.intake.accrualMaterialityThreshold', 'Materiality threshold to trigger accrual/cutoff review', 'Q4 Invoice Dates', {
    answerType: 'currency',
    defaultValue: 10000,
    ownerPersona: 'Controller',
  }),
  q(1, 'l1.intake.servicePeriodRequiredWhen', 'When must service period (start/end) be captured?', 'Q5 Service Period', {
    answerType: 'multiSelect',
    options: [
      { label: 'Always for non-PO invoices', value: 'always_non_po' },
      { label: 'Recurring/subscription/rent/maintenance categories', value: 'recurring_and_prepaid' },
      { label: 'Only above amount threshold', value: 'above_threshold' },
      { label: 'Not required at intake', value: 'not_required' },
    ],
    defaultValue: ['recurring_and_prepaid', 'above_threshold'],
    ownerPersona: 'AP Ops',
  }),
  q(1, 'l1.intake.servicePeriodMissingPolicy', 'If service period is required but missing, what should happen?', 'Q5 Service Period', {
    answerType: 'singleSelect',
    options: [
      { label: 'Hold and request service period', value: 'hold_request' },
      { label: 'Default to 1 month ending invoice date', value: 'default_1_month' },
      { label: 'Default to 12 months for annual invoices', value: 'default_12_months' },
      { label: 'Route to coding team for determination', value: 'route_coding_team' },
    ],
    defaultValue: 'route_coding_team',
    ownerPersona: 'Controller',
  }),
  q(1, 'l1.intake.missingPoPolicy', 'If an invoice is missing a PO number, what should happen?', 'Q6 PO Identification', {
    answerType: 'singleSelect',
    options: [
      { label: 'If PO-required category: reject to supplier', value: 'reject_supplier' },
      { label: 'If PO-required category: hold and route internally to create PO', value: 'hold_route_internal' },
      { label: 'Always hold and route AP for PO lookup', value: 'always_hold_ap_lookup' },
      { label: 'Allow non-PO processing', value: 'allow_non_po' },
    ],
    defaultValue: 'hold_route_internal',
    ownerPersona: 'Procurement',
  }),
  q(1, 'l1.intake.duplicateDetectionAction', 'When a likely duplicate is detected at intake, what do we do?', 'Q7 Duplicate Handling', {
    answerType: 'singleSelect',
    options: [
      { label: 'Hard stop and route to review', value: 'hard_stop_review' },
      { label: 'Soft stop and require approval', value: 'soft_stop_approval' },
      { label: 'Auto-close as duplicate and notify supplier', value: 'auto_close_notify' },
    ],
    defaultValue: 'hard_stop_review',
    ownerPersona: 'Controller',
  }),
  q(1, 'l1.intake.creditMemoPolicy', 'When a credit memo is received, how should it be handled?', 'Q8 Credits & Debits', {
    answerType: 'singleSelect',
    options: [
      { label: 'Apply to oldest open invoice', value: 'apply_oldest' },
      { label: 'Require AP to select target invoice', value: 'ap_select_target' },
      { label: 'Hold for review if no referenced invoice', value: 'hold_if_no_reference' },
      { label: 'Reject if no referenced invoice', value: 'reject_if_no_reference' },
    ],
    defaultValue: 'hold_if_no_reference',
    ownerPersona: 'AP Ops',
  }),
  q(1, 'l1.intake.debitMemoPolicy', 'When a debit memo is received, how should it be handled?', 'Q8 Credits & Debits', {
    answerType: 'singleSelect',
    options: [
      { label: 'Treat as invoice and process normally', value: 'treat_as_invoice' },
      { label: 'Hold and route to procurement/vendor management', value: 'route_procurement' },
      { label: 'Reject unless approved', value: 'reject_unless_approved' },
    ],
    defaultValue: 'route_procurement',
    ownerPersona: 'Procurement',
  }),
  q(1, 'l1.intake.attachmentRequirement', 'Is an invoice attachment required to process the invoice?', 'Q9 Attachments', {
    answerType: 'singleSelect',
    options: [
      { label: 'Always required', value: 'always_required' },
      { label: 'Required unless EDI/e-invoice feed', value: 'required_unless_structured_feed' },
      { label: 'Optional', value: 'optional' },
    ],
    defaultValue: 'required_unless_structured_feed',
    ownerPersona: 'AP Ops',
  }),
  q(1, 'l1.intake.multiAttachmentPolicy', 'If multiple invoice PDFs are attached, what should happen?', 'Q9 Attachments', {
    answerType: 'singleSelect',
    options: [
      { label: 'Split into separate invoices automatically', value: 'auto_split' },
      { label: 'Hold for AP review', value: 'hold_review' },
      { label: 'Reject and ask supplier to resend separately', value: 'reject_resend' },
    ],
    defaultValue: 'hold_review',
    ownerPersona: 'AP Ops',
  }),
  q(1, 'l1.intake.defaultQueueRouting', 'Default queues by document type', 'Q10 Routing & Queues', {
    answerType: 'table',
    defaultValue:
      'Invoice -> AP Processing (SLA 24h)\\nCredit memo -> AP Credits (SLA 24h)\\nDebit memo -> AP Exceptions (SLA 24h)\\nStatement -> Vendor Reconciliation (SLA 48h)\\nW-9/W-8 -> Vendor Master/Tax (SLA 72h)\\nBank change -> Treasury/Vendor Master High Risk (SLA 4h)\\nPayment inquiry -> Payment Status Agent Queue (SLA 8h)\\nRemittance request -> Payment Support Queue (SLA 8h)',
    ownerPersona: 'AP Ops',
  }),

  q(2, 'l2.matching.levelByCategory', 'Which matching level applies by spend category/vendor?', 'Matching Policy Setup', {
    answerType: 'singleSelect',
    options: [
      { label: '2-way only', value: 'two_way_only' },
      { label: '3-way only', value: 'three_way_only' },
      { label: 'Conditional by category/vendor', value: 'conditional' },
    ],
    defaultValue: 'conditional',
    ownerPersona: 'Controller',
  }),
  q(2, 'l2.matching.threeWayMandatoryRule', 'When is 3-way matching mandatory?', 'Matching Policy Setup', {
    answerType: 'singleSelect',
    options: [
      { label: 'Always for PO invoices', value: 'always' },
      { label: 'Inventory/capex and high-risk categories', value: 'inventory_capex_high_risk' },
      { label: 'Only above invoice amount threshold', value: 'above_threshold' },
    ],
    defaultValue: 'inventory_capex_high_risk',
    ownerPersona: 'Procurement',
  }),
  q(2, 'l2.matching.fourWayRequired', 'Is 4-way matching (inspection/acceptance) required for any categories?', 'Matching Policy Setup', {
    answerType: 'singleSelect',
    options: [
      { label: 'No', value: 'no' },
      { label: 'Yes, only quality-controlled items', value: 'quality_controlled' },
      { label: 'Yes, all goods invoices', value: 'all_goods' },
    ],
    defaultValue: 'quality_controlled',
    ownerPersona: 'Receiving',
  }),
  q(2, 'l2.po.required', 'Is PO mandatory for standard spend categories?', 'PO Policy', {
    answerType: 'singleSelect',
    options: yesNo,
    defaultValue: 'yes',
    ownerPersona: 'Procurement',
  }),
  q(2, 'l2.po.tolerance.qty', 'Quantity tolerance % for PO matching', 'Quantity & Price Controls', {
    answerType: 'percent',
    defaultValue: 5,
    ownerPersona: 'Procurement',
    tags: ['Manufacturing'],
  }),
  q(2, 'l2.po.tolerance.price', 'Unit price tolerance % for PO matching', 'Quantity & Price Controls', {
    answerType: 'percent',
    defaultValue: 3,
    ownerPersona: 'Procurement',
    tags: ['Manufacturing'],
  }),
  q(2, 'l2.matching.amountTolerance', 'Header/line amount tolerance approach', 'Quantity & Price Controls', {
    answerType: 'singleSelect',
    options: [
      { label: 'Line-only tolerance', value: 'line_only' },
      { label: 'Header-only tolerance', value: 'header_only' },
      { label: 'Both header and line tolerances', value: 'both' },
    ],
    defaultValue: 'both',
    ownerPersona: 'Controller',
  }),
  q(2, 'l2.matching.cumulativeCheck', 'Should cumulative invoiced qty/amount across prior invoices be checked?', 'Quantity & Price Controls', {
    answerType: 'singleSelect',
    options: yesNo,
    defaultValue: 'yes',
    ownerPersona: 'Controller',
  }),
  q(2, 'l2.matching.swappedQtyPricePolicy', 'If invoice quantity and unit price appear swapped, what should happen?', 'Line Anomalies', {
    answerType: 'singleSelect',
    options: [
      { label: 'Hard stop and manual review', value: 'hard_stop_review' },
      { label: 'Auto-normalize only if total/UOM/item match', value: 'auto_normalize_if_consistent' },
      { label: 'Always auto-normalize', value: 'always_auto_normalize' },
    ],
    defaultValue: 'auto_normalize_if_consistent',
    ownerPersona: 'AP Ops',
  }),
  q(2, 'l2.matching.qtyOneAmountPattern', 'If qty is 1 and unit price equals total invoice amount, how should it be treated?', 'Line Anomalies', {
    answerType: 'singleSelect',
    options: [
      { label: 'Reject', value: 'reject' },
      { label: 'Allow only for configured amount-based categories/vendors', value: 'allow_configured_only' },
      { label: 'Always allow', value: 'always_allow' },
    ],
    defaultValue: 'allow_configured_only',
    ownerPersona: 'AP Ops',
  }),
  q(2, 'l2.matching.lineCountMismatch', 'If invoice line count does not match PO line count, what should happen?', 'Line Anomalies', {
    answerType: 'singleSelect',
    options: [
      { label: 'Require exact line count match', value: 'exact_only' },
      { label: 'Allow one-to-many/many-to-one with confidence', value: 'allow_line_mapping' },
      { label: 'Hold all cases for AP review', value: 'always_hold_review' },
    ],
    defaultValue: 'allow_line_mapping',
    ownerPersona: 'AP Ops',
  }),
  q(2, 'l2.matching.uomMismatchPolicy', 'If invoice and PO unit of measure differ, what should happen?', 'Line Anomalies', {
    answerType: 'singleSelect',
    options: [
      { label: 'Reject', value: 'reject' },
      { label: 'Convert using approved UOM conversion master', value: 'convert_using_master' },
      { label: 'Hold for manual conversion', value: 'hold_manual' },
    ],
    defaultValue: 'convert_using_master',
    ownerPersona: 'Receiving',
  }),
  q(2, 'l2.matching.priceUnitMismatch', 'If price unit differs (per 100/per 1000), what should happen?', 'Line Anomalies', {
    answerType: 'singleSelect',
    options: [
      { label: 'Reject', value: 'reject' },
      { label: 'Normalize using PO price-unit metadata', value: 'normalize_price_unit' },
      { label: 'Hold for AP review', value: 'hold_review' },
    ],
    defaultValue: 'normalize_price_unit',
    ownerPersona: 'AP Ops',
  }),
  q(2, 'l2.receipts.requiredForPayment', 'Is receipt/GR required before payment?', 'Receipt Controls (3-way)', {
    answerType: 'singleSelect',
    options: yesNo,
    defaultValue: 'yes',
    ownerPersona: 'Receiving',
  }),
  q(2, 'l2.receipts.grPendingPolicy', 'If invoice arrives before receipt/GR, what should happen?', 'Receipt Controls (3-way)', {
    answerType: 'singleSelect',
    options: [
      { label: 'Reject', value: 'reject' },
      { label: 'Hold in GR pending queue', value: 'hold_gr_pending' },
      { label: 'Allow with conditional approval', value: 'allow_conditional_approval' },
    ],
    defaultValue: 'hold_gr_pending',
    ownerPersona: 'Receiving',
  }),
  q(2, 'l2.receipts.lateHandling', 'How are missing/late receipts handled?', 'Receipt Controls (3-way)', {
    answerType: 'singleSelect',
    options: [
      { label: 'Auto-remind receiving then escalate by SLA', value: 'remind_and_escalate' },
      { label: 'Manual follow-up only', value: 'manual_follow_up' },
      { label: 'Release invoice after grace period', value: 'release_after_grace_period' },
    ],
    defaultValue: 'remind_and_escalate',
    ownerPersona: 'Receiving',
  }),
  q(2, 'l2.matching.exceptionQueue', 'Owner queue for PO mismatch exceptions', 'Exception Operations', {
    answerType: 'singleSelect',
    options: [
      { label: 'AP Ops', value: 'ap_ops' },
      { label: 'Receiving', value: 'receiving' },
      { label: 'Procurement', value: 'procurement' },
      { label: 'Controller', value: 'controller' },
    ],
    defaultValue: 'ap_ops',
    ownerPersona: 'AP Ops',
  }),
  q(2, 'l2.matching.hardSoftStopPolicy', 'Hard stop vs soft stop policy for matching discrepancies', 'Exception Operations', {
    answerType: 'singleSelect',
    options: [
      { label: 'Single global rule', value: 'single_rule' },
      { label: 'Discrepancy-type matrix (recommended)', value: 'type_matrix' },
    ],
    defaultValue: 'type_matrix',
    ownerPersona: 'Controller',
  }),
  q(2, 'l2.matching.overrideAuthority', 'Who can override PO matching holds?', 'Exception Operations', {
    answerType: 'singleSelect',
    options: [
      { label: 'AP Clerk', value: 'ap_clerk' },
      { label: 'AP Lead for minor, Controller for material', value: 'lead_and_controller' },
      { label: 'Controller only', value: 'controller_only' },
    ],
    defaultValue: 'lead_and_controller',
    ownerPersona: 'Controller',
  }),
  q(2, 'l2.matching.overrideReasonCodes', 'Are standardized reason codes required for overrides?', 'Exception Operations', {
    answerType: 'singleSelect',
    options: yesNo,
    defaultValue: 'yes',
    ownerPersona: 'Controller',
  }),
  q(2, 'l2.matching.exceptionSlaPolicy', 'SLA model for PO matching exceptions', 'Exception Operations', {
    answerType: 'singleSelect',
    options: [
      { label: 'Single SLA for all exception types', value: 'single_sla' },
      { label: 'Queue/discrepancy-specific SLA with auto-escalation', value: 'queue_specific_sla' },
    ],
    defaultValue: 'queue_specific_sla',
    ownerPersona: 'AP Ops',
  }),
  q(2, 'l2.freight.treatment', 'How are planned/unplanned delivery costs handled?', 'Freight & Charges', {
    answerType: 'singleSelect',
    options: [
      { label: 'Reject non-PO freight lines', value: 'reject_non_po_freight' },
      { label: 'Allow configured charge types with thresholds', value: 'allow_configured_charges' },
      { label: 'Always allow as misc charges', value: 'always_allow_misc' },
    ],
    defaultValue: 'allow_configured_charges',
    ownerPersona: 'Procurement',
    tags: ['Manufacturing'],
  }),
  q(2, 'l2.services.sesRequired', 'Is Service Entry Sheet required for services?', 'Services', {
    answerType: 'singleSelect',
    options: yesNo,
    defaultValue: 'yes',
    ownerPersona: 'Receiving',
  }),
  q(2, 'l2.po.changeControl', 'If PO changes after invoice receipt, which PO revision should matching use?', 'PO Lifecycle', {
    answerType: 'singleSelect',
    options: [
      { label: 'Original PO revision', value: 'original' },
      { label: 'Latest approved revision with audit trace', value: 'latest_approved' },
      { label: 'Manual determination by AP', value: 'manual' },
    ],
    defaultValue: 'latest_approved',
    ownerPersona: 'Procurement',
  }),
  q(2, 'l2.matching.closedPoPolicy', 'If PO is closed/final matched, what should happen?', 'PO Lifecycle', {
    answerType: 'singleSelect',
    options: [
      { label: 'Hard reject and route PO reopen workflow', value: 'reject_and_reopen' },
      { label: 'Allow AP override', value: 'allow_override' },
      { label: 'Post to non-PO flow', value: 'route_non_po' },
    ],
    defaultValue: 'reject_and_reopen',
    ownerPersona: 'Procurement',
  }),

  q(3, 'l3.nonpo.eligibleCategories', 'Which spend categories are allowed as non-PO?', 'Scope & Guardrails', {
    answerType: 'multiSelect',
    options: [
      { label: 'Utilities', value: 'utilities' },
      { label: 'Rent/Lease', value: 'rent_lease' },
      { label: 'Taxes & Government Fees', value: 'tax_gov_fees' },
      { label: 'Legal/Professional Services', value: 'professional_services' },
      { label: 'Telecom/Subscriptions', value: 'subscriptions' },
      { label: 'Emergency One-time Spend', value: 'emergency_spend' },
      { label: 'Travel Expense Rebill', value: 'travel_rebill' },
    ],
    defaultValue: ['utilities', 'rent_lease', 'tax_gov_fees', 'professional_services', 'subscriptions'],
    ownerPersona: 'Controller',
  }),
  q(3, 'l3.nonpo.blockedCategories', 'Which categories must never be processed as non-PO?', 'Scope & Guardrails', {
    answerType: 'multiSelect',
    options: [
      { label: 'Inventory / direct materials', value: 'inventory' },
      { label: 'Capex / fixed assets', value: 'capex' },
      { label: 'Standard MRO items', value: 'mro' },
      { label: 'Contracted recurring services with PO requirement', value: 'contracted_services' },
    ],
    defaultValue: ['inventory', 'capex', 'mro', 'contracted_services'],
    ownerPersona: 'Procurement',
  }),
  q(3, 'l3.nonpo.poRequiredDecisionRule', 'How should AP determine if an invoice should have had a PO?', 'Scope & Guardrails', {
    answerType: 'singleSelect',
    options: [
      { label: 'Category-based policy matrix only', value: 'category_matrix' },
      { label: 'Category + vendor + amount + legal entity matrix', value: 'full_policy_matrix' },
      { label: 'AP clerk discretion', value: 'clerk_discretion' },
    ],
    defaultValue: 'full_policy_matrix',
    ownerPersona: 'Controller',
  }),
  q(3, 'l3.nonpo.threshold', 'Non-PO invoice amount threshold requiring additional approval', 'Scope & Guardrails', {
    answerType: 'currency',
    defaultValue: 5000,
    ownerPersona: 'Controller',
  }),
  q(3, 'l3.nonpo.mustHaveJustification', 'Is business justification required for all non-PO invoices?', 'Validation Controls', {
    answerType: 'singleSelect',
    options: yesNo,
    defaultValue: 'yes',
    ownerPersona: 'AP Ops',
  }),
  q(3, 'l3.nonpo.requiredEvidence', 'Required evidence for non-PO processing', 'Validation Controls', {
    answerType: 'multiSelect',
    options: [
      { label: 'Invoice attachment', value: 'invoice_attachment' },
      { label: 'Business justification text', value: 'business_justification' },
      { label: 'Requester / cost center owner confirmation', value: 'owner_confirmation' },
      { label: 'Contract / SOW reference', value: 'contract_reference' },
      { label: 'Exception reason code', value: 'reason_code' },
    ],
    defaultValue: ['invoice_attachment', 'business_justification', 'owner_confirmation', 'reason_code'],
    ownerPersona: 'AP Ops',
  }),
  q(3, 'l3.nonpo.requesterValidation', 'How should requester and cost center ownership be validated?', 'Validation Controls', {
    answerType: 'singleSelect',
    options: [
      { label: 'No validation', value: 'none' },
      { label: 'Email/domain check only', value: 'email_check' },
      { label: 'Cost center owner lookup + active approver validation', value: 'owner_lookup' },
    ],
    defaultValue: 'owner_lookup',
    ownerPersona: 'Controller',
  }),
  q(3, 'l3.nonpo.vendorRiskGate', 'Should non-PO invoices from new/high-risk vendors be blocked pending review?', 'Validation Controls', {
    answerType: 'singleSelect',
    options: yesNo,
    defaultValue: 'yes',
    ownerPersona: 'Procurement',
  }),
  q(3, 'l3.nonpo.contractPoExpectedRule', 'If a vendor has active contract/blanket PO coverage, how should non-PO invoices be treated?', 'Leakage Prevention Rules', {
    answerType: 'singleSelect',
    options: [
      { label: 'Allow as non-PO if below threshold', value: 'allow_below_threshold' },
      { label: 'Always route for PO compliance review', value: 'route_po_compliance_review' },
      { label: 'Auto-reject and request PO reference', value: 'auto_reject_need_po' },
    ],
    defaultValue: 'route_po_compliance_review',
    ownerPersona: 'Procurement',
  }),
  q(3, 'l3.nonpo.recurringPatternRule', 'If repeated non-PO invoices occur for same vendor/category, what should happen?', 'Leakage Prevention Rules', {
    answerType: 'singleSelect',
    options: [
      { label: 'Continue as non-PO', value: 'continue_non_po' },
      { label: 'Trigger PO creation recommendation after N invoices', value: 'trigger_po_after_n' },
      { label: 'Block until PO is created', value: 'block_until_po' },
    ],
    defaultValue: 'trigger_po_after_n',
    ownerPersona: 'Controller',
  }),
  q(3, 'l3.nonpo.recurringPatternThreshold', 'Recurring non-PO threshold (invoice count per vendor/category per quarter)', 'Leakage Prevention Rules', {
    answerType: 'number',
    defaultValue: 3,
    ownerPersona: 'Controller',
  }),
  q(3, 'l3.nonpo.keywordLeakageDetection', 'Should line descriptions/GL patterns be used to detect PO-eligible spend slipping as non-PO?', 'Leakage Prevention Rules', {
    answerType: 'singleSelect',
    options: yesNo,
    defaultValue: 'yes',
    ownerPersona: 'AP Ops',
  }),
  q(3, 'l3.nonpo.leakageAction', 'When non-PO appears PO-eligible, what is the default action?', 'Leakage Prevention Rules', {
    answerType: 'singleSelect',
    options: [
      { label: 'Hard hold and route to procurement for PO creation', value: 'hold_route_procurement' },
      { label: 'Soft warning and continue if approver confirms', value: 'soft_warn_with_confirm' },
      { label: 'Auto-reject to supplier for PO correction', value: 'auto_reject_supplier' },
    ],
    defaultValue: 'hold_route_procurement',
    ownerPersona: 'Procurement',
  }),
  q(3, 'l3.nonpo.exceptionReasonCodes', 'Are mandatory reason codes required for non-PO exceptions?', 'Exception Governance', {
    answerType: 'singleSelect',
    options: yesNo,
    defaultValue: 'yes',
    ownerPersona: 'Controller',
  }),
  q(3, 'l3.nonpo.overrideAuthority', 'Who can approve non-PO exceptions when policy indicates PO should exist?', 'Exception Governance', {
    answerType: 'singleSelect',
    options: [
      { label: 'AP Clerk', value: 'ap_clerk' },
      { label: 'AP Lead + Procurement', value: 'ap_lead_procurement' },
      { label: 'Controller (or delegate) only', value: 'controller_only' },
    ],
    defaultValue: 'ap_lead_procurement',
    ownerPersona: 'Controller',
  }),
  q(3, 'l3.nonpo.exceptionSla', 'SLA for non-PO policy exceptions (hours)', 'Exception Governance', {
    answerType: 'number',
    defaultValue: 48,
    ownerPersona: 'AP Ops',
  }),
  q(3, 'l3.nonpo.taxReview', 'When should Tax team review non-PO invoices?', 'Compliance', {
    answerType: 'singleSelect',
    options: [
      { label: 'Only VAT/GST/withholding flagged invoices', value: 'tax_flagged_only' },
      { label: 'All cross-border non-PO invoices', value: 'cross_border_all' },
      { label: 'All non-PO invoices', value: 'all_non_po' },
    ],
    defaultValue: 'tax_flagged_only',
    ownerPersona: 'Tax',
  }),
  q(3, 'l3.nonpo.documentationChecklist', 'Non-PO control matrix (category, PO expected?, required evidence, approver, exception queue, SLA)', 'Control Matrix', {
    answerType: 'table',
    defaultValue:
      'Utilities | PO expected: No | Evidence: Invoice+Owner confirmation | Approver: Cost center owner | Queue: AP Non-PO | SLA: 24h\\nProfessional services | PO expected: Depends contract | Evidence: Invoice+SOW+justification | Approver: Dept head | Queue: AP/Procurement | SLA: 48h\\nInventory | PO expected: Yes | Evidence: PO+receipt | Approver: Procurement | Queue: PO Compliance | SLA: 8h',
    ownerPersona: 'Controller',
  }),
  q(3, 'l3.nonpo.kpiLeakageThreshold', 'At what non-PO leakage rate should remediation be triggered?', 'Monitoring & Remediation', {
    answerType: 'percent',
    defaultValue: 10,
    ownerPersona: 'Controller',
  }),
  q(3, 'l3.nonpo.remediationAction', 'If leakage KPI is breached, what is the default remediation?', 'Monitoring & Remediation', {
    answerType: 'singleSelect',
    options: [
      { label: 'Monthly review only', value: 'monthly_review' },
      { label: 'Category-level policy tightening + training', value: 'tighten_policy_training' },
      { label: 'Immediate hard-stop on flagged categories', value: 'immediate_hard_stop' },
    ],
    defaultValue: 'tighten_policy_training',
    ownerPersona: 'Controller',
  }),

  q(4, 'l4.coding.defaultSegments', 'Default segment values for non-PO coding (entity, department, location, intercompany)', 'COA Foundation', {
    answerType: 'table',
    defaultValue:
      'Entity: Default legal entity\\nDepartment: Default only when missing requester info\\nLocation: Use vendor service location where applicable\\nIntercompany: Required for cross-entity charges',
    ownerPersona: 'Controller',
  }),
  q(4, 'l4.coding.accountSelectionMethod', 'How should the primary GL account be determined for non-PO invoices?', 'COA Foundation', {
    answerType: 'singleSelect',
    options: [
      { label: 'Vendor default account only', value: 'vendor_default_only' },
      { label: 'Category/service-based mapping matrix', value: 'category_mapping_matrix' },
      { label: 'AP clerk free selection from COA', value: 'free_selection' },
    ],
    defaultValue: 'category_mapping_matrix',
    ownerPersona: 'Controller',
  }),
  q(4, 'l4.coding.categoryAccountMatrix', 'Category-to-Account Mapping Matrix (COA driven)', 'COA Foundation', {
    answerType: 'table',
    defaultValue:
      'Software / SaaS | 6750 Software Subscriptions | CC: Requester | Capex: No | COGS: No\\nCloud / Hosting | 5110 Hosting Costs | CC: Cloud Ops | Capex: No | COGS: Depends\\nProfessional Services | 6340 Professional Services | CC: Requesting function | Capex: Maybe | COGS: Maybe',
    ownerPersona: 'Controller',
  }),
  q(4, 'l4.coding.accountSelection', 'Default primary expense account for fallback coding', 'COA Foundation', {
    answerType: 'accountPicker',
    ownerPersona: 'Controller',
  }),
  q(4, 'l4.coding.costCenterSelectionRule', 'How should cost center be selected for non-PO coding?', 'COA Foundation', {
    answerType: 'singleSelect',
    options: [
      { label: 'Invoice requester/approver cost center', value: 'requester_cost_center' },
      { label: 'Vendor default cost center', value: 'vendor_default_cc' },
      { label: 'AP default cost center if unknown', value: 'ap_default_cc' },
    ],
    defaultValue: 'requester_cost_center',
    ownerPersona: 'Controller',
  }),
  q(4, 'l4.coding.costCenterSelection', 'Fallback cost center for missing ownership', 'COA Foundation', {
    answerType: 'costCenterPicker',
    ownerPersona: 'Controller',
  }),
  q(4, 'l4.coding.cogsPolicy', 'When should non-PO invoices be coded to COGS accounts?', 'COGS vs Opex', {
    answerType: 'singleSelect',
    options: [
      { label: 'Never for non-PO', value: 'never_non_po' },
      { label: 'Allowed for specific categories/entities with controls', value: 'allowed_with_controls' },
      { label: 'Allowed at AP discretion', value: 'ap_discretion' },
    ],
    defaultValue: 'allowed_with_controls',
    ownerPersona: 'Controller',
  }),
  q(4, 'l4.coding.cogsEvidence', 'Required evidence before coding non-PO to COGS', 'COGS vs Opex', {
    answerType: 'multiSelect',
    options: [
      { label: 'Approved cost object/project', value: 'approved_cost_object' },
      { label: 'Controller/FP&A approval', value: 'controller_approval' },
      { label: 'Documented policy exception reason code', value: 'reason_code' },
      { label: 'Supporting contract/SOW', value: 'supporting_contract' },
    ],
    defaultValue: ['approved_cost_object', 'controller_approval', 'reason_code'],
    ownerPersona: 'Controller',
  }),
  q(4, 'l4.coding.capexDecisionRule', 'How should AP decide whether an invoice is Capex vs Opex?', 'Capex Controls', {
    answerType: 'singleSelect',
    options: [
      { label: 'Use fixed-asset category and capitalization policy matrix', value: 'policy_matrix' },
      { label: 'Use invoice amount threshold only', value: 'amount_only' },
      { label: 'AP clerk judgment', value: 'clerk_judgment' },
    ],
    defaultValue: 'policy_matrix',
    ownerPersona: 'Controller',
  }),
  q(4, 'l4.coding.capexThreshold', 'Capitalization threshold amount', 'Capex Controls', {
    answerType: 'currency',
    defaultValue: 5000,
    ownerPersona: 'Controller',
  }),
  q(4, 'l4.coding.capexRequiredAttributes', 'Required attributes before posting to Capex account', 'Capex Controls', {
    answerType: 'multiSelect',
    options: [
      { label: 'Asset class', value: 'asset_class' },
      { label: 'In-service date (or expected date)', value: 'in_service_date' },
      { label: 'Business owner / custodian', value: 'asset_owner' },
      { label: 'Location', value: 'asset_location' },
      { label: 'Project/WBS (if applicable)', value: 'project_wbs' },
    ],
    defaultValue: ['asset_class', 'asset_owner', 'asset_location'],
    ownerPersona: 'Controller',
  }),
  q(4, 'l4.coding.prepaidRule', 'When should a non-PO invoice be coded as prepaid?', 'Prepaids & Period Recognition', {
    answerType: 'singleSelect',
    options: [
      { label: 'When service period extends beyond current month', value: 'service_period_beyond_month' },
      { label: 'Only if annual contract', value: 'annual_only' },
      { label: 'Never create prepaids in AP', value: 'never_prepaid_ap' },
    ],
    defaultValue: 'service_period_beyond_month',
    ownerPersona: 'Controller',
  }),
  q(4, 'l4.coding.prepaidMaterialityThreshold', 'Prepaid materiality threshold', 'Prepaids & Period Recognition', {
    answerType: 'currency',
    defaultValue: 10000,
    ownerPersona: 'Controller',
  }),
  q(4, 'l4.coding.servicePeriodMissingHandling', 'If service period is missing but prepaid criteria likely apply, what should happen?', 'Prepaids & Period Recognition', {
    answerType: 'singleSelect',
    options: [
      { label: 'Hold and request service period', value: 'hold_request_period' },
      { label: 'Route to controller coding queue', value: 'route_controller_queue' },
      { label: 'Post current period and adjust later', value: 'post_and_adjust' },
    ],
    defaultValue: 'hold_request_period',
    ownerPersona: 'Controller',
  }),
  q(4, 'l4.coding.multiLineSplitPolicy', 'How should mixed invoices (services + tax + freight + fees) be coded?', 'Line Splitting & Allocation', {
    answerType: 'singleSelect',
    options: [
      { label: 'Single summary line only', value: 'single_line' },
      { label: 'Split into separate lines by component and account type', value: 'split_by_component' },
      { label: 'Split only above threshold', value: 'split_above_threshold' },
    ],
    defaultValue: 'split_by_component',
    ownerPersona: 'AP Ops',
  }),
  q(4, 'l4.coding.allocationBasis', 'Default allocation basis when one invoice is shared across multiple cost centers/departments', 'Line Splitting & Allocation', {
    answerType: 'singleSelect',
    options: [
      { label: 'Equal split', value: 'equal_split' },
      { label: 'Headcount/usage-based predefined drivers', value: 'driver_based' },
      { label: 'Manual AP entry per approver instruction', value: 'manual_instruction' },
    ],
    defaultValue: 'driver_based',
    ownerPersona: 'Controller',
  }),
  q(4, 'l4.tax.vatCodeLogic', 'VAT/GST tax code determination logic for non-PO invoices', 'Tax & Compliance', {
    answerType: 'singleSelect',
    options: [
      { label: 'Tax code by vendor tax profile + item category + jurisdiction', value: 'profile_category_jurisdiction' },
      { label: 'Vendor default tax code only', value: 'vendor_default_only' },
      { label: 'AP manual tax code selection', value: 'manual_tax_code' },
    ],
    defaultValue: 'profile_category_jurisdiction',
    ownerPersona: 'Tax',
    tags: ['VAT', 'GST'],
  }),
  q(4, 'l4.tax.withholdingPolicy', 'Withholding tax policy by vendor type and service type', 'Tax & Compliance', {
    answerType: 'singleSelect',
    options: [
      { label: 'Mandatory rules by vendor class and jurisdiction', value: 'mandatory_rules' },
      { label: 'Apply only when vendor requests it', value: 'vendor_requested' },
      { label: 'Manual ad-hoc by AP', value: 'manual_adhoc' },
    ],
    defaultValue: 'mandatory_rules',
    ownerPersona: 'Tax',
  }),
  q(4, 'l4.coding.intercompanyPolicy', 'Intercompany coding and settlement policy for cross-entity non-PO invoices', 'Intercompany', {
    answerType: 'singleSelect',
    options: [
      { label: 'Require intercompany segment and due-to/due-from mapping', value: 'require_ic_segments' },
      { label: 'Post to single entity then reclass monthly', value: 'post_then_reclass' },
      { label: 'Disallow non-PO intercompany invoices', value: 'disallow_non_po_ic' },
    ],
    defaultValue: 'require_ic_segments',
    ownerPersona: 'Controller',
  }),
  q(4, 'l4.coding.manualOverride', 'Who can override suggested GL/cost-center coding?', 'Controls & Exceptions', {
    answerType: 'singleSelect',
    options: [
      { label: 'Controller only', value: 'controller' },
      { label: 'Controller + AP Leads', value: 'controller_ap' },
      { label: 'Any AP Analyst', value: 'ap_any' },
    ],
    defaultValue: 'controller_ap',
    ownerPersona: 'Controller',
  }),
  q(4, 'l4.coding.overrideReasonCodesRequired', 'Are reason codes and evidence mandatory for coding overrides?', 'Controls & Exceptions', {
    answerType: 'singleSelect',
    options: yesNo,
    defaultValue: 'yes',
    ownerPersona: 'Controller',
  }),
  q(4, 'l4.coding.exceptionRoute', 'Where should coding exceptions route by default?', 'Controls & Exceptions', {
    answerType: 'singleSelect',
    options: [
      { label: 'AP coding exception queue', value: 'ap_exception_queue' },
      { label: 'Controller review queue', value: 'controller_queue' },
      { label: 'Category owner + controller queue', value: 'category_controller_queue' },
    ],
    defaultValue: 'controller_queue',
    ownerPersona: 'Controller',
  }),

  q(5, 'l5.approvals.model', 'Approval model for AP invoices', 'Workflow', {
    answerType: 'singleSelect',
    options: [
      { label: 'Cost Center Owner', value: 'costCenterOwner' },
      { label: 'Manager Chain', value: 'managerChain' },
      { label: 'Role Groups', value: 'roleGroups' },
      { label: 'Mixed', value: 'mixed' },
    ],
    ownerPersona: 'Controller',
  }),
  q(5, 'l5.approvals.doa.upload', 'Upload DoA/approval matrix', 'Workflow', {
    answerType: 'upload',
    ownerPersona: 'Controller',
  }),
  q(5, 'l5.approvals.doa.matrix', 'Approval matrix definition', 'Workflow', {
    answerType: 'table',
    ownerPersona: 'Controller',
  }),
  q(5, 'l5.approvals.escalationHours', 'Escalation trigger for pending approvals (hours)', 'Workflow', {
    answerType: 'number',
    ownerPersona: 'AP Ops',
  }),
  q(5, 'l5.approvals.autoReminders', 'Automatic reminder cadence', 'Workflow', {
    answerType: 'text',
    ownerPersona: 'AP Ops',
  }),
  q(5, 'l5.workflow.reassignPolicy', 'Reassignment policy when approver is OOO', 'Workflow', {
    ownerPersona: 'AP Ops',
  }),
  q(5, 'l5.workflow.auditRequirement', 'Approval audit evidence retention (months)', 'Controls', {
    answerType: 'number',
    ownerPersona: 'Controller',
  }),

  q(6, 'l6.controls.duplicateCheck', 'Duplicate invoice control configuration', 'Controls', {
    ownerPersona: 'Controller',
  }),
  q(6, 'l6.controls.bankChange', 'Bank change verification protocol', 'Controls', {
    ownerPersona: 'Treasury',
  }),
  q(6, 'l6.controls.vendorStatement', 'Vendor statement reconciliation cadence', 'Controls', {
    answerType: 'singleSelect',
    options: [
      { label: 'Weekly', value: 'weekly' },
      { label: 'Monthly', value: 'monthly' },
      { label: 'Quarterly', value: 'quarterly' },
    ],
    ownerPersona: 'AP Ops',
  }),
  q(6, 'l6.controls.segregationDuties', 'Segregation-of-duties checkpoints', 'Controls', {
    answerType: 'table',
    ownerPersona: 'Controller',
  }),
  q(6, 'l6.governance.kpiSet', 'AP KPI set and review forum', 'Governance', {
    ownerPersona: 'Controller',
  }),
  q(6, 'l6.governance.exceptionCommittee', 'Exception committee structure', 'Governance', {
    requiredDefault: false,
    ownerPersona: 'Controller',
  }),
  q(6, 'l6.governance.riskRegister', 'AP risk register ownership', 'Governance', {
    ownerPersona: 'Controller',
  }),
  q(6, 'l6.compliance.vatControls', 'EU VAT control requirements', 'Compliance', {
    ownerPersona: 'Tax',
    tags: ['VAT'],
  }),
  q(6, 'l6.compliance.gstControls', 'India GST control requirements', 'Compliance', {
    ownerPersona: 'Tax',
    tags: ['GST'],
  }),

  q(7, 'l7.integration.erpSystem', 'Primary ERP and release/version', 'Integration', {
    answerType: 'singleSelect',
    options: [
      { label: 'Workday', value: 'Workday' },
      { label: 'Oracle Fusion', value: 'OracleFusion' },
      { label: 'SAP', value: 'SAP' },
      { label: 'Oracle EBS', value: 'OracleEBS' },
      { label: 'NetSuite', value: 'NetSuite' },
      { label: 'Coupa', value: 'Coupa' },
    ],
    defaultValue: 'SAP',
    ownerPersona: 'IT/Finance Systems',
  }),
  q(7, 'l7.integration.masterDataLatency', 'Master data sync latency target', 'Integration', {
    ownerPersona: 'IT/Finance Systems',
  }),
  q(7, 'l7.integration.paymentInterface', 'Payment interface handoff method', 'Integration', {
    answerType: 'singleSelect',
    options: [
      { label: 'API', value: 'api' },
      { label: 'SFTP', value: 'sftp' },
      { label: 'Flat file', value: 'flat_file' },
      { label: 'Manual export', value: 'manual' },
    ],
    ownerPersona: 'IT/Finance Systems',
  }),
  q(7, 'l7.integration.archivePolicy', 'Document archive and retention setup', 'Integration', {
    ownerPersona: 'IT/Finance Systems',
  }),
  q(7, 'l7.integration.incidentProcess', 'Incident management process for AP automations', 'Operations', {
    ownerPersona: 'IT/Finance Systems',
  }),
  q(7, 'l7.it.accessModel', 'Role-based access model for AP tooling', 'Operations', {
    ownerPersona: 'IT/Finance Systems',
  }),
  q(7, 'l7.it.changeControl', 'Change control cadence and approvals', 'Operations', {
    ownerPersona: 'IT/Finance Systems',
  }),
  q(7, 'l7.integration.itPrimaryContact', 'Primary IT integration owner contact (name, email, team)', 'System Contacts', {
    ownerPersona: 'IT/Finance Systems',
  }),
  q(7, 'l7.integration.itSupportMatrix', 'Integration support matrix (team, role, contact, coverage hours)', 'System Contacts', {
    answerType: 'table',
    ownerPersona: 'IT/Finance Systems',
  }),

  q(7, 'l7.erp.sap.version', 'SAP version and deployment (ECC or S/4HANA; on-prem/private/public cloud)', 'SAP Integration Discovery', {
    answerType: 'singleSelect',
    options: [
      { label: 'SAP ECC', value: 'ecc' },
      { label: 'SAP S/4HANA', value: 's4hana' },
      { label: 'Both (transition phase)', value: 'hybrid' },
    ],
    defaultValue: 's4hana',
    ownerPersona: 'IT/Finance Systems',
    tags: ['ERP:SAP'],
  }),
  q(7, 'l7.erp.sap.integrationPattern', 'Preferred SAP integration pattern for AP data flows', 'SAP Integration Discovery', {
    answerType: 'singleSelect',
    options: [
      { label: 'IDoc', value: 'idoc' },
      { label: 'BAPI/RFC', value: 'bapi_rfc' },
      { label: 'OData/API', value: 'odata_api' },
      { label: 'File/SFTP middleware', value: 'file_sftp' },
    ],
    defaultValue: 'odata_api',
    ownerPersona: 'IT/Finance Systems',
    tags: ['ERP:SAP'],
  }),
  q(7, 'l7.erp.sap.basisContact', 'SAP Basis owner contact for connectivity, transports, and environment setup', 'SAP Integration Discovery', {
    ownerPersona: 'IT/Finance Systems',
    tags: ['ERP:SAP'],
  }),
  q(7, 'l7.erp.sap.abapContact', 'SAP ABAP owner contact for BAPI/user exits/enhancements', 'SAP Integration Discovery', {
    ownerPersona: 'IT/Finance Systems',
    tags: ['ERP:SAP'],
  }),
  q(7, 'l7.erp.sap.scopeMatrix', 'SAP integration scope matrix (company code, plant, doc type, posting path)', 'SAP Integration Discovery', {
    answerType: 'table',
    ownerPersona: 'IT/Finance Systems',
    tags: ['ERP:SAP'],
  }),

  q(7, 'l7.erp.oracleEbs.version', 'Oracle EBS release and patch level', 'Oracle EBS Integration Discovery', {
    answerType: 'singleSelect',
    options: [
      { label: '12.1.x', value: '12_1' },
      { label: '12.2.x', value: '12_2' },
      { label: 'Other/Custom', value: 'other' },
    ],
    defaultValue: '12_2',
    ownerPersona: 'IT/Finance Systems',
    tags: ['ERP:OracleEBS'],
  }),
  q(7, 'l7.erp.oracleEbs.integrationMethod', 'Primary Oracle EBS integration method', 'Oracle EBS Integration Discovery', {
    answerType: 'singleSelect',
    options: [
      { label: 'Open Interface Tables + Import Programs', value: 'open_interface' },
      { label: 'Public APIs/PLSQL packages', value: 'public_apis' },
      { label: 'Middleware + file loads', value: 'middleware_files' },
    ],
    defaultValue: 'open_interface',
    ownerPersona: 'IT/Finance Systems',
    tags: ['ERP:OracleEBS'],
  }),
  q(7, 'l7.erp.oracleEbs.techContacts', 'Oracle EBS technical contacts (DBA, Apps, Integrations)', 'Oracle EBS Integration Discovery', {
    answerType: 'table',
    ownerPersona: 'IT/Finance Systems',
    tags: ['ERP:OracleEBS'],
  }),
  q(7, 'l7.erp.oracleEbs.customizations', 'List EBS customizations impacting AP invoice/import flows', 'Oracle EBS Integration Discovery', {
    answerType: 'table',
    ownerPersona: 'IT/Finance Systems',
    tags: ['ERP:OracleEBS'],
  }),

  q(7, 'l7.erp.oracleFusion.pod', 'Oracle Fusion pod and environment strategy (DEV/TEST/UAT/PROD)', 'Oracle Fusion Integration Discovery', {
    ownerPersona: 'IT/Finance Systems',
    tags: ['ERP:OracleFusion'],
  }),
  q(7, 'l7.erp.oracleFusion.integrationMethod', 'Primary Oracle Fusion integration method', 'Oracle Fusion Integration Discovery', {
    answerType: 'singleSelect',
    options: [
      { label: 'REST APIs', value: 'rest' },
      { label: 'SOAP services', value: 'soap' },
      { label: 'FBDI file loads', value: 'fbdi' },
      { label: 'OIC/orchestration', value: 'oic' },
    ],
    defaultValue: 'rest',
    ownerPersona: 'IT/Finance Systems',
    tags: ['ERP:OracleFusion'],
  }),
  q(7, 'l7.erp.oracleFusion.securityContacts', 'Oracle Fusion security + integration owner contacts', 'Oracle Fusion Integration Discovery', {
    answerType: 'table',
    ownerPersona: 'IT/Finance Systems',
    tags: ['ERP:OracleFusion'],
  }),
  q(7, 'l7.erp.oracleFusion.jobDependencies', 'Fusion scheduled jobs/dependencies required for AP posting and status sync', 'Oracle Fusion Integration Discovery', {
    answerType: 'table',
    ownerPersona: 'IT/Finance Systems',
    tags: ['ERP:OracleFusion'],
  }),

  q(7, 'l7.erp.netSuite.edition', 'NetSuite edition and OneWorld usage', 'NetSuite Integration Discovery', {
    answerType: 'singleSelect',
    options: [
      { label: 'OneWorld', value: 'oneworld' },
      { label: 'Single instance (non-OneWorld)', value: 'single_instance' },
    ],
    defaultValue: 'oneworld',
    ownerPersona: 'IT/Finance Systems',
    tags: ['ERP:NetSuite'],
  }),
  q(7, 'l7.erp.netSuite.integrationMethod', 'Preferred NetSuite integration channel', 'NetSuite Integration Discovery', {
    answerType: 'singleSelect',
    options: [
      { label: 'SuiteTalk REST', value: 'suite_talk_rest' },
      { label: 'SuiteTalk SOAP', value: 'suite_talk_soap' },
      { label: 'CSV import', value: 'csv_import' },
      { label: 'SuiteScript middleware', value: 'suite_script' },
    ],
    defaultValue: 'suite_talk_rest',
    ownerPersona: 'IT/Finance Systems',
    tags: ['ERP:NetSuite'],
  }),
  q(7, 'l7.erp.netSuite.contacts', 'NetSuite admin + integration developer contacts', 'NetSuite Integration Discovery', {
    answerType: 'table',
    ownerPersona: 'IT/Finance Systems',
    tags: ['ERP:NetSuite'],
  }),
  q(7, 'l7.erp.netSuite.customSegments', 'Custom segments/fields required for AP coding and posting', 'NetSuite Integration Discovery', {
    answerType: 'table',
    ownerPersona: 'IT/Finance Systems',
    tags: ['ERP:NetSuite'],
  }),

  q(7, 'l7.erp.coupa.tenant', 'Coupa tenant URL and environment details', 'Coupa Integration Discovery', {
    ownerPersona: 'IT/Finance Systems',
    tags: ['ERP:Coupa'],
  }),
  q(7, 'l7.erp.coupa.integrationMethod', 'Primary Coupa integration approach for AP flows', 'Coupa Integration Discovery', {
    answerType: 'singleSelect',
    options: [
      { label: 'Coupa REST APIs', value: 'coupa_rest' },
      { label: 'cXML', value: 'cxml' },
      { label: 'Flat file/SFTP', value: 'file_sftp' },
      { label: 'Middleware connector', value: 'middleware' },
    ],
    defaultValue: 'coupa_rest',
    ownerPersona: 'IT/Finance Systems',
    tags: ['ERP:Coupa'],
  }),
  q(7, 'l7.erp.coupa.contacts', 'Coupa admin + integration owner contacts', 'Coupa Integration Discovery', {
    answerType: 'table',
    ownerPersona: 'IT/Finance Systems',
    tags: ['ERP:Coupa'],
  }),
  q(7, 'l7.erp.coupa.syncScope', 'Coupa-to-ERP sync scope (suppliers, POs, invoices, payment status)', 'Coupa Integration Discovery', {
    answerType: 'table',
    ownerPersona: 'IT/Finance Systems',
    tags: ['ERP:Coupa'],
  }),

  q(7, 'l7.erp.workday.tenant', 'Workday tenant and environment details', 'Workday Integration Discovery', {
    ownerPersona: 'IT/Finance Systems',
    tags: ['ERP:Workday'],
  }),
  q(7, 'l7.erp.workday.integrationMethod', 'Primary Workday integration method', 'Workday Integration Discovery', {
    answerType: 'singleSelect',
    options: [
      { label: 'Workday REST/SOAP APIs', value: 'wd_api' },
      { label: 'EIB', value: 'eib' },
      { label: 'Workday Studio', value: 'studio' },
      { label: 'Middleware orchestration', value: 'middleware' },
    ],
    defaultValue: 'wd_api',
    ownerPersona: 'IT/Finance Systems',
    tags: ['ERP:Workday'],
  }),
  q(7, 'l7.erp.workday.securityContacts', 'Workday ISU/security and integration owner contacts', 'Workday Integration Discovery', {
    answerType: 'table',
    ownerPersona: 'IT/Finance Systems',
    tags: ['ERP:Workday'],
  }),
  q(7, 'l7.erp.workday.worktags', 'Workday worktags and spend categories needed for AP coding', 'Workday Integration Discovery', {
    answerType: 'table',
    ownerPersona: 'IT/Finance Systems',
    tags: ['ERP:Workday'],
  }),

  q(1, 'sap.l1.companyCodes', 'SAP company codes in scope', 'SAP Foundation', {
    answerType: 'multiSelect',
    ownerPersona: 'IT/Finance Systems',
    tags: ['SAP'],
  }),
  q(1, 'sap.l1.landscape', 'SAP landscape and version (ECC/S4 + environments)', 'SAP Foundation', {
    ownerPersona: 'IT/Finance Systems',
    tags: ['SAP'],
  }),
  q(4, 'sap.l4.withholdingTaxType', 'SAP withholding tax type and code logic', 'SAP Tax', {
    ownerPersona: 'Tax',
    tags: ['SAP'],
  }),
  q(4, 'sap.l4.baselineDateLogic', 'SAP payment baseline date determination', 'SAP Tax', {
    ownerPersona: 'Controller',
    tags: ['SAP'],
  }),
  q(6, 'sap.l6.duplicateCheckConfig', 'SAP duplicate check configuration', 'SAP Controls', {
    ownerPersona: 'Controller',
    tags: ['SAP'],
  }),
  q(6, 'sap.l6.ersPolicy', 'ERS policy and exception handling', 'SAP Controls', {
    ownerPersona: 'Procurement',
    tags: ['SAP'],
  }),
];

export const layers = [1, 2, 3, 4, 5, 6, 7] as const;

export const layerLabels: Record<number, string> = {
  1: 'Intake & Capture',
  2: 'PO & Matching',
  3: 'Non-PO Policy',
  4: 'Coding Policy (GAAP)',
  5: 'Approvals & Workflow',
  6: 'Controls & Governance',
  7: 'Integration & IT',
};
