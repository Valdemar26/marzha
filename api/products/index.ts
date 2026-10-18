import { authenticate } from '../_lib/auth';
import { createProduct, json, listProducts, readProductInput, serverError } from '../_lib/products';

export async function GET(request: Request): Promise<Response> {
  const client = await authenticate(request);
  if (client instanceof Response) return client;

  try {
    return json(await listProducts(client));
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  const client = await authenticate(request);
  if (client instanceof Response) return client;

  const input = await readProductInput(request);
  if (input instanceof Response) return input;

  try {
    return json(await createProduct(client, input), 201);
  } catch (error) {
    return serverError(error);
  }
}
