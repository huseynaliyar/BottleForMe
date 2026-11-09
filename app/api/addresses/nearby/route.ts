import roads from '@/data/malta-streets.json';
import { failure, response } from '@/lib/pickups-server';

const streets = roads as [string, number[]][];

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const lat = body?.latitude;
  const lon = body?.longitude;
  if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return failure('Could not read your GPS position.', 400);
  }
  if (lat < 35.79 || lat > 36.10 || lon < 14.16 || lon > 14.60) return response({ streets: [] });
  const y = lat * 100000;
  const x = lon * 100000;
  const scale = Math.cos(lat * Math.PI / 180);
  const radiusSquared = 600 ** 2;
  const nearby: { name: string; distance: number }[] = [];
  for (const [name, points] of streets) {
    let best = radiusSquared;
    for (let index = 0; index < points.length; index += 2) {
      const dy = (points[index] - y) * 1.11;
      const dx = (points[index + 1] - x) * 1.11 * scale;
      const distance = dx * dx + dy * dy;
      if (distance < best) best = distance;
    }
    if (best < radiusSquared) nearby.push({ name, distance: best });
  }
  nearby.sort((a, b) => a.distance - b.distance);
  return response({ streets: nearby.slice(0, 8).map(({ name }) => name) });
}
