// API Configuration
export const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000';

export const API_ENDPOINTS = {
  AUTH: {
    REGISTER: `${API_BASE_URL}/auth/register`,
    LOGIN: `${API_BASE_URL}/auth/login`,
    ME: `${API_BASE_URL}/auth/me`,
    COMPLETE_ONBOARDING: `${API_BASE_URL}/auth/complete-onboarding`,
    ONBOARDING_SAVE: `${API_BASE_URL}/auth/onboarding/save`,
    ONBOARDING_DATA: `${API_BASE_URL}/auth/onboarding/data`,
    ONBOARDING_STEP1_UPDATE: `${API_BASE_URL}/auth/onboarding/step1`,
    ONBOARDING_STEP2_UPDATE: `${API_BASE_URL}/auth/onboarding/step2`,
    ONBOARDING_NUTRITION_UPDATE: `${API_BASE_URL}/auth/onboarding/nutrition`,
    ONBOARDING_NUTRITION_GET: `${API_BASE_URL}/auth/onboarding/nutrition`,
    ONBOARDING_AI_ASSESSMENT: `${API_BASE_URL}/auth/onboarding/ai-assessment`,
    GOOGLE: `${API_BASE_URL}/auth/google`,
    GOOGLE_CALLBACK: `${API_BASE_URL}/auth/google/callback`,
    FITBIT: `${API_BASE_URL}/auth/fitbit`,
    FITBIT_CALLBACK: `${API_BASE_URL}/auth/fitbit/callback`,
  },
  AI: {
    ASSESSMENT: `${API_BASE_URL}/ai/assessment`,
    GOAL_FEASIBILITY: `${API_BASE_URL}/ai/goal-feasibility`,
    WORKOUT: {
      FILTER_LIBRARY: `${API_BASE_URL}/ai/workout/filter-library`,
      SUGGEST_ALTERNATIVE: `${API_BASE_URL}/ai/workout/suggest-alternative`,
      GENERATE_PLAN: `${API_BASE_URL}/ai/workout/generate-plan`,
    },
    COACH: {
      BASE: `${API_BASE_URL}/fluxie`,
      CHAT: `${API_BASE_URL}/fluxie/chat`,
      SESSIONS: `${API_BASE_URL}/fluxie/sessions`,
      SESSION_MESSAGES: (sessionId: string) => `${API_BASE_URL}/fluxie/sessions/${sessionId}`,
      UPDATE_TITLE: (sessionId: string) => `${API_BASE_URL}/fluxie/sessions/${sessionId}/title`,
      DELETE_SESSION: (sessionId: string) => `${API_BASE_URL}/fluxie/sessions/${sessionId}`,
    },
  },
  WORKOUT: {
    STATUS: `${API_BASE_URL}/workout/status`,
    PROFILE: `${API_BASE_URL}/workout/profile`,
    PLAN: `${API_BASE_URL}/workouts/plan`,
    ADD_TO_DAY: (weekday: number) => `${API_BASE_URL}/workouts/plan/day/${weekday}/add`,
    SESSION_TODAY: `${API_BASE_URL}/workouts/session/today`,
    COMPLETE_EX: (exerciseId: string) => `${API_BASE_URL}/workouts/session/complete-exercise/${exerciseId}`,
    CUSTOM_CHECK_CONFLICTS: `${API_BASE_URL}/workouts/custom/plan/check-conflicts`,
    CUSTOM_SAVE: `${API_BASE_URL}/workouts/custom/plan/save`,
  
  },
  PROGRESS: {
    // Enhanced Progress Endpoints
    DASHBOARD: `${API_BASE_URL}/api/progress/dashboard`,
    BADGES_ENHANCED: `${API_BASE_URL}/api/progress/badges/enhanced`,
    BADGES_CHECK: `${API_BASE_URL}/api/progress/badges/check`,
    BADGES_INITIALIZE: `${API_BASE_URL}/api/progress/badges/initialize`,
    
    // Nutrition
    CALORIES: `${API_BASE_URL}/api/progress/nutrition/calories`,
    MACROS: `${API_BASE_URL}/api/progress/nutrition/macros`,
    MEALS: `${API_BASE_URL}/api/progress/nutrition/meals`,
    
    // Health
    SLEEP: `${API_BASE_URL}/api/progress/health/sleep`,
    HYDRATION: `${API_BASE_URL}/api/progress/health/hydration`,
    
    // Goals
    GOALS: `${API_BASE_URL}/api/progress/goals`,
    GOAL_PROGRESS: (goalId: string) => `${API_BASE_URL}/api/progress/goals/${goalId}/progress`,
    
    // Workouts
    WORKOUT_COMPLETION: `${API_BASE_URL}/api/progress/workouts/completion`,
    
    // Legacy endpoints for compatibility (if needed)
    LOG: `${API_BASE_URL}/api/progress/log`,
    ENTRIES: `${API_BASE_URL}/api/progress/entries`,
    MILESTONES: `${API_BASE_URL}/api/progress/milestones`,
    STREAK: `${API_BASE_URL}/api/progress/streaks-typed`,
    BADGES: `${API_BASE_URL}/api/progress/badges`,
    ADD_MILESTONE: `${API_BASE_URL}/api/progress/milestones-typed`,
  },
  NUTRITION: {
    MEALS: `${API_BASE_URL}/nutrition/meals`,
    MEAL: (mealId: string) => `${API_BASE_URL}/nutrition/meals/${mealId}`,
    WATER_ADD: `${API_BASE_URL}/nutrition/water`,
    WATER_TODAY: `${API_BASE_URL}/nutrition/water/today`,
    STREAK: `${API_BASE_URL}/nutrition/streak`,
    ACTIVITY: `${API_BASE_URL}/nutrition/activity`,
    MACROS: `${API_BASE_URL}/nutrition/macros`,
    GROCERY_LIST: `${API_BASE_URL}/nutrition/grocery-list`,
    GROCERY_EXPORT: `${API_BASE_URL}/nutrition/grocery-list/export`,
    MEAL_SWAP: `${API_BASE_URL}/nutrition/meal-swap`,
    GENERATE_RECIPE: `${API_BASE_URL}/nutrition/generate-recipe`,
    COMPLIANCE_TODAY: `${API_BASE_URL}/nutrition/compliance/today`,
    AGENT_RUN: `${API_BASE_URL}/nutrition/agent/run`,
    AGENT_PLAN: `${API_BASE_URL}/nutrition/agent/plan`,
    AGENT_REFRESH: `${API_BASE_URL}/nutrition/agent/refresh`,
    AGENT_SWAP: `${API_BASE_URL}/nutrition/agent/swap`,
    AGENT_AUTO_GENERATE: `${API_BASE_URL}/nutrition/agent/auto-generate`,
    AGENT_SAVE: `${API_BASE_URL}/nutrition/agent/save`,
    HEALTH: `${API_BASE_URL}/nutrition/health`,
    PROFILE: `${API_BASE_URL}/nutrition/profile`,
  },
  REALTIME: {
    METRICS: `${API_BASE_URL}/api/realtime/metrics`,
    STATUS: `${API_BASE_URL}/api/realtime/status`,
    HEALTH: `${API_BASE_URL}/api/realtime/health`,
  },
  EXERCISES: `${API_BASE_URL}/exercises`,
  
} as const;

  

