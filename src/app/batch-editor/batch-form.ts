import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, Validators } from '@angular/forms';
import type { BatchInput, SavedBatch, ScenarioInput } from '@shared/api/batches';
import type { Batch, BatchCost, CostKind, Scenario, Stage } from '@shared/calc';

// Percent fields (defect rate, cost percent, stage share and discount) hold 0..100 in the form
// and fractions 0..1 in BatchInput / calc.

export const CURRENCIES = ['UAH', 'USD', 'EUR', 'PLN'] as const;

export type CostGroup = FormGroup<{
  name: FormControl<string>;
  kind: FormControl<CostKind>;
  amount: FormControl<number | null>;
  percent: FormControl<number | null>;
}>;

export type StageGroup = FormGroup<{
  share: FormControl<number | null>;
  discount: FormControl<number | null>;
  months: FormControl<number | null>;
}>;

export type ScenarioGroup = FormGroup<{
  name: FormControl<string>;
  stages: FormArray<StageGroup>;
}>;

export type BatchForm = ReturnType<typeof createBatchForm>;
export type BatchFormValue = ReturnType<BatchForm['getRawValue']>;

const name = (fb: NonNullableFormBuilder, value = '') =>
  fb.control(value, [Validators.required, Validators.maxLength(200)]);
const percent = (fb: NonNullableFormBuilder, value: number | null, max = 100) =>
  fb.control<number | null>(value, [Validators.min(0), Validators.max(max)]);

export function createBatchForm(fb: NonNullableFormBuilder) {
  return fb.group({
    name: name(fb),
    quantity: fb.control<number | null>(null, [Validators.required, Validators.min(0.000001)]),
    currency: fb.control<string>('UAH'),
    defectRate: percent(fb, 0, 99),
    targetProfit: fb.control<number | null>(null, Validators.min(0)),
    competitorPrice: fb.control<number | null>(null, Validators.min(0)),
    /** Base price X; null until the user picks one (the editor suggests a price meanwhile). */
    basePrice: fb.control<number | null>(null, Validators.min(0)),
    /** Not edited yet (used by sales tracking); kept so saving doesn't clear it. */
    salesStartDate: fb.control<string | null>(null),
    costs: fb.array<CostGroup>([]),
    scenarios: fb.array<ScenarioGroup>([createScenarioGroup(fb, defaultScenario())]),
  });
}

export function defaultScenario(name = 'Базовий'): ScenarioInput {
  return { name, stages: [{ share: 1, discount: 0, months: 1 }] };
}

export function createCostGroup(fb: NonNullableFormBuilder, cost: BatchCost): CostGroup {
  return fb.group({
    name: name(fb, cost.name),
    kind: fb.control<CostKind>(cost.kind),
    amount: fb.control<number | null>(cost.amount ?? null, Validators.min(0)),
    percent: percent(fb, cost.percent === undefined ? null : toPercent(cost.percent)),
  });
}

export function createStageGroup(fb: NonNullableFormBuilder, stage: Stage): StageGroup {
  return fb.group({
    share: percent(fb, toPercent(stage.share)),
    discount: percent(fb, toPercent(stage.discount)),
    months: fb.control<number | null>(stage.months, [Validators.min(0), Validators.max(120)]),
  });
}

export function createScenarioGroup(fb: NonNullableFormBuilder, scenario: ScenarioInput): ScenarioGroup {
  return fb.group({
    name: name(fb, scenario.name),
    stages: fb.array(scenario.stages.map((stage) => createStageGroup(fb, stage))),
  });
}

/** Loads a saved batch into the form, replacing all costs and scenarios. */
export function fillBatchForm(form: BatchForm, fb: NonNullableFormBuilder, batch: SavedBatch): void {
  const { costs, scenarios } = form.controls;
  costs.clear({ emitEvent: false });
  for (const cost of batch.costs) {
    costs.push(createCostGroup(fb, cost), { emitEvent: false });
  }
  scenarios.clear({ emitEvent: false });
  for (const scenario of batch.scenarios.length > 0 ? batch.scenarios : [defaultScenario()]) {
    scenarios.push(createScenarioGroup(fb, scenario), { emitEvent: false });
  }
  form.patchValue({
    name: batch.name,
    quantity: batch.quantity,
    currency: batch.currency,
    defectRate: toPercent(batch.defectRate),
    targetProfit: batch.targetProfit,
    competitorPrice: batch.competitorPrice,
    basePrice: batch.basePrice,
    salesStartDate: batch.salesStartDate,
  });
  form.markAsPristine();
}

/** Form value → API payload. Keeps only the field relevant to each cost's kind; empty numbers count as 0. */
export function toBatchInput(value: BatchFormValue): BatchInput {
  return {
    name: value.name.trim(),
    quantity: value.quantity ?? 0,
    currency: value.currency,
    defectRate: fraction(value.defectRate),
    targetProfit: value.targetProfit ?? 0,
    competitorPrice: value.competitorPrice,
    basePrice: value.basePrice,
    salesStartDate: value.salesStartDate,
    costs: value.costs.map((cost): BatchCost => {
      const base = { name: cost.name.trim(), kind: cost.kind };
      return cost.kind === 'per_sale_percent'
        ? { ...base, percent: fraction(cost.percent) }
        : { ...base, amount: cost.amount ?? 0 };
    }),
    scenarios: value.scenarios.map(toScenarioInput),
  };
}

export function toScenarioInput(scenario: BatchFormValue['scenarios'][number]): ScenarioInput {
  return { name: scenario.name.trim(), stages: scenario.stages.map(toStage) };
}

/** Form value → calc inputs, for live recalculation. */
export function toCalcInputs(value: BatchFormValue): { batch: Batch; scenarios: Scenario[] } {
  const input = toBatchInput(value);
  return {
    batch: { quantity: input.quantity, defectRate: input.defectRate, currency: value.currency, costs: input.costs },
    scenarios: input.scenarios,
  };
}

function toStage(stage: BatchFormValue['scenarios'][number]['stages'][number]): Stage {
  return { share: fraction(stage.share), discount: fraction(stage.discount), months: stage.months ?? 0 };
}

/** Percent → fraction, clamped to 0..1 so out-of-range input mid-typing can't break live results. */
function fraction(percentValue: number | null): number {
  const clamped = Math.min(Math.max(percentValue ?? 0, 0), 100);
  return Math.round(clamped * 1e6) / 1e8;
}

/** Fraction → percent without float noise (0.07 * 100 = 7.000000000000001). */
function toPercent(fractionValue: number): number {
  return Math.round(fractionValue * 100 * 1e6) / 1e6;
}
