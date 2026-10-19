export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export function serverError(error: unknown): Response {
  console.error(error);
  return json({ error: 'Database error' }, 500);
}

/** Reads a JSON body and runs it through `parse`, which returns either the parsed value or an error message. */
export async function readBody<T>(request: Request, parse: (body: unknown) => T | string): Promise<T | Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Body must be JSON' }, 400);
  }
  const result = parse(body);
  return typeof result === 'string' ? json({ error: result }, 400) : result;
}
