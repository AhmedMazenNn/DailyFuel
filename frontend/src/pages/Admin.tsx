import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, LoaderCircle, Search, ShieldCheck, Trash2, UserCheck, UserRound, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { json, request } from '../utils/api';
import { card, inputBase, inputBorder, primaryButton, secondaryButton } from '../utils/styles';
import { PageHeader } from '../components/ui/PageHeader';
import type { AdminUser, AdminUserDetail, AdminUsersPage } from '../types/admin';

const copy = {
  en: {
    title: 'Account management', intro: 'Manage DailyFuel accounts in one place.', hero: 'Your community, at a glance', heroHint: 'Administrator access · Account controls and change history',
    total: 'Total accounts', active: 'Active', inactive: 'Inactive', admins: 'Administrators', all: 'All accounts', admin: 'Administrator', member: 'Member',
    search: 'Search accounts', searchHint: 'Search by name or email', filter: 'Account status', results: 'Accounts', manage: 'Manage account',
    empty: 'No accounts found', emptyHint: 'Try a different name, email, or status.', retry: 'Try again', loading: 'Loading accounts…', previous: 'Previous page', next: 'Next page', page: 'Page', of: 'of',
    edit: 'Edit account', close: 'Close account details', name: 'Name', email: 'Email address', timezone: 'Time zone', timezoneHint: 'Use an IANA time zone, such as Africa/Cairo.', language: 'Language', unit: 'Weight unit', joined: 'Joined', lastLogin: 'Last sign-in', never: 'Never', role: 'Role',
    activeHint: 'Inactive accounts cannot sign in. Their saved data is retained.', protected: 'Administrator accounts are protected from deactivation and deletion.',
    save: 'Save changes', saving: 'Saving…', saved: 'Account updated', cancel: 'Cancel', activity: 'Account activity', privacy: 'Counts only. Private nutrition records and photos are not shown.', meals: 'Meals', foods: 'Saved foods', weeks: 'Progress weeks', photos: 'Photos', history: 'Change history', noHistory: 'No account changes recorded yet.',
    danger: 'Delete account', dangerHint: 'Permanently remove this account and all its saved meals, foods, progress records, and private photos. This cannot be undone.', confirm: 'Type the account email to confirm', delete: 'Permanently delete account', deleting: 'Deleting…', deleted: 'Account deleted', restricted: 'Administrator access required', restrictedHint: 'This page is available only to administrators.', loadingDetail: 'Loading account details…', editHint: 'Update account details and access. Changes are recorded in the audit history.',
  },
  ar: {
    title: 'إدارة الحسابات', intro: 'إدارة حسابات DailyFuel من مكان واحد.', hero: 'نظرة عامة على المستخدمين', heroHint: 'صلاحيات المسؤول · إدارة الحسابات وسجل التغييرات',
    total: 'إجمالي الحسابات', active: 'نشط', inactive: 'غير نشط', admins: 'المسؤولون', all: 'كل الحسابات', admin: 'مسؤول', member: 'مستخدم',
    search: 'البحث في الحسابات', searchHint: 'ابحث بالاسم أو البريد الإلكتروني', filter: 'حالة الحساب', results: 'الحسابات', manage: 'إدارة الحساب', empty: 'لا توجد حسابات', emptyHint: 'جرّب اسمًا أو بريدًا أو حالة مختلفة.', retry: 'حاول مجددًا', loading: 'جارٍ تحميل الحسابات…', previous: 'الصفحة السابقة', next: 'الصفحة التالية', page: 'صفحة', of: 'من',
    edit: 'تعديل الحساب', close: 'إغلاق تفاصيل الحساب', name: 'الاسم', email: 'البريد الإلكتروني', timezone: 'المنطقة الزمنية', timezoneHint: 'استخدم منطقة زمنية مثل Africa/Cairo.', language: 'اللغة', unit: 'وحدة الوزن', joined: 'تاريخ التسجيل', lastLogin: 'آخر تسجيل دخول', never: 'لم يسجل الدخول', role: 'الصلاحية',
    activeHint: 'لا تستطيع الحسابات غير النشطة تسجيل الدخول. تبقى بياناتها محفوظة.', protected: 'حسابات المسؤولين محمية من التعطيل والحذف.', save: 'حفظ التغييرات', saving: 'جارٍ الحفظ…', saved: 'تم تحديث الحساب', cancel: 'إلغاء', activity: 'نشاط الحساب', privacy: 'أعداد فقط. لا تظهر سجلات التغذية والصور الخاصة.', meals: 'الوجبات', foods: 'الأطعمة المحفوظة', weeks: 'أسابيع التقدم', photos: 'الصور', history: 'سجل التغييرات', noHistory: 'لا توجد تغييرات مسجلة حتى الآن.',
    danger: 'حذف الحساب', dangerHint: 'سيتم حذف الحساب وجميع وجباته وأطعمته وسجلات تقدمه وصوره الخاصة نهائيًا. لا يمكن التراجع عن هذا الإجراء.', confirm: 'اكتب البريد الإلكتروني للحساب للتأكيد', delete: 'حذف الحساب نهائيًا', deleting: 'جارٍ الحذف…', deleted: 'تم حذف الحساب', restricted: 'يتطلب صلاحيات المسؤول', restrictedHint: 'هذه الصفحة متاحة للمسؤولين فقط.', loadingDetail: 'جارٍ تحميل تفاصيل الحساب…', editHint: 'حدّث بيانات الحساب وصلاحية الدخول. تسجل التغييرات في سجل التدقيق.',
  },
};
type Draft = Pick<AdminUser, 'email' | 'name' | 'isActive' | 'timezone' | 'language' | 'weightUnit'>;
const draftOf = (user: AdminUser): Draft => ({ email: user.email, name: user.name, isActive: user.isActive, timezone: user.timezone, language: user.language, weightUnit: user.weightUnit });
const field = `${inputBase} ${inputBorder()} min-h-[48px]`;

export function Admin() {
  const { session, refresh } = useAuth();
  const { lang, fmt } = useApp();
  const c = copy[lang];
  const allowed = !!session?.user?.isAdmin;
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<AdminUsersPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailRevision, setDetailRevision] = useState(0);
  const [pending, setPending] = useState<'save' | 'delete' | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const panel = useRef<HTMLDivElement>(null);
  const listTitle = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    setLoading(true); setError('');
    const params = new URLSearchParams({ search: query, status, page: String(page) });
    void request<AdminUsersPage>(`admin/users/?${params}`, { signal: controller.signal }).then(value => {
      if (!controller.signal.aborted) { setData(value); if (value.page !== page) setPage(value.page); }
    }).catch(cause => { if (!controller.signal.aborted) setError((cause as Error).message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [allowed, query, status, page, revision]);
  useEffect(() => {
    if (!allowed || !selectedId) return;
    const controller = new AbortController();
    setDetailLoading(true); setDetailError(''); setDetail(null); setDraft(null); setShowDelete(false); setConfirmation(''); setNewPassword('');
    void request<AdminUserDetail>(`admin/users/${selectedId}/`, { signal: controller.signal }).then(value => {
      if (!controller.signal.aborted) { setDetail(value); setDraft(draftOf(value)); }
    }).catch(cause => { if (!controller.signal.aborted) setDetailError((cause as Error).message); }).finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    panel.current?.focus();
    return () => controller.abort();
  }, [allowed, selectedId, detailRevision]);
  const date = (value: string | null) => value ? new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : c.never;
  const close = () => { if (pending) return; setSelectedId(null); setDetail(null); setDraft(null); setDetailError(''); listTitle.current?.focus(); };
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!detail || !draft || pending) return;
    setPending('save'); setDetailError('');
    try {
      const updated = await json<AdminUserDetail>(`admin/users/${detail.id}/`, 'PATCH', { ...draft, name: draft.name.trim(), email: draft.email.trim(), timezone: draft.timezone.trim(), version: detail.version, ...(newPassword ? { newPassword } : {}) });
      if (detail.id === session?.user?.id) await refresh();
      setNewPassword(''); setDetail(updated); setDraft(draftOf(updated)); setRevision(n => n + 1); setShowDelete(false); setConfirmation(''); toast.success(c.saved);
    } catch (cause) { setDetailError((cause as Error).message); } finally { setPending(null); }
  };
  const remove = async (event: FormEvent) => {
    event.preventDefault(); if (!detail || pending || detail.isAdmin || confirmation !== detail.email) return;
    setPending('delete'); setDetailError('');
    try {
      await json(`admin/users/${detail.id}/`, 'DELETE', { confirmationEmail: confirmation, version: detail.version });
      setSelectedId(null); setDetail(null); setDraft(null); setRevision(n => n + 1); listTitle.current?.focus(); toast.success(c.deleted);
    } catch (cause) { setDetailError((cause as Error).message); } finally { setPending(null); }
  };
  if (!allowed) return <section className={`${card} p-8 text-center`}><ShieldCheck className="mx-auto mb-3 h-10 w-10 text-brand-700" /><h1 className="font-display text-xl font-bold">{c.restricted}</h1><p className="mt-2 text-ink-soft">{c.restrictedHint}</p></section>;
  return <>
    <PageHeader title={c.title} intro={c.intro} />
    <section className="hero-surface mb-5 rounded-[28px] p-5 text-white shadow-hero sm:p-7">
      <div className="flex items-center gap-3"><span className="rounded-2xl bg-white/15 p-3"><ShieldCheck className="h-7 w-7" aria-hidden /></span><div><h2 className="font-display text-xl font-bold sm:text-2xl">{c.hero}</h2><p className="mt-1 text-sm text-white/85">{c.heroHint}</p></div></div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{([['total', Users], ['active', UserCheck], ['inactive', UserRound], ['admins', ShieldCheck]] as const).map(([key, Icon]) => <div key={key} className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/20 sm:p-4"><div className="flex items-center gap-2 text-sm text-white/85"><Icon className="h-4 w-4" aria-hidden />{c[key]}</div><p className="mt-2 font-display text-2xl font-extrabold tabular">{data ? fmt(data.summary[key], 0) : '—'}</p></div>)}</div>
    </section>
    <div className={`grid items-start gap-5 ${selectedId ? 'xl:grid-cols-[minmax(0,1fr)_minmax(340px,1fr)]' : ''}`}>
      <section className={`${card} min-w-0 overflow-hidden`} aria-busy={loading}>
        <div className="border-b border-line p-5"><h2 ref={listTitle} tabIndex={-1} className="font-display text-lg font-bold outline-none">{c.results}{data && <span className="ms-2 text-sm font-normal text-ink-faint">({fmt(data.count, 0)})</span>}</h2>
          <form className="mt-4 flex flex-wrap gap-3" onSubmit={event => { event.preventDefault(); setQuery(search.trim()); setPage(1); }}><div className="min-w-0 flex-1 basis-48"><label htmlFor="admin-search" className="sr-only">{c.search}</label><input id="admin-search" value={search} onChange={event => setSearch(event.target.value)} placeholder={c.searchHint} className={field} /></div><button className={secondaryButton} type="submit" aria-label={c.search}><Search className="h-5 w-5" /><span className="sm:hidden">{c.search}</span></button><div className="w-full"><label htmlFor="admin-status" className="mb-1.5 block text-xs font-semibold text-ink-soft">{c.filter}</label><select id="admin-status" className={field} value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="all">{c.all}</option><option value="active">{c.active}</option><option value="inactive">{c.inactive}</option><option value="admin">{c.admins}</option></select></div></form>
        </div>
        {error ? <div className="p-5"><p role="alert" className="break-words text-sm text-red-700">{error}</p><button className={`${secondaryButton} mt-3`} onClick={() => setRevision(n => n + 1)}>{c.retry}</button></div> : loading ? <div role="status" className="flex items-center justify-center gap-3 p-10 text-sm text-ink-soft"><LoaderCircle className="h-5 w-5 animate-spin" />{c.loading}</div> : !data?.results.length ? <div className="p-10 text-center"><Users className="mx-auto mb-3 h-8 w-8 text-ink-faint" aria-hidden /><p className="font-semibold">{c.empty}</p><p className="mt-1 text-sm text-ink-soft">{c.emptyHint}</p></div> : <ul className="divide-y divide-line">{data.results.map(user => <li key={user.id} className={`p-4 sm:p-5 ${selectedId === user.id ? 'bg-brand-50' : ''}`}><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-700 font-bold" aria-hidden>{(user.name || user.email).slice(0, 2).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate font-semibold">{user.name || user.email}</p><p dir="ltr" className="truncate text-start text-sm text-ink-soft">{user.email}</p><div className="mt-2 flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.isActive ? 'bg-protein-soft text-protein-ink' : 'bg-fat-soft text-fat-ink'}`}>{user.isActive ? c.active : c.inactive}</span><span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs text-brand-700">{user.isAdmin ? c.admin : c.member}</span></div></div></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-ink-faint">{c.joined}: {date(user.joinedAt)}</p><button type="button" disabled={!!pending} aria-pressed={selectedId === user.id} className={`${secondaryButton} disabled:opacity-50`} onClick={() => setSelectedId(user.id)}>{c.manage}<ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden /></button></div></li>)}</ul>}
        {data && data.pages > 1 && <nav aria-label={c.results} className="flex items-center justify-between gap-2 border-t border-line p-4"><button className={`${secondaryButton} disabled:opacity-50`} aria-label={c.previous} disabled={loading || page <= 1} onClick={() => setPage(n => n - 1)}><ChevronLeft className="h-4 w-4 rtl:rotate-180" /></button><span className="text-sm text-ink-soft">{c.page} {fmt(page, 0)} {c.of} {fmt(data.pages, 0)}</span><button className={`${secondaryButton} disabled:opacity-50`} aria-label={c.next} disabled={loading || page >= data.pages} onClick={() => setPage(n => n + 1)}><ChevronRight className="h-4 w-4 rtl:rotate-180" /></button></nav>}
      </section>
      {selectedId && <section ref={panel} tabIndex={-1} aria-label={c.edit} className={`${card} min-w-0 p-5 outline-none sm:p-6`} aria-busy={detailLoading || !!pending}>
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-display text-lg font-bold">{c.edit}</h2><p className="mt-1 text-sm text-ink-soft">{c.editHint}</p></div><button type="button" aria-label={c.close} disabled={!!pending} onClick={close} className={`${secondaryButton} shrink-0 px-3 disabled:opacity-50`}><X className="h-5 w-5" /></button></div>
        {detailLoading && <p role="status" className="my-8 flex items-center gap-2 text-sm text-ink-soft"><LoaderCircle className="h-5 w-5 animate-spin" />{c.loadingDetail}</p>}
        {detailError && <div role="alert" className="my-4 rounded-2xl border border-red-500/30 p-3 text-sm text-red-700 break-words">{detailError}<button type="button" disabled={!!pending} className={`${secondaryButton} mt-2 disabled:opacity-50`} onClick={() => setDetailRevision(n => n + 1)}>{c.retry}</button></div>}
        {detail && draft && <>
          <dl className="my-5 grid grid-cols-2 gap-3 rounded-2xl bg-brand-50 p-4 text-sm">{[[c.role, detail.isAdmin ? c.admin : c.member], [c.joined, date(detail.joinedAt)], [c.lastLogin, date(detail.lastLogin)]].map(([label, value]) => <div key={label}><dt className="text-xs text-ink-faint">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}</dl>
          <form onSubmit={save} className="space-y-4"><fieldset disabled={!!pending} className="space-y-4 disabled:opacity-70">
            {(['name', 'email', 'timezone'] as const).map(key => <div key={key}><label className="mb-1.5 block text-sm font-medium text-ink-soft" htmlFor={`admin-${key}`}>{c[key]}</label><input id={`admin-${key}`} type={key === 'email' ? 'email' : 'text'} required={key !== 'name'} maxLength={key === 'name' ? 100 : key === 'timezone' ? 64 : 254} value={draft[key]} dir={key === 'name' ? undefined : 'ltr'} onChange={event => setDraft({ ...draft, [key]: event.target.value })} className={field} />{key === 'timezone' && <p className="mt-1 text-xs text-ink-faint">{c.timezoneHint}</p>}</div>)}
            <div><label htmlFor="admin-password" className="mb-1.5 block text-sm font-medium text-ink-soft">{lang === 'ar' ? 'كلمة مرور جديدة' : 'New password'}</label><input id="admin-password" type="password" autoComplete="new-password" minLength={10} maxLength={128} value={newPassword} onChange={event => setNewPassword(event.target.value)} className={field} /><p className="mt-1 text-xs text-ink-faint">{lang === 'ar' ? 'اتركها فارغة للاحتفاظ بكلمة المرور الحالية. 10 أحرف على الأقل.' : 'Leave blank to keep the current password. At least 10 characters.'}</p></div>
            <div className="grid grid-cols-2 gap-3"><div><label htmlFor="admin-language" className="mb-1.5 block text-sm font-medium text-ink-soft">{c.language}</label><select id="admin-language" className={field} value={draft.language} onChange={event => setDraft({ ...draft, language: event.target.value as Draft['language'] })}><option value="en">English</option><option value="ar">العربية</option></select></div><div><label htmlFor="admin-unit" className="mb-1.5 block text-sm font-medium text-ink-soft">{c.unit}</label><select id="admin-unit" className={field} value={draft.weightUnit} onChange={event => setDraft({ ...draft, weightUnit: event.target.value as Draft['weightUnit'] })}><option value="kg">kg</option><option value="lb">lb</option></select></div></div>
            <label className="flex items-start gap-3 rounded-2xl border border-line p-4"><input type="checkbox" className="mt-1 h-4 w-4 accent-blue-600" disabled={detail.isAdmin} checked={draft.isActive} onChange={event => setDraft({ ...draft, isActive: event.target.checked })} /><span><span className="block text-sm font-semibold">{c.active}</span><span className="mt-1 block text-xs text-ink-soft">{detail.isAdmin ? c.protected : c.activeHint}</span></span></label>
            <div className="flex flex-wrap gap-2"><button type="submit" className={primaryButton}>{pending === 'save' && <LoaderCircle className="h-4 w-4 animate-spin" />}{pending === 'save' ? c.saving : c.save}</button><button type="button" onClick={close} className={secondaryButton}>{c.cancel}</button></div>
          </fieldset></form>
          <div className="mt-6 border-t border-line pt-5"><h3 className="font-semibold">{c.activity}</h3><p className="mt-1 text-xs text-ink-faint">{c.privacy}</p><dl className="mt-3 grid grid-cols-2 gap-3">{(['meals', 'foods', 'weeks', 'photos'] as const).map(key => <div key={key} className="rounded-2xl bg-brand-50 p-3"><dt className="text-xs text-ink-soft">{c[key]}</dt><dd className="mt-1 text-lg font-bold tabular">{fmt(detail.activity[key], 0)}</dd></div>)}</dl></div>
          <div className="mt-6 border-t border-line pt-5"><h3 className="font-semibold">{c.history}</h3>{detail.history.length ? <ol className="mt-3 max-h-72 space-y-3 overflow-y-auto">{detail.history.map(entry => <li key={entry.id} className="border-s-2 border-brand-200 ps-3"><p className="break-words text-sm text-ink-soft">{entry.description}</p><p className="mt-1 break-words text-xs text-ink-faint">{entry.actor} · {date(entry.at)}</p></li>)}</ol> : <p className="mt-2 text-sm text-ink-faint">{c.noHistory}</p>}</div>
          {!detail.isAdmin && <div className="mt-6 border-t border-line pt-5"><h3 className="font-semibold text-red-700">{c.danger}</h3><p className="mt-2 text-sm text-ink-soft">{c.dangerHint}</p>{!showDelete ? <button type="button" disabled={!!pending} className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-2xl border border-red-500/40 px-4 text-sm font-semibold text-red-700 focus-visible:outline focus-visible:outline-2 disabled:opacity-50" onClick={() => { setShowDelete(true); setConfirmation(''); }}><Trash2 className="h-4 w-4" />{c.danger}</button> : <form onSubmit={remove} className="mt-4 space-y-3"><label htmlFor="admin-delete-email" className="block text-sm font-medium">{c.confirm}<span dir="ltr" className="mt-1 block break-all font-semibold">{detail.email}</span></label><input id="admin-delete-email" autoComplete="off" type="email" dir="ltr" disabled={!!pending} value={confirmation} onChange={event => setConfirmation(event.target.value)} className={field} /><div className="flex flex-wrap gap-2"><button type="submit" disabled={!!pending || confirmation !== detail.email} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-red-700 px-4 text-sm font-semibold text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500">{pending === 'delete' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}{pending === 'delete' ? c.deleting : c.delete}</button><button type="button" disabled={!!pending} className={secondaryButton} onClick={() => { setShowDelete(false); setConfirmation(''); }}>{c.cancel}</button></div></form>}</div>}
        </>}
      </section>}
    </div>
  </>;
}
