export async function emailAuthRequest<T>(origin: string, input: Record<string, string>) {
  const response = await fetch(origin + '/api/auth/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) {
    throw Object.assign(new Error(body?.error ?? 'Could not reach the account service.'), {
      code: body?.code,
      retryAfter: body?.retryAfter,
    });
  }
  return body as T;
}
