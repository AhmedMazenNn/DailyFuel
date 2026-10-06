import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Auth } from './pages/Auth';
import { AppProvider } from './contexts/AppContext';
import { AppShell } from './components/layout/AppShell';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { History } from './pages/History';
import { Progress } from './pages/Progress';
import { Profile } from './pages/Profile';
function Application() { const {session,error,refresh}=useAuth(); if(error)return <main className="p-8"><p role="alert">{error}</p><button onClick={()=>void refresh()}>Retry</button></main>; if(!session)return <main className="p-8" role="status">Loading…</main>; if(!session.user)return <Auth/>; return <AppProvider><BrowserRouter><AppShell><Routes><Route path="/" element={<Home/>}/><Route path="/history" element={<History/>}/><Route path="/progress" element={<Progress/>}/><Route path="/profile" element={<Profile/>}/><Route path="*" element={<Home/>}/></Routes></AppShell></BrowserRouter></AppProvider>; }
export default function App(){return <AuthProvider><Application/></AuthProvider>;}
