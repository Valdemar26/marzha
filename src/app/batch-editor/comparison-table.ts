import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import type { ScenarioAnalysis } from '@shared/calc';

@Component({
  selector: 'app-comparison-table',
  imports: [CurrencyPipe, DecimalPipe, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="scroll">
      <table>
        <caption class="visually-hidden">Порівняння сценаріїв за ціни {{ price() | currency: currency() }}</caption>
        <thead>
          <tr>
            <th scope="col">Сценарій</th>
            <th scope="col">Ціна в нуль</th>
            <th scope="col">Місяців</th>
            <th scope="col">Прибуток за {{ price() | currency: currency() }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track $index; let i = $index) {
            <tr [class.selected]="i === selectedIndex()" [attr.aria-current]="i === selectedIndex() ? 'true' : null">
              <th scope="row">
                <button mat-button type="button" (click)="select.emit(i)">{{ row.name }}</button>
                @if (!row.valid) {
                  <span class="warning">частки ≠ 100%</span>
                }
              </th>
              <td>{{ row.breakEvenPrice === null ? '—' : (row.breakEvenPrice | currency: currency()) }}</td>
              <td>{{ row.totalMonths | number: '1.0-1' }}</td>
              <td [class.negative]="row.profit < 0">{{ row.profit | currency: currency() }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    .scroll {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font: var(--mat-sys-body-medium);
    }
    th,
    td {
      padding: 8px;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      text-align: right;
      white-space: nowrap;
    }
    th:first-child {
      text-align: left;
      white-space: normal;
    }
    thead th {
      font: var(--mat-sys-title-small);
    }
    .selected {
      background: var(--mat-sys-secondary-container);
    }
    .warning,
    .negative {
      color: var(--mat-sys-error);
    }
    .warning {
      display: block;
      font: var(--mat-sys-body-small);
      padding-left: 12px;
    }
  `,
})
export class ComparisonTable {
  readonly names = input.required<string[]>();
  readonly analyses = input.required<ScenarioAnalysis[]>();
  readonly price = input.required<number>();
  readonly currency = input.required<string>();
  readonly selectedIndex = input(0);
  readonly select = output<number>();

  readonly rows = computed(() =>
    this.analyses().map((analysis, i) => ({
      name: this.names()[i] || `Сценарій ${i + 1}`,
      valid: analysis.validation.valid,
      breakEvenPrice: analysis.breakEvenPrice,
      totalMonths: analysis.totalMonths,
      profit: analysis.profitAt(this.price()),
    })),
  );
}
