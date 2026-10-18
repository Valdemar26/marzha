import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink } from '@angular/router';
import { COST_LINE_KINDS, calculate } from '@shared/calc';
import { map } from 'rxjs';
import { ProductsApi } from '../core/products-api';
import { KIND_LABELS, createLineGroup, createProductForm, fillProductForm, toProductInput } from './product-form';
import { ResultsCard } from './results-card';

type EditorStatus = 'loading' | 'ready' | 'not-found' | 'error';

@Component({
  selector: 'app-product-editor',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatToolbarModule,
    ResultsCard,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-editor.html',
  styleUrl: './product-editor.scss',
})
export class ProductEditor implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(ProductsApi);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  /** Route param: a product id, or "new". */
  readonly id = input.required<string>();

  readonly kinds = COST_LINE_KINDS;
  readonly kindLabels = KIND_LABELS;

  readonly form = createProductForm(this.fb);
  readonly status = signal<EditorStatus>('loading');
  readonly saving = signal(false);
  readonly confirmingDelete = signal(false);
  readonly currency = signal('EUR');
  /** Id of the saved product; null until a new product is first saved. */
  private readonly productId = signal<string | null>(null);
  readonly isNew = computed(() => this.productId() === null);

  private readonly formValue = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  /** Live recalculation with the same calculate() the API uses. */
  readonly result = computed(() => {
    const input = toProductInput(this.formValue());
    return input.returnRate >= 0 && input.returnRate < 1 ? calculate(input) : null;
  });

  async ngOnInit(): Promise<void> {
    if (this.id() === 'new') {
      this.status.set('ready');
      return;
    }
    try {
      const product = await this.api.get(this.id());
      fillProductForm(this.form, this.fb, product);
      this.currency.set(product.currency);
      this.productId.set(product.id);
      this.status.set('ready');
    } catch (error) {
      this.status.set(error instanceof HttpErrorResponse && error.status === 404 ? 'not-found' : 'error');
    }
  }

  addLine(): void {
    this.form.controls.lines.push(createLineGroup(this.fb));
  }

  removeLine(index: number): void {
    this.form.controls.lines.removeAt(index);
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snackBar.open('Перевірте поля з помилками', 'OK', { duration: 4000 });
      return;
    }

    this.saving.set(true);
    try {
      const input = toProductInput(this.form.getRawValue());
      const id = this.productId();
      const product = id === null ? await this.api.create(input) : await this.api.update(id, input);
      this.productId.set(product.id);
      this.form.markAsPristine();
      if (id === null) {
        await this.router.navigate(['/products', product.id], { replaceUrl: true });
      }
      this.snackBar.open('Збережено', undefined, { duration: 2500 });
    } catch {
      this.snackBar.open('Не вдалося зберегти. Спробуйте ще раз.', 'OK', { duration: 5000 });
    } finally {
      this.saving.set(false);
    }
  }

  async delete(): Promise<void> {
    const id = this.productId();
    if (id === null) return;

    this.saving.set(true);
    try {
      await this.api.delete(id);
      this.snackBar.open('Товар видалено', undefined, { duration: 2500 });
      await this.router.navigateByUrl('/products');
    } catch {
      this.snackBar.open('Не вдалося видалити. Спробуйте ще раз.', 'OK', { duration: 5000 });
      this.saving.set(false);
    }
  }
}
