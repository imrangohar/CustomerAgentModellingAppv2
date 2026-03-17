import { notFound } from 'next/navigation';
import { AgentModelWorkspace, type AgentModelPanel } from '@/components/agent-model/workspace';

const validPanels: AgentModelPanel[] = ['admin', 'customers', 'prospect'];

export default async function AgentModelPanelPage({
  params,
}: {
  params: Promise<{ panel: string }>;
}) {
  const { panel } = await params;
  if (!validPanels.includes(panel as AgentModelPanel)) {
    notFound();
  }

  return <AgentModelWorkspace panel={panel as AgentModelPanel} />;
}
