import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import logoIcon from '../assets/images/logo-icon.svg';
import { NutritionService, type MealLog, type MacroTargets } from '../services/nutritionService';

export default function NutritionPage() {
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [macros, setMacros] = useState<MacroTargets | null>(null);
  const [waterMl, setWaterMl] = useState<number>(0);
  const [groceryItems, setGroceryItems] = useState<string[]>([]);
  const waterGoalMl = 3000;

  useEffect(() => {
    const load = async () => {
      try {
        const [mealsResp, macrosResp, waterResp, groceryResp] = await Promise.all([
          NutritionService.listMeals(),
          NutritionService.getMacros(),
          NutritionService.waterToday(),
          NutritionService.groceryList(),
        ]);
        setMeals(mealsResp);
        setMacros(macrosResp);
        setWaterMl(waterResp.total_ml || 0);
        setGroceryItems(groceryResp.items || []);
      } catch (e) {
        // Non-blocking: keep UI usable even if calls fail
        console.error('Failed loading nutrition data', e);
      }
    };
    load();
  }, []);

  const summaryByType = useMemo(() => {
    const types = ['breakfast', 'lunch', 'dinner'];
    const map: Record<string, { title: string; kcal: number } | null> = {};
    for (const t of types) {
      const m = meals.find(x => (x.meal_type || '').toLowerCase() === t);
      if (!m) { map[t] = null; continue; }
      const title = (m.items?.[0]?.name) || (m.notes || t.charAt(0).toUpperCase() + t.slice(1));
      const kcal = (m.items || []).reduce((sum, it) => sum + (it.calories || 0), 0);
      map[t] = { title, kcal };
    }
    return map;
  }, [meals]);

  const macroDisplay = useMemo(() => {
    return [
      { label: 'Calories', color: 'bg-[#3B82F6]', track: 'bg-[#374151]', val: macros?.calories ? `${macros.calories} kcal` : '—', w: macros?.calories ? '70%' : '0%' },
      { label: 'Protein', color: 'bg-[#22C55E]', track: 'bg-[#374151]', val: macros?.protein_g ? `${macros.protein_g}g` : '—', w: macros?.protein_g ? '60%' : '0%' },
      { label: 'Carbs', color: 'bg-[#F97316]', track: 'bg-[#374151]', val: macros?.carbs_g ? `${macros.carbs_g}g` : '—', w: macros?.carbs_g ? '65%' : '0%' },
      { label: 'Fats', color: 'bg-[#EAB308]', track: 'bg-[#374151]', val: macros?.fats_g ? `${macros.fats_g}g` : '—', w: macros?.fats_g ? '40%' : '0%' },
    ];
  }, [macros]);

  const handleAddWater = async (amount: number) => {
    try {
      await NutritionService.addWater(amount);
      const w = await NutritionService.waterToday();
      setWaterMl(w.total_ml || 0);
    } catch (e) {
      console.error('Failed to add water', e);
    }
  };

  const handleDownloadCSV = async () => {
    try {
      const blob = await NutritionService.groceryExport();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'grocery_list.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to download grocery list', e);
    }
  };
  return (
    <div className="min-h-screen bg-[#121212] text-white font-['Manrope']">
      {/* Header (same as Dashboard) */}
      <header className="w-full h-[73px] bg-[#121212] border-b border-white/10 backdrop-blur-sm fixed top-0 left-0 right-0 z-40">
        <div className="max-w-[1920px] mx-auto px-10 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoIcon} alt="FluxWell" className="w-8 h-8" />
            <h2 className="text-2xl font-bold font-['Lexend'] tracking-tight">
              <span className="text-white">Flux</span>
              <span className="text-[#EB4747]">Well</span>
            </h2>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link to="/dashboard" className="text-gray-400 hover:text-white">Dashboard</Link>
            <Link to="/workouts" className="text-gray-400 hover:text-white">Workouts</Link>
            <Link to="/nutrition" className="text-[#EB4747] font-semibold">Nutrition</Link>
            <Link to="/realtime" className="text-gray-400 hover:text-white">Tracking</Link>
            <Link to="/coach" className="text-gray-400 hover:text-white">Coach</Link>
            <Link to="/progress" className="text-gray-400 hover:text-white">Progress</Link>
          </nav>
          <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 flex items-center justify-center border border-white/10">
            <span className="text-sm font-semibold">U</span>
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-6 md:px-10 pt-[73px] pb-10">
        {/* Title */}
        <div className="mb-6 md:mb-10">
          <h1 className="text-2xl md:text-3xl font-extrabold">Nutrition</h1>
          <p className="text-sm md:text-base text-gray-400 mt-1">Plan, log, and optimize your meals.</p>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Left Column: Meal Logging, Macro Targets */}
          <div className="flex flex-col gap-8">
            {/* Meal Logging Card */}
            <section className="bg-[#1E1E1E] rounded-2xl p-6 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.1),0_10px_15px_-3px_rgba(0,0,0,0.1)]">
              <h2 className="text-2xl font-bold mb-4">Meal Logging</h2>
              <div className="space-y-6">
                {(['Breakfast','Lunch','Dinner'] as const).map((title) => {
                  const key = title.toLowerCase();
                  const data = summaryByType[key];
                  const mealTitle = data?.title || `Add ${title}`;
                  const kcal = data?.kcal || 0;
                  return (
                  <div key={title} className="grid grid-cols-[24px_2px_1fr] gap-4 items-start">
                    <div className="w-6 h-6 rounded-full bg-[#EB4747]/30 flex items-center justify-center">
                      <div className="w-4 h-4 rounded-full bg-[#EB4747]" />
                    </div>
                    <div className="w-[2px] bg-[rgba(234,42,42,0.4)]" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
                      </div>
                      <div className="flex items-center justify-between bg-[#211111] rounded-xl p-4 border border-white/10">
                        <div>
                          <div className="text-sm font-bold">{mealTitle}</div>
                          <div className="text-xs text-gray-400">{kcal ? `${kcal} kcal` : '—'}</div>
                        </div>
                        <button className="px-3 py-2 rounded-lg text-xs font-semibold border border-white/30 text-gray-200 hover:bg-white/10">Swap Meal</button>
                      </div>
                    </div>
                  </div>
                );})}
                <button className="w-full h-11 rounded-lg bg-[#EB4747] hover:bg-[#d13f3f] font-bold">Add Meal</button>
              </div>
            </section>

            {/* Macro Targets Card */}
            <section className="bg-[#1E1E1E] rounded-2xl p-6 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.1),0_10px_15px_-3px_rgba(0,0,0,0.1)]">
              <h2 className="text-2xl font-bold mb-4">Macro Targets</h2>
              <div className="space-y-6">
                {macroDisplay.map(m => (
                  <div key={m.label} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-300">{m.label}</span>
                      <span className="text-gray-200 font-medium">{m.val}</span>
                    </div>
                    <div className={`w-full h-2 rounded-full ${m.track}`}>
                      <div className={`h-2 rounded-full ${m.color}`} style={{ width: m.w }} />
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-white/10" />
                <div>
                  <p className="text-sm text-gray-400">Today's Intake</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                    {[
                      { label: 'Calories', color: 'bg-[#3B82F6]', track: 'bg-[#374151]', h: 'h-28' },
                      { label: 'Protein', color: 'bg-[#22C55E]', track: 'bg-[#374151]', h: 'h-24' },
                      { label: 'Carbs', color: 'bg-[#F97316]', track: 'bg-[#374151]', h: 'h-20' },
                      { label: 'Fats', color: 'bg-[#EAB308]', track: 'bg-[#374151]', h: 'h-32' },
                    ].map((b) => (
                      <div key={b.label} className="flex flex-col items-center">
                        <div className={`w-full rounded-md ${b.track} overflow-hidden`}>
                          <div className={`${b.color} ${b.h} w-full`} />
                        </div>
                        <span className="text-xs text-gray-400 mt-1">{b.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: Water Intake, Grocery List */}
          <div className="flex flex-col gap-8">
            {/* Water Intake Card */}
            <section className="bg-[#1E1E1E] rounded-2xl p-6 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.1),0_10px_15px_-3px_rgba(0,0,0,0.1)]">
              <h2 className="text-2xl font-bold mb-4">Water Intake</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
                <div className="flex flex-col items-center">
                  <div className="relative w-48 h-48">
                    <svg viewBox="0 0 100 100" className="absolute inset-0">
                      <circle cx="50" cy="50" r="40" stroke="rgba(6,182,212,0.2)" strokeWidth="16" fill="none" />
                      {
                        (() => {
                          const circumference = 2 * Math.PI * 40;
                          const ratio = Math.max(0, Math.min(1, waterMl / waterGoalMl));
                          const dash = `${Math.round(circumference * ratio)} ${Math.round(circumference)}`;
                          return (<circle cx="50" cy="50" r="40" stroke="#06B6D4" strokeWidth="16" fill="none" strokeDasharray={dash} />);
                        })()
                      }
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="text-3xl font-extrabold text-[#06B6D4]">{(waterMl/1000).toFixed(1)}L</div>
                      <div className="text-sm text-gray-400">of {(waterGoalMl/1000).toFixed(0)}L goal</div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-center gap-3">
                  <button className="px-4 py-2 rounded-lg border border-white/30 text-gray-200 hover:bg-white/10" onClick={() => handleAddWater(250)}>+250ml</button>
                  <button className="px-4 py-2 rounded-lg border border-white/30 text-gray-200 hover:bg-white/10" onClick={() => handleAddWater(500)}>+500ml</button>
                </div>
              </div>
            </section>

            {/* Grocery List Card */}
            <section className="bg-[#1E1E1E] rounded-2xl p-6 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.1),0_10px_15px_-3px_rgba(0,0,0,0.1)]">
              <h2 className="text-2xl font-bold mb-4">Grocery List</h2>
              <div className="space-y-3">
                {(groceryItems.length ? groceryItems : ['Chicken Breast', 'Broccoli', 'Brown Rice', 'Olive Oil', 'Berries']).map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded border border-white/10 flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded bg-[#EB4747]" />
                    </div>
                    <div className="text-sm text-gray-300">{item}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <button className="px-4 py-2 rounded-lg border border-white/30 text-gray-200 hover:bg-white/10" onClick={handleDownloadCSV}>Download CSV</button>
                <button className="px-4 py-2 rounded-lg border border-white/30 text-gray-200 hover:bg-white/10" onClick={handleDownloadCSV}>Download CSV</button>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}


