import { AdminPanel } from '@/components/admin-panel';
export default async function Page({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section } = await params;
  return <AdminPanel section={section?.[0]} />;
}
