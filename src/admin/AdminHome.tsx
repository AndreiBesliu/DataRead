import { Fragment, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuthStore } from '../store/authStore';
import { coerceToClientProfile, type ClientProfile } from '../types/client';
import { coerceToOnboarding, type OnboardingData } from '../types/onboarding';
import { LEAD_NOTES_MAX, LEAD_STATUSES, coerceLeadNotes, coerceLeadStatus, type LeadStatus } from '../types/lead';
import LeadRequests from './LeadRequests';
import OpportunityBoard from './OpportunityBoard';
import LeadActivity from './LeadActivity';
import { LeadPrediction, ClientContacts } from './PredictionPanel';
import SuggestionsPanel from './SuggestionsPanel';
import ServiceOrdersPanel from './ServiceOrdersPanel';
import SeoPanel from './SeoPanel';
import HelpView from '../help/HelpView';
import { OPERATOR_HELP } from '../help/helpContent';
import MarketingCenter from './MarketingCenter';
import AutomationsPanel from './AutomationsPanel';
import InvoicesPanel from './InvoicesPanel';
import HealthPanel from './HealthPanel';
import DesignHome from './DesignHome';
import AdminsPanel, { BOOTSTRAP_ADMIN_UID } from './AdminsPanel';
import { csvCell } from '../utils/csv';
import type { AdminRole } from '../types/adminRole';
import { useAdminTheme } from '../theme/useAdminTheme';
import { ADMIN_THEMES, CUSTOM_THEME_ID, customThemeStyle, themeAnimClass, themeStyle } from '../theme/themes';
import ThemeEditor from '../theme/ThemeEditor';
import AuthPanel from '../app/AuthPanel';

type AdminView = 'leads' | 'suggestions' | 'serviceOrders' | 'seo' | 'marketing' | 'automation' | 'invoices' | 'design' | 'admins' | 'health' | 'help';

const VIEW_LABEL_KEY: Record<AdminView, string> = {
  leads: 'admin.navLeads',
  suggestions: 'admin.navSuggestions',
  serviceOrders: 'admin.navServiceOrders',
  seo: 'admin.navSeo',
  marketing: 'admin.navMarketing',
  automation: 'admin.navAutomation',
  invoices: 'admin.navInvoices',
  design: 'admin.navDesign',
  admins: 'admin.navAdmins',
  health: 'admin.navHealth',
  help: 'admin.navHelp',
};

// Comasare /admin (decizie Andrei, 21.06.2026): un singur tab principal „Administrare" adună operarea zilnică + sistemul
// (lead-uri/sugestii/automatizări/facturi/administratori/sănătate) ca SUB-tab-uri; Marketing, Design & Pagini și Ghid rămân
// tab-uri principale separate. Nav pe DOUĂ niveluri — grupul activ se DERIVĂ din `view` (nu ținem state separat).
type TopTab = 'admin' | 'marketing' | 'design' | 'help';
const TOP_TAB_ORDER: TopTab[] = ['admin', 'marketing', 'design', 'help'];
const TOP_TAB_LABEL_KEY: Record<TopTab, string> = {
  admin: 'admin.navAdministrare',
  marketing: 'admin.navMarketing',
  design: 'admin.navDesign',
  help: 'admin.navHelp',
};
const TOP_TAB_VIEWS: Record<TopTab, AdminView[]> = {
  admin: ['leads', 'suggestions', 'serviceOrders', 'seo', 'automation', 'invoices', 'admins', 'health'],
  marketing: ['marketing'],
  design: ['design'],
  help: ['help'],
};
const topTabOf = (v: AdminView): TopTab => TOP_TAB_ORDER.find((tt) => TOP_TAB_VIEWS[tt].includes(v)) || 'admin';

/** Cheia i18n a fiecărui status de pipeline. */
const STATUS_KEY: Record<LeadStatus, string> = {
  new: 'admin.statusNew',
  contacted: 'admin.statusContacted',
  won: 'admin.statusWon',
  lost: 'admin.statusLost',
};

const STATUS_COLOR: Record<LeadStatus, string> = {
  new: 'var(--accent, #2563eb)',
  contacted: '#b07b1e',
  won: '#1e7e34',
  lost: '#8a93a3',
};

interface ClientRow {
  uid: string;
  profile: ClientProfile;
}


interface LeadRow {
  id: string;
  data: OnboardingData;
  createdAt: unknown;
  status: LeadStatus;
  notes: string;
  clientUid: string;
  clientEmail: string;
}

function fmtTs(v: unknown): string {
  try {
    const d = (v as { toDate?: () => Date })?.toDate?.();
    return d ? d.toLocaleString('ro-RO') : '—';
  } catch {
    return '—';
  }
}

/** Detaliul unui onboarding/lead — refolosit de secțiunile Lead-uri și Clienți. */
function OnboardingDetail({ detail }: { detail: OnboardingData }) {
  const { t } = useTranslation();
  return (
    <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '4px 14px', margin: 0, fontSize: 13 }}>
      <dt style={{ fontWeight: 700 }}>{t('admin.fCompany')}</dt>
      <dd style={{ margin: 0 }}>{detail.companyName || '—'} {detail.cui && `(${t('admin.fCui')}: ${detail.cui})`}</dd>
      <dt style={{ fontWeight: 700 }}>{t('admin.fContact')}</dt>
      <dd style={{ margin: 0 }}>{[detail.contactName, detail.contactEmail, detail.contactPhone].filter(Boolean).join(' · ') || '—'}</dd>
      <dt style={{ fontWeight: 700 }}>{t('admin.fWebsite')}</dt>
      <dd style={{ margin: 0 }}>{detail.website || '—'}</dd>
      <dt style={{ fontWeight: 700 }}>{t('admin.fIndustry')}</dt>
      <dd style={{ margin: 0 }}>
        {detail.industry ? t(`onboarding.industries.${detail.industry}`) : '—'}
        {detail.industry === 'other' && detail.industryOther ? ` — ${detail.industryOther}` : ''}
      </dd>
      <dt style={{ fontWeight: 700 }}>{t('admin.fObjectives')}</dt>
      <dd style={{ margin: 0 }}>{detail.objectives.map((o) => t(`onboarding.objective.${o}`)).join(', ') || '—'}</dd>
      <dt style={{ fontWeight: 700 }}>{t('admin.fBudget')}</dt>
      <dd style={{ margin: 0 }}>{detail.adBudget ? t(`onboarding.budget.${detail.adBudget}`) : '—'}</dd>
      <dt style={{ fontWeight: 700 }}>{t('admin.fSocial')}</dt>
      <dd style={{ margin: 0 }}>{[detail.facebook, detail.instagram, detail.tiktok].filter(Boolean).join(' · ') || '—'}</dd>
      <dt style={{ fontWeight: 700 }}>{t('admin.fPackage')}</dt>
      <dd style={{ margin: 0 }}>{detail.packageInterest ? t(`pachete.${detail.packageInterest}.name`) : '—'}</dd>
      <dt style={{ fontWeight: 700 }}>{t('admin.fService')}</dt>
      <dd style={{ margin: 0 }}>{detail.serviceInterest ? t(`services.${detail.serviceInterest}.name`) : '—'}</dd>
      <dt style={{ fontWeight: 700 }}>{t('admin.fDescription')}</dt>
      <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{detail.description || '—'}</dd>
    </dl>
  );
}

/** Ecranul pentru ne-admini: ÎNREGISTREAZĂ automat o cerere de acces (adminRequests/{uid}) —
 *  „dacă cineva încearcă să se logheze prin /admin, declanșează o cerere care trebuie aprobată".
 *  Primul admin (bootstrap) e auto-aprobat de functions. Self-healing: și butonul Reverifică
 *  re-asigură documentul de cerere (dacă a fost șters / creat înaintea trigger-ului, recrearea
 *  lui re-declanșează fluxul), iar după înregistrare urmează o reverificare automată — fluxul
 *  de bootstrap merge fără nicio acțiune manuală. */
function RequestAccess({ uid, email, displayName, onRecheck }: { uid: string; email: string | null; displayName: string | null; onRecheck: () => void }) {
  const { t } = useTranslation();

  const ensureRequest = async (): Promise<void> => {
    try {
      const ref = doc(db, 'adminRequests', uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          email: email ?? '',
          displayName: displayName ?? '',
          requestedAt: serverTimestamp(),
          status: 'pending',
        });
      }
    } catch (e) {
      console.warn('admin request register failed:', e);
    }
  };

  useEffect(() => {
    let t1: ReturnType<typeof setTimeout> | null = null;
    let t2: ReturnType<typeof setTimeout> | null = null;
    void ensureRequest().then(() => {
      // Bootstrap-ul / o aprobare proaspătă durează câteva secunde (trigger → claim) —
      // reverificăm automat de două ori înainte să lăsăm utilizatorul să apese manual.
      t1 = setTimeout(onRecheck, 4000);
      t2 = setTimeout(onRecheck, 10000);
    });
    return () => {
      if (t1) clearTimeout(t1);
      if (t2) clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const recheck = () => {
    void ensureRequest().then(onRecheck);
  };

  return (
    <main data-page="admin-request" style={{ maxWidth: 560, margin: '0 auto', padding: '64px 24px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 26 }}>{t('admin.accessTitle')}</h1>
      <p style={{ color: 'var(--fg-1)' }}>{t('admin.accessBody')}</p>
      <p style={{ fontSize: 13, color: 'var(--fg-1)' }}>{t('admin.accessUid')}</p>
      <code style={{ display: 'inline-block', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: 13, userSelect: 'all' }}>
        {uid}
      </code>
      <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button className="btn btn-primary" onClick={recheck}>{t('admin.accessRecheck')}</button>
        <Link to="/" className="btn">{t('notFound.back')}</Link>
      </div>
    </main>
  );
}

/** Panoul intern al operatorilor — gate pe claim-ul `admin`. v1: cereri de acces, lead-urile
 *  formularului public și clienții (conturi — dormant până revine self-serve). */
export default function AdminHome() {
  const { t } = useTranslation();
  const { user, initializing } = useAuthStore();
  const [isAdmin, setIsAdmin] = useState<'checking' | boolean>('checking');
  const [myRole, setMyRole] = useState<AdminRole | null>(null);
  const [checkNonce, setCheckNonce] = useState(0);
  const [leads, setLeads] = useState<LeadRow[] | null>(null);
  const [clients, setClients] = useState<ClientRow[] | null>(null);
  const [openLead, setOpenLead] = useState<string | null>(null);
  const [openClient, setOpenClient] = useState<string | null>(null);
  const [clientDetail, setClientDetail] = useState<OnboardingData | null | 'loading'>(null);
  const [leadFilter, setLeadFilter] = useState<'all' | LeadStatus>('all');
  const [leadSearch, setLeadSearch] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [notesState, setNotesState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [aiCount, setAiCount] = useState<number | null>(null);
  const [view, setView] = useState<AdminView>('leads');
  const [linkSelect, setLinkSelect] = useState('');
  const { themeId, setThemeId, custom, setCustom } = useAdminTheme();
  const [editingTheme, setEditingTheme] = useState(false);

  // Opțiunile de client pentru Marketing Center (din lead-urile deja abonate).
  const leadOptions = useMemo(
    () => (leads ?? []).map((l) => ({ id: l.id, label: l.data.companyName || l.data.contactName || l.data.contactEmail || l.id })),
    [leads]
  );

  // Verifică claim-ul; un refresh forțat prinde claim-ul abia setat de trigger (bootstrap/aprobare).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setIsAdmin('checking');
    (async () => {
      const u = auth.currentUser;
      if (!u) return;
      try {
        let tok = await u.getIdTokenResult();
        if (tok.claims.admin !== true) tok = await u.getIdTokenResult(true);
        if (!cancelled) {
          setIsAdmin(tok.claims.admin === true);
          setMyRole(tok.claims.role === 'owner' ? 'owner' : tok.claims.admin === true ? 'operator' : null);
        }
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, checkNonce]);

  // Lead-urile formularului public (+ câmpurile de pipeline scrise de admini).
  useEffect(() => {
    if (isAdmin !== true) return;
    const q = query(collection(db, 'leads'), orderBy('createdAt', 'desc'), limit(200));
    return onSnapshot(q, (snap) => {
      const out: LeadRow[] = [];
      snap.forEach((d) => {
        const raw = d.data();
        out.push({
          id: d.id,
          data: coerceToOnboarding(raw),
          createdAt: raw.createdAt,
          status: coerceLeadStatus(raw.status),
          notes: coerceLeadNotes(raw.notes),
          clientUid: typeof raw.clientUid === 'string' ? raw.clientUid : '',
          clientEmail: typeof raw.clientEmail === 'string' ? raw.clientEmail : '',
        });
      });
      setLeads(out);
    }, (err) => {
      console.warn('admin leads listener:', err);
      setLeads([]);
    });
  }, [isAdmin]);

  // Contorul de generări AI al operatorului curent (luna în curs) — pentru statistici.
  useEffect(() => {
    if (isAdmin !== true || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'aiUsage', user.uid));
        const data = snap.exists() ? snap.data() : null;
        const month = new Date().toISOString().slice(0, 7);
        if (!cancelled) setAiCount(data && data.month === month && typeof data.count === 'number' ? data.count : 0);
      } catch {
        if (!cancelled) setAiCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, user]);

  // Clienții (conturi — relevant când revine self-serve).
  useEffect(() => {
    if (isAdmin !== true) return;
    const q = query(collection(db, 'clients'), orderBy('createdAt', 'desc'), limit(200));
    return onSnapshot(q, (snap) => {
      const out: ClientRow[] = [];
      snap.forEach((d) => {
        const p = coerceToClientProfile(d.data());
        if (p) out.push({ uid: d.id, profile: p });
      });
      setClients(out);
    }, (err) => {
      console.warn('admin clients listener:', err);
      setClients([]);
    });
  }, [isAdmin]);

  // Aprobarea/respingerea/revocarea administratorilor s-a mutat în tabul „Administratori" (AdminsPanel),
  // prin callable-ul owner-only `manageAdmin` (clientul nu mai scrie direct în admins/adminRequests).

  const setLeadStatus = async (id: string, status: LeadStatus) => {
    try {
      await updateDoc(doc(db, 'leads', id), { status, statusUpdatedAt: serverTimestamp() });
    } catch (e) {
      console.warn('lead status update failed:', e);
    }
  };

  const toggleLead = (l: LeadRow) => {
    if (openLead === l.id) {
      setOpenLead(null);
      return;
    }
    setOpenLead(l.id);
    setNotesDraft(l.notes);
    setNotesState('idle');
  };

  /** Șterge definitiv lead-ul + cererile lui + istoricele de versiuni (Firestore nu face cascade). */
  const deleteLead = async (id: string) => {
    if (!window.confirm(t('admin.leadDeleteConfirm'))) return;
    try {
      const reqs = await getDocs(collection(db, 'leads', id, 'requests'));
      for (const r of reqs.docs) {
        const vers = await getDocs(collection(r.ref, 'versions'));
        await Promise.all(vers.docs.map((v) => deleteDoc(v.ref)));
        await deleteDoc(r.ref);
      }
      // Campaniile clientului (colecție de nivel superior) + metricile lor.
      const camps = await getDocs(query(collection(db, 'campaigns'), where('leadId', '==', id)));
      for (const c of camps.docs) {
        const ms = await getDocs(collection(c.ref, 'metrics'));
        await Promise.all(ms.docs.map((mm) => deleteDoc(mm.ref)));
        await deleteDoc(c.ref);
      }
      await deleteDoc(doc(db, 'leads', id));
      if (openLead === id) setOpenLead(null);
    } catch (e) {
      console.warn('lead delete failed:', e);
    }
  };

  // Conectează un cont de client la lead → portalul clientului îi arată campaniile.
  // Backfill: clientUid se denormalizează pe campaniile existente ale lead-ului (rules le citesc).
  const linkClient = async (leadId: string, clientUid: string, clientEmail: string) => {
    if (!clientUid) return;
    try {
      await updateDoc(doc(db, 'leads', leadId), { clientUid, clientEmail });
      const camps = await getDocs(query(collection(db, 'campaigns'), where('leadId', '==', leadId)));
      await Promise.all(camps.docs.map((c) => updateDoc(c.ref, { clientUid })));
      // Cererile primesc clientUid → trigger-ul onRequestWrite oglindește livrabilele în portal.
      const reqs = await getDocs(collection(db, 'leads', leadId, 'requests'));
      await Promise.all(reqs.docs.map((r) => updateDoc(r.ref, { clientUid })));
      setLinkSelect('');
    } catch (e) {
      console.warn('link client failed:', e);
    }
  };

  const unlinkClient = async (leadId: string) => {
    try {
      await updateDoc(doc(db, 'leads', leadId), { clientUid: '', clientEmail: '' });
      const camps = await getDocs(query(collection(db, 'campaigns'), where('leadId', '==', leadId)));
      await Promise.all(camps.docs.map((c) => updateDoc(c.ref, { clientUid: '' })));
      // Golirea clientUid pe cereri → trigger-ul șterge oglinda livrabilelor din portalul fostului client.
      const reqs = await getDocs(collection(db, 'leads', leadId, 'requests'));
      await Promise.all(reqs.docs.map((r) => updateDoc(r.ref, { clientUid: '' })));
    } catch (e) {
      console.warn('unlink client failed:', e);
    }
  };

  const saveNotes = async (id: string) => {
    setNotesState('saving');
    try {
      await updateDoc(doc(db, 'leads', id), {
        notes: notesDraft.slice(0, LEAD_NOTES_MAX),
        notesUpdatedAt: serverTimestamp(),
      });
      setNotesState('saved');
    } catch (e) {
      console.warn('notes save failed:', e);
      setNotesState('idle');
    }
  };

  const exportCsv = (rows: LeadRow[]) => {
    const header = [
      t('admin.colDate'), t('admin.colCompany'), t('admin.fCui'), t('admin.fWebsite'),
      t('admin.fContact'), t('admin.colEmail'), t('admin.colPhone'), t('admin.fIndustry'),
      t('admin.fObjectives'), t('admin.fBudget'), t('admin.fPackage'), t('admin.fService'), t('admin.colStatus'),
      t('admin.notesLabel'), t('admin.fDescription'),
    ];
    const lines = rows.map((l) =>
      [
        fmtTs(l.createdAt),
        l.data.companyName,
        l.data.cui,
        l.data.website,
        l.data.contactName,
        l.data.contactEmail,
        l.data.contactPhone,
        l.data.industry ? t(`onboarding.industries.${l.data.industry}`) : '',
        l.data.objectives.map((o) => t(`onboarding.objective.${o}`)).join(', '),
        l.data.adBudget ? t(`onboarding.budget.${l.data.adBudget}`) : '',
        l.data.packageInterest ? t(`pachete.${l.data.packageInterest}.name`) : '',
        l.data.serviceInterest ? t(`services.${l.data.serviceInterest}.name`) : '',
        t(STATUS_KEY[l.status]),
        l.notes,
        l.data.description,
      ].map(csvCell).join(';')
    );
    // BOM pentru diacritice corecte în Excel; separator ';' (convenția RO). csvCell = anti formula-injection
    // (prefix ' pe =,+,-,@,tab,CR) — datele de lead vin din formularul PUBLIC anonim, nu au încredere.
    const csv = '﻿' + [header.map(csvCell).join(';'), ...lines].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dataread-leads.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleClientDetail = async (uid: string) => {
    if (openClient === uid) {
      setOpenClient(null);
      setClientDetail(null);
      return;
    }
    setOpenClient(uid);
    setClientDetail('loading');
    try {
      const snap = await getDoc(doc(db, 'clients', uid, 'onboarding', 'main'));
      setClientDetail(snap.exists() ? coerceToOnboarding(snap.data()) : null);
    } catch {
      setClientDetail(null);
    }
  };

  if (initializing) {
    return <main data-page="admin-loading" style={{ padding: 64, textAlign: 'center', color: 'var(--fg-1)' }}>…</main>;
  }
  if (!user) return <AuthPanel />;

  if (isAdmin === 'checking') {
    return <main data-page="admin-loading" style={{ padding: 64, textAlign: 'center', color: 'var(--fg-1)' }}>{t('admin.loading')}</main>;
  }

  if (isAdmin === false) {
    return <RequestAccess uid={user.uid} email={user.email} displayName={user.displayName} onRecheck={() => setCheckNonce((n) => n + 1)} />;
  }

  const td: CSSProperties = { padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: 14, textAlign: 'left' };
  const sectionBox: CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflowX: 'auto', marginBottom: 28 };

  const isCustom = themeId === CUSTOM_THEME_ID;
  const scopeStyle = isCustom ? customThemeStyle(custom) : themeStyle(themeId);
  const animClass = isCustom ? themeAnimClass(custom.animation) : '';

  return (
    <div className="admin-scope" style={scopeStyle}>
    {animClass ? <div className={`admin-fx ${animClass}`} aria-hidden="true" /> : null}
    <main data-page="admin-home" style={{ position: 'relative', zIndex: 1, maxWidth: 'var(--max-width)', margin: '0 auto', padding: '28px 24px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>{t('admin.title')}</h1>
        <span style={{ color: 'var(--fg-1)', fontSize: 14 }}>{user.email}</span>
        <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--fg-1)' }}>
          🎨 {t('admin.theme')}
          <select
            value={themeId}
            onChange={(e) => setThemeId(e.target.value)}
            style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 13, background: 'var(--bg-1)', color: 'var(--fg-0)' }}
          >
            {ADMIN_THEMES.map((th) => <option key={th.id} value={th.id}>{th.label}</option>)}
            <option value={CUSTOM_THEME_ID}>{t('admin.themeEditor.custom')}</option>
          </select>
        </label>
        {isCustom ? (
          <button
            onClick={() => setEditingTheme(true)}
            style={{ border: '1px solid var(--accent)', background: 'var(--accent)', color: 'var(--accent-contrast)', borderRadius: 6, padding: '5px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            {t('admin.themeEditor.edit')}
          </button>
        ) : null}
      </header>

      {/* Statistici operaționale — derivate live din lead-uri + contorul AI al operatorului. */}
      {(() => {
        const all = leads ?? [];
        const won = all.filter((l) => l.status === 'won').length;
        const lost = all.filter((l) => l.status === 'lost').length;
        const decided = won + lost;
        const chip: CSSProperties = { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 999, padding: '4px 14px', fontSize: 13, fontWeight: 600 };
        return (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
            <span style={chip}>{t('admin.leadsTitle').split(' ')[0]}: {all.length}</span>
            <span style={{ ...chip, color: 'var(--accent, #2563eb)' }}>{t(STATUS_KEY.new)}: {all.filter((l) => l.status === 'new').length}</span>
            <span style={{ ...chip, color: '#b07b1e' }}>{t(STATUS_KEY.contacted)}: {all.filter((l) => l.status === 'contacted').length}</span>
            <span style={{ ...chip, color: '#1e7e34' }}>{t(STATUS_KEY.won)}: {won}</span>
            {decided > 0 && <span style={chip}>{t('admin.statsConversion')}: {Math.round((won / decided) * 100)}%</span>}
            {aiCount !== null && <span style={chip}>🤖 {t('admin.statsAi', { count: aiCount })}</span>}
          </div>
        );
      })()}

      {/* Nav pe DOUĂ niveluri: tab-uri principale (Administrare comasează operarea + sistemul) + sub-tab-uri în Administrare.
          Grupul activ se derivă din `view` (wrap pe ecrane înguste ca să nu se reverse). */}
      {(() => {
        const top = topTabOf(view);
        return (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, borderBottom: '2px solid var(--border)', marginBottom: top === 'admin' ? 0 : 22 }}>
              {TOP_TAB_ORDER.map((tt) => {
                const on = top === tt;
                return (
                  <button
                    key={tt}
                    onClick={() => { if (topTabOf(view) !== tt) setView(TOP_TAB_VIEWS[tt][0]); }}
                    style={{
                      border: 'none', background: 'none', padding: '8px 14px', marginBottom: -2, fontSize: 15,
                      fontWeight: on ? 800 : 600,
                      color: on ? 'var(--accent, #2563eb)' : 'var(--fg-1)',
                      borderBottom: on ? '2px solid var(--accent, #2563eb)' : '2px solid transparent',
                      cursor: 'pointer',
                    }}
                  >
                    {t(TOP_TAB_LABEL_KEY[tt])}
                  </button>
                );
              })}
            </div>
            {top === 'admin' && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, borderBottom: '1px solid var(--border)', marginBottom: 22, paddingTop: 10 }}>
                {TOP_TAB_VIEWS.admin.map((v) => {
                  const on = view === v;
                  return (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      style={{
                        border: 'none', background: 'none', padding: '6px 14px', fontSize: 14,
                        fontWeight: on ? 800 : 600,
                        color: on ? 'var(--accent, #2563eb)' : 'var(--fg-1)',
                        borderBottom: on ? '2px solid var(--accent, #2563eb)' : '2px solid transparent',
                        cursor: 'pointer',
                      }}
                    >
                      {t(VIEW_LABEL_KEY[v])}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        );
      })()}

      {view === 'suggestions' && <SuggestionsPanel onNavigate={(v) => setView(v as AdminView)} />}
      {view === 'serviceOrders' && <ServiceOrdersPanel />}
      {view === 'seo' && <SeoPanel />}
      {view === 'help' && <div style={{ marginTop: 12 }}><h2 style={{ fontSize: 18, margin: '0 0 6px' }}>{t('help.title')}</h2><HelpView sections={OPERATOR_HELP} /></div>}
      {view === 'marketing' && <MarketingCenter leads={leadOptions} />}
      {view === 'automation' && <AutomationsPanel />}
      {view === 'invoices' && <InvoicesPanel />}
      {view === 'health' && <HealthPanel />}
      {view === 'design' && <DesignHome adminUid={user.uid} />}
      {view === 'admins' && <AdminsPanel myUid={user.uid} isOwner={myRole === 'owner' || user.uid === BOOTSTRAP_ADMIN_UID} />}

      {view === 'leads' && (<>
      {/* Lead-urile din formularul public /start — pipeline-ul operațional. */}
      {(() => {
        const q = leadSearch.trim().toLowerCase();
        const all = (leads ?? []).filter(
          (l) =>
            !q ||
            [l.data.companyName, l.data.contactName, l.data.contactEmail, l.data.contactPhone]
              .join(' ')
              .toLowerCase()
              .includes(q)
        );
        const counts = { all: all.length } as Record<'all' | LeadStatus, number>;
        for (const s of LEAD_STATUSES) counts[s] = all.filter((l) => l.status === s).length;
        const visible = leadFilter === 'all' ? all : all.filter((l) => l.status === leadFilter);
        return (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '0 0 10px' }}>
              <h2 style={{ fontSize: 18, margin: 0 }}>{t('admin.leadsTitle')}</h2>
              {counts.new > 0 && (
                <span style={{ background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 700, borderRadius: 999, padding: '2px 10px' }}>
                  {t('admin.leadsNewCount', { count: counts.new })}
                </span>
              )}
              {all.length > 0 && (
                <button className="btn" style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: 12 }} onClick={() => exportCsv(visible)}>
                  ⬇ {t('admin.exportCsv')}
                </button>
              )}
            </div>

            {leads === null && <p style={{ color: 'var(--fg-1)', fontSize: 14 }}>{t('admin.loading')}</p>}
            {leads !== null && leads.length === 0 && <p style={{ color: 'var(--fg-1)', fontSize: 14, marginBottom: 28 }}>{t('admin.leadsEmpty')}</p>}

            {leads !== null && leads.length > 0 && (
              <>
                <input
                  type="search"
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                  placeholder={t('admin.searchPlaceholder')}
                  style={{ width: '100%', maxWidth: 420, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, marginBottom: 10, background: 'var(--bg-1)' }}
                />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  {(['all', ...LEAD_STATUSES] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setLeadFilter(f)}
                      style={{
                        border: leadFilter === f ? '1px solid var(--accent)' : '1px solid var(--border)',
                        background: leadFilter === f ? 'var(--accent)' : 'var(--bg-1)',
                        color: leadFilter === f ? '#fff' : 'var(--fg-1)',
                        borderRadius: 999,
                        padding: '3px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {f === 'all' ? t('admin.filterAll') : t(STATUS_KEY[f])} ({counts[f]})
                    </button>
                  ))}
                </div>

                <div style={sectionBox}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-0)' }}>
                        <th style={td}>{t('admin.colDate')}</th>
                        <th style={td}>{t('admin.colCompany')}</th>
                        <th style={td}>{t('admin.colEmail')}</th>
                        <th style={td}>{t('admin.colPhone')}</th>
                        <th style={td}>{t('admin.fPackage')}</th>
                        <th style={td}>{t('admin.colStatus')}</th>
                        <th style={td}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((l) => (
                        <Fragment key={l.id}>
                          <tr style={l.status === 'new' ? { background: 'rgba(37, 99, 235, 0.06)' } : undefined}>
                            <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtTs(l.createdAt)}</td>
                            <td style={{ ...td, fontWeight: l.status === 'new' ? 700 : 400 }}>
                              {l.data.companyName || '—'}
                              {(l.data as unknown as Record<string, unknown>).source === 'self-discovery' ? <span title={t('admin.leadSelfDiscovery')} style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#fff', background: 'var(--accent)', borderRadius: 4, padding: '1px 5px' }}>🔎 Self</span> : null}
                              {l.data.serviceInterest ? <span title={t('admin.fService')} style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'var(--fg-1)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px' }}>{t(`services.${l.data.serviceInterest}.name`)}</span> : null}
                            </td>
                            <td style={td}>{l.data.contactEmail || '—'}</td>
                            <td style={td}>{l.data.contactPhone || '—'}</td>
                            <td style={td}>{l.data.packageInterest ? t(`pachete.${l.data.packageInterest}.name`) : '—'}</td>
                            <td style={td}>
                              <select
                                value={l.status}
                                onChange={(e) => void setLeadStatus(l.id, e.target.value as LeadStatus)}
                                style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '3px 6px', fontSize: 12, fontWeight: 700, color: STATUS_COLOR[l.status], background: 'var(--bg-1)' }}
                              >
                                {LEAD_STATUSES.map((s) => (
                                  <option key={s} value={s}>{t(STATUS_KEY[s])}</option>
                                ))}
                              </select>
                            </td>
                            <td style={td}>
                              <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => toggleLead(l)}>
                                {openLead === l.id ? t('admin.hideDetail') : t('admin.viewDetail')}
                              </button>
                            </td>
                          </tr>
                          {openLead === l.id && (
                            <tr>
                              <td style={{ ...td, background: 'var(--bg-0)' }} colSpan={7}>
                                <OnboardingDetail detail={l.data} />
                                <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                                  <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700 }}>
                                    {t('admin.notesLabel')}
                                    <textarea
                                      value={notesDraft}
                                      maxLength={LEAD_NOTES_MAX}
                                      placeholder={t('admin.notesPlaceholder')}
                                      onChange={(e) => {
                                        setNotesDraft(e.target.value);
                                        setNotesState('idle');
                                      }}
                                      style={{ minHeight: 70, resize: 'vertical', fontFamily: 'inherit', fontSize: 13, fontWeight: 400, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-1)' }}
                                    />
                                  </label>
                                  <button
                                    className="btn btn-primary"
                                    style={{ marginTop: 8, padding: '5px 14px', fontSize: 12 }}
                                    disabled={notesState === 'saving'}
                                    onClick={() => void saveNotes(l.id)}
                                  >
                                    {notesState === 'saving' ? t('admin.notesSaving') : notesState === 'saved' ? t('admin.notesSaved') : t('admin.notesSave')}
                                  </button>
                                </div>
                                {user && <OpportunityBoard leadId={l.id} adminUid={user.uid} clientUid={l.clientUid} />}
                                {user && <LeadRequests leadId={l.id} adminUid={user.uid} clientUid={l.clientUid} />}
                                {user && <LeadActivity leadId={l.id} adminUid={user.uid} />}
                                {user && <LeadPrediction leadId={l.id} adminUid={user.uid} clientUid={l.clientUid} />}

                                {/* Cont client (portal): conectează un cont logat la datele acestui client. */}
                                <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                                  <strong style={{ fontSize: 13 }}>{t('admin.linkClientTitle')}</strong>
                                  {l.clientUid ? (
                                    <div style={{ marginTop: 6, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                                      <span style={{ fontSize: 13 }}>✓ {t('admin.linkConnected')} <strong>{l.clientEmail || l.clientUid}</strong></span>
                                      <button className="btn" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => void unlinkClient(l.id)}>{t('admin.linkUnlink')}</button>
                                    </div>
                                  ) : clients && clients.length > 0 ? (
                                    <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                      <select value={linkSelect} onChange={(e) => setLinkSelect(e.target.value)} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 13, background: 'var(--bg-1)' }}>
                                        <option value="">{t('admin.linkPick')}</option>
                                        {clients.map((c) => <option key={c.uid} value={c.uid}>{c.profile.email || c.uid}</option>)}
                                      </select>
                                      <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: 12 }} disabled={!linkSelect} onClick={() => { const c = clients.find((x) => x.uid === linkSelect); void linkClient(l.id, linkSelect, c?.profile.email || ''); }}>{t('admin.linkBtn')}</button>
                                    </div>
                                  ) : (
                                    <p style={{ fontSize: 12, color: 'var(--fg-1)', margin: '6px 0 0' }}>{t('admin.linkNoAccounts')}</p>
                                  )}
                                </div>

                                <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10, textAlign: 'right' }}>
                                  <button className="btn" style={{ padding: '4px 12px', fontSize: 12, color: '#c0392b' }} onClick={() => void deleteLead(l.id)}>
                                    {t('admin.leadDelete')}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        );
      })()}

      {/* Clienți cu cont (dormant până revine self-serve-ul Stripe). */}
      <h2 style={{ fontSize: 18, margin: '0 0 10px' }}>{t('admin.clientsTitle')}</h2>
      {clients === null && <p style={{ color: 'var(--fg-1)', fontSize: 14 }}>{t('admin.loading')}</p>}
      {clients !== null && clients.length === 0 && <p style={{ color: 'var(--fg-1)', fontSize: 14 }}>{t('admin.empty')}</p>}
      {clients !== null && clients.length > 0 && (
        <div style={sectionBox}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-0)' }}>
                <th style={td}>{t('admin.colEmail')}</th>
                <th style={td}>{t('admin.colName')}</th>
                <th style={td}>{t('admin.colOnboarding')}</th>
                <th style={td}>{t('admin.colSubscription')}</th>
                <th style={td}></th>
              </tr>
            </thead>
            <tbody>
              {clients.map(({ uid, profile }) => (
                <Fragment key={uid}>
                  <tr>
                    <td style={td}>{profile.email ?? '—'}</td>
                    <td style={td}>{profile.displayName ?? '—'}</td>
                    <td style={td}>{profile.onboardingStatus === 'submitted' ? `✓ ${t('admin.onboardingYes')}` : t('admin.onboardingNo')}</td>
                    <td style={{ ...td, fontWeight: 600, color: profile.entitlement?.active ? '#1e7e34' : 'var(--fg-1)' }}>
                      {profile.entitlement?.active ? t('admin.subActive') : t('admin.subNone')}
                    </td>
                    <td style={td}>
                      <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => void toggleClientDetail(uid)}>
                        {openClient === uid ? t('admin.hideDetail') : t('admin.viewDetail')}
                      </button>
                    </td>
                  </tr>
                  {openClient === uid && (
                    <tr>
                      <td style={{ ...td, background: 'var(--bg-0)' }} colSpan={5}>
                        {clientDetail === 'loading' && <span style={{ color: 'var(--fg-1)' }}>{t('admin.loading')}</span>}
                        {clientDetail === null && <span style={{ color: 'var(--fg-1)' }}>{t('admin.detailEmpty')}</span>}
                        {clientDetail !== null && clientDetail !== 'loading' && <OnboardingDetail detail={clientDetail} />}
                        {clientDetail !== 'loading' && <ClientContacts uid={uid} />}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </>)}
    </main>
    {editingTheme ? <ThemeEditor value={custom} onChange={setCustom} onClose={() => setEditingTheme(false)} /> : null}
    </div>
  );
}
