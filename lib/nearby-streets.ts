export async function nearbyStreets(origin: string, latitude: number, longitude: number) {
  const result = await fetch(origin + '/api/addresses/nearby', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ latitude, longitude }),
  });
  if (!result.ok) throw new Error('Could not look up nearby streets.');
  const data: { streets: string[] } = await result.json();
  return data.streets;
}
