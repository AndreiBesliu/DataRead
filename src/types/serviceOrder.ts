/**
 * Comenzi de servicii (Felia 2 catalog servicii) — colecția top-level `serviceOrders`.
 * O comandă = un serviciu din catalog (src/config/services.ts) cerut de un client (din /app) SAU deschis de
 * operator pe un lead/client (din /admin), cu un ciclu de status (cerut → în lucru → livrat / anulat).
 *
 * IZOLARE / CLIENT-SAFE: doc-ul conține DOAR câmpuri pe care clientul are voie să le vadă (briefing + livrabil
 * + status). FĂRĂ note interne, FĂRĂ UID de operator. Notele interne ale operatorului rămân pe lead/client.
 * Reguli: admin = tot; client = citește DOAR comenzile lui (clientUid == uid) + creează constrâns (source 'client').
 * Un singur normaliser (coerceToServiceOrder) pe toate căile de citire — corupt/legacy → defaults sigure.
 */
import { isValidServiceId, type ServiceId } from '../config/services';

export const SERVICE_ORDER_SCHEMA = 1;

export const SERVICE_ORDER_STATUSES = ['requested', 'in_progress', 'delivered', 'cancelled'] as const;
export type ServiceOrderStatus = (typeof SERVICE_ORDER_STATUSES)[number];
export const SERVICE_ORDER_STATUS_DEFAULT: ServiceOrderStatus = 'requested';

export const SERVICE_ORDER_SOURCES = ['operator', 'client'] as const;
export type ServiceOrderSource = (typeof SERVICE_ORDER_SOURCES)[number];

export const SERVICE_ORDER_LIMITS = { note: 2000, company: 120, contact: 120, deliverable: 8000 } as const;

/** Culori de status pentru badge-uri (admin + portal). */
export const SERVICE_ORDER_STATUS_COLORS: Record<ServiceOrderStatus, string> = {
  requested: '#2e7fff',
  in_progress: '#d98e0b',
  delivered: '#1f9d57',
  cancelled: '#8a93a6',
};

export interface ServiceOrder {
  schema: typeof SERVICE_ORDER_SCHEMA;
  service: ServiceId;
  status: ServiceOrderStatus;
  source: ServiceOrderSource;
  /** uid-ul clientului (dacă e legată de un cont) sau null. */
  clientUid: string | null;
  /** id-ul lead-ului (dacă operatorul a deschis-o pe un lead) sau null. */
  leadId: string | null;
  /** Denormalizat pentru afișare în /admin. */
  companyName: string;
  contactEmail: string;
  contactPhone: string;
  /** Briefingul/cererea (vizibil clientului). */
  note: string;
  /** Livrabilul operatorului (vizibil clientului). */
  deliverable: string;
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

/** Unicul normaliser. Corupt/legacy/viitor → defaults sigure, niciodată throw. */
export function coerceToServiceOrder(raw: unknown): ServiceOrder {
  const d = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    schema: SERVICE_ORDER_SCHEMA,
    service: isValidServiceId(d.service) ? d.service : 'audit',
    status: SERVICE_ORDER_STATUSES.includes(d.status as ServiceOrderStatus) ? (d.status as ServiceOrderStatus) : SERVICE_ORDER_STATUS_DEFAULT,
    source: SERVICE_ORDER_SOURCES.includes(d.source as ServiceOrderSource) ? (d.source as ServiceOrderSource) : 'operator',
    clientUid: typeof d.clientUid === 'string' && d.clientUid ? d.clientUid.slice(0, 128) : null,
    leadId: typeof d.leadId === 'string' && d.leadId ? d.leadId.slice(0, 128) : null,
    companyName: str(d.companyName, SERVICE_ORDER_LIMITS.company),
    contactEmail: str(d.contactEmail, SERVICE_ORDER_LIMITS.contact),
    contactPhone: str(d.contactPhone, SERVICE_ORDER_LIMITS.contact),
    note: str(d.note, SERVICE_ORDER_LIMITS.note),
    deliverable: str(d.deliverable, SERVICE_ORDER_LIMITS.deliverable),
  };
}
