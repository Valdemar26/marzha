import type { SupabaseClient } from '@supabase/supabase-js';
import { authenticate } from '../_lib/auth';
import { parseBatchInput } from '../_lib/batch-input';
import { deleteBatch, getBatch, updateBatch } from '../_lib/batches';
import { UUID_PATTERN, json, readBody, serverError } from '../_lib/http';

const notFound = () => json({ error: 'Batch not found' }, 404);

/** Authenticates and extracts a valid batch id from /api/batches/:id. */
async function prepare(request: Request): Promise<{ client: SupabaseClient; id: string } | Response> {
  const client = await authenticate(request);
  if (client instanceof Response) return client;

  const id = decodeURIComponent(new URL(request.url).pathname.split('/').pop() ?? '');
  return UUID_PATTERN.test(id) ? { client, id } : notFound();
}

export async function GET(request: Request): Promise<Response> {
  const ctx = await prepare(request);
  if (ctx instanceof Response) return ctx;

  try {
    const batch = await getBatch(ctx.client, ctx.id);
    return batch ? json(batch) : notFound();
  } catch (error) {
    return serverError(error);
  }
}

export async function PUT(request: Request): Promise<Response> {
  const ctx = await prepare(request);
  if (ctx instanceof Response) return ctx;

  const input = await readBody(request, parseBatchInput);
  if (input instanceof Response) return input;

  try {
    const batch = await updateBatch(ctx.client, ctx.id, input);
    return batch ? json(batch) : notFound();
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const ctx = await prepare(request);
  if (ctx instanceof Response) return ctx;

  try {
    return (await deleteBatch(ctx.client, ctx.id)) ? new Response(null, { status: 204 }) : notFound();
  } catch (error) {
    return serverError(error);
  }
}
