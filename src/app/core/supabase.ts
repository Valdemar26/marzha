import { Injectable, computed, signal } from '@angular/core';
import { type Session, type SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class Supabase {
  readonly client: SupabaseClient = createClient(environment.supabaseUrl, environment.supabaseAnonKey);

  private readonly sessionState = signal<Session | null>(null);
  readonly session = this.sessionState.asReadonly();
  readonly isAuthenticated = computed(() => this.sessionState() !== null);

  constructor() {
    this.client.auth.onAuthStateChange((_event, session) => {
      this.sessionState.set(session);
    });
  }

  /** Awaited once by the app initializer so the initial auth state is known before routing. */
  async loadSession(): Promise<void> {
    const { data } = await this.client.auth.getSession();
    this.sessionState.set(data.session);
  }

  async signInWithMagicLink(email: string): Promise<{ error: string | null }> {
    const { error } = await this.client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/batches` },
    });
    return { error: error?.message ?? null };
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }
}
