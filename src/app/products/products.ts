import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Supabase } from '../core/supabase';

@Component({
  selector: 'app-products',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main>
      <h1>Products</h1>
      <p>Signed in as {{ email() }}</p>
      <button type="button" (click)="signOut()">Sign out</button>
    </main>
  `,
})
export class Products {
  private readonly supabase = inject(Supabase);
  private readonly router = inject(Router);

  readonly email = computed(() => this.supabase.session()?.user.email ?? '');

  async signOut(): Promise<void> {
    await this.supabase.signOut();
    await this.router.navigateByUrl('/login');
  }
}
