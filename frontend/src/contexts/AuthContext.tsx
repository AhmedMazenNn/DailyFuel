import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { json, request } from '../utils/api';
import type { Settings } from '../types/nutrition';
export interface Session { user: { id: string; email: string; isAdmin?: boolean; emailVerified?: boolean; verificationEmailSent?: boolean } | null; profile?: Settings }
interface AuthValue { session: Session | null; error: string; refresh: () => Promise<void>; authenticate: (mode: 'login' | 'register', data: {email: string; password: string; name?: string}) => Promise<void>; logout: () => Promise<void>; setProfile: (profile: Settings) => void }
const Context = createContext<AuthValue | null>(null);
export function AuthProvider({children}: {children: ReactNode}) {
 const [session, setSession] = useState<Session | null>(null);
 const [error,setError] = useState('');
 const refresh = async () => { try { await request('auth/csrf/'); setError(''); setSession(await request<Session>('auth/session/')); } catch(e) { setError((e as Error).message); } };
 useEffect(() => { let active = true; void request('auth/csrf/').then(() => request<Session>('auth/session/')).then(value => { if(active) setSession(value); }).catch(e => { if(active) setError((e as Error).message); }); return () => {active=false;}; }, []);
 const authenticate: AuthValue['authenticate'] = async (mode,data) => { await request('auth/csrf/'); setSession(await json<Session>(`auth/${mode}/`,'POST',data)); };
 const logout = async () => { await json('auth/logout/','POST'); setSession({user:null}); };
 return <Context.Provider value={{session,error,refresh,authenticate,logout,setProfile: profile => setSession(prev => prev ? {...prev,profile} : prev)}}>{children}</Context.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() { const value=useContext(Context); if(!value) throw new Error('Authentication provider missing'); return value; }
