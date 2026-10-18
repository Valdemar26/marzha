import { CurrencyPipe, PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink } from '@angular/router';
import type { Product } from '@shared/api/products';
import { ProductsApi } from '../core/products-api';
import { Supabase } from '../core/supabase';

@Component({
  selector: 'app-products',
  imports: [
    CurrencyPipe,
    PercentPipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatProgressBarModule,
    MatToolbarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-toolbar>
      <span>Маржа</span>
      <span class="toolbar-spacer"></span>
      <span class="email">{{ email() }}</span>
      <button mat-icon-button type="button" (click)="signOut()" aria-label="Вийти">
        <mat-icon>logout</mat-icon>
      </button>
    </mat-toolbar>
    @if (status() === 'loading') {
      <mat-progress-bar mode="indeterminate" aria-label="Завантаження товарів" />
    }

    <main class="page">
      <div class="heading">
        <h1>Товари</h1>
        <a mat-flat-button routerLink="/products/new">
          <mat-icon>add</mat-icon>
          Додати товар
        </a>
      </div>

      @switch (status()) {
        @case ('error') {
          <p class="error" role="alert">
            Не вдалося завантажити товари.
            <button mat-button type="button" (click)="load()">Спробувати ще</button>
          </p>
        }
        @case ('ready') {
          @if (products().length === 0) {
            <p>Ще немає товарів. Додайте перший, щоб порахувати його маржу.</p>
          } @else {
            <mat-nav-list aria-label="Товари">
              @for (product of products(); track product.id) {
                <a mat-list-item [routerLink]="['/products', product.id]">
                  <span matListItemTitle>{{ product.name }}</span>
                  <span matListItemLine>{{ product.salePrice | currency: product.currency }}</span>
                  <span matListItemMeta class="margin" [class.negative]="product.result.profit < 0">
                    @if (product.result.marginPct === null) {
                      —
                    } @else {
                      {{ product.result.marginPct | percent: '1.0-1' }}
                    }
                    <span class="visually-hidden">маржа</span>
                  </span>
                </a>
              }
            </mat-nav-list>
          }
        }
      }
    </main>
  `,
  styles: `
    .email {
      font: var(--mat-sys-body-medium);
      margin-right: 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 40vw;
    }
    .heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    h1 {
      font: var(--mat-sys-headline-small);
    }
    .margin {
      font: var(--mat-sys-title-medium);
      color: var(--mat-sys-on-surface);
      align-self: center;
    }
    .negative,
    .error {
      color: var(--mat-sys-error);
    }
  `,
})
export class Products {
  private readonly supabase = inject(Supabase);
  private readonly router = inject(Router);
  private readonly api = inject(ProductsApi);

  readonly email = computed(() => this.supabase.session()?.user.email ?? '');
  readonly products = signal<Product[]>([]);
  readonly status = signal<'loading' | 'ready' | 'error'>('loading');

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.status.set('loading');
    try {
      this.products.set(await this.api.list());
      this.status.set('ready');
    } catch {
      this.status.set('error');
    }
  }

  async signOut(): Promise<void> {
    await this.supabase.signOut();
    await this.router.navigateByUrl('/login');
  }
}
