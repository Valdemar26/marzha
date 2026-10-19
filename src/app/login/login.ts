import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router } from '@angular/router';
import { Supabase } from '../core/supabase';

type LoginStatus = 'idle' | 'sending' | 'sent' | 'error';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="login">
      <mat-card appearance="outlined">
        @if (status() === 'sending') {
          <mat-progress-bar mode="indeterminate" aria-label="Надсилання посилання" />
        }
        <mat-card-header>
          <mat-card-title><h1>Маржа</h1></mat-card-title>
          <mat-card-subtitle>Ціна партії: в нуль і в плюс</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <p>Введіть email — ми надішлемо посилання для входу.</p>

          <form [formGroup]="form" (ngSubmit)="submit()">
            <mat-form-field appearance="outline">
              <mat-label>Email</mat-label>
              <input matInput id="email" type="email" formControlName="email" autocomplete="email" />
              @if (form.controls.email.invalid) {
                <mat-error>Введіть коректну email-адресу.</mat-error>
              }
            </mat-form-field>

            <button mat-flat-button type="submit" [disabled]="status() === 'sending'">
              @if (status() === 'sending') {
                Надсилаємо…
              } @else {
                Надіслати посилання
              }
            </button>
          </form>

          <p class="status" [class.error]="status() === 'error'" aria-live="polite">
            @if (status() === 'sent') {
              Перевірте пошту — там посилання для входу.
            } @else if (status() === 'error') {
              {{ errorMessage() }}
            }
          </p>
        </mat-card-content>
      </mat-card>
    </main>
  `,
  styles: `
    .login {
      display: grid;
      place-items: center;
      min-height: 100dvh;
      padding: 16px;
      box-sizing: border-box;
    }
    mat-card {
      width: 100%;
      max-width: 400px;
      overflow: hidden;
    }
    h1 {
      margin: 0;
      font: var(--mat-sys-headline-medium);
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .status {
      min-height: 1.5em;
      margin: 16px 0 0;
    }
    .error {
      color: var(--mat-sys-error);
    }
  `,
})
export class Login {
  private readonly supabase = inject(Supabase);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);

  readonly status = signal<LoginStatus>('idle');
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  constructor() {
    if (this.supabase.isAuthenticated()) {
      void this.router.navigateByUrl('/batches');
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.status.set('sending');
    this.errorMessage.set(null);

    const { error } = await this.supabase.signInWithMagicLink(this.form.getRawValue().email);

    if (error) {
      this.status.set('error');
      this.errorMessage.set(error);
      return;
    }

    this.status.set('sent');
  }
}
