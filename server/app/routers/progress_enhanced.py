from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Dict, Any, Optional
from datetime import date, datetime, timedelta
from bson import ObjectId
import math

from app.models.progress import (
    # Existing models
    ProgressEntryIn, ProgressEntryOut, MilestoneIn, MilestoneOut,
    StreakOut, BadgeOut, ProgressIn, ProgressOut,
    # New models
    CalorieEntryIn, CalorieEntryOut, MacroEntryIn, MacroEntryOut,
    MealEntryIn, MealEntryOut, SleepEntryIn, SleepEntryOut,
    HydrationEntryIn, HydrationEntryOut, GoalIn, GoalOut,
    WorkoutCompletionIn, WorkoutCompletionOut, EnhancedBadgeOut,
    DashboardMetrics, WeeklyData
)
from app.database.connection import db
from app.auth.jwt_auth import get_current_user_id

router = APIRouter(prefix="/api/progress", tags=["Progress Enhanced"])


# ---------- Utils ----------
def _oid(val: str):
    try:
        return ObjectId(val)
    except:
        return val


# -------------------------
# Enhanced Badge System
# -------------------------
ENHANCED_BADGE_RULES = {
    # Workout badges
    "Workout Warrior": {
        "requirements": {"workout_streak": 7},
        "rarity": "common",
        "category": "workout",
        "icon": "💪"
    },
    "Gym Legend": {
        "requirements": {"workout_streak": 30},
        "rarity": "rare",
        "category": "workout",
        "icon": "🏆"
    },
    "Perfect Week": {
        "requirements": {"workout_completion": 100, "days": 7},
        "rarity": "epic",
        "category": "workout",
        "icon": "⭐"
    },
    
    # Nutrition badges
    "Nutrition Master": {
        "requirements": {"meal_compliance": 90, "days": 30},
        "rarity": "rare",
        "category": "nutrition",
        "icon": "🥗"
    },
    "Macro Master": {
        "requirements": {"macro_accuracy": 95, "days": 14},
        "rarity": "epic",
        "category": "nutrition",
        "icon": "📊"
    },
    
    # Health badges
    "Sleep Champion": {
        "requirements": {"sleep_quality": "excellent", "days": 14},
        "rarity": "rare",
        "category": "health",
        "icon": "😴"
    },
    "Hydration Hero": {
        "requirements": {"hydration_target": 100, "days": 30},
        "rarity": "common",
        "category": "health",
        "icon": "💧"
    },
    
    # General badges
    "Goal Crusher": {
        "requirements": {"goals_completed": 5},
        "rarity": "epic",
        "category": "general",
        "icon": "🎯"
    },
    "Consistency King": {
        "requirements": {"total_streak": 100},
        "rarity": "legendary",
        "category": "general",
        "icon": "👑"
    }
}


def _check_enhanced_badges(user_id: str, entry_type: str, entry_data: Dict[str, Any]) -> List[str]:
    """Check and unlock enhanced badges based on user activity"""
    unlocked = []
    
    # Get user stats
    stats = _get_user_stats(user_id)
    
    for badge_name, badge_info in ENHANCED_BADGE_RULES.items():
        # Check if already unlocked
        existing = db.badges.find_one({"user_id": _oid(user_id), "name": badge_name})
        if existing:
            continue
            
        # Check requirements
        requirements = badge_info["requirements"]
        unlocked_badge = False
        
        try:
            if badge_name == "Workout Warrior":
                unlocked_badge = stats.get("workout_streak", 0) >= requirements["workout_streak"]
            elif badge_name == "Gym Legend":
                unlocked_badge = stats.get("workout_streak", 0) >= requirements["workout_streak"]
            elif badge_name == "Perfect Week":
                unlocked_badge = (stats.get("workout_completion_7d", 0) >= requirements["workout_completion"] and
                                stats.get("workout_days_7d", 0) >= requirements["days"])
            elif badge_name == "Nutrition Master":
                unlocked_badge = (stats.get("meal_compliance_30d", 0) >= requirements["meal_compliance"] and
                                stats.get("meal_days_30d", 0) >= requirements["days"])
            elif badge_name == "Macro Master":
                unlocked_badge = (stats.get("macro_accuracy_14d", 0) >= requirements["macro_accuracy"] and
                                stats.get("macro_days_14d", 0) >= requirements["days"])
            elif badge_name == "Sleep Champion":
                unlocked_badge = (stats.get("sleep_quality_14d", "poor") == requirements["sleep_quality"] and
                                stats.get("sleep_days_14d", 0) >= requirements["days"])
            elif badge_name == "Hydration Hero":
                unlocked_badge = (stats.get("hydration_30d", 0) >= requirements["hydration_target"] and
                                stats.get("hydration_days_30d", 0) >= requirements["days"])
            elif badge_name == "Goal Crusher":
                unlocked_badge = stats.get("goals_completed", 0) >= requirements["goals_completed"]
            elif badge_name == "Consistency King":
                unlocked_badge = stats.get("total_streak", 0) >= requirements["total_streak"]
                
        except Exception:
            unlocked_badge = False
            
        if unlocked_badge:
            # Create badge entry
            badge_doc = {
                "user_id": _oid(user_id),
                "name": badge_name,
                "description": badge_info.get("description", f"Unlocked {badge_name}"),
                "icon": badge_info["icon"],
                "rarity": badge_info["rarity"],
                "category": badge_info["category"],
                "unlocked": True,
                "unlocked_date": datetime.utcnow(),
                "created_at": datetime.utcnow()
            }
            db.badges.insert_one(badge_doc)
            unlocked.append(badge_name)
    
    return unlocked


def _get_user_stats(user_id: str) -> Dict[str, Any]:
    """Get comprehensive user statistics for badge checking"""
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)
    month_ago = now - timedelta(days=30)
    
    # Workout stats
    workout_streak = db.workout_completions.find_one(
        {"user_id": _oid(user_id)}, 
        sort=[("date", -1)]
    )
    workout_streak_days = 0
    if workout_streak:
        # Calculate workout streak logic here
        pass
    
    # Meal compliance stats
    meal_entries = list(db.meal_entries.find({
        "user_id": _oid(user_id),
        "date": {"$gte": month_ago.date().isoformat()}
    }))
    
    meal_compliance_30d = 0
    if meal_entries:
        followed_meals = sum(1 for meal in meal_entries if meal.get("followed", False))
        total_meals = len(meal_entries)
        meal_compliance_30d = (followed_meals / total_meals * 100) if total_meals > 0 else 0
    
    # Sleep quality stats
    sleep_entries = list(db.sleep_entries.find({
        "user_id": _oid(user_id),
        "date": {"$gte": two_weeks_ago.date().isoformat()}
    }))
    
    sleep_quality_14d = "poor"
    if sleep_entries:
        quality_scores = {"poor": 0, "fair": 1, "good": 2, "excellent": 3}
        avg_quality = sum(quality_scores.get(entry.get("quality", "poor"), 0) for entry in sleep_entries) / len(sleep_entries)
        if avg_quality >= 3:
            sleep_quality_14d = "excellent"
        elif avg_quality >= 2:
            sleep_quality_14d = "good"
        elif avg_quality >= 1:
            sleep_quality_14d = "fair"
    
    # Hydration stats
    hydration_entries = list(db.hydration_entries.find({
        "user_id": _oid(user_id),
        "date": {"$gte": month_ago.date().isoformat()}
    }))
    
    hydration_30d = 0
    if hydration_entries:
        total_consumed = sum(entry.get("consumed", 0) for entry in hydration_entries)
        total_target = sum(entry.get("target", 0) for entry in hydration_entries)
        hydration_30d = (total_consumed / total_target * 100) if total_target > 0 else 0
    
    # Goals completed
    goals_completed = db.goals.count_documents({
        "user_id": _oid(user_id),
        "completed": True
    })
    
    # Total streak (from existing streak system)
    streak_doc = db.streaks.find_one({"user_id": _oid(user_id)})
    total_streak = streak_doc.get("longest_streak", 0) if streak_doc else 0
    
    return {
        "workout_streak": workout_streak_days,
        "meal_compliance_30d": meal_compliance_30d,
        "meal_days_30d": len(meal_entries),
        "sleep_quality_14d": sleep_quality_14d,
        "sleep_days_14d": len(sleep_entries),
        "hydration_30d": hydration_30d,
        "hydration_days_30d": len(hydration_entries),
        "goals_completed": goals_completed,
        "total_streak": total_streak
    }


# -------------------------
# Nutrition Endpoints
# -------------------------
@router.post("/nutrition/calories", response_model=CalorieEntryOut)
def log_calories(entry: CalorieEntryIn, user_id: str = Depends(get_current_user_id)):
    """Log daily calorie intake"""
    doc = entry.dict()
    doc["user_id"] = _oid(user_id)
    doc["created_at"] = datetime.utcnow()
    
    result = db.calorie_entries.insert_one(doc)
    saved = db.calorie_entries.find_one({"_id": result.inserted_id})
    
    # Check for badges
    _check_enhanced_badges(user_id, "calories", doc)
    
    return CalorieEntryOut(
        id=str(saved["_id"]),
        user_id=user_id,
        **{k: saved.get(k) for k in ["date", "consumed", "recommended", "notes", "created_at"]}
    )


@router.get("/nutrition/calories", response_model=List[CalorieEntryOut])
def get_calories(
    user_id: str = Depends(get_current_user_id),
    days: int = Query(30, description="Number of days to retrieve")
):
    """Get calorie entries for the last N days"""
    start_date = (datetime.utcnow() - timedelta(days=days)).date()
    
    docs = db.calorie_entries.find({
        "user_id": _oid(user_id),
        "date": {"$gte": start_date.isoformat()}
    }).sort("date", -1)
    
    return [
        CalorieEntryOut(
            id=str(d["_id"]),
            user_id=user_id,
            **{k: d.get(k) for k in ["date", "consumed", "recommended", "notes", "created_at"]}
        )
        for d in docs
    ]


@router.post("/nutrition/macros", response_model=MacroEntryOut)
def log_macros(entry: MacroEntryIn, user_id: str = Depends(get_current_user_id)):
    """Log daily macronutrient intake"""
    doc = entry.dict()
    doc["user_id"] = _oid(user_id)
    doc["created_at"] = datetime.utcnow()
    
    result = db.macro_entries.insert_one(doc)
    saved = db.macro_entries.find_one({"_id": result.inserted_id})
    
    # Check for badges
    _check_enhanced_badges(user_id, "macros", doc)
    
    return MacroEntryOut(
        id=str(saved["_id"]),
        user_id=user_id,
        **{k: saved.get(k) for k in ["date", "protein", "carbs", "fats", "protein_target", "carbs_target", "fats_target", "created_at"]}
    )


@router.get("/nutrition/macros", response_model=List[MacroEntryOut])
def get_macros(
    user_id: str = Depends(get_current_user_id),
    days: int = Query(30, description="Number of days to retrieve")
):
    """Get macro entries for the last N days"""
    start_date = (datetime.utcnow() - timedelta(days=days)).date()
    
    docs = db.macro_entries.find({
        "user_id": _oid(user_id),
        "date": {"$gte": start_date.isoformat()}
    }).sort("date", -1)
    
    return [
        MacroEntryOut(
            id=str(d["_id"]),
            user_id=user_id,
            **{k: d.get(k) for k in ["date", "protein", "carbs", "fats", "protein_target", "carbs_target", "fats_target", "created_at"]}
        )
        for d in docs
    ]


@router.post("/nutrition/meals", response_model=MealEntryOut)
def log_meal(entry: MealEntryIn, user_id: str = Depends(get_current_user_id)):
    """Log meal compliance"""
    doc = entry.dict()
    doc["user_id"] = _oid(user_id)
    doc["created_at"] = datetime.utcnow()
    
    result = db.meal_entries.insert_one(doc)
    saved = db.meal_entries.find_one({"_id": result.inserted_id})
    
    # Check for badges
    _check_enhanced_badges(user_id, "meals", doc)
    
    return MealEntryOut(
        id=str(saved["_id"]),
        user_id=user_id,
        **{k: saved.get(k) for k in ["date", "meal_name", "planned", "followed", "time", "notes", "created_at"]}
    )


@router.get("/nutrition/meals", response_model=List[MealEntryOut])
def get_meals(
    user_id: str = Depends(get_current_user_id),
    days: int = Query(30, description="Number of days to retrieve")
):
    """Get meal entries for the last N days"""
    start_date = (datetime.utcnow() - timedelta(days=days)).date()
    
    docs = db.meal_entries.find({
        "user_id": _oid(user_id),
        "date": {"$gte": start_date.isoformat()}
    }).sort("date", -1)
    
    return [
        MealEntryOut(
            id=str(d["_id"]),
            user_id=user_id,
            **{k: d.get(k) for k in ["date", "meal_name", "planned", "followed", "time", "notes", "created_at"]}
        )
        for d in docs
    ]


# -------------------------
# Health Endpoints
# -------------------------
@router.post("/health/sleep", response_model=SleepEntryOut)
def log_sleep(entry: SleepEntryIn, user_id: str = Depends(get_current_user_id)):
    """Log sleep data"""
    doc = entry.dict()
    doc["user_id"] = _oid(user_id)
    doc["created_at"] = datetime.utcnow()
    
    # Calculate recovery score if not provided
    if doc.get("recovery_score") is None:
        doc["recovery_score"] = _calculate_recovery_score(doc)
    
    result = db.sleep_entries.insert_one(doc)
    saved = db.sleep_entries.find_one({"_id": result.inserted_id})
    
    # Check for badges
    _check_enhanced_badges(user_id, "sleep", doc)
    
    return SleepEntryOut(
        id=str(saved["_id"]),
        user_id=user_id,
        **{k: saved.get(k) for k in ["date", "duration", "quality", "deep_sleep", "rem_sleep", "light_sleep", "awakenings", "recovery_score", "created_at"]}
    )


@router.get("/health/sleep", response_model=List[SleepEntryOut])
def get_sleep(
    user_id: str = Depends(get_current_user_id),
    days: int = Query(30, description="Number of days to retrieve")
):
    """Get sleep entries for the last N days"""
    start_date = (datetime.utcnow() - timedelta(days=days)).date()
    
    docs = db.sleep_entries.find({
        "user_id": _oid(user_id),
        "date": {"$gte": start_date.isoformat()}
    }).sort("date", -1)
    
    return [
        SleepEntryOut(
            id=str(d["_id"]),
            user_id=user_id,
            **{k: d.get(k) for k in ["date", "duration", "quality", "deep_sleep", "rem_sleep", "light_sleep", "awakenings", "recovery_score", "created_at"]}
        )
        for d in docs
    ]


@router.post("/health/hydration", response_model=HydrationEntryOut)
def log_hydration(entry: HydrationEntryIn, user_id: str = Depends(get_current_user_id)):
    """Log hydration data"""
    doc = entry.dict()
    doc["user_id"] = _oid(user_id)
    doc["created_at"] = datetime.utcnow()
    
    result = db.hydration_entries.insert_one(doc)
    saved = db.hydration_entries.find_one({"_id": result.inserted_id})
    
    # Check for badges
    _check_enhanced_badges(user_id, "hydration", doc)
    
    return HydrationEntryOut(
        id=str(saved["_id"]),
        user_id=user_id,
        **{k: saved.get(k) for k in ["date", "consumed", "target", "bottles", "reminders", "created_at"]}
    )


@router.get("/health/hydration", response_model=List[HydrationEntryOut])
def get_hydration(
    user_id: str = Depends(get_current_user_id),
    days: int = Query(30, description="Number of days to retrieve")
):
    """Get hydration entries for the last N days"""
    start_date = (datetime.utcnow() - timedelta(days=days)).date()
    
    docs = db.hydration_entries.find({
        "user_id": _oid(user_id),
        "date": {"$gte": start_date.isoformat()}
    }).sort("date", -1)
    
    return [
        HydrationEntryOut(
            id=str(d["_id"]),
            user_id=user_id,
            **{k: d.get(k) for k in ["date", "consumed", "target", "bottles", "reminders", "created_at"]}
        )
        for d in docs
    ]


# -------------------------
# Goal Management Endpoints
# -------------------------
@router.post("/goals", response_model=GoalOut)
def create_goal(goal: GoalIn, user_id: str = Depends(get_current_user_id)):
    """Create a new goal"""
    doc = goal.dict()
    doc["user_id"] = _oid(user_id)
    doc["created_at"] = datetime.utcnow()
    doc["achievement_rate"] = 0.0
    
    result = db.goals.insert_one(doc)
    saved = db.goals.find_one({"_id": result.inserted_id})
    
    return GoalOut(
        id=str(saved["_id"]),
        user_id=user_id,
        **{k: saved.get(k) for k in ["title", "description", "target", "current", "deadline", "category", "unit", "completed", "achievement_rate", "created_at", "completed_at"]}
    )


@router.get("/goals", response_model=List[GoalOut])
def get_goals(
    user_id: str = Depends(get_current_user_id),
    category: Optional[str] = Query(None, description="Filter by category"),
    completed: Optional[bool] = Query(None, description="Filter by completion status")
):
    """Get user goals with optional filtering"""
    query = {"user_id": _oid(user_id)}
    if category:
        query["category"] = category
    if completed is not None:
        query["completed"] = completed
    
    docs = db.goals.find(query).sort("created_at", -1)
    
    return [
        GoalOut(
            id=str(d["_id"]),
            user_id=user_id,
            **{k: d.get(k) for k in ["title", "description", "target", "current", "deadline", "category", "unit", "completed", "achievement_rate", "created_at", "completed_at"]}
        )
        for d in docs
    ]


@router.put("/goals/{goal_id}/progress")
def update_goal_progress(
    goal_id: str,
    progress: float,
    user_id: str = Depends(get_current_user_id)
):
    """Update goal progress"""
    goal = db.goals.find_one({"_id": _oid(goal_id), "user_id": _oid(user_id)})
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    # Update progress
    achievement_rate = min(100.0, (progress / goal["target"]) * 100) if goal["target"] > 0 else 0.0
    completed = achievement_rate >= 100.0
    
    update_data = {
        "current": progress,
        "achievement_rate": achievement_rate,
        "completed": completed
    }
    
    if completed and not goal.get("completed", False):
        update_data["completed_at"] = datetime.utcnow()
        # Check for badges
        _check_enhanced_badges(user_id, "goals", {"goals_completed": 1})
    
    db.goals.update_one(
        {"_id": _oid(goal_id)},
        {"$set": update_data}
    )
    
    return {"message": "Goal progress updated", "achievement_rate": achievement_rate, "completed": completed}


# -------------------------
# Workout Completion Endpoints
# -------------------------
@router.post("/workouts/completion", response_model=WorkoutCompletionOut)
def log_workout_completion(entry: WorkoutCompletionIn, user_id: str = Depends(get_current_user_id)):
    """Log workout completion"""
    doc = entry.dict()
    doc["user_id"] = _oid(user_id)
    doc["completion_rate"] = (entry.exercises_completed / entry.exercises_planned * 100) if entry.exercises_planned > 0 else 0
    doc["created_at"] = datetime.utcnow()
    
    result = db.workout_completions.insert_one(doc)
    saved = db.workout_completions.find_one({"_id": result.inserted_id})
    
    # Check for badges
    _check_enhanced_badges(user_id, "workout", doc)
    
    return WorkoutCompletionOut(
        id=str(saved["_id"]),
        user_id=user_id,
        **{k: saved.get(k) for k in ["date", "workout_id", "exercises_planned", "exercises_completed", "duration_minutes", "notes", "completion_rate", "created_at"]}
    )


@router.get("/workouts/completion", response_model=List[WorkoutCompletionOut])
def get_workout_completions(
    user_id: str = Depends(get_current_user_id),
    days: int = Query(30, description="Number of days to retrieve")
):
    """Get workout completions for the last N days"""
    start_date = (datetime.utcnow() - timedelta(days=days)).date()
    
    docs = db.workout_completions.find({
        "user_id": _oid(user_id),
        "date": {"$gte": start_date.isoformat()}
    }).sort("date", -1)
    
    return [
        WorkoutCompletionOut(
            id=str(d["_id"]),
            user_id=user_id,
            **{k: d.get(k) for k in ["date", "workout_id", "exercises_planned", "exercises_completed", "duration_minutes", "notes", "completion_rate", "created_at"]}
        )
        for d in docs
    ]


# -------------------------
# Enhanced Badge Endpoints
# -------------------------
@router.get("/badges/enhanced", response_model=List[EnhancedBadgeOut])
def get_enhanced_badges(user_id: str = Depends(get_current_user_id)):
    """Get enhanced badges with progress tracking"""
    docs = db.badges.find({"user_id": _oid(user_id)}).sort("unlocked_date", -1)
    
    badges = []
    for d in docs:
        # Calculate progress for locked badges
        progress = None
        if not d.get("unlocked", False):
            stats = _get_user_stats(user_id)
            badge_name = d["name"]
            if badge_name in ENHANCED_BADGE_RULES:
                requirements = ENHANCED_BADGE_RULES[badge_name]["requirements"]
                # Calculate progress based on requirements
                progress = _calculate_badge_progress(badge_name, requirements, stats)
        
        badges.append(EnhancedBadgeOut(
            id=str(d["_id"]),
            name=d["name"],
            description=d.get("description", ""),
            icon=d.get("icon", "🏆"),
            rarity=d.get("rarity", "common"),
            category=d.get("category", "general"),
            unlocked=d.get("unlocked", False),
            unlocked_date=d.get("unlocked_date"),
            progress=progress
        ))
    
    return badges


# -------------------------
# Dashboard Endpoint
# -------------------------
@router.get("/dashboard", response_model=DashboardMetrics)
def get_dashboard_metrics(user_id: str = Depends(get_current_user_id)):
    """Get comprehensive dashboard metrics"""
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)
    
    # Workout completion metrics
    workout_completions = list(db.workout_completions.find({
        "user_id": _oid(user_id),
        "date": {"$gte": week_ago.date().isoformat()}
    }))
    
    workout_completion_rate = 0
    if workout_completions:
        total_completion = sum(w.get("completion_rate", 0) for w in workout_completions)
        workout_completion_rate = total_completion / len(workout_completions)
    
    # Calorie intake metrics
    calorie_entries = list(db.calorie_entries.find({
        "user_id": _oid(user_id),
        "date": {"$gte": week_ago.date().isoformat()}
    }))
    
    avg_calories_consumed = 0
    avg_calories_recommended = 0
    if calorie_entries:
        avg_calories_consumed = sum(c.get("consumed", 0) for c in calorie_entries) / len(calorie_entries)
        avg_calories_recommended = sum(c.get("recommended", 0) for c in calorie_entries) / len(calorie_entries)
    
    # Macro breakdown metrics
    macro_entries = list(db.macro_entries.find({
        "user_id": _oid(user_id),
        "date": {"$gte": week_ago.date().isoformat()}
    }))
    
    avg_protein = 0
    avg_carbs = 0
    avg_fats = 0
    if macro_entries:
        avg_protein = sum(m.get("protein", 0) for m in macro_entries) / len(macro_entries)
        avg_carbs = sum(m.get("carbs", 0) for m in macro_entries) / len(macro_entries)
        avg_fats = sum(m.get("fats", 0) for m in macro_entries) / len(macro_entries)
    
    # Meal compliance metrics
    meal_entries = list(db.meal_entries.find({
        "user_id": _oid(user_id),
        "date": {"$gte": week_ago.date().isoformat()}
    }))
    
    meal_compliance_rate = 0
    if meal_entries:
        followed_meals = sum(1 for m in meal_entries if m.get("followed", False))
        meal_compliance_rate = (followed_meals / len(meal_entries) * 100) if meal_entries else 0
    
    # Activity trends (from realtime data)
    activity_trends = {
        "steps_today": 0,
        "steps_weekly_avg": 0,
        "calories_burned": 0,
        "active_minutes": 0
    }
    
    # Goal achievement metrics
    goals = list(db.goals.find({"user_id": _oid(user_id)}))
    total_goals = len(goals)
    completed_goals = sum(1 for g in goals if g.get("completed", False))
    goal_achievement_rate = (completed_goals / total_goals * 100) if total_goals > 0 else 0
    
    # Sleep and recovery metrics
    sleep_entries = list(db.sleep_entries.find({
        "user_id": _oid(user_id),
        "date": {"$gte": week_ago.date().isoformat()}
    }))
    
    avg_sleep_duration = 0
    avg_recovery_score = 0
    if sleep_entries:
        avg_sleep_duration = sum(s.get("duration", 0) for s in sleep_entries) / len(sleep_entries)
        avg_recovery_score = sum(s.get("recovery_score", 0) for s in sleep_entries) / len(sleep_entries)
    
    # Hydration trends
    hydration_entries = list(db.hydration_entries.find({
        "user_id": _oid(user_id),
        "date": {"$gte": week_ago.date().isoformat()}
    }))
    
    avg_hydration = 0
    hydration_target = 0
    if hydration_entries:
        avg_hydration = sum(h.get("consumed", 0) for h in hydration_entries) / len(hydration_entries)
        hydration_target = sum(h.get("target", 0) for h in hydration_entries) / len(hydration_entries)
    
    # Badges and streaks
    badges = list(db.badges.find({"user_id": _oid(user_id), "unlocked": True}))
    streak_doc = db.streaks.find_one({"user_id": _oid(user_id)})
    current_streak = streak_doc.get("current_streak", 0) if streak_doc else 0
    longest_streak = streak_doc.get("longest_streak", 0) if streak_doc else 0
    
    return DashboardMetrics(
        workout_completion={
            "completion_rate": workout_completion_rate,
            "workouts_this_week": len(workout_completions),
            "avg_duration": sum(w.get("duration_minutes", 0) for w in workout_completions) / len(workout_completions) if workout_completions else 0
        },
        calorie_intake={
            "consumed": avg_calories_consumed,
            "recommended": avg_calories_recommended,
            "deficit": avg_calories_recommended - avg_calories_consumed
        },
        macro_breakdown={
            "protein": avg_protein,
            "carbs": avg_carbs,
            "fats": avg_fats
        },
        meal_compliance={
            "compliance_rate": meal_compliance_rate,
            "meals_this_week": len(meal_entries)
        },
        activity_trends=activity_trends,
        goal_achievement={
            "achievement_rate": goal_achievement_rate,
            "completed_goals": completed_goals,
            "total_goals": total_goals
        },
        sleep_recovery={
            "avg_duration": avg_sleep_duration,
            "avg_recovery_score": avg_recovery_score,
            "entries_this_week": len(sleep_entries)
        },
        hydration_trends={
            "avg_consumed": avg_hydration,
            "target": hydration_target,
            "compliance_rate": (avg_hydration / hydration_target * 100) if hydration_target > 0 else 0
        },
        badges_streaks={
            "total_badges": len(badges),
            "current_streak": current_streak,
            "longest_streak": longest_streak
        }
    )


# -------------------------
# Helper Functions
# -------------------------
def _calculate_recovery_score(sleep_data: Dict[str, Any]) -> float:
    """Calculate recovery score based on sleep data"""
    duration = sleep_data.get("duration", 0)
    quality_scores = {"poor": 0.2, "fair": 0.4, "good": 0.7, "excellent": 1.0}
    quality = quality_scores.get(sleep_data.get("quality", "poor"), 0.2)
    
    # Base score from quality
    score = quality * 50
    
    # Duration bonus (optimal 7-9 hours)
    if 7 <= duration <= 9:
        score += 30
    elif 6 <= duration < 7 or 9 < duration <= 10:
        score += 20
    elif 5 <= duration < 6 or 10 < duration <= 11:
        score += 10
    
    # Awakenings penalty
    awakenings = sleep_data.get("awakenings", 0)
    if awakenings == 0:
        score += 20
    elif awakenings <= 2:
        score += 10
    elif awakenings <= 4:
        score += 5
    
    return min(100.0, max(0.0, score))


def _calculate_badge_progress(badge_name: str, requirements: Dict[str, Any], stats: Dict[str, Any]) -> float:
    """Calculate progress towards unlocking a badge"""
    try:
        if badge_name == "Workout Warrior":
            current = stats.get("workout_streak", 0)
            target = requirements["workout_streak"]
            return min(100.0, (current / target) * 100)
        elif badge_name == "Gym Legend":
            current = stats.get("workout_streak", 0)
            target = requirements["workout_streak"]
            return min(100.0, (current / target) * 100)
        elif badge_name == "Nutrition Master":
            current = stats.get("meal_compliance_30d", 0)
            target = requirements["meal_compliance"]
            return min(100.0, (current / target) * 100)
        elif badge_name == "Hydration Hero":
            current = stats.get("hydration_30d", 0)
            target = requirements["hydration_target"]
            return min(100.0, (current / target) * 100)
        elif badge_name == "Goal Crusher":
            current = stats.get("goals_completed", 0)
            target = requirements["goals_completed"]
            return min(100.0, (current / target) * 100)
        elif badge_name == "Consistency King":
            current = stats.get("total_streak", 0)
            target = requirements["total_streak"]
            return min(100.0, (current / target) * 100)
        else:
            return 0.0
    except Exception:
        return 0.0
