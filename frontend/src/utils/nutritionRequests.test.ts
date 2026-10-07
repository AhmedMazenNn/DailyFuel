import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {Day, MealDraft} from '../types/nutrition';
import {json, request} from './api';
import {createNutritionRequests} from './nutritionRequests';

vi.mock('./api',()=>({json:vi.fn(),request:vi.fn()}));
const macros={calories:100,protein:5,carbohydrate:0,fat:2};
const draft:MealDraft={name:'Lunch',mode:'quick',note:'',totals:macros,items:[]};
const day:Day={date:'2026-10-07',targets:macros,totals:macros,remaining:macros,meals:[],nextMealNumber:2};
const gamification={xp:10,level:1,levelProgress:10,streak:1,longestStreak:1,loggedDays:1,earned:[]};
const saved={id:'meal',day,gamification};
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return {promise,resolve};}
function setup(){const publishDay=vi.fn();const publishStats=vi.fn();return {publishDay,publishStats,client:createNutritionRequests(publishDay,publishStats)};}
beforeEach(()=>vi.resetAllMocks());

describe('nutrition request coordination',()=>{
 it('finishes create and edit using their committed snapshots without follow-up GETs',async()=>{
  vi.mocked(json).mockResolvedValue(saved);
  const {client,publishDay,publishStats}=setup();
  await client.addMeal(day.date,draft,'retry-key');
  expect(json).toHaveBeenCalledWith(`nutrition-days/${day.date}/meals/`,'POST',draft,'retry-key');
  await client.updateMeal('meal',draft);
  expect(json).toHaveBeenLastCalledWith('meals/meal/','PATCH',draft,undefined);
  expect(request).not.toHaveBeenCalled();
  expect(publishDay).toHaveBeenCalledTimes(2);
  expect(publishDay).toHaveBeenLastCalledWith(day);
  expect(publishStats).toHaveBeenLastCalledWith({...gamification,levelXp:10,best:1});
 });
 it('does not let pending day, stats, or history reads overwrite a completed save',async()=>{
  const oldDay=deferred<Day>();const oldStats=deferred<typeof gamification>();const oldHistory=deferred<{results:Day[];next:null}>();
  vi.mocked(request).mockImplementation(path=>path==='gamification/'?oldStats.promise:path.startsWith('history/')?oldHistory.promise:oldDay.promise);
  vi.mocked(json).mockResolvedValue(saved);
  const {client,publishDay,publishStats}=setup();
  const pending=[client.loadDay(day.date),client.loadStats(),client.loadHistory(day.date,day.date)];
  await client.addMeal(day.date,draft,'key');
  oldDay.resolve({...day,nextMealNumber:1});oldStats.resolve({...gamification,xp:0});oldHistory.resolve({results:[{...day,nextMealNumber:1}],next:null});
  await Promise.all(pending);
  expect(publishDay).toHaveBeenCalledExactlyOnceWith(day);
  expect(publishStats).toHaveBeenCalledTimes(1);
 });
 it('serializes simultaneous mutations so an older snapshot cannot arrive last',async()=>{
  const first=deferred<typeof saved>();const next={...saved,day:{...day,nextMealNumber:3}};
  vi.mocked(json).mockReturnValueOnce(first.promise).mockResolvedValueOnce(next);
  const {client,publishDay}=setup();
  const creating=client.addMeal(day.date,draft,'key');const editing=client.updateMeal('meal',draft);
  await Promise.resolve();
  expect(json).toHaveBeenCalledTimes(1);
  first.resolve(saved);
  await Promise.all([creating,editing]);
  expect(json).toHaveBeenCalledTimes(2);
  expect(publishDay.mock.calls.map(([value])=>value.nextMealNumber)).toEqual([2,3]);
 });
 it('allows later saves after a failed mutation without publishing a success snapshot',async()=>{
  vi.mocked(json).mockRejectedValueOnce(new Error('Save failed')).mockResolvedValueOnce(saved);
  const {client,publishDay}=setup();
  await expect(client.addMeal(day.date,draft,'key')).rejects.toThrow('Save failed');
  expect(publishDay).not.toHaveBeenCalled();
  await client.addMeal(day.date,draft,'key');
  expect(publishDay).toHaveBeenCalledExactlyOnceWith(day);
 });
 it('uses the reorder response directly and refreshes deletion data concurrently',async()=>{
  const {client,publishDay}=setup();
  vi.mocked(json).mockResolvedValueOnce(day).mockResolvedValueOnce(undefined);
  await client.reorderMeals(day.date,['meal']);
  expect(publishDay).toHaveBeenCalledExactlyOnceWith(day);
  expect(request).not.toHaveBeenCalled();
  const refreshedDay=deferred<Day>();const refreshedStats=deferred<typeof gamification>();
  vi.mocked(request).mockImplementation(path=>path==='gamification/'?refreshedStats.promise:refreshedDay.promise);
  const deleting=client.deleteMeal('meal',day.date);
  await vi.waitFor(()=>expect(request).toHaveBeenCalledTimes(2));
  refreshedDay.resolve(day);refreshedStats.resolve(gamification);
  await deleting;
 });
});
