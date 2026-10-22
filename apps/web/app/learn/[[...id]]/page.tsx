import { Learn } from '@/components/public-experiences';
export default async function Page({ params }: { params: Promise<{ id?: string[] }> }) {
  const { id } = await params;
  return <Learn ids={id} />;
}
