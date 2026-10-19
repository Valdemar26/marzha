import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink } from '@angular/router';
import { analyzeScenario } from '@shared/calc';
import { map } from 'rxjs';
import { BatchesApi } from '../core/batches-api';
import { CURRENCIES, createBatchForm, fillBatchForm, toBatchInput, toCalcInputs } from './batch-form';
import { ComparisonTable } from './comparison-table';
import { CostsSection } from './costs-section';
import { ResultsCard } from './results-card';
import { ScenariosSection } from './scenarios-section';

type EditorStatus = 'loading' | 'ready' | 'not-found' | 'error';

@Component({
  selector: 'app-batch-editor',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatToolbarModule,
    ComparisonTable,
    CostsSection,
    ResultsCard,
    ScenariosSection,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './batch-editor.html',
  styleUrl: './batch-editor.scss',
})
export class BatchEditor implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(BatchesApi);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  /** Route param: a batch id, or "new". */
  readonly id = input.required<string>();

  readonly currencies = CURRENCIES;
  readonly form = createBatchForm(this.fb);
  readonly status = signal<EditorStatus>('loading');
  readonly saving = signal(false);
  readonly confirmingDelete = signal(false);
  /** Id of the saved batch; null until a new batch is first saved. */
  private readonly batchId = signal<string | null>(null);
  readonly isNew = computed(() => this.batchId() === null);

  private readonly formValue = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  readonly currency = computed(() => this.formValue().currency);
  readonly targetProfit = computed(() => this.formValue().targetProfit ?? 0);
  readonly competitorPrice = computed(() => this.formValue().competitorPrice);
  readonly scenarioNames = computed(() => this.formValue().scenarios.map((s) => s.name));

  /** Live recalculation with the same analyzeScenario() the API uses. */
  private readonly calcInputs = computed(() => toCalcInputs(this.formValue()));
  readonly sellableUnits = computed(() => {
    const { quantity, defectRate } = this.calcInputs().batch;
    return quantity * (1 - defectRate);
  });
  readonly analyses = computed(() => {
    const { batch, scenarios } = this.calcInputs();
    return scenarios.map((scenario) => analyzeScenario(batch, scenario));
  });

  readonly selectedScenario = signal(0);
  readonly selectedAnalysis = computed(() => this.analyses()[this.selectedScenario()] ?? null);
  readonly selectedScenarioName = computed(() => this.scenarioNames().at(this.selectedScenario()) ?? '');

  /** Base price X: the saved/picked one, else a suggestion that follows the inputs. */
  private readonly suggestedPrice = computed(() => {
    const analysis = this.selectedAnalysis();
    const price =
      analysis?.priceForProfit(this.targetProfit()) ?? analysis?.breakEvenPrice ?? this.competitorPrice() ?? 0;
    return price >= 100 ? Math.ceil(price) : Math.ceil(price * 100) / 100;
  });
  readonly price = computed(() => this.formValue().basePrice ?? this.suggestedPrice());

  async ngOnInit(): Promise<void> {
    if (this.id() === 'new') {
      this.status.set('ready');
      return;
    }
    try {
      const batch = await this.api.get(this.id());
      fillBatchForm(this.form, this.fb, batch);
      this.batchId.set(batch.id);
      this.status.set('ready');
    } catch (error) {
      this.status.set(error instanceof HttpErrorResponse && error.status === 404 ? 'not-found' : 'error');
    }
  }

  setPrice(price: number): void {
    this.form.controls.basePrice.setValue(price);
    this.form.controls.basePrice.markAsDirty();
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snackBar.open('Перевірте поля з помилками', 'OK', { duration: 4000 });
      return;
    }

    this.saving.set(true);
    try {
      // Save the price on screen, so a suggested price becomes the base price instead of moving later.
      const input = { ...toBatchInput(this.form.getRawValue()), basePrice: this.price() };
      const id = this.batchId();
      const batch = id === null ? await this.api.create(input) : await this.api.update(id, input);
      this.batchId.set(batch.id);
      this.form.markAsPristine();
      if (id === null) {
        await this.router.navigate(['/batches', batch.id], { replaceUrl: true });
      }
      this.snackBar.open('Збережено', undefined, { duration: 2500 });
    } catch {
      this.snackBar.open('Не вдалося зберегти. Спробуйте ще раз.', 'OK', { duration: 5000 });
    } finally {
      this.saving.set(false);
    }
  }

  async delete(): Promise<void> {
    const id = this.batchId();
    if (id === null) return;

    this.saving.set(true);
    try {
      await this.api.delete(id);
      this.snackBar.open('Партію видалено', undefined, { duration: 2500 });
      await this.router.navigateByUrl('/batches');
    } catch {
      this.snackBar.open('Не вдалося видалити. Спробуйте ще раз.', 'OK', { duration: 5000 });
      this.saving.set(false);
    }
  }
}
