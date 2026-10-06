import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {useReducedMotion} from 'framer-motion';
import {toast} from 'sonner';
import {useAuth} from './AuthContext';
import {request,json} from '../utils/api';
import {addDays,formatDate,localToday,weekStartOf} from '../utils/date';
import {formatNumber,kgToUnit} from '../utils/format';
import {translate,type TKey,type TVars} from '../utils/i18n';
import type {Day,MealDraft,Settings,Targets,WeeklyRecord,ProgressPhoto} from '../types/nutrition';
import type {Stats} from '../utils/gamification';
const EMPTY={calories:0,protein:0,fat:0};
const initialStats:Stats={xp:0,level:1,levelXp:0,streak:0,best:0,loggedDays:0,earned:[]};
function useAppValue(){
 const {session,setProfile,logout}=useAuth(); const settings=session!.profile!;
 const systemReduce=useReducedMotion();const lang=settings.language;const dir=lang==='ar'?'rtl':'ltr';const reduceMotion=!!systemReduce||settings.reduceMotion;
 const [today,setToday]=useState(()=>localToday(settings.timezone));
 const [selectedDate,setSelectedDate]=useState(today); const [days,setDays]=useState<Record<string,Day>>({});
 const [weekly,setWeekly]=useState<Record<string,WeeklyRecord>>({}); const [selectedWeek,setSelectedWeek]=useState(()=>weekStartOf(today));
 const [stats,setStats]=useState<Stats>(initialStats);const [error,setError]=useState('');
 const [pending,setPending]=useState(0); const [weeksNext,setWeeksNext]=useState<string|null>(null);
 const versions=useRef<Record<string,number>>({});
 const t=useCallback((key:TKey,vars?:TVars)=>translate(lang,key,vars),[lang]);
 const fmt=useCallback((n:number,maxFrac=2)=>formatNumber(n,lang,maxFrac),[lang]);
 const formatDay=useCallback((iso:string)=>iso===today?t('today'):iso===addDays(today,-1)?t('yesterday'):formatDate(iso,lang),[today,t,lang]);
 const formatLong=useCallback((iso:string)=>formatDate(iso,lang,{weekday:'long',year:'numeric',month:'long',day:'numeric'}),[lang]);
 const fmtWeight=useCallback((kg:number)=>`${fmt(kgToUnit(kg,settings.weightUnit),3)} ${t(settings.weightUnit)}`,[fmt,settings.weightUnit,t]);
 const loadDay=useCallback(async(date:string)=>{const version=(versions.current[date]??0)+1;versions.current[date]=version;const day=await request<Day>(`nutrition-days/${date}/`);if(versions.current[date]===version)setDays(prev=>({...prev,[date]:day}));return day;},[]);
 const loadStats=useCallback(async()=>{const value=await request<{xp:number;level:number;levelProgress:number;streak:number;longestStreak:number;loggedDays:number;earned:Stats['earned']}>('gamification/');setStats({...value,levelXp:value.levelProgress,best:value.longestStreak});},[]);
 const loadHistory=useCallback(async(from:string,to:string)=>{let path=`history/?from=${from}&to=${to}`; const result:Record<string,Day>={};while(path){const page=await request<{results:Day[];next:string|null}>(path);for(const day of page.results)result[day.date]=day;path=page.next?new URL(page.next,location.origin).pathname.replace('/api/v1/','')+new URL(page.next,location.origin).search:'';}setDays(prev=>({...prev,...result}));},[]);
 const loadWeek=useCallback(async(week:string)=>{const rec=await request<WeeklyRecord>(`progress/weeks/${week}/`);setWeekly(prev=>({...prev,[week]:rec}));return rec;},[]);
 const loadWeeks=useCallback(async(path='progress/weeks/')=>{const page=await request<{results:WeeklyRecord[];next:string|null}>(path);setWeekly(prev=>({...prev,...Object.fromEntries(page.results.map(w=>[w.weekStart,w]))}));setWeeksNext(page.next?new URL(page.next,location.origin).pathname.replace('/api/v1/','')+new URL(page.next,location.origin).search:null);},[]);
 useEffect(()=>{const update=()=>setToday(localToday(settings.timezone));update();const id=setInterval(update,30000);return()=>clearInterval(id);},[settings.timezone]);
 useEffect(()=>{let active=true;void loadDay(selectedDate).catch(e=>{if(active)setError((e as Error).message);});return()=>{active=false;};},[selectedDate,loadDay]);
 useEffect(()=>{if(settings.onboardingComplete)void loadStats().catch(e=>setError((e as Error).message));},[settings.onboardingComplete,loadStats]);
 const reconcile=async(date:string)=>{await loadDay(date);await loadStats();};
 const addMeal=async(date:string,draft:MealDraft,key:string)=>{await json(`nutrition-days/${date}/meals/`,'POST',draft,key);await reconcile(date);toast.success(t('mealSaved'));};
 const updateMeal=async(id:string,draft:MealDraft)=>{const date=Object.values(days).flatMap(d=>d.meals).find(m=>m.id===id)?.date;if(!date)throw new Error(t('errSave'));await json(`meals/${id}/`,'PATCH',draft);await reconcile(date);toast.success(t('mealUpdated'));};
 const deleteMeal=async(id:string)=>{const date=Object.values(days).flatMap(d=>d.meals).find(m=>m.id===id)?.date;if(!date)throw new Error(t('errSave'));await json(`meals/${id}/`,'DELETE');await reconcile(date);toast.success(t('mealDeleted'));};
 const reorderMeals=async(date:string,ids:string[])=>{await json(`nutrition-days/${date}/meals/reorder/`,'POST',{ids});await loadDay(date);};
 const setTargets=async(date:string,targets:Targets)=>{const day=await json<Day>(`nutrition-days/${date}/`,'PUT',{targets});versions.current[date]=(versions.current[date]??0)+1;setDays(prev=>({...prev,[date]:day}));toast.success(t('targetsSaved'));};
 const saveWeight=async(week:string,weightKg:number,measuredOn?:string,note?:string)=>{const rec=await json<WeeklyRecord>(`progress/weeks/${week}/weight/`,'PUT',{weightKg,measuredOn,note});setWeekly(prev=>({...prev,[week]:rec}));toast.success(t('weightSaved'));};
 const addPhoto=async(week:string,file:File,meta:{label:string;note:string;capturedOn:string})=>{const form=new FormData();form.set('image',file);Object.entries(meta).forEach(([k,v])=>form.set(k,v));await request<ProgressPhoto>(`progress/weeks/${week}/photos/`,{method:'POST',body:form});await loadWeek(week);};
 const removePhoto=async(week:string,id:string)=>{await json(`progress/photos/${id}/`,'DELETE');await loadWeek(week);};
 const editPhoto=async(week:string,id:string,meta:Partial<ProgressPhoto>)=>{await json(`progress/photos/${id}/`,'PATCH',meta);await loadWeek(week);};
 const updateSettings=async(patch:Partial<Settings>)=>{const profile=await json<Settings>('profile/','PATCH',patch);setProfile(profile);return profile;};
 const safely=async(action:()=>Promise<unknown>)=>{setPending(n=>n+1);setError('');try{await action();}catch(e){setError((e as Error).message);}finally{setPending(n=>n-1);}};
 const meals=useMemo(()=>Object.values(days).flatMap(d=>d.meals),[days]);
 return {loading:!days[selectedDate],pending,error,setError,days,meals,weekly,settings,stats,today,selectedDate,setSelectedDate,selectedWeek,setSelectedWeek,lang,dir,reduceMotion,t,fmt,formatDay,formatLong,fmtWeight,getTargets:(date:string)=>days[date]?.targets??settings.initialTargets??EMPTY,getTotals:(date:string)=>days[date]?.totals??EMPTY,loadDay,loadHistory,loadWeeks,weeksNext,loadWeek,addMeal,updateMeal,deleteMeal,reorderMeals,setTargets,saveWeight,addPhoto,removePhoto,editPhoto,updateSettings,safely,logout};
}
const Context=createContext<ReturnType<typeof useAppValue>|null>(null);
export function AppProvider({children}:{children:ReactNode}){const value=useAppValue();return <Context.Provider value={value}>{children}</Context.Provider>;}
// eslint-disable-next-line react-refresh/only-export-components
export function useApp(){const value=useContext(Context);if(!value)throw new Error('App provider missing');return value;}
