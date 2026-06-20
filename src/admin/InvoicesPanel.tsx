/**
 * Facturi / Proforme (Verticala 2 „Lansare Soft") — panou operator. Alegi un client (cont legat de un lead),
 * vezi documentele lui (`clients/{uid}/invoices`), creezi/editezi unul (părți, linii, TVA) cu totaluri live și
 * îl tipărești ca PDF (print-to-PDF brandat). Reguli: read owner+admin, write admin. Tot textul prin t().
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import {
  coerceToInvoice, invoiceTotals, lineTotal, emptyParty, coerceToInvoiceConfig,
  INVOICE_KINDS, INVOICE_STATUSES, INVOICE_ITEMS_MAX,
  type Invoice, type InvoiceKind, type InvoiceStatus, type InvoiceParty, type InvoiceConfig,
} from '../types/invoice';
import { printInvoice, type InvoiceLabels } from '../utils/invoiceDoc';

interface ClientOpt { uid: string; label: string }
type Row = Invoice & { id: string };

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function InvoicesPanel() {
  const { t } = useTranslation();
  const [clientOpts, setClientOpts] = useState<ClientOpt[]>([]);
  const [uid, setUid] = useState('');
  const [list, setList] = useState<Row[]>([]);
  const [draft, setDraft] = useState<Invoice | null>(null);
  const [cfg, setCfg] = useState<InvoiceConfig>(() => coerceToInvoiceConfig(null));
  const [cfgOpen, setCfgOpen] = useState(false);
  const [cfgSaved, setCfgSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    return onSnapshot(doc(db, 'appConfig', 'invoiceSeller'), (snap) => {
      setCfg(coerceToInvoiceConfig(snap.exists() ? snap.data() : null));
    }, () => { /* default */ });
  }, []);

  useEffect(() => {
    return onSnapshot(query(collection(db, 'leads'), limit(500)), (snap) => {
      const m = new Map<string, string>();
      snap.docs.forEach((d) => {
        const v = d.data() as Record<string, unknown>;
        const cu = typeof v.clientUid === 'string' ? v.clientUid : '';
        if (!cu || m.has(cu)) return;
        m.set(cu, (typeof v.companyName === 'string' && v.companyName) || (typeof v.contactName === 'string' && v.contactName) || (typeof v.email === 'string' && v.email) || cu);
      });
      setClientOpts([...m.entries()].map(([u, label]) => ({ uid: u, label })));
    }, () => setClientOpts([]));
  }, []);

  useEffect(() => {
    if (!uid) { setList([]); return; }
    return onSnapshot(query(collection(db, 'clients', uid, 'invoices'), orderBy('updatedAt', 'desc')), (snap) => {
      setList(snap.docs.map((d) => ({ ...coerceToInvoice({ ...d.data(), id: d.id }), id: d.id })));
    }, () => setList([]));
  }, [uid]);

  const totals = useMemo(() => (draft ? invoiceTotals(draft) : { subtotal: 0, vat: 0, total: 0 }), [draft]);
  const clientLabel = clientOpts.find((c) => c.uid === uid)?.label || '';

  const startNew = (kind: InvoiceKind) => {
    setErr('');
    const seller = cfg.seller.name ? cfg.seller : { ...emptyParty(), name: 'DataRead' };
    setDraft(coerceToInvoice({
      kind, issuedAt: todayStr(), currency: cfg.defaultCurrency, vatRate: cfg.defaultVatRate, status: 'draft',
      series: cfg.defaultSeries,
      seller: { ...seller },
      buyer: { ...emptyParty(), name: clientLabel },
      items: [{ description: '', qty: 1, unitPrice: 0 }],
    }));
  };

  const saveConfig = async () => {
    setBusy(true); setErr(''); setCfgSaved(false);
    try {
      await setDoc(doc(db, 'appConfig', 'invoiceSeller'), {
        schema: 1, seller: cfg.seller, defaultSeries: cfg.defaultSeries, defaultVatRate: cfg.defaultVatRate, defaultCurrency: cfg.defaultCurrency,
        updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid || '',
      }, { merge: true });
      setCfgSaved(true); setTimeout(() => setCfgSaved(false), 2500);
    } catch (e) { console.warn('saveConfig failed:', e); setErr(t('admin.invoices.err')); }
    finally { setBusy(false); }
  };
  const patchCfgSeller = (p: Partial<InvoiceParty>) => setCfg((c) => ({ ...c, seller: { ...c.seller, ...p } }));
  const patch = (p: Partial<Invoice>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const patchParty = (which: 'seller' | 'buyer', p: Partial<InvoiceParty>) => setDraft((d) => (d ? { ...d, [which]: { ...d[which], ...p } } : d));
  const patchItem = (i: number, p: Partial<{ description: string; qty: number; unitPrice: number }>) =>
    setDraft((d) => { if (!d) return d; const items = [...d.items]; items[i] = { ...items[i], ...p }; return { ...d, items }; });

  const save = async () => {
    if (!draft || !uid) return;
    setBusy(true); setErr('');
    try {
      const a = coerceToInvoice(draft);
      const id = draft.id || doc(collection(db, 'clients', uid, 'invoices')).id;
      const { id: _drop, updatedAt: _u, ...rest } = a;
      await setDoc(doc(db, 'clients', uid, 'invoices', id), { ...rest, schema: 1, createdBy: auth.currentUser?.uid || '', updatedAt: serverTimestamp() }, { merge: true });
      setDraft(null);
    } catch (e) { console.warn('save invoice failed:', e); setErr(t('admin.invoices.err')); }
    finally { setBusy(false); }
  };
  const remove = async (r: Row) => {
    if (!window.confirm(t('admin.invoices.deleteConfirm'))) return;
    try { await deleteDoc(doc(db, 'clients', uid, 'invoices', r.id)); } catch (e) { console.warn(e); }
  };

  const pdfLabels = (kind: InvoiceKind): InvoiceLabels => ({
    docTitle: t(kind === 'factura' ? 'admin.invoices.factura' : 'admin.invoices.proforma').toUpperCase(),
    seller: t('admin.invoices.seller'), buyer: t('admin.invoices.buyer'), cui: t('admin.invoices.cui'), regCom: t('admin.invoices.regCom'), iban: t('admin.invoices.iban'),
    issued: t('admin.invoices.issued'), due: t('admin.invoices.due'), nr: t('admin.invoices.nr'),
    colItem: t('admin.invoices.itemDesc'), colQty: t('admin.invoices.qty'), colPrice: t('admin.invoices.unitPrice'), colTotal: t('admin.invoices.lineTotal'),
    subtotal: t('admin.invoices.subtotal'), vat: t('admin.invoices.vat'), total: t('admin.invoices.total'),
  });

  const inp: CSSProperties = { padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--bg-1)', color: 'var(--fg-0)', width: '100%', boxSizing: 'border-box' };
  const lbl: CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--fg-1)', display: 'block', marginBottom: 3 };
  const card: CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 8 };
  const money = (n: number) => `${n.toFixed(2)} ${draft?.currency || 'RON'}`;
  const partyFields = (which: 'seller' | 'buyer') => {
    const p = draft![which];
    return (
      <div style={{ display: 'grid', gap: 6 }}>
        <div><label style={lbl}>{t('admin.invoices.name')}</label><input style={inp} value={p.name} onChange={(e) => patchParty(which, { name: e.target.value })} /></div>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ flex: 1 }}><label style={lbl}>{t('admin.invoices.cui')}</label><input style={inp} value={p.cui} onChange={(e) => patchParty(which, { cui: e.target.value })} /></div>
          <div style={{ flex: 1 }}><label style={lbl}>{t('admin.invoices.regCom')}</label><input style={inp} value={p.regCom} onChange={(e) => patchParty(which, { regCom: e.target.value })} /></div>
        </div>
        <div><label style={lbl}>{t('admin.invoices.address')}</label><input style={inp} value={p.address} onChange={(e) => patchParty(which, { address: e.target.value })} /></div>
        <div><label style={lbl}>{t('admin.invoices.iban')}</label><input style={inp} value={p.iban} onChange={(e) => patchParty(which, { iban: e.target.value })} /></div>
      </div>
    );
  };

  return (
    <div style={{ marginTop: 12 }}>
      <h2 style={{ fontSize: 18, margin: 0 }}>{t('admin.invoices.title')}</h2>
      <p style={{ fontSize: 12, color: 'var(--fg-1)', margin: '4px 0 12px', maxWidth: 640 }}>{t('admin.invoices.hint')}</p>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 700 }}>{t('admin.invoices.pickClient')}</label>
        {clientOpts.length > 0 ? (
          <select style={{ ...inp, width: 260 }} value={uid} onChange={(e) => { setUid(e.target.value); setDraft(null); }}>
            <option value="">—</option>
            {clientOpts.map((c) => <option key={c.uid} value={c.uid}>{c.label}</option>)}
          </select>
        ) : <span style={{ fontSize: 13, color: 'var(--fg-1)' }}>{t('admin.invoices.noClient')}</span>}
      </div>

      {err ? <p role="alert" style={{ color: '#c0392b', fontSize: 13 }}>{err}</p> : null}

      {/* Setări furnizor — salvate o singură dată; pre-completează facturile noi (fără retastare). */}
      {!draft && (
        <div style={{ marginBottom: 12 }}>
          <button className="btn" style={{ padding: '5px 11px', fontSize: 12 }} onClick={() => setCfgOpen((o) => !o)}>{t('admin.invoices.sellerSettings')} {cfgOpen ? '▲' : '▼'}</button>
          {cfgOpen && (
            <div style={{ ...card, marginTop: 8 }}>
              <p style={{ fontSize: 12, color: 'var(--fg-1)', margin: '0 0 8px', maxWidth: 560 }}>{t('admin.invoices.sellerHint')}</p>
              <div style={{ display: 'grid', gap: 6, maxWidth: 520 }}>
                <div><label style={lbl}>{t('admin.invoices.name')}</label><input style={inp} value={cfg.seller.name} onChange={(e) => patchCfgSeller({ name: e.target.value })} /></div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div style={{ flex: 1 }}><label style={lbl}>{t('admin.invoices.cui')}</label><input style={inp} value={cfg.seller.cui} onChange={(e) => patchCfgSeller({ cui: e.target.value })} /></div>
                  <div style={{ flex: 1 }}><label style={lbl}>{t('admin.invoices.regCom')}</label><input style={inp} value={cfg.seller.regCom} onChange={(e) => patchCfgSeller({ regCom: e.target.value })} /></div>
                </div>
                <div><label style={lbl}>{t('admin.invoices.address')}</label><input style={inp} value={cfg.seller.address} onChange={(e) => patchCfgSeller({ address: e.target.value })} /></div>
                <div><label style={lbl}>{t('admin.invoices.iban')}</label><input style={inp} value={cfg.seller.iban} onChange={(e) => patchCfgSeller({ iban: e.target.value })} /></div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div style={{ flex: 1 }}><label style={lbl}>{t('admin.invoices.series')}</label><input style={inp} value={cfg.defaultSeries} onChange={(e) => setCfg((c) => ({ ...c, defaultSeries: e.target.value }))} /></div>
                  <div style={{ flex: 1 }}><label style={lbl}>{t('admin.invoices.vatRate')}</label><input type="number" min={0} max={100} style={inp} value={cfg.defaultVatRate} onChange={(e) => setCfg((c) => ({ ...c, defaultVatRate: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))} /></div>
                  <div style={{ flex: 1 }}><label style={lbl}>{t('admin.invoices.currency')}</label><input style={inp} value={cfg.defaultCurrency} onChange={(e) => setCfg((c) => ({ ...c, defaultCurrency: e.target.value }))} /></div>
                </div>
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: 12 }} disabled={busy} onClick={() => void saveConfig()}>{t('admin.invoices.save')}</button>
                {cfgSaved && <span style={{ fontSize: 12, color: '#1e7e34', fontWeight: 700 }}>✓</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {uid && !draft && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => startNew('proforma')}>+ {t('admin.invoices.proforma')}</button>
            <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => startNew('factura')}>+ {t('admin.invoices.factura')}</button>
          </div>
          {list.length === 0 ? <p style={{ fontSize: 13, color: 'var(--fg-1)' }}>{t('admin.invoices.empty')}</p> : (
            <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 10, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: 'var(--bg-0)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px' }}>{t('admin.invoices.kind')}</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px' }}>{t('admin.invoices.nr')}</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px' }}>{t('admin.invoices.issued')}</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px' }}>{t('admin.invoices.total')}</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px' }}>{t('admin.invoices.status')}</th>
                  <th style={{ padding: '6px 8px' }}></th>
                </tr></thead>
                <tbody>
                  {list.map((r) => {
                    const tt = invoiceTotals(r);
                    return (
                      <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '6px 8px' }}>{t(`admin.invoices.${r.kind}`)}</td>
                        <td style={{ padding: '6px 8px' }}>{[r.series, r.number].filter(Boolean).join(' ') || '—'}</td>
                        <td style={{ padding: '6px 8px' }}>{r.issuedAt || '—'}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{tt.total.toFixed(2)} {r.currency}</td>
                        <td style={{ padding: '6px 8px' }}>{t(`admin.invoices.status_${r.status}`)}</td>
                        <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                          <button className="btn" style={{ padding: '3px 9px', fontSize: 12, marginRight: 6 }} onClick={() => { setErr(''); setDraft(coerceToInvoice(r)); }}>{t('admin.invoices.edit')}</button>
                          <button className="btn" style={{ padding: '3px 9px', fontSize: 12, marginRight: 6 }} onClick={() => printInvoice(coerceToInvoice(r), pdfLabels(r.kind))}>📄 {t('admin.invoices.print')}</button>
                          <button className="btn" style={{ padding: '3px 9px', fontSize: 12, color: '#c0392b' }} onClick={() => void remove(r)}>{t('admin.invoices.delete')}</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Editor */}
      {draft && (
        <div style={{ ...card, borderColor: 'var(--accent)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8 }}>
            <div><label style={lbl}>{t('admin.invoices.kind')}</label>
              <select style={inp} value={draft.kind} onChange={(e) => patch({ kind: e.target.value as InvoiceKind })}>
                {INVOICE_KINDS.map((k) => <option key={k} value={k}>{t(`admin.invoices.${k}`)}</option>)}
              </select>
            </div>
            <div><label style={lbl}>{t('admin.invoices.series')}</label><input style={inp} value={draft.series} onChange={(e) => patch({ series: e.target.value })} /></div>
            <div><label style={lbl}>{t('admin.invoices.number')}</label><input style={inp} value={draft.number} onChange={(e) => patch({ number: e.target.value })} /></div>
            <div><label style={lbl}>{t('admin.invoices.issued')}</label><input type="date" style={inp} value={draft.issuedAt} onChange={(e) => patch({ issuedAt: e.target.value })} /></div>
            <div><label style={lbl}>{t('admin.invoices.due')}</label><input type="date" style={inp} value={draft.dueAt} onChange={(e) => patch({ dueAt: e.target.value })} /></div>
            <div><label style={lbl}>{t('admin.invoices.currency')}</label><input style={inp} value={draft.currency} onChange={(e) => patch({ currency: e.target.value })} /></div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
            <div style={{ flex: '1 1 260px' }}><div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{t('admin.invoices.seller')}</div>{partyFields('seller')}</div>
            <div style={{ flex: '1 1 260px' }}><div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{t('admin.invoices.buyer')}</div>{partyFields('buyer')}</div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{t('admin.invoices.items')}</div>
            {draft.items.map((it, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                <input style={{ ...inp, flex: '3 1 200px' }} placeholder={t('admin.invoices.itemDesc')} value={it.description} onChange={(e) => patchItem(i, { description: e.target.value })} />
                <input type="number" min={0} step="any" style={{ ...inp, flex: '1 1 70px' }} placeholder={t('admin.invoices.qty')} value={it.qty} onChange={(e) => patchItem(i, { qty: Number(e.target.value) || 0 })} />
                <input type="number" min={0} step="any" style={{ ...inp, flex: '1 1 90px' }} placeholder={t('admin.invoices.unitPrice')} value={it.unitPrice} onChange={(e) => patchItem(i, { unitPrice: Number(e.target.value) || 0 })} />
                <span style={{ flex: '1 1 90px', alignSelf: 'center', textAlign: 'right', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{money(lineTotal(it))}</span>
                <button className="btn" style={{ padding: '4px 9px', fontSize: 12 }} onClick={() => patch({ items: draft.items.filter((_, j) => j !== i) })}>✕</button>
              </div>
            ))}
            {draft.items.length < INVOICE_ITEMS_MAX && (
              <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => patch({ items: [...draft.items, { description: '', qty: 1, unitPrice: 0 }] })}>{t('admin.invoices.addItem')}</button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 12 }}>
            <div><label style={lbl}>{t('admin.invoices.vatRate')} (%)</label><input type="number" min={0} max={100} step="any" style={{ ...inp, width: 90 }} value={draft.vatRate} onChange={(e) => patch({ vatRate: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} /></div>
            <div><label style={lbl}>{t('admin.invoices.status')}</label>
              <select style={{ ...inp, width: 150 }} value={draft.status} onChange={(e) => patch({ status: e.target.value as InvoiceStatus })}>
                {INVOICE_STATUSES.map((st) => <option key={st} value={st}>{t(`admin.invoices.status_${st}`)}</option>)}
              </select>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right', fontSize: 13 }}>
              <div>{t('admin.invoices.subtotal')}: <strong>{money(totals.subtotal)}</strong></div>
              <div>{t('admin.invoices.vat')}: <strong>{money(totals.vat)}</strong></div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{t('admin.invoices.total')}: {money(totals.total)}</div>
            </div>
          </div>

          <div style={{ marginTop: 10 }}><label style={lbl}>{t('admin.invoices.notes')}</label><textarea style={{ ...inp, minHeight: 50 }} value={draft.notes} onChange={(e) => patch({ notes: e.target.value })} /></div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button className="btn" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => printInvoice(draft, pdfLabels(draft.kind))}>📄 {t('admin.invoices.print')}</button>
            <div style={{ flex: 1 }} />
            <button className="btn" style={{ padding: '6px 12px', fontSize: 13 }} disabled={busy} onClick={() => setDraft(null)}>{t('admin.invoices.cancel')}</button>
            <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 13 }} disabled={busy} onClick={() => void save()}>{busy ? t('admin.invoices.saving') : t('admin.invoices.save')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
