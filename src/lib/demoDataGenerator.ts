interface SupplierRow extends Record<string, unknown> {
  supplier_id: string;
  supplier_name: string;
  supplier_status: string;
}

interface ContactRow extends Record<string, unknown> {
  contact_id: string;
  supplier_id: string;
  contact_email: string;
  contact_role: string;
}

interface BankingRow extends Record<string, unknown> {
  bank_account_id: string;
  supplier_id: string;
  bank_account_last4: string;
  bank_country: string;
}

interface InvoiceHeaderRow extends Record<string, unknown> {
  invoice_id: string;
  supplier_id: string;
  invoice_number: string;
  invoice_amount: number;
  invoice_date: string;
  po_number: string;
}

interface InvoiceLineRow extends Record<string, unknown> {
  invoice_line_id: string;
  invoice_id: string;
  line_number: number;
  line_amount: number;
  line_description: string;
}

interface InvoiceExceptionRow extends Record<string, unknown> {
  exception_id: string;
  invoice_id: string;
  supplier_id: string;
  invoice_line_id: string;
  line_number: number;
  hold_reason_code: string;
  hold_reason_text: string;
}

interface PaymentRow extends Record<string, unknown> {
  payment_id: string;
  invoice_id: string;
  supplier_id: string;
  payment_date: string;
  payment_amount: number;
}

interface CreditRow extends Record<string, unknown> {
  credit_id: string;
  supplier_id: string;
  invoice_id: string;
}

export interface DemoDataset {
  suppliers: SupplierRow[];
  supplierContacts: ContactRow[];
  supplierBanking: BankingRow[];
  invoiceHeaders: InvoiceHeaderRow[];
  invoiceLines: InvoiceLineRow[];
  invoiceExceptions: InvoiceExceptionRow[];
  payments: PaymentRow[];
  credits: CreditRow[];
}

const pad = (value: number, size = 4): string => String(value).padStart(size, '0');

const supplierNames = [
  'Apex Industrial Supply',
  'Northline Logistics',
  'Vertex Components',
  'Summit Fabrication',
  'Golden Gate Packaging',
  'Bluefield Metals',
  'Brightline Electronics',
  'Pioneer MRO Services',
  'Lakeside Fasteners',
  'Cedar Valley Tools',
];

const holdReasons = [
  { code: 'MISSING_PO', text: 'Missing PO' },
  { code: 'PRICE_MISMATCH', text: 'Price mismatch' },
  { code: 'DUPLICATE_SUSPECTED', text: 'Duplicate suspected' },
  { code: 'TAX_ISSUE', text: 'Tax issue' },
  { code: 'VENDOR_HOLD', text: 'Vendor hold' },
  { code: 'APPROVAL_REQUIRED', text: 'Approval required' },
];

export const generateDemoDataset = (seed = 1): DemoDataset => {
  const offset = Math.max(0, seed - 1);
  const suppliers: SupplierRow[] = Array.from({ length: 10 }, (_, index) => ({
    supplier_id: `SUP-${pad(index + 1)}`,
    supplier_name: supplierNames[index],
    supplier_status: index % 4 === 0 ? 'Onboarding' : 'Active',
  }));

  const supplierContacts: ContactRow[] = suppliers.map((supplier, index) => ({
    contact_id: `CON-${pad(index + 1)}`,
    supplier_id: supplier.supplier_id,
    contact_email: `ap-contact-${index + 1}@${supplier.supplier_name.toLowerCase().replace(/[^a-z]/g, '')}.com`,
    contact_role: index % 2 === 0 ? 'Accounts Receivable' : 'Finance Controller',
  }));

  const supplierBanking: BankingRow[] = suppliers.map((supplier, index) => ({
    bank_account_id: `BANK-${pad(index + 1)}`,
    supplier_id: supplier.supplier_id,
    bank_account_last4: `${4200 + index}`,
    bank_country: index % 3 === 0 ? 'US' : index % 3 === 1 ? 'CA' : 'MX',
  }));

  const invoiceHeaders: InvoiceHeaderRow[] = suppliers.map((supplier, index) => {
    const invoiceId = `INV-${pad(index + 1)}`;
    const line1 = 180 + index * 11 + offset;
    const line2 = 95 + index * 7 + offset;
    const total = Number((line1 + line2).toFixed(2));

    return {
      invoice_id: invoiceId,
      supplier_id: supplier.supplier_id,
      invoice_number: `2026-${10000 + index}`,
      invoice_amount: total,
      invoice_date: `2026-01-${String(((index + offset) % 28) + 1).padStart(2, '0')}`,
      po_number: `PO-${20000 + index}`,
    };
  });

  const invoiceLines: InvoiceLineRow[] = invoiceHeaders.flatMap((invoice, index) => {
    const lineA = {
      invoice_line_id: `LINE-${pad(index * 2 + 1)}`,
      invoice_id: invoice.invoice_id,
      line_number: 1,
      line_amount: 180 + index * 11 + offset,
      line_description: 'Raw materials lot',
    };
    const lineB = {
      invoice_line_id: `LINE-${pad(index * 2 + 2)}`,
      invoice_id: invoice.invoice_id,
      line_number: 2,
      line_amount: 95 + index * 7 + offset,
      line_description: 'Freight and handling',
    };
    return [lineA, lineB];
  });

  const invoiceExceptions: InvoiceExceptionRow[] = invoiceHeaders.map((invoice, index) => {
    const reason = holdReasons[index % holdReasons.length];
    const line = invoiceLines.find(
      (item) => item.invoice_id === invoice.invoice_id && item.line_number === ((index % 2) + 1)
    );
    return {
      exception_id: `EXC-${pad(index + 1)}`,
      invoice_id: invoice.invoice_id,
      supplier_id: invoice.supplier_id,
      invoice_line_id: line?.invoice_line_id ?? '',
      line_number: line?.line_number ?? 1,
      hold_reason_code: reason.code,
      hold_reason_text: reason.text,
    };
  });

  const payments: PaymentRow[] = invoiceHeaders.map((invoice, index) => {
    const paidRatio = index % 3 === 0 ? 1 : index % 3 === 1 ? 0.75 : 0.5;
    return {
      payment_id: `PAY-${pad(index + 1)}`,
      invoice_id: invoice.invoice_id,
      supplier_id: invoice.supplier_id,
      payment_date: `2026-02-${String(((index + offset) % 28) + 1).padStart(2, '0')}`,
      payment_amount: Number((invoice.invoice_amount * paidRatio).toFixed(2)),
    };
  });

  const credits: CreditRow[] = invoiceHeaders.map((invoice, index) => ({
    credit_id: `CR-${pad(index + 1)}`,
    supplier_id: invoice.supplier_id,
    invoice_id: index % 2 === 0 ? invoice.invoice_id : `INV-${pad(((index + 2) % 10) + 1)}`,
  }));

  return {
    suppliers,
    supplierContacts,
    supplierBanking,
    invoiceHeaders,
    invoiceLines,
    invoiceExceptions,
    payments,
    credits,
  };
};

export const validateDemoDataset = (dataset: DemoDataset): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (dataset.suppliers.length < 10) errors.push('Suppliers must have at least 10 records.');
  if (dataset.supplierContacts.length < 10) errors.push('Supplier Contacts must have at least 10 records.');
  if (dataset.supplierBanking.length < 10) errors.push('Supplier Banking must have at least 10 records.');
  if (dataset.invoiceHeaders.length < 10) errors.push('Invoice Header must have at least 10 records.');
  if (dataset.invoiceLines.length < 20) errors.push('Invoice Lines must have at least 20 records.');
  if (dataset.invoiceExceptions.length < 10) errors.push('Invoice Exceptions must have at least 10 records.');
  if (dataset.payments.length < 10) errors.push('Payments must have at least 10 records.');
  if (dataset.credits.length < 10) errors.push('Credits must have at least 10 records.');

  const supplierIds = new Set(dataset.suppliers.map((item) => item.supplier_id));
  const invoiceById = new Map(dataset.invoiceHeaders.map((item) => [item.invoice_id, item]));
  const lineById = new Map(dataset.invoiceLines.map((item) => [item.invoice_line_id, item]));

  for (const contact of dataset.supplierContacts) {
    if (!supplierIds.has(contact.supplier_id)) {
      errors.push(`Contact ${contact.contact_id} has unknown supplier_id ${contact.supplier_id}`);
    }
  }

  for (const banking of dataset.supplierBanking) {
    if (!supplierIds.has(banking.supplier_id)) {
      errors.push(`Banking ${banking.bank_account_id} has unknown supplier_id ${banking.supplier_id}`);
    }
  }

  for (const invoice of dataset.invoiceHeaders) {
    if (!supplierIds.has(invoice.supplier_id)) {
      errors.push(`Invoice ${invoice.invoice_id} has unknown supplier_id ${invoice.supplier_id}`);
    }

    const lines = dataset.invoiceLines.filter((line) => line.invoice_id === invoice.invoice_id);
    const sum = Number(lines.reduce((acc, item) => acc + Number(item.line_amount), 0).toFixed(2));
    if (sum !== Number(invoice.invoice_amount.toFixed(2))) {
      errors.push(`Invoice ${invoice.invoice_id} total (${invoice.invoice_amount}) does not match line sum (${sum}).`);
    }
  }

  for (const line of dataset.invoiceLines) {
    if (!invoiceById.has(line.invoice_id)) {
      errors.push(`Invoice line ${line.invoice_line_id} has unknown invoice_id ${line.invoice_id}`);
    }
  }

  for (const exception of dataset.invoiceExceptions) {
    const invoice = invoiceById.get(exception.invoice_id);
    if (!invoice) {
      errors.push(`Exception ${exception.exception_id} has unknown invoice_id ${exception.invoice_id}`);
      continue;
    }

    if (exception.supplier_id && exception.supplier_id !== invoice.supplier_id) {
      errors.push(`Exception ${exception.exception_id} supplier mismatch with invoice ${exception.invoice_id}.`);
    }

    if (exception.invoice_line_id) {
      const line = lineById.get(exception.invoice_line_id);
      if (!line || line.invoice_id !== exception.invoice_id) {
        errors.push(`Exception ${exception.exception_id} has invalid invoice_line_id ${exception.invoice_line_id}.`);
      }
    }

    if (exception.line_number) {
      const lineForNumber = dataset.invoiceLines.find(
        (line) => line.invoice_id === exception.invoice_id && line.line_number === exception.line_number
      );
      if (!lineForNumber) {
        errors.push(`Exception ${exception.exception_id} has invalid line_number ${exception.line_number}.`);
      }
    }
  }

  for (const payment of dataset.payments) {
    const invoice = invoiceById.get(payment.invoice_id);
    if (!invoice) {
      errors.push(`Payment ${payment.payment_id} has unknown invoice_id ${payment.invoice_id}`);
      continue;
    }

    if (payment.supplier_id !== invoice.supplier_id) {
      errors.push(`Payment ${payment.payment_id} supplier mismatch with invoice ${payment.invoice_id}.`);
    }

    if (payment.payment_amount > invoice.invoice_amount) {
      errors.push(`Payment ${payment.payment_id} exceeds invoice amount for ${payment.invoice_id}.`);
    }
  }

  for (const credit of dataset.credits) {
    if (!supplierIds.has(credit.supplier_id)) {
      errors.push(`Credit ${credit.credit_id} has unknown supplier_id ${credit.supplier_id}`);
    }
    if (credit.invoice_id && !invoiceById.has(credit.invoice_id)) {
      errors.push(`Credit ${credit.credit_id} has unknown invoice_id ${credit.invoice_id}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
