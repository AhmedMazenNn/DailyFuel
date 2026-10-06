import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Auth } from './pages/Auth';
function Application() { const {session,error,refresh}=useAuth(); if(error)return <main className="p-8"><p role="alert">{error}</p><button onClick={()=>void refresh()}>Retry</button></main>; if(!session)return <main className="p-8" role="status">Loading…</main>; if(!session.user)return <Auth/>; return <main className="app-backdrop min-h-screen p-8">DailyFuel · {session.profile?.name}</main>; }
export default function App(){return <AuthProvider><Application/></AuthProvider>;}
