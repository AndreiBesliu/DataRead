/**
 * Primitive de câmp de formular — etichetă VIZIBILĂ (a11y) deasupra controlului, cu eroare + hint opționale.
 * Inputul stă în interiorul `<label>` → asociere implicită (citit de screen-reader, rămâne vizibil la tastare).
 * `error`/`hint` sunt CHEI i18n (regula proiectului: zero text hardcodat). Consolidează tiparul label+input
 * folosit în AuthPanel / OnboardingFields / ChromeEditor.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>
      <span>
        {label}
        {error ? <span style={{ color: 'var(--danger)', fontWeight: 500 }}> — {t(error)}</span> : null}
      </span>
      {children}
      {hint ? <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--fg-1)' }}>{t(hint)}</span> : null}
    </label>
  );
}
