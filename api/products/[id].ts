import type { SupabaseClient } from '@supabase/supabase-js';
import { authenticate } from '../_lib/auth';
import {
  UUID_PATTERN,
  deleteProduct,
  getProduct,
  json,
  readProductInput,
  serverError,
  updateProduct,
} from '../_lib/products';

const notFound = () => json({ error: 'Product not found' }, 404);

/** Authenticates and extracts a valid product id from /api/products/:id. */
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
    const product = await getProduct(ctx.client, ctx.id);
    return product ? json(product) : notFound();
  } catch (error) {
    return serverError(error);
  }
}

export async function PUT(request: Request): Promise<Response> {
  const ctx = await prepare(request);
  if (ctx instanceof Response) return ctx;

  const input = await readProductInput(request);
  if (input instanceof Response) return input;

  try {
    const product = await updateProduct(ctx.client, ctx.id, input);
    return product ? json(product) : notFound();
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const ctx = await prepare(request);
  if (ctx instanceof Response) return ctx;

  try {
    return (await deleteProduct(ctx.client, ctx.id)) ? new Response(null, { status: 204 }) : notFound();
  } catch (error) {
    return serverError(error);
  }
}
