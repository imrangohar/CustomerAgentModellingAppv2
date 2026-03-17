'use client';

interface Account {
  code: string;
  name: string;
  type: string;
  active: boolean;
}

export function AccountPicker({
  accounts,
  value,
  onChange,
}: {
  accounts: Account[];
  value?: string;
  onChange: (next: string) => void;
}) {
  return (
    <select
      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select account</option>
      {accounts
        .filter((a) => a.active)
        .map((a) => (
          <option key={a.code} value={a.code}>
            {a.code} - {a.name} ({a.type})
          </option>
        ))}
    </select>
  );
}
