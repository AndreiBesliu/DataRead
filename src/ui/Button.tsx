/**
 * Primitive de buton — sursă UNICĂ pentru stilurile de buton (peste clasele .btn din styles.css).
 * Înlocuiește butoanele cu stil inline divergent: variante + mărimi tipate, `type="button"` implicit
 * (evită submit accidental în formulare). `Button` = <button>; `LinkButton` = <Link> (react-router) cu
 * același aspect, pentru navigare. Aspectul se adaptează la temă prin variabilele CSS (--accent etc.).
 */
import type { ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

export type ButtonVariant = 'primary' | 'secondary' | 'blue' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'btn btn-primary',
  secondary: 'btn',
  blue: 'btn btn-blue',
  ghost: 'btn btn-ghost',
  danger: 'btn btn-danger',
};
const SIZE_CLASS: Record<ButtonSize, string> = { sm: 'btn-sm', md: '' };

function btnClasses(variant: ButtonVariant, size: ButtonSize, extra?: string): string {
  return [VARIANT_CLASS[variant], SIZE_CLASS[size], extra].filter(Boolean).join(' ');
}

type ButtonProps = { variant?: ButtonVariant; size?: ButtonSize } & ButtonHTMLAttributes<HTMLButtonElement>;
export function Button({ variant = 'secondary', size = 'md', className, type, ...rest }: ButtonProps) {
  return <button type={type ?? 'button'} className={btnClasses(variant, size, className)} {...rest} />;
}

type LinkButtonProps = { variant?: ButtonVariant; size?: ButtonSize } & LinkProps;
export function LinkButton({ variant = 'secondary', size = 'md', className, ...rest }: LinkButtonProps) {
  return <Link className={btnClasses(variant, size, className)} {...rest} />;
}
