import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink } from '@angular/router';
import type { SavedBatch } from '@shared/api/batches';
import { BatchesApi } from '../core/batches-api';
import { Supabase } from '../core/supabase';

@Component({
  selector: 'app-batches',
  imports: [
    CurrencyPipe,
    DecimalPipe,
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
      <mat-progress-bar mode="indeterminate" aria-label="Завантаження партій" />
    }

    <main class="page">
      <div class="heading">
        <h1>Партії</h1>
        <a mat-flat-button routerLink="/batches/new">
          <mat-icon>add</mat-icon>
          Нова партія
        </a>
      </div>

      @switch (status()) {
        @case ('error') {
          <p class="error" role="alert">
            Не вдалося завантажити партії.
            <button mat-button type="button" (click)="load()">Спробувати ще</button>
          </p>
        }
        @case ('ready') {
          @if (batches().length === 0) {
            <p>Ще немає партій. Додайте першу, щоб дізнатися, за скільки її продавати.</p>
          } @else {
            <mat-nav-list aria-label="Партії">
              @for (batch of batches(); track batch.id) {
                <a mat-list-item [routerLink]="['/batches', batch.id]">
                  <span matListItemTitle>{{ batch.name }}</span>
                  <span matListItemLine>
                    {{ batch.quantity | number: '1.0-2' }} шт · сценаріїв: {{ batch.scenarios.length }}
                  </span>
                  @let price = batch.scenarios[0]?.result?.breakEvenPrice ?? null;
                  @if (price !== null) {
                    <span matListItemMeta class="price">
                      <span class="visually-hidden">Ціна в нуль:</span>
                      {{ price | currency: batch.currency }}
                    </span>
                  }
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
    mat-nav-list {
      --mat-list-list-item-trailing-supporting-text-size: var(--mat-sys-title-medium-size);
      --mat-list-list-item-trailing-supporting-text-line-height: var(--mat-sys-title-medium-line-height);
      --mat-list-list-item-trailing-supporting-text-weight: var(--mat-sys-title-medium-weight);
      --mat-list-list-item-trailing-supporting-text-color: var(--mat-sys-on-surface);
    }
    .price {
      align-self: center;
    }
    .error {
      color: var(--mat-sys-error);
    }
  `,
})
export class Batches {
  private readonly supabase = inject(Supabase);
  private readonly router = inject(Router);
  private readonly api = inject(BatchesApi);

  readonly email = computed(() => this.supabase.session()?.user.email ?? '');
  readonly batches = signal<SavedBatch[]>([]);
  readonly status = signal<'loading' | 'ready' | 'error'>('loading');

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.status.set('loading');
    try {
      this.batches.set(await this.api.list());
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
