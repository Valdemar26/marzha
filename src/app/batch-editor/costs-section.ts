import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, inject, input, Injector } from '@angular/core';
import { FormArray, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { COST_KINDS, type CostKind } from '@shared/calc';
import { type CostGroup, createCostGroup } from './batch-form';

interface KindInfo {
  title: string;
  hint: string;
  amountLabel: string;
  addLabel: string;
}

export const KIND_INFO: Record<CostKind, KindInfo> = {
  one_time: {
    title: 'Разові',
    hint: 'Закупівля, доставка партії, фото — платите один раз.',
    amountLabel: 'Сума',
    addLabel: 'Додати разову витрату',
  },
  monthly: {
    title: 'Щомісячні',
    hint: 'Нараховуються щомісяця, поки партія не розпродана.',
    amountLabel: 'Сума на місяць, що припадає на цю партію',
    addLabel: 'Додати щомісячну витрату',
  },
  per_sale_fixed: {
    title: 'З кожного проданого',
    hint: 'Пакування, доставка покупцю — фіксована сума за кожну продану одиницю.',
    amountLabel: 'Сума за одиницю',
    addLabel: 'Додати витрату на продаж',
  },
  per_sale_percent: {
    title: 'Відсоток від ціни продажу',
    hint: 'Комісія маркетплейсу, еквайринг, податок — від фактичної ціни з урахуванням знижки.',
    amountLabel: 'Відсоток від ціни',
    addLabel: 'Додати відсоткову витрату',
  },
};

@Component({
  selector: 'app-costs-section',
  imports: [CurrencyPipe, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (kind of kinds; track kind) {
      @let info = kindInfo[kind];
      <section class="kind" [attr.aria-labelledby]="'kind-' + kind">
        <h3 [id]="'kind-' + kind">{{ info.title }}</h3>
        <p class="hint">{{ info.hint }}</p>
        @for (cost of costs().controls; track cost; let i = $index) {
          @if (cost.controls.kind.value === kind) {
            <div class="row" [formGroup]="cost" role="group" [attr.aria-label]="cost.controls.name.value || info.title">
              <mat-form-field appearance="outline" class="grow">
                <mat-label>Назва</mat-label>
                <input matInput formControlName="name" maxlength="200" [id]="'cost-' + i + '-name'" />
                <mat-error>Вкажіть назву.</mat-error>
              </mat-form-field>
              @if (kind === 'per_sale_percent') {
                <mat-form-field appearance="outline">
                  <mat-label>{{ info.amountLabel }}</mat-label>
                  <input matInput type="number" inputmode="decimal" min="0" max="100" step="any" formControlName="percent" />
                  <span matTextSuffix>%</span>
                  <mat-hint>≈ {{ ((cost.controls.percent.value ?? 0) / 100) * price() | currency: currency() }} з одиниці за повною ціною</mat-hint>
                  <mat-error>Від 0 до 100.</mat-error>
                </mat-form-field>
              } @else {
                <mat-form-field appearance="outline" [class.wide]="kind === 'monthly'">
                  <mat-label>{{ info.amountLabel }}</mat-label>
                  <input matInput type="number" inputmode="decimal" min="0" step="any" formControlName="amount" />
                  <span matTextSuffix>{{ currency() }}</span>
                  <mat-error>0 або більше.</mat-error>
                </mat-form-field>
              }
              <button
                mat-icon-button
                type="button"
                class="remove"
                (click)="remove(i, kind)"
                [attr.aria-label]="'Видалити витрату ' + (cost.controls.name.value || i + 1)"
              >
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          }
        }
        <button mat-stroked-button type="button" [id]="'add-' + kind" (click)="add(kind)">
          <mat-icon>add</mat-icon>
          {{ info.addLabel }}
        </button>
      </section>
    }
  `,
  styles: `
    .kind {
      margin-bottom: 20px;
    }
    h3 {
      margin: 0;
      font: var(--mat-sys-title-small);
    }
    .hint {
      margin: 4px 0 12px;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 0 12px;
    }
    mat-form-field {
      flex: 1 1 140px;
    }
    .grow {
      flex-basis: 200px;
    }
    .wide {
      flex-basis: 260px;
    }
    .remove {
      margin-top: 4px;
    }
  `,
})
export class CostsSection {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly costs = input.required<FormArray<CostGroup>>();
  readonly currency = input.required<string>();
  /** Base price X, to show percent costs in money. */
  readonly price = input.required<number>();

  readonly kinds = COST_KINDS;
  readonly kindInfo = KIND_INFO;

  add(kind: CostKind): void {
    const cost = kind === 'per_sale_percent' ? { name: '', kind, percent: 0 } : { name: '', kind, amount: 0 };
    this.costs().push(createCostGroup(this.fb, cost));
    this.focusAfterRender(`#cost-${this.costs().length - 1}-name`);
  }

  remove(index: number, kind: CostKind): void {
    this.costs().removeAt(index);
    this.focusAfterRender(`#add-${kind}`);
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
