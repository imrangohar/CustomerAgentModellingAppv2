'use client';

import { agentCatalog } from '@/lib/agentCatalog';
import type { MissingFieldInfo } from '@/lib/readinessEngine';
import { AgentId, ReadinessStatus } from '@/types/onboarding';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const statusVariant: Record<ReadinessStatus, 'success' | 'warning' | 'danger'> = {
  ready: 'success',
  degraded: 'warning',
  blocked: 'danger',
};

const groupByDomain = (
  fields: MissingFieldInfo[]
): Array<{ domain: string; items: MissingFieldInfo[] }> => {
  const map = new Map<string, MissingFieldInfo[]>();
  for (const field of fields) {
    const key = field.domainLabel || 'General';
    const existing = map.get(key) ?? [];
    existing.push(field);
    map.set(key, existing);
  }
  return Array.from(map.entries()).map(([domain, items]) => ({ domain, items }));
};

export function AgentCard({
  agentId,
  enabled,
  status,
  missingMandatory,
  missingRecommended,
  missingOptional,
  notes,
  onToggle,
  emailWarning,
  toggleDisabled,
  toggleWarning,
}: {
  agentId: AgentId;
  enabled: boolean;
  status: ReadinessStatus;
  missingMandatory: MissingFieldInfo[];
  missingRecommended: MissingFieldInfo[];
  missingOptional: MissingFieldInfo[];
  notes: string[];
  onToggle: (enabled: boolean) => void;
  emailWarning?: string;
  toggleDisabled?: boolean;
  toggleWarning?: string;
}) {
  const agent = agentCatalog.find((item) => item.key === agentId);
  if (!agent) return null;
  const missingMandatoryByDomain = groupByDomain(missingMandatory);
  const missingRecommendedByDomain = groupByDomain(missingRecommended);
  const optionalByDomain = groupByDomain(missingOptional);

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{agent.name}</CardTitle>
            <CardDescription className="mt-1">{agent.description}</CardDescription>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Switch checked={enabled} onCheckedChange={onToggle} disabled={toggleDisabled} />
                </div>
              </TooltipTrigger>
              {toggleWarning && <TooltipContent>{toggleWarning}</TooltipContent>}
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs text-app-muted">Data readiness</div>
          <Badge variant={statusVariant[status]}>{status.toUpperCase()}</Badge>
        </div>
        {missingMandatory.length > 0 && (
          <p className="text-xs text-rose-700">
            Missing mandatory: {missingMandatory.slice(0, 2).map((item) => item.label).join(', ')}
          </p>
        )}
        {missingMandatory.length === 0 && missingRecommended.length > 0 && (
          <p className="text-xs text-orange-700">
            Missing recommended: {missingRecommended.slice(0, 2).map((item) => item.label).join(', ')}
          </p>
        )}
        {emailWarning && <p className="text-xs text-orange-700">{emailWarning}</p>}
        {toggleWarning && status === 'degraded' && <p className="text-xs text-orange-700">{toggleWarning}</p>}
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary">
            Review / Edit
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost">
                Why?
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{agent.name} readiness details</DialogTitle>
                <DialogDescription>
                  Missing fields impact what this agent can automate.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                {(agent.inputs?.length || agent.outputs?.length) && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="font-medium">Inputs</div>
                      <ul className="list-disc pl-5 text-app-muted">
                        {(agent.inputs ?? []).map((item) => (
                          <li key={`in-${item}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="font-medium">Outputs</div>
                      <ul className="list-disc pl-5 text-app-muted">
                        {(agent.outputs ?? []).map((item) => (
                          <li key={`out-${item}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                <div>
                  <div className="font-medium">Mandatory gaps</div>
                  <ul className="list-disc pl-5 text-app-muted">
                    {missingMandatory.length === 0 && <li>None</li>}
                    {missingMandatoryByDomain.map((group) => (
                      <li key={`m-group-${group.domain}`}>
                        {group.domain}: {group.items.map((item) => item.label).join(', ')}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="font-medium">Recommended gaps</div>
                  <ul className="list-disc pl-5 text-app-muted">
                    {missingRecommended.length === 0 && <li>None</li>}
                    {missingRecommendedByDomain.map((group) => (
                      <li key={`r-group-${group.domain}`}>
                        {group.domain}: {group.items.map((item) => item.label).join(', ')}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="font-medium">Nice-to-have / optional missing</div>
                  <ul className="list-disc pl-5 text-app-muted">
                    {missingOptional.length === 0 && <li>None</li>}
                    {optionalByDomain.map((group) => (
                      <li key={`o-group-${group.domain}`}>
                        {group.domain}: {group.items.map((item) => item.label).join(', ')}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="font-medium">What happens if missing?</div>
                  <ul className="list-disc pl-5 text-app-muted">
                    {notes.length === 0 && <li>No known impact.</li>}
                    {notes.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
