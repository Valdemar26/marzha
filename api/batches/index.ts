import { authenticate } from '../_lib/auth';
import { parseBatchInput } from '../_lib/batch-input';
import { createBatch, listBatches } from '../_lib/batches';
import { json, readBody, serverError } from '../_lib/http';

export async function GET(request: Request): Promise<Response> {
  const client = await authenticate(request);
  if (client instanceof Response) return client;

  try {
    return json(await listBatches(client));
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  const client = await authenticate(request);
  if (client instanceof Response) return client;

  const input = await readBody(request, parseBatchInput);
  if (input instanceof Response) return input;

  try {
    return json(await createBatch(client, input), 201);
  } catch (error) {
    return serverError(error);
  }
}
