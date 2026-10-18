import { FormControl, FormGroup, NonNullableFormBuilder, Validators } from '@angular/forms';
import type { Product, ProductInput } from '@shared/api/products';
import type { CostLine, CostLineKind } from '@shared/calc';

export const KIND_LABELS: Record<CostLineKind, string> = {
  material: 'Матеріал',
  labor: 'Робота',
  fixed: 'Фіксована сума',
  percent: 'Відсоток від ціни',
};

export type LineGroup = FormGroup<{
  name: FormControl<string>;
  kind: FormControl<CostLineKind>;
  quantity: FormControl<number | null>;
  unitPrice: FormControl<number | null>;
  hours: FormControl<number | null>;
  rate: FormControl<number | null>;
  amount: FormControl<number | null>;
  /** In percent (0..100), unlike CostLine.percent which is a fraction. */
  percent: FormControl<number | null>;
}>;

export type ProductForm = ReturnType<typeof createProductForm>;
export type ProductFormValue = ReturnType<ProductForm['getRawValue']>;

const amount = (fb: NonNullableFormBuilder) => fb.control<number | null>(null, Validators.min(0));

export function createProductForm(fb: NonNullableFormBuilder) {
  return fb.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    salePrice: fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    /** In percent (0..100). */
    returnRate: fb.control<number | null>(0, [Validators.min(0), Validators.max(99)]),
    returnCost: amount(fb),
    lines: fb.array<LineGroup>([]),
  });
}

export function createLineGroup(fb: NonNullableFormBuilder, line?: CostLine): LineGroup {
  return fb.group({
    name: [line?.name ?? '', [Validators.required, Validators.maxLength(200)]],
    kind: fb.control<CostLineKind>(line?.kind ?? 'material'),
    quantity: fb.control<number | null>(line?.quantity ?? (line ? null : 1), Validators.min(0)),
    unitPrice: fb.control<number | null>(line?.unitPrice ?? null, Validators.min(0)),
    hours: fb.control<number | null>(line?.hours ?? null, Validators.min(0)),
    rate: fb.control<number | null>(line?.rate ?? null, Validators.min(0)),
    amount: fb.control<number | null>(line?.amount ?? null, Validators.min(0)),
    percent: fb.control<number | null>(
      line?.percent === undefined ? null : toPercent(line.percent),
      [Validators.min(0), Validators.max(100)],
    ),
  });
}

/** Loads a saved product into the form, replacing all cost lines. */
export function fillProductForm(form: ProductForm, fb: NonNullableFormBuilder, product: Product): void {
  form.controls.lines.clear({ emitEvent: false });
  for (const line of product.lines) {
    form.controls.lines.push(createLineGroup(fb, line), { emitEvent: false });
  }
  form.patchValue({
    name: product.name,
    salePrice: product.salePrice,
    returnRate: toPercent(product.returnRate),
    returnCost: product.returnCost,
  });
  form.markAsPristine();
}

/** Form value → API payload. Keeps only the fields relevant to each line's kind; empty numbers count as 0. */
export function toProductInput(value: ProductFormValue): ProductInput {
  return {
    name: value.name.trim(),
    salePrice: value.salePrice ?? 0,
    returnRate: (value.returnRate ?? 0) / 100,
    returnCost: value.returnCost ?? 0,
    lines: value.lines.map((line): CostLine => {
      const base = { name: line.name.trim(), kind: line.kind };
      switch (line.kind) {
        case 'material':
          return { ...base, quantity: line.quantity ?? 0, unitPrice: line.unitPrice ?? 0 };
        case 'labor':
          return { ...base, hours: line.hours ?? 0, rate: line.rate ?? 0 };
        case 'fixed':
          return { ...base, amount: line.amount ?? 0 };
        case 'percent':
          return { ...base, percent: (line.percent ?? 0) / 100 };
      }
    }),
  };
}

/** Fraction → percent without float noise (0.07 * 100 = 7.000000000000001). */
function toPercent(fraction: number): number {
  return Math.round(fraction * 100 * 1e6) / 1e6;
}
