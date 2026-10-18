import { CurrencyPipe, PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatSliderModule } from '@angular/material/slider';
import type { CalcResult } from '@shared/calc';

@Component({
  selector: 'app-results-card',
  imports: [CurrencyPipe, PercentPipe, MatCardModule, MatSliderModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-card appearance="outlined">
      <mat-card-header>
        <mat-card-title><h2>Результат</h2></mat-card-title>
      </mat-card-header>
      <mat-card-content>
        @if (result(); as r) {
          <dl>
            <dt>Собівартість</dt>
            <dd>{{ r.unitCost | currency: currency() }}</dd>
            <dt>Прибуток</dt>
            <dd [class.negative]="r.profit < 0">{{ r.profit | currency: currency() }}</dd>
            <dt>Маржа</dt>
            <dd [class.negative]="r.profit < 0">{{ r.marginPct === null ? '—' : (r.marginPct | percent: '1.0-1') }}</dd>
            <dt>Націнка</dt>
            <dd [class.negative]="r.profit < 0">{{ r.markupPct === null ? '—' : (r.markupPct | percent: '1.0-1') }}</dd>
          </dl>

          <h3 id="target-margin-label">Цільова маржа: {{ targetMargin() / 100 | percent: '1.0-0' }}</h3>
          <mat-slider min="0" max="95" step="1">
            <input
              #thumb
              matSliderThumb
              [value]="targetMargin()"
              (input)="targetMargin.set(thumb.valueAsNumber)"
              aria-labelledby="target-margin-label"
            />
          </mat-slider>
          <p class="recommended">
            Рекомендована ціна:
            @if (recommendedPrice() !== null) {
              <strong>{{ recommendedPrice() | currency: currency() }}</strong>
            } @else {
              <strong>недосяжна</strong>
              <span class="hint">— відсоткові витрати разом із маржею сягають 100%.</span>
            }
          </p>
        } @else {
          <p>Виправте помилки у формі, щоб побачити розрахунок.</p>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    h2 {
      margin: 0;
      font: var(--mat-sys-title-large);
    }
    h3 {
      margin: 16px 0 0;
      font: var(--mat-sys-title-small);
    }
    dl {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px 16px;
      margin: 0;
    }
    dd {
      margin: 0;
      text-align: right;
      font: var(--mat-sys-title-medium);
    }
    mat-slider {
      display: block;
      margin: 0 8px;
    }
    .recommended strong {
      font: var(--mat-sys-title-medium);
    }
    .hint {
      color: var(--mat-sys-on-surface-variant);
    }
    .negative {
      color: var(--mat-sys-error);
    }
  `,
})
export class ResultsCard {
  readonly result = input.required<CalcResult | null>();
  readonly currency = input.required<string>();

  /** In percent (0..95). */
  readonly targetMargin = signal(30);
  readonly recommendedPrice = computed(() => this.result()?.priceForMargin(this.targetMargin() / 100) ?? null);
}
