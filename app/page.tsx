import Marketplace from '@/components/Marketplace';

export default async function HomePage({ searchParams }: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  return <Marketplace initialView={view === 'pickups' || view === 'profile' ? view : undefined} />;
}
