import { notFound } from 'next/navigation';
import Marketplace from '@/components/Marketplace';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ chat?: string }> };

export default async function PickupPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  return <Marketplace key={id + ':' + (query.chat === '1')} initialPickup={id} initialChat={query.chat === '1'} />;
}
