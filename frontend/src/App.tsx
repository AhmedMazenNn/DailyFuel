import { ThemeProvider } from './contexts/ThemeContext';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Auth } from './pages/Auth';
import { EmailReminderAction } from './pages/EmailReminderAction';
import { AppProvider } from './contexts/AppContext';
import { AppShell } from './components/layout/AppShell';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { History } from './pages/History';
import { Progress } from './pages/Progress';
import { Profile } from './pages/Profile';
import { SavedFoods } from './pages/SavedFoods';
import { json } from './utils/api';
import { lazy, Suspense, useState } from 'react';
import type { FormEvent } from 'react';

function Onboarding() {
  const { refresh } = useAuth();
  const [values, setValues] = useState({ calories: '2000', protein: '150', carbohydrate: '220', fat: '65' });
  const [error, setError] = useState('');
  const save = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    try { await json('profile/', 'PATCH', { onboardingComplete: true, initialTargets: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Number(value)])) }); await refresh(); }
    catch (cause) { setError((cause as Error).message); }
  };
  return <main className="app-backdrop min-h-screen px-4 py-10 text-ink"><form onSubmit={save} className="mx-auto max-w-md rounded-[28px] bg-white p-7 shadow-card ring-1 ring-line"><h1 className="font-display text-3xl font-extrabold">Set your DailyFuel targets</h1><p className="mt-2 text-ink-soft">These are your starting values. You can change them for any date later.</p><div className="mt-6 space-y-4">{([['calories','Calories'],['protein','Protein (g)'],['carbohydrate','Carbohydrates (g)'],['fat','Fat (g)']] as const).map(([key,label]) => <label key={key} className="block text-sm font-semibold">{label}<input required min="0" step="0.01" type="number" value={values[key]} onChange={event => setValues(previous => ({ ...previous, [key]: event.target.value }))} className="mt-1 h-12 w-full rounded-xl border border-line px-3" /></label>)}</div>{error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}<button className="mt-6 w-full rounded-xl bg-brand-600 px-4 py-3 font-bold text-white">Continue</button></form></main>;
}
const Admin = lazy(() => import('./pages/Admin').then(module => ({ default: module.Admin })));

function Application() {
  const { session, error, refresh } = useAuth();
  if (window.location.pathname === "/email-preferences/confirm") return <EmailReminderAction action="confirm" />;
  if (window.location.pathname === "/email-preferences/unsubscribe") return <EmailReminderAction action="unsubscribe" />;
  if (error) return <main className="p-8"><p role="alert">{error}</p><button onClick={() => void refresh()}>Retry</button></main>;
  if (!session) return <LoadingScreen />;
  if (!session.user) return <Auth />;
  // Account administration doesn't require setting personal nutrition targets.
  if (!session.profile?.onboardingComplete && !session.user.isAdmin) return <Onboarding />;
  return (
    <AppProvider>
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/history" element={<History />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/foods" element={<SavedFoods />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/manage-users" element={session.user.isAdmin
              ? <Suspense fallback={<LoadingScreen />}><Admin /></Suspense>
              : <Navigate to="/" replace />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </AppProvider>
  );
}
export default function App(){return <ThemeProvider><AuthProvider><Application/></AuthProvider></ThemeProvider>;}
