import { useEffect, useState } from 'react';
import { ThemeToggle } from '../components/theme/ThemeToggle';
import { BrandMark } from '../components/layout/BrandMark';
import { useAuth } from '../contexts/AuthContext';
import { json, request } from '../utils/api';
import { inputBase, inputBorder, primaryButton, secondaryButton } from '../utils/styles';
export function Auth() {
 const {authenticate} = useAuth();
 const params = new URLSearchParams(location.search);
 const [mode,setMode] = useState<'login'|'register'|'reset'|'confirm'>(params.has('uid') && params.has('token') ? 'confirm' : 'login');
 const [ar,setAr]=useState(false); const l=(en:string,arabic:string)=>ar?arabic:en;
 const [email,setEmail]=useState(''); const [name,setName]=useState(''); const [password,setPassword]=useState('');
 const [error,setError]=useState(''); const [message,setMessage]=useState(''); const [busy,setBusy]=useState(false); const [google,setGoogle]=useState(false);
 useEffect(()=> { void request<{googleEnabled:boolean}>('auth/config/').then(c=>setGoogle(c.googleEnabled)).catch(()=>{}); },[]);
 useEffect(()=> { document.documentElement.dir=ar?'rtl':'ltr'; document.documentElement.lang=ar?'ar':'en'; },[ar]);
 const submit=async(e:React.FormEvent)=> { e.preventDefault(); setError('');setMessage('');setBusy(true); try {
  if(mode==='reset') {await json('auth/password/reset/','POST',{email});setMessage(l('If this email has an account, a reset link has been sent.','إذا كان البريد مسجلاً، أرسلنا رابط إعادة تعيين كلمة المرور.'));}
  else if(mode==='confirm') {await json('auth/password/reset/confirm/','POST',{uid:params.get('uid'),token:params.get('token'),password});setMode('login');setMessage(l('Password updated. Sign in to continue.','تم تحديث كلمة المرور. سجل الدخول للمتابعة.'));}
  else await authenticate(mode,{email,password,name});
 }catch(e){setError((e as Error).message);}finally{setBusy(false);} };
 return <main className="app-backdrop min-h-screen px-4 py-10 text-ink"><div className="mx-auto max-w-md"><div className="mb-8 flex items-center justify-between"><BrandMark/><div className="flex flex-wrap justify-end gap-2"><ThemeToggle language={ar?'ar':'en'}/><button className={secondaryButton} onClick={()=>setAr(!ar)}>{ar?'English':'العربية'}</button></div></div><div className="rounded-[28px] bg-white p-6 shadow-card ring-1 ring-line sm:p-8"><h1 className="font-display text-3xl font-extrabold">{mode==='register'?l('Start your journey','ابدأ رحلتك'):mode==='reset'||mode==='confirm'?l('Reset password','إعادة تعيين كلمة المرور'):l('Welcome back','مرحباً بعودتك')}</h1><p className="mb-6 mt-2 text-ink-soft">{l('A little consistency. A little more you.','خطوات صغيرة وثبات كل يوم.')}</p><form onSubmit={submit} className="space-y-4">
 {mode==='register'&&<label className="block text-sm font-semibold">{l('Name','الاسم')}<input required maxLength={100} autoComplete="name" className={`${inputBase} ${inputBorder()} mt-1 h-12`} value={name} onChange={e=>setName(e.target.value)}/></label>}
 {mode!=='confirm'&&<label className="block text-sm font-semibold">{l('Email','البريد الإلكتروني')}<input required type="email" autoComplete="email" dir="ltr" className={`${inputBase} ${inputBorder()} mt-1 h-12`} value={email} onChange={e=>setEmail(e.target.value)}/></label>}
 {mode!=='reset'&&<label className="block text-sm font-semibold">{l('Password','كلمة المرور')}<input required minLength={mode==='login'?1:10} type="password" autoComplete={mode==='login'?'current-password':'new-password'} className={`${inputBase} ${inputBorder()} mt-1 h-12`} value={password} onChange={e=>setPassword(e.target.value)}/></label>}
 {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{message&&<p role="status" className="text-sm text-brand-700">{message}</p>}
 <button disabled={busy} className={`${primaryButton} w-full`}>{busy?l('Please wait…','يرجى الانتظار…'):mode==='register'?l('Create account','إنشاء حساب'):mode==='reset'?l('Send reset link','إرسال رابط الاستعادة'):mode==='confirm'?l('Save password','حفظ كلمة المرور'):l('Sign in','تسجيل الدخول')}</button></form>
 {google&&(mode==='login'||mode==='register')&&<form action="/accounts/google/login/" method="post" className="mt-3"><input type="hidden" name="csrfmiddlewaretoken" value={decodeURIComponent(document.cookie.match(/csrftoken=([^;]+)/)?.[1]??'')}/><button className={`${secondaryButton} w-full`}>{l('Continue with Google','المتابعة باستخدام Google')}</button></form>}
 <div className="mt-5 flex flex-wrap justify-between gap-3 text-sm font-semibold text-brand-700"><button onClick={()=>{setMode(mode==='register'?'login':'register');setError('');}}>{mode==='register'?l('Already have an account?','لديك حساب بالفعل؟'):l('Create an account','إنشاء حساب')}</button><button onClick={()=>{setMode(mode==='reset'||mode==='confirm'?'login':'reset');setError('');}}>{mode==='reset'||mode==='confirm'?l('Back to sign in','العودة للدخول'):l('Forgot password?','نسيت كلمة المرور؟')}</button></div></div></div></main>;
}
