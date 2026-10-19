import { COST_KINDS, type BatchCost, type CostKind, type Stage } from '../../shared/calc/index';
import type { BatchInput, ScenarioInput } from '../../shared/api/batches';

const MAX_NAME_LENGTH = 200;
const MAX_COSTS = 100;
const MAX_SCENARIOS = 20;
const MAX_STAGES = 50;
const MAX_STAGE_MONTHS = 120;

/** Validates a /api/batches request body. Returns the normalized input or an error message. */
export function parseBatchInput(body: unknown): BatchInput | string {
  if (!isRecord(body)) {
    return 'Body must be an object';
  }

  const name = parseName(body['name']);
  if (name === null) {
    return `name must be a non-empty string of at most ${MAX_NAME_LENGTH} characters`;
  }
  const quantity = body['quantity'];
  if (!isNonNegative(quantity) || quantity === 0) {
    return 'quantity must be a positive number';
  }
  const currency = body['currency'];
  if (currency !== undefined && (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency))) {
    return 'currency must be a 3-letter ISO code';
  }
  const defectRate = body['defectRate'];
  if (!isNonNegative(defectRate) || defectRate >= 1) {
    return 'defectRate must be a number in [0, 1)';
  }
  const targetProfit = body['targetProfit'];
  if (!isNonNegative(targetProfit)) {
    return 'targetProfit must be a non-negative number';
  }
  const competitorPrice = body['competitorPrice'] ?? null;
  if (competitorPrice !== null && !isNonNegative(competitorPrice)) {
    return 'competitorPrice must be a non-negative number or null';
  }
  const basePrice = body['basePrice'] ?? null;
  if (basePrice !== null && !isNonNegative(basePrice)) {
    return 'basePrice must be a non-negative number or null';
  }
  const salesStartDate = body['salesStartDate'] ?? null;
  if (salesStartDate !== null && !isIsoDate(salesStartDate)) {
    return 'salesStartDate must be a YYYY-MM-DD date or null';
  }

  const costs = parseList(body['costs'], 'costs', MAX_COSTS, parseCost);
  if (typeof costs === 'string') return costs;
  const scenarios = parseList(body['scenarios'], 'scenarios', MAX_SCENARIOS, parseScenario);
  if (typeof scenarios === 'string') return scenarios;

  return {
    name,
    quantity,
    ...(currency !== undefined && { currency }),
    defectRate,
    targetProfit,
    competitorPrice,
    basePrice,
    salesStartDate,
    costs,
    scenarios,
  };
}

function parseCost(raw: unknown): BatchCost | string {
  if (!isRecord(raw)) {
    return 'must be an object';
  }
  const name = parseName(raw['name']);
  if (name === null) {
    return `name must be a non-empty string of at most ${MAX_NAME_LENGTH} characters`;
  }
  const kind = raw['kind'];
  if (!COST_KINDS.includes(kind as CostKind)) {
    return `kind must be one of ${COST_KINDS.join(', ')}`;
  }
  if (kind === 'per_sale_percent') {
    const percent = raw['percent'];
    return isNonNegative(percent) && percent <= 1
      ? { name, kind, percent }
      : 'percent must be a number in [0, 1]';
  }
  const amount = raw['amount'];
  return isNonNegative(amount) ? { name, kind: kind as CostKind, amount } : 'amount must be a non-negative number';
}

function parseScenario(raw: unknown): ScenarioInput | string {
  if (!isRecord(raw)) {
    return 'must be an object';
  }
  const name = parseName(raw['name']);
  if (name === null) {
    return `name must be a non-empty string of at most ${MAX_NAME_LENGTH} characters`;
  }
  const stages = parseList(raw['stages'], 'stages', MAX_STAGES, parseStage);
  return typeof stages === 'string' ? stages : { name, stages };
}

function parseStage(raw: unknown): Stage | string {
  if (!isRecord(raw)) {
    return 'must be an object';
  }
  const { share, discount, months } = raw;
  if (!isNonNegative(share) || share > 1) {
    return 'share must be a number in [0, 1]';
  }
  if (!isNonNegative(discount) || discount > 1) {
    return 'discount must be a number in [0, 1]';
  }
  if (!isNonNegative(months) || months > MAX_STAGE_MONTHS) {
    return `months must be a number in [0, ${MAX_STAGE_MONTHS}]`;
  }
  return { share, discount, months };
}

function parseList<T>(
  raw: unknown,
  field: string,
  max: number,
  parseItem: (item: unknown) => T | string,
): T[] | string {
  if (!Array.isArray(raw) || raw.length > max) {
    return `${field} must be an array of at most ${max} items`;
  }
  const items: T[] = [];
  for (const [index, rawItem] of raw.entries()) {
    const item = parseItem(rawItem);
    if (typeof item === 'string') {
      return `${field}[${index}]: ${item}`;
    }
    items.push(item);
  }
  return items;
}

function parseName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_NAME_LENGTH ? trimmed : null;
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  // Rejects dates that don't exist, like 2026-02-30 (Date would roll it over to March).
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
