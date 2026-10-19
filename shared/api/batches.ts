// Request/response shapes of /api/batches, shared by src/ and api/. Types only.
import type { BatchCost, Stage, Validation } from '../calc/index';

export interface ScenarioInput {
  name: string;
  stages: Stage[];
}

export interface BatchInput {
  name: string;
  quantity: number;
  currency?: string;
  /** 0..1 (exclusive of 1). */
  defectRate: number;
  targetProfit: number;
  competitorPrice: number | null;
  /** The selling price X the user settled on; null until they pick one. */
  basePrice: number | null;
  /** ISO date, YYYY-MM-DD. */
  salesStartDate: string | null;
  costs: BatchCost[];
  scenarios: ScenarioInput[];
}

/** Results of analyzeScenario(), computed server-side from the saved data. */
export interface ScenarioSummary {
  sellableUnits: number;
  totalMonths: number;
  sharesTotal: number;
  validation: Validation;
  breakEvenPrice: number | null;
  /** Price that yields the batch's targetProfit. */
  targetPrice: number | null;
  stageUnits: number[];
  /** Profit at the batch's basePrice; null when no base price is set. */
  profitAtBasePrice: number | null;
}

export interface SavedScenario extends ScenarioInput {
  id: string;
  result: ScenarioSummary;
}

export interface SavedBatch extends BatchInput {
  id: string;
  currency: string;
  scenarios: SavedScenario[];
  createdAt: string;
  updatedAt: string;
}
