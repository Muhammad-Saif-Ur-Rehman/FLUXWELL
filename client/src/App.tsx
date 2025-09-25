import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Homepage from './pages/Homepage';
import SignupPage from './pages/SignupPage';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import WorkoutsPage from './pages/WorkoutsPage';
import OnboardingPage from './pages/OnboardingPage';
import OnboardingNutritionPage from './pages/NutritionOnboardingPage';
import WorkoutOnboardingPage from './pages/WorkoutOnboardingPage';
import ExerciseSearchPage from './pages/ExerciseSearchPage';
import CreateWorkoutPlanPage from './pages/CreateWorkoutPlanPage';
import RealtimePage from './pages/RealtimePage';
import AuthSuccessPage from './pages/AuthSuccessPage';
import AuthErrorPage from './pages/AuthErrorPage';
import './App.css';
import CoachPage from './pages/CoachPage';
import ProgressPage from './pages/ProgressPage';

// Simple auth guard for private routes
function RequireAuth({ children }: { children: JSX.Element }) {
  const token = localStorage.getItem('access_token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/onboarding/nutrition" element={<OnboardingNutritionPage />} />
        <Route path="/onboarding/workout" element={<WorkoutOnboardingPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/workouts" element={<WorkoutsPage />} />
        <Route path="/exercises/search" element={<ExerciseSearchPage />} />
        <Route path="/workouts/create" element={<CreateWorkoutPlanPage />} />
        <Route path="/coach" element={<RequireAuth><CoachPage /></RequireAuth>} />
        <Route path="/realtime" element={<RequireAuth><RealtimePage /></RequireAuth>} />
        <Route path="/progress" element={<RequireAuth><ProgressPage /></RequireAuth>} />
        <Route path="/auth-success" element={<AuthSuccessPage />} />
        <Route path="/auth-error" element={<AuthErrorPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
