'use client';
import { use } from 'react';
import { ResourcePage } from '@/components/resource-page';
import { LeadsCRM } from '@/components/leads-crm';
import { Connections, Team, Billing, Settings } from '@/components/settings-pages';
import { WorkflowBuilder } from '@/components/workflow-builder';
import { Overview } from '@/components/overview';
import { useWorkspace } from '@/components/shell';
import { Empty } from '@/components/shared';
import { Suspense } from 'react';
export default function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = use(params),
    { workspaceId, user } = useWorkspace();
  const kind: Record<string, string> = {
    leads: 'leads',
    forms: 'forms',
    'lead-magnets': 'magnets',
    store: 'products',
    courses: 'courses',
    automations: 'automations',
    autodm: 'automations',
    support: 'support',
  };
  return (
    <Suspense>
      {section === 'leads' ? (
        <LeadsCRM key={workspaceId} />
      ) : kind[section] ? (
        <ResourcePage key={section} kind={kind[section]} />
      ) : section === 'social-accounts' ? (
        <Connections />
      ) : section === 'team' ? (
        <Team />
      ) : section === 'billing' ? (
        <Billing />
      ) : section === 'settings' ? (
        <Settings />
      ) : section === 'workflows' ? (
        <WorkflowBuilder />
      ) : section === 'analytics' ? (
        <Overview workspaceId={workspaceId} name={user.name} analytics />
      ) : (
        <Empty title="Page not found" description="Choose a page from the sidebar." />
      )}
    </Suspense>
  );
}
