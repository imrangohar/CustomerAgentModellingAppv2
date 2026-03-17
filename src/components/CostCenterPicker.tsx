'use client';

interface CostCenter {
  id: string;
  name: string;
  active: boolean;
  entity?: string;
}

export function CostCenterPicker({
  costCenters,
  value,
  onChange,
}: {
  costCenters: CostCenter[];
  value?: string;
  onChange: (next: string) => void;
}) {
  return (
    <select
      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select cost center</option>
      {costCenters
        .filter((c) => c.active)
        .map((c) => (
          <option key={c.id} value={c.id}>
            {c.id} - {c.name} {c.entity ? `(${c.entity})` : ''}
          </option>
        ))}
    </select>
  );
}
