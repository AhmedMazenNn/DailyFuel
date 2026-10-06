import type {Meal} from '../types/nutrition';
import {weekStartOf} from './date';
export const XP_PER_LEVEL=100;
export type BadgeId='first'|'seven'|'thirty';
export interface Stats {xp:number;level:number;levelXp:number;streak:number;best:number;loggedDays:number;earned:BadgeId[]}
export const BADGES:{id:BadgeId;goal:(s:Stats)=>[number,number]}[]=[{id:'first',goal:s=>[Math.min(s.loggedDays,1),1]},{id:'seven',goal:s=>[Math.min(s.loggedDays,7),7]},{id:'thirty',goal:s=>[Math.min(s.loggedDays,30),30]}];
export function weekSummary(meals:Meal[],today:string){const start=weekStartOf(today);const current=meals.filter(m=>m.date>=start&&m.date<=today);const dates=new Set(current.map(m=>m.date));return {start,daysLogged:dates.size,mealCount:current.length,avgKcal:dates.size?current.reduce((a,m)=>a+m.totals.calories,0)/dates.size:0};}
