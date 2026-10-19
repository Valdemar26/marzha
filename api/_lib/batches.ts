import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { type BatchCost, type CostKind, type Stage, analyzeScenario } from '../../shared/calc/index';
import type { BatchInput, SavedBatch, SavedScenario } from '../../shared/api/batches';

interface CostRow {
  id: string;
  batch_id: string;
  name: string;
  kind: CostKind;
  amount: number | null;
  percent: number | null;
  position: number;
}

interface StageRow {
  id: string;
  scenario_id: string;
  share: number;
  discount: number;
  months: number;
  position: number;
}

interface ScenarioRow {
  id: string;
  batch_id: string;
  name: string;
  position: number;
  scenario_stages: StageRow[];
}

interface BatchRow {
  id: string;
  name: string;
  quantity: number;
  currency: string;
  defect_rate: number;
  target_profit: number;
  competitor_price: number | null;
  base_price: number | null;
  sales_start_date: string | null;
  created_at: string;
  updated_at: string;
  batch_costs: CostRow[];
  scenarios: ScenarioRow[];
}

const BATCH_SELECT = '*, batch_costs(*), scenarios(*, scenario_stages(*))';

const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;

/** Postgres numerics arrive as strings or numbers depending on size; normalize to number. */
function toBatch(row: BatchRow): SavedBatch {
  const costs = [...row.batch_costs].sort(byPosition).map(
    (costRow): BatchCost =>
      costRow.kind === 'per_sale_percent'
        ? { name: costRow.name, kind: costRow.kind, percent: Number(costRow.percent) }
        : { name: costRow.name, kind: costRow.kind, amount: Number(costRow.amount) },
  );
  const fields = {
    name: row.name,
    quantity: Number(row.quantity),
    currency: row.currency,
    defectRate: Number(row.defect_rate),
    targetProfit: Number(row.target_profit),
    competitorPrice: row.competitor_price === null ? null : Number(row.competitor_price),
    basePrice: row.base_price === null ? null : Number(row.base_price),
    salesStartDate: row.sales_start_date,
  };
  const calcBatch = { quantity: fields.quantity, defectRate: fields.defectRate, currency: row.currency, costs };

  const scenarios = [...row.scenarios].sort(byPosition).map((scenarioRow): SavedScenario => {
    const stages = [...scenarioRow.scenario_stages].sort(byPosition).map(
      (stageRow): Stage => ({
        share: Number(stageRow.share),
        discount: Number(stageRow.discount),
        months: Number(stageRow.months),
      }),
    );
    const analysis = analyzeScenario(calcBatch, { stages });
    return {
      id: scenarioRow.id,
      name: scenarioRow.name,
      stages,
      result: {
        sellableUnits: analysis.sellableUnits,
        totalMonths: analysis.totalMonths,
        sharesTotal: analysis.sharesTotal,
        validation: analysis.validation,
        breakEvenPrice: analysis.breakEvenPrice,
        targetPrice: analysis.priceForProfit(fields.targetProfit),
        stageUnits: stages.map((stage) => analysis.sellableUnits * stage.share),
        profitAtBasePrice: fields.basePrice === null ? null : analysis.profitAt(fields.basePrice),
      },
    };
  });

  return { id: row.id, ...fields, costs, scenarios, createdAt: row.created_at, updatedAt: row.updated_at };
}

function toBatchColumns(input: BatchInput) {
  return {
    name: input.name,
    quantity: input.quantity,
    ...(input.currency !== undefined && { currency: input.currency }),
    defect_rate: input.defectRate,
    target_profit: input.targetProfit,
    competitor_price: input.competitorPrice,
    base_price: input.basePrice,
    sales_start_date: input.salesStartDate,
  };
}

/** Ids of rows inserted by insertChildren, so a failed save can be rolled back. */
interface ChildIds {
  costIds: string[];
  scenarioIds: string[];
}

/**
 * Inserts costs, scenarios and stages for a batch. Ids are generated here so stages can reference
 * their scenario without relying on the order of returned rows. On failure, removes what it inserted.
 */
async function insertChildren(client: SupabaseClient, batchId: string, input: BatchInput): Promise<ChildIds> {
  const costRows = input.costs.map((cost, position) => ({
    id: randomUUID(),
    batch_id: batchId,
    name: cost.name,
    kind: cost.kind,
    amount: cost.amount ?? null,
    percent: cost.percent ?? null,
    position,
  }));
  const scenarioRows = input.scenarios.map((scenario, position) => ({
    id: randomUUID(),
    batch_id: batchId,
    name: scenario.name,
    position,
  }));
  const stageRows = input.scenarios.flatMap((scenario, scenarioIndex) =>
    scenario.stages.map((stage, position) => ({
      scenario_id: scenarioRows[scenarioIndex].id,
      share: stage.share,
      discount: stage.discount,
      months: stage.months,
      position,
    })),
  );
  const ids: ChildIds = { costIds: costRows.map((r) => r.id), scenarioIds: scenarioRows.map((r) => r.id) };

  try {
    if (costRows.length > 0) {
      const { error } = await client.from('batch_costs').insert(costRows);
      if (error) throw error;
    }
    if (scenarioRows.length > 0) {
      const { error } = await client.from('scenarios').insert(scenarioRows);
      if (error) throw error;
    }
    if (stageRows.length > 0) {
      const { error } = await client.from('scenario_stages').insert(stageRows);
      if (error) throw error;
    }
  } catch (error) {
    await deleteChildren(client, ids);
    throw error;
  }
  return ids;
}

/** Deleting a scenario cascades to its stages. */
async function deleteChildren(client: SupabaseClient, { costIds, scenarioIds }: ChildIds): Promise<void> {
  if (costIds.length > 0) {
    const { error } = await client.from('batch_costs').delete().in('id', costIds);
    if (error) throw error;
  }
  if (scenarioIds.length > 0) {
    const { error } = await client.from('scenarios').delete().in('id', scenarioIds);
    if (error) throw error;
  }
}

export async function listBatches(client: SupabaseClient): Promise<SavedBatch[]> {
  const { data, error } = await client
    .from('batches')
    .select(BATCH_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as BatchRow[]).map(toBatch);
}

export async function getBatch(client: SupabaseClient, id: string): Promise<SavedBatch | null> {
  const { data, error } = await client.from('batches').select(BATCH_SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toBatch(data as BatchRow) : null;
}

export async function createBatch(client: SupabaseClient, input: BatchInput): Promise<SavedBatch> {
  const { data, error } = await client.from('batches').insert(toBatchColumns(input)).select('id').single();
  if (error) throw error;
  const id = (data as { id: string }).id;

  try {
    await insertChildren(client, id, input);
  } catch (childError) {
    await client.from('batches').delete().eq('id', id);
    throw childError;
  }

  const batch = await getBatch(client, id);
  if (!batch) throw new Error(`Batch ${id} vanished after insert`);
  return batch;
}

/** Replaces the batch's fields, costs and scenarios. Returns null if the batch doesn't exist (or isn't the user's). */
export async function updateBatch(client: SupabaseClient, id: string, input: BatchInput): Promise<SavedBatch | null> {
  const { data: updated, error } = await client.from('batches').update(toBatchColumns(input)).eq('id', id).select('id');
  if (error) throw error;
  if (updated.length === 0) return null;

  const [oldCosts, oldScenarios] = await Promise.all([
    client.from('batch_costs').select('id').eq('batch_id', id),
    client.from('scenarios').select('id').eq('batch_id', id),
  ]);
  if (oldCosts.error) throw oldCosts.error;
  if (oldScenarios.error) throw oldScenarios.error;

  // Insert the new children before removing the old ones, so a failed insert never loses data.
  await insertChildren(client, id, input);
  await deleteChildren(client, {
    costIds: (oldCosts.data as { id: string }[]).map((row) => row.id),
    scenarioIds: (oldScenarios.data as { id: string }[]).map((row) => row.id),
  });

  return getBatch(client, id);
}

/** Returns false if the batch doesn't exist (or isn't the user's). Children go with it via cascade. */
export async function deleteBatch(client: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await client.from('batches').delete().eq('id', id).select('id');
  if (error) throw error;
  return data.length > 0;
}
