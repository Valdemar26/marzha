import { CurrencyPipe, PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import type { ScenarioAnalysis } from '@shared/calc';

@Component({
  selector: 'app-results-card',
  imports: [CurrencyPipe, PercentPipe, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSliderModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-card appearance="outlined">
      <mat-card-header>
        <mat-card-title><h2 id="results-heading">Результат</h2></mat-card-title>
        <mat-card-subtitle>{{ scenarioName() }}</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        @if (analysis(); as a) {
          <dl>
            <dt>Ціна в нуль</dt>
            <dd>{{ a.breakEvenPrice === null ? 'недосяжна' : (a.breakEvenPrice | currency: currency()) }}</dd>
            <dt>Ціна під прибуток {{ targetProfit() | currency: currency() : 'symbol' : '1.0-0' }}</dt>
            <dd>{{ targetPrice() === null ? 'недосяжна' : (targetPrice() | currency: currency()) }}</dd>
          </dl>
          @if (a.sellableUnits <= 0) {
            <p class="hint">Вкажіть кількість у партії, щоб порахувати ціну.</p>
          } @else if (a.breakEvenPrice === null) {
            <p class="hint">
              Жодна ціна не окупить партію: усі етапи зі знижкою 100%, частки нульові або відсоткові витрати сягають
              100%.
            </p>
          }

          <h3 id="price-label">Базова ціна</h3>
          <div class="price-row">
            <mat-slider [min]="0" [max]="sliderMax()" [step]="sliderStep()">
              <input
                matSliderThumb
                [value]="price()"
                (valueChange)="price.set($event)"
                aria-labelledby="price-label"
              />
            </mat-slider>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Ціна</mat-label>
              <input
                #priceInput
                matInput
                type="number"
                inputmode="decimal"
                min="0"
                step="any"
                [value]="price()"
                (input)="setPrice(priceInput.valueAsNumber)"
              />
              <span matTextSuffix>{{ currency() }}</span>
            </mat-form-field>
          </div>
          <p class="profit" aria-live="polite">
            {{ profit() < 0 ? 'Збиток' : 'Прибуток' }} за цієї ціни:
            <strong [class.negative]="profit() < 0">{{ profit() | currency: currency() }}</strong>
            за {{ a.totalMonths }} міс.
          </p>

          @if (competitorPrice(); as competitor) {
            <h3>Конкурент: {{ competitor | currency: currency() }}</h3>
            <ul class="compare">
              <li>
                Ваша ціна {{ price() | currency: currency() }} —
                @if (price() === competitor) {
                  така сама.
                } @else {
                  на {{ abs(price() - competitor) | currency: currency() }}
                  ({{ abs(price() / competitor - 1) | percent: '1.0-1' }})
                  {{ price() < competitor ? 'нижча' : 'вища' }}.
                }
              </li>
              @if (a.breakEvenPrice !== null) {
                <li [class.negative]="a.breakEvenPrice > competitor">
                  @if (a.breakEvenPrice > competitor) {
                    Навіть ціна в нуль вища за ціну конкурента на
                    {{ a.breakEvenPrice - competitor | currency: currency() }}.
                  } @else {
                    За ціною конкурента ви заробите {{ a.profitAt(competitor) | currency: currency() }}.
                  }
                </li>
              }
            </ul>
          }

          @if (hints().length > 0) {
            <h3>Підказки</h3>
            <ul class="hints">
              @for (hint of hints(); track hint.stageIndex) {
                <li>
                  <mat-icon aria-hidden="true">lightbulb</mat-icon>
                  <span>
                    Етап {{ hint.stageIndex + 1 }}: вигідніше продати зі знижкою, ніж ще місяць тримати на складі.
                    Додаткова знижка коштує {{ hint.discountCost | currency: currency() }}, а місяць зберігання —
                    {{ hint.holdingCostPerMonth | currency: currency() }}.
                  </span>
                </li>
              }
            </ul>
          }
        } @else {
          <p>Додайте сценарій, щоб побачити розрахунок.</p>
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
      margin: 16px 0 4px;
      font: var(--mat-sys-title-small);
    }
    dl {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px 16px;
      margin: 8px 0 0;
    }
    dd {
      margin: 0;
      text-align: right;
      font: var(--mat-sys-title-medium);
    }
    .price-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    mat-slider {
      flex: 1 1 180px;
    }
    .price-row mat-form-field {
      flex: 0 1 150px;
    }
    .profit strong {
      font: var(--mat-sys-title-medium);
    }
    ul {
      margin: 0;
      padding-left: 20px;
    }
    .hints {
      list-style: none;
      padding: 0;
    }
    .hints li {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    }
    mat-icon {
      flex: none;
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
  readonly analysis = input.required<ScenarioAnalysis | null>();
  readonly scenarioName = input('');
  readonly currency = input.required<string>();
  readonly targetProfit = input.required<number>();
  readonly competitorPrice = input<number | null>(null);
  /** Base price X. */
  readonly price = model.required<number>();

  readonly targetPrice = computed(() => this.analysis()?.priceForProfit(this.targetProfit()) ?? null);
  readonly profit = computed(() => this.analysis()?.profitAt(this.price()) ?? 0);
  readonly hints = computed(() => this.analysis()?.hintsAt(this.price()) ?? []);

  /** Covers the interesting prices with room to spare, without moving while the thumb is dragged. */
  readonly sliderMax = computed(() => {
    const reference = Math.max(
      this.analysis()?.breakEvenPrice ?? 0,
      this.targetPrice() ?? 0,
      this.competitorPrice() ?? 0,
    );
    const max = reference > 0 ? niceCeil(reference * 2) : 100;
    return Math.max(max, this.price());
  });
  readonly sliderStep = computed(() => 10 ** Math.floor(Math.log10(this.sliderMax() / 100)));

  readonly abs = Math.abs;

  setPrice(value: number): void {
    if (Number.isFinite(value) && value >= 0) {
      this.price.set(value);
    }
  }
}

/** Rounds up to 1, 2 or 5 times a power of ten. */
function niceCeil(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((m) => m * magnitude >= value) ?? 10;
  return step * magnitude;
}
