import { API_ENDPOINTS } from "../config/api";

const authHeaders = () => {
  const accessToken = localStorage.getItem("access_token");
  if (!accessToken) throw new Error("User not authenticated");
  return { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` };
};

export type FoodItem = {
  name: string;
  serving_size?: string;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fats_g?: number;
  notes?: string;
  image_url?: string;
};

export type MealLog = {
  id: string;
  meal_type: string;
  timestamp: string;
  items: FoodItem[];
  notes?: string;
  created_at: string;
  updated_at: string;
};

export type MacroTargets = {
  id: string;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fats_g?: number;
  diet_pref?: string;
  exclude_foods?: string[];
  updated_at: string;
};

export const NutritionService = {
  async listMeals(params?: { start?: string; end?: string }): Promise<MealLog[]> {
    const usp = new URLSearchParams();
    if (params?.start) usp.set("start", params.start);
    if (params?.end) usp.set("end", params.end);
    const resp = await fetch(`${API_ENDPOINTS.NUTRITION.MEALS}${usp.toString() ? `?${usp}` : ''}`, { headers: authHeaders() });
    if (!resp.ok) throw new Error("Failed to fetch meals");
    return resp.json();
  },

  async createMeal(payload: { meal_type: string; timestamp?: string; items: FoodItem[]; notes?: string }): Promise<MealLog> {
    const resp = await fetch(API_ENDPOINTS.NUTRITION.MEALS, { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
    if (!resp.ok) throw new Error("Failed to create meal");
    return resp.json();
  },

  async updateMeal(mealId: string, payload: { meal_type: string; timestamp?: string; items: FoodItem[]; notes?: string }): Promise<MealLog> {
    const resp = await fetch(API_ENDPOINTS.NUTRITION.MEAL(mealId), { method: 'PUT', headers: authHeaders(), body: JSON.stringify(payload) });
    if (!resp.ok) throw new Error("Failed to update meal");
    return resp.json();
  },

  async deleteMeal(mealId: string): Promise<boolean> {
    const resp = await fetch(API_ENDPOINTS.NUTRITION.MEAL(mealId), { method: 'DELETE', headers: authHeaders() });
    if (!resp.ok) throw new Error("Failed to delete meal");
    return true;
  },

  async getMacros(): Promise<MacroTargets | null> {
    const resp = await fetch(API_ENDPOINTS.NUTRITION.MACROS, { headers: authHeaders() });
    if (!resp.ok) throw new Error("Failed to fetch macro targets");
    return resp.json();
  },

  async setMacros(payload: Partial<Omit<MacroTargets, 'id' | 'updated_at'>>): Promise<MacroTargets> {
    const resp = await fetch(API_ENDPOINTS.NUTRITION.MACROS, { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
    if (!resp.ok) throw new Error("Failed to save macro targets");
    return resp.json();
  },

  async waterToday(): Promise<{ total_ml: number; logs: { id: string; amount_ml: number; timestamp: string }[] }> {
    const resp = await fetch(API_ENDPOINTS.NUTRITION.WATER_TODAY, { headers: authHeaders() });
    if (!resp.ok) throw new Error("Failed to fetch today's water");
    return resp.json();
  },

  async addWater(amount_ml: number): Promise<{ id: string; amount_ml: number; timestamp: string; user_id: string; created_at: string }> {
    const resp = await fetch(API_ENDPOINTS.NUTRITION.WATER_ADD, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ amount_ml }) });
    if (!resp.ok) throw new Error("Failed to add water");
    return resp.json();
  },

  async groceryList(): Promise<{ items: string[]; generated_at: string }> {
    const resp = await fetch(API_ENDPOINTS.NUTRITION.GROCERY_LIST, { headers: authHeaders() });
    if (!resp.ok) throw new Error("Failed to fetch grocery list");
    return resp.json();
  },

  async groceryExport(): Promise<Blob> {
    const resp = await fetch(API_ENDPOINTS.NUTRITION.GROCERY_EXPORT, { headers: authHeaders() });
    if (!resp.ok) throw new Error("Failed to export grocery list");
    return resp.blob();
  },

  async mealSwap(payload: { meal_id?: string; reason?: string; desired_profile?: Record<string, any> }): Promise<{ swaps: Record<string, string[]> }> {
    const resp = await fetch(API_ENDPOINTS.NUTRITION.MEAL_SWAP, { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
    if (!resp.ok) throw new Error("Failed to fetch meal swap suggestions");
    return resp.json();
  },

  async generateRecipe(payload: { target_calories?: number; protein_g?: number; carbs_g?: number; fats_g?: number; diet_pref?: string; title_hint?: string }) {
    const resp = await fetch(API_ENDPOINTS.NUTRITION.GENERATE_RECIPE, { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
    if (!resp.ok) throw new Error("Failed to generate recipe");
    return resp.json();
  },

  async complianceToday(): Promise<{ status: string; score: number; meals_count: number; total_calories: number; target_calories?: number }> {
    const resp = await fetch(API_ENDPOINTS.NUTRITION.COMPLIANCE_TODAY, { headers: authHeaders() });
    if (!resp.ok) throw new Error("Failed to fetch compliance");
    return resp.json();
  },

  async runAgent(): Promise<{ status: string }> {
    const resp = await fetch(API_ENDPOINTS.NUTRITION.AGENT_RUN, { method: 'POST', headers: authHeaders() });
    if (!resp.ok) throw new Error("Failed to queue nutrition agent");
    return resp.json();
  },

  async getProfile(): Promise<NutritionProfile | null> {
    const resp = await fetch(API_ENDPOINTS.NUTRITION.PROFILE, { headers: authHeaders() });
    if (resp.status === 404) return null;
    if (!resp.ok) throw new Error("Failed to fetch nutrition profile");
    return resp.json();
  },

  async saveProfile(payload: NutritionProfilePayload): Promise<NutritionProfile> {
    const resp = await fetch(API_ENDPOINTS.NUTRITION.PROFILE, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    if (!resp.ok) throw new Error("Failed to save nutrition profile");
    return resp.json();
  }
};

export type NutritionProfilePayload = {
  diet_type?: string | null;
  allergies?: string[];
  disliked_foods?: string | null;
  favorite_cuisines?: string[];
  meals_per_day?: number | null;
  snacks_per_day?: number | null;
  cooking_time_preference?: string | null;
};

export type NutritionProfile = NutritionProfilePayload & {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};


