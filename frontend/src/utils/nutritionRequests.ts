import type {Day, Meal, MealDraft, Targets} from '../types/nutrition';
import type {Stats} from './gamification';
import {json, request} from './api';

type GamificationSnapshot = {xp:number;level:number;levelProgress:number;streak:number;longestStreak:number;loggedDays:number;earned:Stats['earned']};
type MealSaveResponse = Meal & {day:Day;gamification:GamificationSnapshot};

/** Coordinate server snapshots so reads started before a save cannot undo it. */
export function createNutritionRequests(publishDay:(day:Day)=>void, publishStats:(stats:Stats)=>void) {
 const versions:Record<string,number>={};
 let statsVersion=0;
 let mutations:Promise<unknown>=Promise.resolve();
 const publishGamification=(value:GamificationSnapshot)=>publishStats({...value,levelXp:value.levelProgress,best:value.longestStreak});
 const applyDay=(day:Day)=>{versions[day.date]=(versions[day.date]??0)+1;publishDay(day);};
 // Serialize writes, including their snapshot publication, across concurrent sheets.
 const mutate=<T,>(action:()=>Promise<T>):Promise<T>=>{const result=mutations.then(action);mutations=result.catch(()=>undefined);return result;};
 const loadDay=async(date:string)=>{const version=(versions[date]??0)+1;versions[date]=version;const day=await request<Day>(`nutrition-days/${date}/`);if(versions[date]===version)publishDay(day);return day;};
 const loadStats=async()=>{const version=++statsVersion;const value=await request<GamificationSnapshot>('gamification/');if(statsVersion===version)publishGamification(value);};
 const saveMeal=async(path:string,method:string,draft:MealDraft,key?:string)=>{const saved=await json<MealSaveResponse>(path,method,draft,key);applyDay(saved.day);statsVersion++;publishGamification(saved.gamification);};
 const loadHistory=async(from:string,to:string)=>{
  const startedVersions={...versions};
  let path=`history/?from=${from}&to=${to}`;
  const result:Record<string,Day>={};
  while(path){const page=await request<{results:Day[];next:string|null}>(path);for(const day of page.results)result[day.date]=day;path=page.next?new URL(page.next,location.origin).pathname.replace('/api/v1/','')+new URL(page.next,location.origin).search:'';}
  for(const day of Object.values(result))if((versions[day.date]??0)===(startedVersions[day.date]??0))publishDay(day);
 };
 return {
  loadDay,loadStats,loadHistory,
  addMeal:(date:string,draft:MealDraft,key:string)=>mutate(()=>saveMeal(`nutrition-days/${date}/meals/`,'POST',draft,key)),
  updateMeal:(id:string,draft:MealDraft)=>mutate(()=>saveMeal(`meals/${id}/`,'PATCH',draft)),
  deleteMeal:(id:string,date:string)=>mutate(async()=>{await json(`meals/${id}/`,'DELETE');await Promise.all([loadDay(date),loadStats()]);}),
  reorderMeals:(date:string,ids:string[])=>mutate(async()=>{applyDay(await json<Day>(`nutrition-days/${date}/meals/reorder/`,'POST',{ids}));}),
  setTargets:(date:string,targets:Targets)=>mutate(async()=>{applyDay(await json<Day>(`nutrition-days/${date}/`,'PUT',{targets}));}),
 };
}
