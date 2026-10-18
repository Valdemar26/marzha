import type { SupabaseClient } from '@supabase/supabase-js';
import { COST_LINE_KINDS, type CostLine, type CostLineKind, calculate } from '../../shared/calc/index';
import type { Product, ProductInput } from '../../shared/api/products';

interface CostLineRow {
  id: string;
  product_id: string;
  name: string;
  kind: CostLineKind;
  quantity: number | null;
  unit_price: number | null;
  hours: number | null;
  rate: number | null;
  amount: number | null;
  percent: number | null;
  position: number;
}

interface ProductRow {
  id: string;
  name: string;
  sale_price: number;
  currency: string;
  return_rate: number;
  return_cost: number;
  created_at: string;
  updated_at: string;
  cost_lines: CostLineRow[];
}

const PRODUCT_SELECT = '*, cost_lines(*)';
const MAX_NAME_LENGTH = 200;
const MAX_LINES = 100;

/** Fields stored for each kind; everything else is dropped on save. */
const KIND_FIELDS: Record<CostLineKind, readonly (keyof CostLine)[]> = {
  material: ['quantity', 'unitPrice'],
  labor: ['hours', 'rate'],
  fixed: ['amount'],
  percent: ['percent'],
};

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export function serverError(error: unknown): Response {
  console.error(error);
  return json({ error: 'Database error' }, 500);
}

export async function readProductInput(request: Request): Promise<ProductInput | Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Body must be JSON' }, 400);
  }
  const result = parseProductInput(body);
  return typeof result === 'string' ? json({ error: result }, 400) : result;
}

export function parseProductInput(body: unknown): ProductInput | string {
  if (!isRecord(body)) {
    return 'Body must be an object';
  }

  const name = parseName(body['name']);
  if (name === null) {
    return `name must be a non-empty string of at most ${MAX_NAME_LENGTH} characters`;
  }
  if (!isNonNegative(body['salePrice'])) {
    return 'salePrice must be a non-negative number';
  }
  if (!isNonNegative(body['returnRate']) || body['returnRate'] >= 1) {
    return 'returnRate must be a number in [0, 1)';
  }
  if (!isNonNegative(body['returnCost'])) {
    return 'returnCost must be a non-negative number';
  }
  const currency = body['currency'];
  if (currency !== undefined && (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency))) {
    return 'currency must be a 3-letter ISO code';
  }
  const rawLines = body['lines'];
  if (!Array.isArray(rawLines) || rawLines.length > MAX_LINES) {
    return `lines must be an array of at most ${MAX_LINES} items`;
  }

  const lines: CostLine[] = [];
  for (const [index, rawLine] of rawLines.entries()) {
    const line = parseCostLine(rawLine);
    if (typeof line === 'string') {
      return `lines[${index}]: ${line}`;
    }
    lines.push(line);
  }

  return {
    name,
    salePrice: body['salePrice'],
    ...(currency !== undefined && { currency }),
    returnRate: body['returnRate'],
    returnCost: body['returnCost'],
    lines,
  };
}

function parseCostLine(raw: unknown): CostLine | string {
  if (!isRecord(raw)) {
    return 'must be an object';
  }
  const name = parseName(raw['name']);
  if (name === null) {
    return `name must be a non-empty string of at most ${MAX_NAME_LENGTH} characters`;
  }
  const kind = raw['kind'];
  if (!COST_LINE_KINDS.includes(kind as CostLineKind)) {
    return `kind must be one of ${COST_LINE_KINDS.join(', ')}`;
  }
  const line: CostLine = { name, kind: kind as CostLineKind };
  for (const field of KIND_FIELDS[line.kind]) {
    const value = raw[field];
    if (value === undefined || value === null) {
      continue;
    }
    if (!isNonNegative(value) || (field === 'percent' && value > 1)) {
      return field === 'percent'
        ? 'percent must be a number in [0, 1]'
        : `${field} must be a non-negative number`;
    }
    Object.assign(line, { [field]: value });
  }
  return line;
}

function parseName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_NAME_LENGTH ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function toProduct(row: ProductRow): Product {
  const lines = [...row.cost_lines]
    .sort((a, b) => a.position - b.position)
    .map((lineRow): CostLine => {
      const line: CostLine = { name: lineRow.name, kind: lineRow.kind };
      if (lineRow.quantity !== null) line.quantity = Number(lineRow.quantity);
      if (lineRow.unit_price !== null) line.unitPrice = Number(lineRow.unit_price);
      if (lineRow.hours !== null) line.hours = Number(lineRow.hours);
      if (lineRow.rate !== null) line.rate = Number(lineRow.rate);
      if (lineRow.amount !== null) line.amount = Number(lineRow.amount);
      if (lineRow.percent !== null) line.percent = Number(lineRow.percent);
      return line;
    });

  const input = {
    salePrice: Number(row.sale_price),
    returnRate: Number(row.return_rate),
    returnCost: Number(row.return_cost),
    lines,
  };
  const { priceForMargin: _, ...result } = calculate(input);

  return {
    id: row.id,
    name: row.name,
    currency: row.currency,
    ...input,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    result,
  };
}

function toProductColumns(input: ProductInput) {
  return {
    name: input.name,
    sale_price: input.salePrice,
    ...(input.currency !== undefined && { currency: input.currency }),
    return_rate: input.returnRate,
    return_cost: input.returnCost,
  };
}

function toCostLineRows(productId: string, lines: CostLine[]) {
  return lines.map((line, position) => ({
    product_id: productId,
    name: line.name,
    kind: line.kind,
    quantity: line.quantity ?? null,
    unit_price: line.unitPrice ?? null,
    hours: line.hours ?? null,
    rate: line.rate ?? null,
    amount: line.amount ?? null,
    percent: line.percent ?? null,
    position,
  }));
}

export async function listProducts(client: SupabaseClient): Promise<Product[]> {
  const { data, error } = await client
    .from('products')
    .select(PRODUCT_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as ProductRow[]).map(toProduct);
}

export async function getProduct(client: SupabaseClient, id: string): Promise<Product | null> {
  const { data, error } = await client.from('products').select(PRODUCT_SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toProduct(data as ProductRow) : null;
}

export async function createProduct(client: SupabaseClient, input: ProductInput): Promise<Product> {
  const { data, error } = await client.from('products').insert(toProductColumns(input)).select('id').single();
  if (error) throw error;
  const id = (data as { id: string }).id;

  if (input.lines.length > 0) {
    const { error: linesError } = await client.from('cost_lines').insert(toCostLineRows(id, input.lines));
    if (linesError) {
      await client.from('products').delete().eq('id', id);
      throw linesError;
    }
  }

  const product = await getProduct(client, id);
  if (!product) throw new Error(`Product ${id} vanished after insert`);
  return product;
}

/** Replaces the product's fields and cost lines. Returns null if the product doesn't exist (or isn't the user's). */
export async function updateProduct(
  client: SupabaseClient,
  id: string,
  input: ProductInput,
): Promise<Product | null> {
  const { data: updated, error } = await client
    .from('products')
    .update(toProductColumns(input))
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (updated.length === 0) return null;

  const { data: oldLines, error: oldLinesError } = await client
    .from('cost_lines')
    .select('id')
    .eq('product_id', id);
  if (oldLinesError) throw oldLinesError;

  // Insert the new lines before removing the old ones, so a failed insert never loses data.
  if (input.lines.length > 0) {
    const { error: insertError } = await client.from('cost_lines').insert(toCostLineRows(id, input.lines));
    if (insertError) throw insertError;
  }
  const oldIds = (oldLines as { id: string }[]).map((line) => line.id);
  if (oldIds.length > 0) {
    const { error: deleteError } = await client.from('cost_lines').delete().in('id', oldIds);
    if (deleteError) throw deleteError;
  }

  return getProduct(client, id);
}

/** Returns false if the product doesn't exist (or isn't the user's). */
export async function deleteProduct(client: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await client.from('products').delete().eq('id', id).select('id');
  if (error) throw error;
  return data.length > 0;
}
