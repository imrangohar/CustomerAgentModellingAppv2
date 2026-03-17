import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Workspace Settings</CardTitle>
          <CardDescription>Placeholder page for provider credentials, policy controls, and user roles.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-app-muted">
          In a production build this section would include RBAC, SLA policies, escalation paths, and audit controls.
        </CardContent>
      </Card>
    </div>
  );
}
