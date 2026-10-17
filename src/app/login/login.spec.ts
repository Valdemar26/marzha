import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Supabase } from '../core/supabase';
import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let signInWithMagicLink: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    signInWithMagicLink = vi.fn().mockResolvedValue({ error: null });

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        {
          provide: Supabase,
          useValue: { isAuthenticated: () => false, signInWithMagicLink },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not submit an invalid email', async () => {
    component.form.controls.email.setValue('not-an-email');
    await component.submit();

    expect(signInWithMagicLink).not.toHaveBeenCalled();
    expect(component.form.controls.email.touched).toBe(true);
  });

  it('sends a magic link for a valid email', async () => {
    component.form.controls.email.setValue('seller@example.com');
    await component.submit();

    expect(signInWithMagicLink).toHaveBeenCalledWith('seller@example.com');
    expect(component.status()).toBe('sent');
  });
});
