import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_ENDPOINTS } from '../config/api';
import { OnboardingNutritionData } from '../types/onboarding';
import logoIcon from '../assets/images/logo-icon.svg';

const DIET_TYPES = [
  'Balanced', 'Low Carb', 'Vegetarian', 'Vegan', 'Keto', 'Paleo', 'Custom'
];

const ALLERGY_PRESETS = ['Dairy', 'Gluten', 'Nuts', 'Soy', 'Shellfish', 'Eggs', 'Custom'];

const CUISINE_OPTIONS = [
  'Italian', 'Mexican', 'Indian', 'Chinese', 'Japanese', 'Mediterranean', 'Custom'
];

const COOKING_TIME_OPTIONS = ['Quick (15-30m)', 'Moderate (30-60m)', 'Leisurely (60+m)'];

export default function NutritionOnboardingPage() {
  const navigate = useNavigate();
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const authHeaders: Record<string, string> = useMemo(() => (
    token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }
  ), [token]);

  const [data, setData] = useState<OnboardingNutritionData>({
    dietType: 'Balanced',
    allergies: [],
    dislikedFoods: '',
    favoriteCuisines: [],
    mealsPerDay: 3,
    snacksPerDay: 2,
    cookingTimePreference: null,
  });
  const [customAllergy, setCustomAllergy] = useState('');
  const [customCuisine, setCustomCuisine] = useState('');
  const [customDietType, setCustomDietType] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('onboarding_completed');
    localStorage.removeItem('onboarding_step1');
    localStorage.removeItem('onboarding_step2');
    localStorage.removeItem('onboarding_data');
    navigate('/');
  };

  const toggleChip = (key: 'allergies' | 'favoriteCuisines', value: string) => {
    setData(prev => {
      const exists = prev[key].includes(value);
      return { ...prev, [key]: exists ? prev[key].filter(v => v !== value) : [...prev[key], value] };
    });
  };

  const onSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      if (!token) {
        navigate('/login');
        return;
      }
      const payload = {
        diet_type: data.dietType,
        allergies: data.allergies,
        disliked_foods: data.dislikedFoods,
        favorite_cuisines: data.favoriteCuisines,
        meals_per_day: data.mealsPerDay,
        snacks_per_day: data.snacksPerDay,
        cooking_time_preference: data.cookingTimePreference,
      };
      const resp = await fetch(API_ENDPOINTS.AUTH.ONBOARDING_NUTRITION_UPDATE, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || 'Failed to save');
      }
      navigate('/dashboard', { replace: true });
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] text-white font-['Manrope']">
      {/* Header from Dashboard */}
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
            <Link to="/dashboard" className="text-[#EB4747] font-semibold">Dashboard</Link>
            <Link to="/workouts" className="text-gray-400 hover:text-white">Workouts</Link>
            <a href="#" className="text-gray-400 hover:text-white">Nutrition</a>
            <Link to="/realtime" className="text-gray-400 hover:text-white">Tracking</Link>
            <Link to="/coach" className="text-gray-400 hover:text-white">Coach</Link>
            <Link to="/progress" className="text-gray-400 hover:text-white">Progress</Link>
            <a href="#" className="text-gray-400 hover:text-white">Blog</a>
          </nav>
          <div className="flex items-center gap-3">
            <button onClick={handleLogout} className="hidden sm:inline px-3 py-2 rounded-lg border border-white/20 text-xs text-gray-300 hover:bg-white/10">Logout</button>
            <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 flex items-center justify-center border border-white/10">
              <span className="text-sm font-semibold">U</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1440px] mx-auto px-6 md:px-10 lg:px-20 xl:px-28 pt-[88px] md:pt-[96px] py-8 md:py-12">
        {/* Intro */}
        <div className="mb-8 md:mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight">Personalize Your Nutrition Plan</h2>
          <p className="text-white/70 mt-2 text-sm sm:text-base">Tailor your meals to fit your lifestyle and preferences.</p>
        </div>

        {/* Dietary Preferences */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mb-8">
          <div>
            <h3 className="text-base sm:text-lg font-bold">Dietary Preferences</h3>
            <p className="text-sm text-white/70">Choose your diet type, allergies, and dislikes.</p>
          </div>
          <div className="space-y-6">
            {/* Diet Type */}
            <div>
              <div className="text-sm font-medium mb-2">Diet Type</div>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {DIET_TYPES.map(opt => {
                  const selected = data.dietType === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        if (opt === 'Custom') {
                          setData(prev => ({ ...prev, dietType: 'Custom' }));
                        } else {
                          setData(prev => ({ ...prev, dietType: opt }));
                          setCustomDietType('');
                        }
                      }}
                      className={
                        `px-3 py-2 sm:px-4 sm:py-2 rounded-2xl text-sm transition-colors ` +
                        (selected ? 'bg-[#EB4747] text-white' : 'bg-white/5 text-white hover:bg-white/10')
                      }
                    >{opt}</button>
                  );
                })}
              </div>
              {data.dietType === 'Custom' && (
                <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    value={customDietType}
                    onChange={e => setCustomDietType(e.target.value)}
                    placeholder="Specify custom diet type"
                    className="flex-1 bg-black/20 border border-white/20 focus:border-[#EB4747] focus:ring-2 focus:ring-[#EB4747]/20 outline-none rounded-xl px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    className="px-4 py-2 rounded-xl bg-[#EB4747] hover:bg-[#d13f3f] text-sm font-medium"
                    onClick={() => {
                      const v = customDietType.trim();
                      if (v) {
                        setData(prev => ({ ...prev, dietType: v }));
                        setCustomDietType('');
                      }
                    }}
                  >Add</button>
                </div>
              )}
            </div>

            {/* Allergies */}
            <div>
              <div className="text-sm font-medium mb-2">Allergies</div>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {ALLERGY_PRESETS.map(a => {
                  const selected = data.allergies.includes(a);
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() => toggleChip('allergies', a)}
                      className={
                        `px-3 py-2 sm:px-4 sm:py-2 rounded-2xl text-sm transition-colors ` +
                        (selected ? 'bg-[#EB4747] text-white' : 'bg-white/5 text-white hover:bg-white/10')
                      }
                    >{a}</button>
                  );
                })}
              </div>
              {data.allergies.includes('Custom') && (
                <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    value={customAllergy}
                    onChange={e => setCustomAllergy(e.target.value)}
                    placeholder="Specify custom allergy"
                    className="flex-1 bg-black/20 border border-white/20 focus:border-[#EB4747] focus:ring-2 focus:ring-[#EB4747]/20 outline-none rounded-xl px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    className="px-4 py-2 rounded-xl bg-[#EB4747] hover:bg-[#d13f3f] text-sm font-medium"
                    onClick={() => {
                      const v = customAllergy.trim();
                      if (v && !data.allergies.includes(v)) {
                        setData(prev => ({ ...prev, allergies: [...prev.allergies.filter(x => x !== 'Custom'), v] }));
                        setCustomAllergy('');
                      }
                    }}
                  >Add</button>
                </div>
              )}
            </div>

            {/* Disliked Foods */}
            <div>
              <div className="text-sm font-medium mb-2">Disliked Foods</div>
              <textarea
                value={data.dislikedFoods}
                onChange={e => setData(prev => ({ ...prev, dislikedFoods: e.target.value }))}
                placeholder="e.g., cilantro, mushrooms, olives"
                className="w-full min-h-[100px] sm:min-h-[120px] bg-white/5 border border-white/20 rounded-2xl p-3 text-sm"
              />
            </div>
          </div>
        </section>

        <div className="h-px bg-white/10 my-6 md:my-8" />

        {/* Cuisine Preferences */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mb-8">
          <div>
            <h3 className="text-base sm:text-lg font-bold">Cuisine Preferences</h3>
            <p className="text-sm text-white/70">Select the cuisines you enjoy.</p>
          </div>
          <div className="space-y-6">
            <div>
              <div className="text-sm font-medium mb-2">Favorite Cuisines</div>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {CUISINE_OPTIONS.map(opt => {
                  const selected = data.favoriteCuisines.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleChip('favoriteCuisines', opt)}
                      className={
                        `px-3 py-2 sm:px-4 sm:py-2 rounded-2xl text-sm transition-colors ` +
                        (selected ? 'bg-[#EB4747] text-white' : 'bg-white/5 text-white hover:bg-white/10')
                      }
                    >{opt}</button>
                  );
                })}
              </div>
              {data.favoriteCuisines.includes('Custom') && (
                <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    value={customCuisine}
                    onChange={e => setCustomCuisine(e.target.value)}
                    placeholder="Specify custom cuisine"
                    className="flex-1 bg-black/20 border border-white/20 focus:border-[#EB4747] focus:ring-2 focus:ring-[#EB4747]/20 outline-none rounded-xl px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    className="px-4 py-2 rounded-xl bg-[#EB4747] hover:bg-[#d13f3f] text-sm font-medium"
                    onClick={() => {
                      const v = customCuisine.trim();
                      if (v && !data.favoriteCuisines.includes(v)) {
                        setData(prev => ({ ...prev, favoriteCuisines: [...prev.favoriteCuisines.filter(x => x !== 'Custom'), v] }));
                        setCustomCuisine('');
                      }
                    }}
                  >Add</button>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="h-px bg-white/10 my-6 md:my-8" />

        {/* Meal Structure */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mb-8">
          <div>
            <h3 className="text-base sm:text-lg font-bold">Meal Structure</h3>
            <p className="text-sm text-white/70">Define your daily meal and snack routine.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div>
              <div className="text-sm font-medium mb-2">Meals per day</div>
              <div className="flex items-center gap-2 sm:gap-3 bg-white/5 border border-white/20 rounded-2xl px-3 py-2 sm:px-4 sm:py-2">
                <button
                  type="button"
                  className="text-white/80 px-2 py-1 sm:px-3 sm:py-1.5 rounded-md hover:bg-white/10"
                  onClick={() => setData(prev => ({ ...prev, mealsPerDay: Math.max(1, (prev.mealsPerDay || 1) - 1) }))}
                >−</button>
                <div className="flex-1 text-center text-base sm:text-lg font-semibold">{data.mealsPerDay ?? 3}</div>
                <button
                  type="button"
                  className="text-white/80 px-2 py-1 sm:px-3 sm:py-1.5 rounded-md hover:bg-white/10"
                  onClick={() => setData(prev => ({ ...prev, mealsPerDay: Math.min(8, (prev.mealsPerDay || 3) + 1) }))}
                >+</button>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-2">Snacks per day</div>
              <div className="flex items-center gap-2 sm:gap-3 bg-white/5 border border-white/20 rounded-2xl px-3 py-2 sm:px-4 sm:py-2">
                <button
                  type="button"
                  className="text-white/80 px-2 py-1 sm:px-3 sm:py-1.5 rounded-md hover:bg-white/10"
                  onClick={() => setData(prev => ({ ...prev, snacksPerDay: Math.max(0, (prev.snacksPerDay || 0) - 1) }))}
                >−</button>
                <div className="flex-1 text-center text-base sm:text-lg font-semibold">{data.snacksPerDay ?? 2}</div>
                <button
                  type="button"
                  className="text-white/80 px-2 py-1 sm:px-3 sm:py-1.5 rounded-md hover:bg-white/10"
                  onClick={() => setData(prev => ({ ...prev, snacksPerDay: Math.min(6, (prev.snacksPerDay || 2) + 1) }))}
                >+</button>
              </div>
            </div>
          </div>
        </section>

        <div className="h-px bg-white/10 my-6 md:my-8" />

        {/* Other Preferences */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mb-10">
          <div>
            <h3 className="text-base sm:text-lg font-bold">Other Preferences</h3>
            <p className="text-sm text-white/70">Additional preferences to fine-tune your plan.</p>
          </div>
          <div>
            <div className="text-sm font-medium mb-2">Cooking Time</div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {COOKING_TIME_OPTIONS.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setData(prev => ({ ...prev, cookingTimePreference: opt }))}
                  className={
                    `px-3 py-2 sm:px-4 sm:py-2 rounded-2xl text-sm ` +
                    (data.cookingTimePreference === opt ? 'bg-red-600 text-white' : 'bg-white/5 text-white')
                  }
                >{opt}</button>
              ))}
            </div>
          </div>
        </section>

        {error && (
          <div className="mb-4 text-sm text-red-400">{error}</div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className={
              `w-full sm:w-auto px-6 sm:px-8 py-3 rounded-2xl font-semibold transition-colors ` +
              (isSaving ? 'bg-[#EB4747]/60 cursor-not-allowed' : 'bg-[#EB4747] hover:bg-[#d13f3f]')
            }
          >{isSaving ? 'Saving...' : 'Save & Continue'}</button>
        </div>
      </div>
    </div>
  );
}


