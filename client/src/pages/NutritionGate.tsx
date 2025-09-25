import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { NutritionService } from '../services/nutritionService';
import NutritionPage from './NutritionPage';

export default function NutritionGate() {
  const [status, setStatus] = useState<'loading' | 'onboarding' | 'login' | 'ready'>('loading');

  useEffect(() => {
    const check = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setStatus('login');
        return;
      }
      try {
        const profile = await NutritionService.getProfile();
        const hasProfile = Boolean(profile && (profile.diet_type || (profile.allergies?.length) || (profile.favorite_cuisines?.length) || profile.meals_per_day || profile.snacks_per_day || profile.cooking_time_preference));
        if (hasProfile) {
          setStatus('ready');
          return;
        }
      } catch (e) {
        // ignore; fall back to onboarding data
      }
      try {
        const onboarding = await fetch('/auth/onboarding/nutrition', { headers: { Authorization: `Bearer ${token}` } });
        if (onboarding.ok) {
          const data = await onboarding.json();
          const n = data?.nutrition || {};
          const exists = Boolean(data?.nutrition_exists);
          const hasProfile = exists || Boolean(
            (Array.isArray(n.allergies) && n.allergies.some((item: string) => item && item.trim())) ||
            (Array.isArray(n.favorite_cuisines) && n.favorite_cuisines.some((item: string) => item && item.trim())) ||
            (typeof n.meals_per_day === 'number' && n.meals_per_day > 0) ||
            (typeof n.snacks_per_day === 'number' && n.snacks_per_day > 0) ||
            (typeof n.cooking_time_preference === 'string' && n.cooking_time_preference.trim().length > 0) ||
            (typeof n.disliked_foods === 'string' && n.disliked_foods.trim().length > 0)
          );
          if (hasProfile) {
            setStatus('ready');
            return;
          }
        }
      } catch {}
      setStatus('onboarding');
    };
    check();
  }, []);

  if (status === 'login') {
    return <Navigate to="/login" replace />;
  }
  if (status === 'onboarding') {
    return <Navigate to="/onboarding/nutrition" replace />;
  }
  if (status === 'ready') {
    return <NutritionPage />;
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white flex items-center justify-center">
      <div className="text-gray-300">Checking your nutrition profile…</div>
    </div>
  );
}


