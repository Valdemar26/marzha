// Request/response shapes of /api/products, shared by src/ and api/. Types only.
import type { CalcResult, CostLine } from '../calc/index';

export type CalcSummary = Omit<CalcResult, 'priceForMargin'>;

export interface ProductInput {
  name: string;
  salePrice: number;
  currency?: string;
  returnRate: number;
  returnCost: number;
  lines: CostLine[];
}

export interface Product extends ProductInput {
  id: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
  /** calculate() computed server-side from the saved data. */
  result: CalcSummary;
}
