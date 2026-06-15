/**
 * Roluri de administrator (pentru UI). Logica de autorizare/decizie trăiește în functions (manageAdmin
 * + canMutateAdmin, autoritate Firestore). Aici doar enum + etichete + coerce pentru afișare.
 */
export const ADMIN_ROLES = ['owner', 'operator'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];
export const DEFAULT_ADMIN_ROLE: AdminRole = 'operator';

export function coerceAdminRole(v: unknown): AdminRole {
  return v === 'owner' ? 'owner' : 'operator';
}
