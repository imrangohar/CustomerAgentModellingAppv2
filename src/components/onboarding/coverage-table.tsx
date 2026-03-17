import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CoverageItem {
  key: string;
  label: string;
  requirement: 'mandatory' | 'recommended' | 'optional';
  present: boolean;
}

export function CoverageTable({ title, rows }: { title: string; rows: CoverageItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-app-border text-app-muted">
                <th className="pb-2">Field</th>
                <th className="pb-2">Level</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-app-border/70">
                  <td className="py-2">{row.label}</td>
                  <td className="py-2">
                    <Badge
                      variant={
                        row.requirement === 'mandatory'
                          ? 'danger'
                          : row.requirement === 'recommended'
                          ? 'warning'
                          : 'default'
                      }
                    >
                      {row.requirement}
                    </Badge>
                  </td>
                  <td className="py-2">
                    <Badge
                      variant={
                        row.present
                          ? 'success'
                          : row.requirement === 'mandatory'
                          ? 'danger'
                          : 'warning'
                      }
                    >
                      {row.present ? 'Present' : 'Missing'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
