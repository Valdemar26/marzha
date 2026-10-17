import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Supabase } from '../core/supabase';

type LoginStatus = 'idle' | 'sending' | 'sent' | 'error';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main>
      <h1>Marzha</h1>
      <p>Sign in with a magic link sent to your email.</p>

      <form [formGroup]="form" (ngSubmit)="submit()">
        <label for="email">Email</label>
        <input
          id="email"
          type="email"
          formControlName="email"
          autocomplete="email"
          [attr.aria-invalid]="form.controls.email.invalid && form.controls.email.touched"
          aria-describedby="email-error"
        />
        @if (form.controls.email.invalid && form.controls.email.touched) {
          <p id="email-error" role="alert">Enter a valid email address.</p>
        }

        <button type="submit" [disabled]="status() === 'sending'">
          @if (status() === 'sending') {
            Sending…
          } @else {
            Send magic link
          }
        </button>
      </form>

      <p aria-live="polite">
        @if (status() === 'sent') {
          Check your email for the sign-in link.
        } @else if (status() === 'error') {
          {{ errorMessage() }}
        }
      </p>
    </main>
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
      void this.router.navigateByUrl('/products');
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
