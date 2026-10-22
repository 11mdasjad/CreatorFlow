'use client';
import { Overview } from '@/components/overview';
import { useWorkspace } from '@/components/shell';
export default function Page() {
  const { workspaceId, user } = useWorkspace();
  return <Overview workspaceId={workspaceId} name={user.name} />;
}
