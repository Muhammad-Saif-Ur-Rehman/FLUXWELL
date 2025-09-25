import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logoIcon from '../assets/images/logo-icon.svg';
import { API_ENDPOINTS, API_BASE_URL } from '../config/api';

// Import new progress components
import MetricCard from '../components/progress/MetricCard';
import WorkoutCompletionChart from '../components/progress/WorkoutCompletionChart';
import CalorieChart from '../components/progress/CalorieChart';
import MacroBreakdown from '../components/progress/MacroBreakdown';
import MealComplianceChart from '../components/progress/MealComplianceChart';
import ActivityTrendChart from '../components/progress/ActivityTrendChart';
import GoalAchievementChart from '../components/progress/GoalAchievementChart';
import BadgesAndStreaks from '../components/progress/BadgesAndStreaks';
import SleepRecoveryScore from '../components/progress/SleepRecoveryScore';
import HydrationTrends from '../components/progress/HydrationTrends';

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#1E1E1E] border border-white/10 rounded-2xl shadow-[0_4px_6px_-4px_rgba(0,0,0,0.1),0_10px_15px_-3px_rgba(0,0,0,0.1)]">
      {children}
    </div>
  );
}

type Milestone = {
  id: string;
  title: string;
  target_metric: string;
  target_value: number;
  start_value?: number;
  progress: number;
  completed: boolean;
  created_at?: string;
  completed_at?: string | null;
};

type Badge = { name: string; unlocked: boolean; unlocked_date?: string };

export default function ProgressPage() {
  const navigate = useNavigate();
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const authHeaders: Record<string, string> = token 
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } 
    : { 'Content-Type': 'application/json' };

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streak, setStreak] = useState<{ current_streak: number; longest_streak: number }>({ current_streak: 0, longest_streak: 0 });
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [range, setRange] = useState<'7D' | '1M' | '3M' | '1Y' | 'All'>('1M');
  
  // New state for comprehensive metrics
  const [realtimeData, setRealtimeData] = useState<any>(null);
  const [workoutData, setWorkoutData] = useState<any>(null);
  const [nutritionData, setNutritionData] = useState<any>(null);
  const [goalsData, setGoalsData] = useState<any>(null);
  const [healthData, setHealthData] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [onboardingStep1, setOnboardingStep1] = useState<any>(null);

  const rangeStartDate = useMemo(() => {
    const now = new Date();
    switch (range) {
      case '7D': return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      case '1M': return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      case '3M': return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      case '1Y': return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      case 'All':
      default: return new Date(0);
    }
  }, [range]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('onboarding_completed');
    navigate('/');
  };
  
  const fetchProgressData = async () => {
    if (!token) { setIsLoading(false); return; }
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch user data
      const userRes = await fetch(API_ENDPOINTS.AUTH.ME, { headers: authHeaders });
      if (userRes.ok) {
        const userData = await userRes.json();
        setUser(userData);
      }
      
      // Fetch onboarding data for profile picture
      const obRes = await fetch(API_ENDPOINTS.AUTH.ONBOARDING_DATA, { headers: authHeaders });
      if (obRes.ok) {
        const obData = await obRes.json();
        setOnboardingStep1(obData?.step1 || null);
      }
      
      // Fetch all data in parallel using enhanced endpoints
      const [
        dashboardRes,
        badgesRes,
        realtimeRes,
        workoutRes,
        goalsRes,
        caloriesRes,
        macrosRes,
        mealsRes,
        sleepRes,
        hydrationRes
      ] = await Promise.all([
        fetch(API_ENDPOINTS.PROGRESS.DASHBOARD, { headers: authHeaders }),
        fetch(API_ENDPOINTS.PROGRESS.BADGES_ENHANCED, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/api/realtime/metrics`, { headers: authHeaders }),
        fetch(API_ENDPOINTS.WORKOUT.SESSION_TODAY, { headers: authHeaders }),
        fetch(API_ENDPOINTS.PROGRESS.GOALS, { headers: authHeaders }),
        fetch(API_ENDPOINTS.PROGRESS.CALORIES, { headers: authHeaders }),
        fetch(API_ENDPOINTS.PROGRESS.MACROS, { headers: authHeaders }),
        fetch(API_ENDPOINTS.PROGRESS.MEALS, { headers: authHeaders }),
        fetch(API_ENDPOINTS.PROGRESS.SLEEP, { headers: authHeaders }),
        fetch(API_ENDPOINTS.PROGRESS.HYDRATION, { headers: authHeaders })
      ]);
      
      // Handle dashboard response (contains comprehensive metrics)
      if (dashboardRes.ok) {
        const dashboardData = await dashboardRes.json();
        // Extract streak data from dashboard if available
        if (dashboardData.workout_completion?.streak) {
          setStreak({
            current_streak: dashboardData.workout_completion.streak,
            longest_streak: dashboardData.workout_completion.longest_streak || 0
          });
        }
        // Extract milestones from goals if available
        if (dashboardData.goals?.goals) {
          setMilestones(dashboardData.goals.goals.map((goal: any) => ({
            id: goal.id,
            title: goal.title,
            target_metric: goal.category,
            target_value: goal.target,
            start_value: goal.current,
            progress: goal.achievement_rate || 0,
            completed: goal.completed || false,
            created_at: goal.created_at,
            completed_at: goal.completed_at
          })));
        }
      }
      
      // Handle enhanced badges response
      if (badgesRes.ok) {
        const badgesData = await badgesRes.json();
        setBadges(badgesData.map((badge: any) => ({
          name: badge.name,
          unlocked: badge.unlocked,
          unlocked_date: badge.unlocked_date
        })));
      }
      
      // Handle realtime data
      if (realtimeRes.ok) {
        setRealtimeData(await realtimeRes.json());
      }
      
      // Handle workout data
      if (workoutRes.ok) {
        setWorkoutData(await workoutRes.json());
      }
      
      // Handle goals data
      if (goalsRes.ok) {
        const goalsData = await goalsRes.json();
        setGoalsData(goalsData);
      }
      
      // Handle nutrition data
      if (caloriesRes.ok && macrosRes.ok && mealsRes.ok) {
        const [calories, macros, meals] = await Promise.all([
          caloriesRes.json(),
          macrosRes.json(),
          mealsRes.json()
        ]);
        
        // Process nutrition data for components
        const processedNutritionData = {
          calories: {
            consumed: calories.length > 0 ? calories[0].consumed : 0,
            recommended: calories.length > 0 ? calories[0].recommended : 2200,
            dailyData: calories.map((entry: any) => ({
              date: entry.date,
              consumed: entry.consumed,
              recommended: entry.recommended
            }))
          },
          macros: {
            protein: { 
              consumed: macros.length > 0 ? macros[0].protein : 0, 
              target: macros.length > 0 ? macros[0].protein_target : 150, 
              color: 'bg-gradient-to-r from-red-500 to-red-600' 
            },
            carbs: { 
              consumed: macros.length > 0 ? macros[0].carbs : 0, 
              target: macros.length > 0 ? macros[0].carbs_target : 250, 
              color: 'bg-gradient-to-r from-blue-500 to-blue-600' 
            },
            fats: { 
              consumed: macros.length > 0 ? macros[0].fats : 0, 
              target: macros.length > 0 ? macros[0].fats_target : 90, 
              color: 'bg-gradient-to-r from-green-500 to-green-600' 
            },
            dailyData: macros.map((entry: any) => ({
              date: entry.date,
              protein: entry.protein,
              carbs: entry.carbs,
              fats: entry.fats
            }))
          },
          mealCompliance: {
            rate: meals.length > 0 ? (meals.filter((m: any) => m.followed).length / meals.length * 100) : 0,
            totalMeals: meals.length,
            compliantMeals: meals.filter((m: any) => m.followed).length,
            dailyData: meals.map((entry: any) => ({
              date: entry.date,
              meals: [{
                name: entry.meal_name,
                planned: entry.planned,
                followed: entry.followed,
                time: entry.time
              }]
            }))
          }
        };
        setNutritionData(processedNutritionData);
      }
      
      // Handle health data
      if (sleepRes.ok && hydrationRes.ok) {
        const [sleep, hydration] = await Promise.all([
          sleepRes.json(),
          hydrationRes.json()
        ]);
        // Process health data for components
        setHealthData({ sleep, hydration });
      }
      
    } catch (e: any) {
      setError(e?.message || 'Failed to load progress');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchProgressData(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  return (
    <div className="min-h-screen bg-[#121212] text-white font-['Manrope']">
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
            <Link to="/nutrition" className="text-gray-400 hover:text-white">Nutrition</Link>
            <Link to="/realtime" className="text-gray-400 hover:text-white">Tracking</Link>
            <Link to="/coach" className="text-gray-400 hover:text-white">Coach</Link>
            <Link to="/progress" className="text-[#EB4747] font-semibold">Progress</Link>
            <a href="#" className="text-gray-400 hover:text-white">Blog</a>
          </nav>
          <div className="flex items-center gap-3">
            <button onClick={handleLogout} className="hidden sm:inline px-3 py-2 rounded-lg border border-white/20 text-xs text-gray-300 hover:bg-white/10">Logout</button>
            <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 flex items-center justify-center border border-white/10">
              {(() => {
                const provider = user?.auth_provider;
                const socialPic = (provider === 'google' || provider === 'fitbit') ? (user?.profile_picture_url || null) : null;
                const formPic = provider === 'form' ? (onboardingStep1?.profile_picture_url || null) : null;
                const src = socialPic || formPic;
                if (src) return <img src={src} alt={user?.full_name || 'Profile'} className="w-full h-full object-cover" />;
                return <span className="text-sm font-semibold">{user?.full_name?.[0] || 'U'}</span>;
              })()}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-6 md:px-10 pt-[93px] pb-16">
        {/* Title + Controls */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h2 className="text-[36px] font-extrabold tracking-tight">Progress Dashboard</h2>
            <p className="text-sm text-gray-400">Comprehensive health and fitness tracking</p>
          </div>
          <div className="flex items-center gap-2">
            <div role="tablist" aria-label="Range" className="bg-black/20 border border-white/10 rounded-xl p-1 flex">
              {(['7D','1M','3M','1Y','All'] as const).map((r) => (
                <button
                  key={r}
                  role="tab"
                  aria-selected={range === r}
                  onClick={() => setRange(r)}
                  className={`px-3 h-9 rounded-lg text-sm transition-colors ${range === r ? 'bg-white text-black font-semibold' : 'text-gray-300 hover:text-white'}`}
                >{r}</button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 text-sm text-[#FCA5A5]">{error}</div>
        )}
        {isLoading && (
          <div className="mb-6 text-center py-8">
            <div className="inline-flex items-center gap-2 text-gray-400">
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              Loading progress data...
            </div>
          </div>
        )}

        {!isLoading && (
          <>
            {/* Key Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
              <MetricCard
                title="Workout Completion"
                value={`${workoutData ? Math.round((workoutData.completed_exercise_ids?.length || 0) / (workoutData.exercises?.length || 1) * 100) : 0}%`}
                subtitle="This week"
                trend="up"
                trendValue="+5%"
                icon="💪"
                color="success"
              />
              <MetricCard
                title="Calories Consumed"
                value={`${realtimeData?.calories || 0}`}
                subtitle={`of ${nutritionData?.calories?.recommended || 2200} target`}
                trend="neutral"
                icon="🔥"
                color="warning"
              />
              <MetricCard
                title="Daily Steps"
                value={`${realtimeData?.steps?.toLocaleString() || 0}`}
                subtitle="Goal: 10,000"
                trend="up"
                trendValue="+12%"
                icon="👟"
                color="info"
              />
              <MetricCard
                title="Current Streak"
                value={`${streak.current_streak} days`}
                subtitle={`Best: ${streak.longest_streak}`}
                trend="up"
                icon="🔥"
                color="danger"
              />
            </div>

            {/* Workout & Nutrition Row */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          <Card>
            <div className="p-6">
                  <h3 className="text-lg font-bold mb-4">Workout Completion</h3>
                  <WorkoutCompletionChart
                    completionRate={workoutData ? Math.round((workoutData.completed_exercise_ids?.length || 0) / (workoutData.exercises?.length || 1) * 100) : 0}
                    totalWorkouts={workoutData?.exercises?.length || 0}
                    completedWorkouts={workoutData?.completed_exercise_ids?.length || 0}
                    weeklyData={Array.from({ length: 7 }, (_, i) => ({
                      day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
                      completed: Math.random() > 0.3,
                      planned: Math.random() > 0.1
                    }))}
                  />
            </div>
          </Card>

          <Card>
            <div className="p-6">
                  <h3 className="text-lg font-bold mb-4">Calorie Intake</h3>
                  <CalorieChart
                    consumed={nutritionData?.calories?.consumed || 0}
                    recommended={nutritionData?.calories?.recommended || 2200}
                    dailyData={nutritionData?.calories?.dailyData || []}
                  />
                  </div>
              </Card>
              </div>

            {/* Macronutrients & Meal Compliance Row */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-bold mb-4">Macronutrient Breakdown</h3>
                  <MacroBreakdown
                    macros={nutritionData?.macros || {
                      protein: { consumed: 0, target: 150, color: 'bg-gradient-to-r from-red-500 to-red-600' },
                      carbs: { consumed: 0, target: 250, color: 'bg-gradient-to-r from-blue-500 to-blue-600' },
                      fats: { consumed: 0, target: 90, color: 'bg-gradient-to-r from-green-500 to-green-600' }
                    }}
                    dailyData={nutritionData?.macros?.dailyData || []}
                  />
            </div>
          </Card>

          <Card>
                <div className="p-6">
                  <h3 className="text-lg font-bold mb-4">Meal Compliance</h3>
                  <MealComplianceChart
                    complianceRate={nutritionData?.mealCompliance?.rate || 0}
                    totalMeals={nutritionData?.mealCompliance?.totalMeals || 0}
                    compliantMeals={nutritionData?.mealCompliance?.compliantMeals || 0}
                    dailyData={nutritionData?.mealCompliance?.dailyData || []}
                  />
            </div>
          </Card>
        </div>

            {/* Activity & Goals Row */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          <Card>
            <div className="p-6">
                  <h3 className="text-lg font-bold mb-4">Activity Trends</h3>
                  <ActivityTrendChart
                    currentSteps={realtimeData?.steps || 0}
                    dailyGoal={10000}
                    weeklyData={Array.from({ length: 7 }, (_, i) => ({
                      date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                      steps: Math.floor(Math.random() * 5000) + 5000,
                      calories: Math.floor(Math.random() * 500) + 2000,
                      distance: Math.random() * 5 + 2
                    }))}
                  />
            </div>
          </Card>

          <Card>
            <div className="p-6">
                  <h3 className="text-lg font-bold mb-4">Goal Achievement</h3>
                  <GoalAchievementChart
                    goals={goalsData?.goals || []}
                    achievementRate={goalsData?.achievementRate || 0}
                    completedGoals={goalsData?.completedGoals || 0}
                    totalGoals={goalsData?.totalGoals || 0}
                  />
              </div>
              </Card>
                    </div>

            {/* Health & Recovery Row */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-bold mb-4">Sleep & Recovery</h3>
                  <SleepRecoveryScore
                    currentScore={healthData?.sleep?.length > 0 ? healthData.sleep[0].recovery_score : 85}
                    sleepData={healthData?.sleep?.map((entry: any) => ({
                      date: entry.date,
                      duration: entry.duration,
                      quality: entry.quality,
                      deepSleep: entry.deep_sleep,
                      remSleep: entry.rem_sleep,
                      lightSleep: entry.light_sleep,
                      awakenings: entry.awakenings
                    })) || []}
                    weeklyAverage={healthData?.sleep?.length > 0 ? 
                      healthData.sleep.reduce((sum: number, entry: any) => sum + (entry.recovery_score || 0), 0) / healthData.sleep.length : 82}
                    targetHours={8}
                  />
            </div>
          </Card>

          <Card>
            <div className="p-6">
                  <h3 className="text-lg font-bold mb-4">Hydration Trends</h3>
                  <HydrationTrends
                    currentIntake={healthData?.hydration?.length > 0 ? healthData.hydration[0].consumed : 1500}
                    dailyTarget={healthData?.hydration?.length > 0 ? healthData.hydration[0].target : 2500}
                    hydrationData={healthData?.hydration?.map((entry: any) => ({
                      date: entry.date,
                      consumed: entry.consumed,
                      target: entry.target,
                      bottles: Math.floor(entry.consumed / 500),
                      reminders: entry.reminders || 0
                    })) || []}
                    weeklyAverage={healthData?.hydration?.length > 0 ? 
                      healthData.hydration.reduce((sum: number, entry: any) => sum + entry.consumed, 0) / healthData.hydration.length : 2100}
                  />
            </div>
          </Card>
        </div>

            {/* Badges & Streaks Row */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          <Card>
            <div className="p-6">
                  <BadgesAndStreaks
                    badges={[
                      { id: '1', name: 'First Workout', description: 'Complete your first workout', icon: '💪', unlocked: true, unlockedDate: '2024-01-15', rarity: 'common' },
                      { id: '2', name: 'Consistency King', description: 'Workout 7 days in a row', icon: '👑', unlocked: true, unlockedDate: '2024-01-20', rarity: 'rare' },
                      { id: '3', name: 'Nutrition Master', description: 'Follow meal plan for 30 days', icon: '🥗', unlocked: false, rarity: 'epic' },
                      { id: '4', name: 'Sleep Champion', description: 'Perfect sleep score for a week', icon: '😴', unlocked: false, rarity: 'legendary' },
                      { id: '5', name: 'Hydration Hero', description: 'Meet water goals for 14 days', icon: '💧', unlocked: true, unlockedDate: '2024-01-25', rarity: 'rare' },
                      { id: '6', name: 'Goal Crusher', description: 'Complete 5 goals', icon: '🎯', unlocked: false, rarity: 'epic' }
                    ]}
                    streaks={[
                      { type: 'workout', current: streak.current_streak, longest: streak.longest_streak, lastActivity: new Date().toISOString() },
                      { type: 'nutrition', current: 5, longest: 12, lastActivity: new Date().toISOString() },
                      { type: 'logging', current: 3, longest: 8, lastActivity: new Date().toISOString() },
                      { type: 'general', current: Math.max(streak.current_streak, 5), longest: streak.longest_streak, lastActivity: new Date().toISOString() }
                    ]}
                    totalBadges={12}
                    unlockedBadges={3}
                  />
                </div>
              </Card>

              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
                  <div className="space-y-4">
                    <button className="w-full p-4 rounded-xl bg-gradient-to-r from-[#EB4747] to-[#FF6B6B] text-white font-semibold hover:from-[#d13f3f] hover:to-[#e55a5a] transition-all duration-200">
                      Log Today's Workout
                    </button>
                    <button className="w-full p-4 rounded-xl border border-white/20 text-white font-semibold hover:bg-white/10 transition-all duration-200">
                      Add Meal Entry
                    </button>
                    <button className="w-full p-4 rounded-xl border border-white/20 text-white font-semibold hover:bg-white/10 transition-all duration-200">
                      Set New Goal
                    </button>
                    <button className="w-full p-4 rounded-xl border border-white/20 text-white font-semibold hover:bg-white/10 transition-all duration-200">
                      View Detailed Reports
                    </button>
              </div>
            </div>
          </Card>
        </div>
          </>
        )}

      </main>
    </div>
  );
}


