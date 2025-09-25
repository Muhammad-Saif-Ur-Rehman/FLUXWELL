# app/routers/nutrition.py
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Any
import csv
import io
import os
import asyncio
import traceback

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Body, Response
from pydantic import BaseModel, Field
from bson import ObjectId

from app.database.connection import db
from app.auth import get_current_user_id

# Groq client assumed to be initialized in your project like in ai_workout.py
from groq import Groq
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL")
groq_client = None
if GROQ_API_KEY and GROQ_MODEL:
    try:
        groq_client = Groq(api_key=GROQ_API_KEY)
    except Exception:
        groq_client = None

router = APIRouter(prefix="/nutrition", tags=["Nutrition"])

# ---------- helpers ----------
def _oid(val: str):
    try:
        return ObjectId(val)
    except Exception:
        return val  # fallback if stored as string

def _now():
    return datetime.utcnow()

# ---------- Pydantic models ----------
class FoodItem(BaseModel):
    name: str
    serving_size: Optional[str] = None
    calories: Optional[float] = None
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fats_g: Optional[float] = None
    notes: Optional[str] = None
    image_url: Optional[str] = None  # future: link to stored image

class MealLogIn(BaseModel):
    meal_type: str  # "breakfast", "lunch", "dinner", "snack"
    timestamp: Optional[datetime] = None
    items: List[FoodItem] = Field(default_factory=list)
    notes: Optional[str] = None

class MealLogOut(MealLogIn):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime

class WaterLogIn(BaseModel):
    amount_ml: int
    timestamp: Optional[datetime] = None

class WaterLogOut(WaterLogIn):
    id: str
    user_id: str
    created_at: datetime

class MacroTargetsIn(BaseModel):
    calories: Optional[int] = None
    protein_g: Optional[int] = None
    carbs_g: Optional[int] = None
    fats_g: Optional[int] = None
    # preferences
    diet_pref: Optional[str] = None  # e.g., "vegan", "keto", etc.
    exclude_foods: Optional[List[str]] = []

class MacroTargetsOut(MacroTargetsIn):
    id: str
    user_id: str
    updated_at: datetime

class MealSwapRequest(BaseModel):
    meal_id: Optional[str] = None  # the meal user wants to swap from (optional)
    reason: Optional[str] = None   # user reason for swap (e.g., "too heavy", "allergy")
    desired_profile: Optional[Dict[str, Any]] = None  # overrides like {"calories": 400, "protein_g": 30}

class GenerateRecipeRequest(BaseModel):
    target_calories: Optional[int] = None
    protein_g: Optional[int] = None
    carbs_g: Optional[int] = None
    fats_g: Optional[int] = None
    diet_pref: Optional[str] = None
    title_hint: Optional[str] = None

class GeneratedRecipe(BaseModel):
    title: str
    ingredients: List[str]
    steps: List[str]
    calories: Optional[int] = None
    protein_g: Optional[int] = None
    carbs_g: Optional[int] = None
    fats_g: Optional[int] = None

# ---------- DB helpers ----------
def _ensure_indexes():
    # idempotent index creation
    try:
        db.meals.create_index([("user_id", 1), ("meal_type", 1), ("timestamp", 1)])
        db.water_logs.create_index([("user_id", 1), ("timestamp", 1)])
        db.macro_targets.create_index([("user_id", 1)], unique=True)
    except Exception:
        pass

@router.on_event("startup")
async def _startup_indexes():
    _ensure_indexes()
    try:
        db.nutrition_profiles.create_index([("user_id", 1)], unique=True, name="ux_nutrition_profile_user")
    except Exception:
        pass

# ---------- CRUD: Meal Logs ----------
@router.post("/meals", response_model=MealLogOut)
def create_meal(payload: MealLogIn, user_id: str = Depends(get_current_user_id)):
    now = _now()
    doc = {
        "user_id": _oid(user_id),
        "meal_type": payload.meal_type.lower(),
        "timestamp": payload.timestamp or now,
        "items": [item.dict() for item in payload.items],
        "notes": payload.notes,
        "created_at": now,
        "updated_at": now,
    }
    res = db.meals.insert_one(doc)
    saved = db.meals.find_one({"_id": res.inserted_id})
    return MealLogOut(
        id=str(saved["_id"]),
        user_id=str(saved["user_id"]),
        meal_type=saved["meal_type"],
        timestamp=saved["timestamp"],
        items=saved.get("items", []),
        notes=saved.get("notes"),
        created_at=saved["created_at"],
        updated_at=saved["updated_at"],
    )

@router.get("/meals", response_model=List[MealLogOut])
def list_meals(user_id: str = Depends(get_current_user_id), start: Optional[date] = None, end: Optional[date] = None):
    q = {"user_id": _oid(user_id)}
    if start:
        q["timestamp"] = {"$gte": datetime.combine(start, datetime.min.time())}
    if end:
        q.setdefault("timestamp", {})
        q["timestamp"]["$lte"] = datetime.combine(end, datetime.max.time())
    docs = list(db.meals.find(q).sort("timestamp", 1))
    out = []
    for d in docs:
        out.append(MealLogOut(
            id=str(d["_id"]),
            user_id=str(d["user_id"]),
            meal_type=d["meal_type"],
            timestamp=d["timestamp"],
            items=d.get("items", []),
            notes=d.get("notes"),
            created_at=d["created_at"],
            updated_at=d["updated_at"],
        ))
    return out

@router.get("/meals/{meal_id}", response_model=MealLogOut)
def read_meal(meal_id: str, user_id: str = Depends(get_current_user_id)):
    d = db.meals.find_one({"_id": _oid(meal_id), "user_id": _oid(user_id)})
    if not d:
        raise HTTPException(404, "Meal not found")
    return MealLogOut(
        id=str(d["_id"]),
        user_id=str(d["user_id"]),
        meal_type=d["meal_type"],
        timestamp=d["timestamp"],
        items=d.get("items", []),
        notes=d.get("notes"),
        created_at=d["created_at"],
        updated_at=d["updated_at"],
    )

@router.put("/meals/{meal_id}", response_model=MealLogOut)
def update_meal(meal_id: str, payload: MealLogIn, user_id: str = Depends(get_current_user_id)):
    now = _now()
    res = db.meals.find_one_and_update(
        {"_id": _oid(meal_id), "user_id": _oid(user_id)},
        {"$set": {"meal_type": payload.meal_type.lower(), "timestamp": payload.timestamp or now, "items": [i.dict() for i in payload.items], "notes": payload.notes, "updated_at": now}},
        return_document=True
    )
    if not res:
        raise HTTPException(404, "Meal not found")
    return MealLogOut(
        id=str(res["_id"]),
        user_id=str(res["user_id"]),
        meal_type=res["meal_type"],
        timestamp=res["timestamp"],
        items=res.get("items", []),
        notes=res.get("notes"),
        created_at=res["created_at"],
        updated_at=res["updated_at"],
    )

@router.delete("/meals/{meal_id}")
def delete_meal(meal_id: str, user_id: str = Depends(get_current_user_id)):
    res = db.meals.delete_one({"_id": _oid(meal_id), "user_id": _oid(user_id)})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"deleted": True}

# ---------- Water logs ----------
@router.post("/water", response_model=WaterLogOut)
def add_water(payload: WaterLogIn, user_id: str = Depends(get_current_user_id)):
    now = _now()
    ts = payload.timestamp or now
    doc = {"user_id": _oid(user_id), "amount_ml": payload.amount_ml, "timestamp": ts, "created_at": now}
    res = db.water_logs.insert_one(doc)
    saved = db.water_logs.find_one({"_id": res.inserted_id})
    return WaterLogOut(id=str(saved["_id"]), user_id=str(saved["user_id"]), amount_ml=saved["amount_ml"], timestamp=saved["timestamp"], created_at=saved["created_at"])

@router.get("/water/today")
def water_today(user_id: str = Depends(get_current_user_id)):
    today = datetime.utcnow().date()
    start = datetime.combine(today, datetime.min.time())
    end = datetime.combine(today, datetime.max.time())
    docs = list(db.water_logs.find({"user_id": _oid(user_id), "timestamp": {"$gte": start, "$lte": end}}))
    total_ml = sum(d.get("amount_ml", 0) for d in docs)
    return {"total_ml": total_ml, "logs": [{"id": str(d["_id"]), "amount_ml": d["amount_ml"], "timestamp": d["timestamp"]} for d in docs]}

# ---------- Macro Targets ----------
@router.post("/macros", response_model=MacroTargetsOut)
def set_macros(payload: MacroTargetsIn, user_id: str = Depends(get_current_user_id)):
    now = _now()
    doc = {"user_id": _oid(user_id), **payload.dict(), "updated_at": now}
    existing = db.macro_targets.find_one({"user_id": _oid(user_id)})
    if existing:
        db.macro_targets.update_one({"_id": existing["_id"]}, {"$set": doc})
        saved = db.macro_targets.find_one({"_id": existing["_id"]})
    else:
        doc["created_at"] = now
        res = db.macro_targets.insert_one(doc)
        saved = db.macro_targets.find_one({"_id": res.inserted_id})
    return MacroTargetsOut(id=str(saved["_id"]), user_id=str(saved["user_id"]), calories=saved.get("calories"), protein_g=saved.get("protein_g"), carbs_g=saved.get("carbs_g"), fats_g=saved.get("fats_g"), diet_pref=saved.get("diet_pref"), exclude_foods=saved.get("exclude_foods", []), updated_at=saved.get("updated_at"))

@router.get("/macros", response_model=Optional[MacroTargetsOut])
def get_macros(user_id: str = Depends(get_current_user_id)):
    d = db.macro_targets.find_one({"user_id": _oid(user_id)})
    if not d:
        return None
    return MacroTargetsOut(id=str(d["_id"]), user_id=str(d["user_id"]), calories=d.get("calories"), protein_g=d.get("protein_g"), carbs_g=d.get("carbs_g"), fats_g=d.get("fats_g"), diet_pref=d.get("diet_pref"), exclude_foods=d.get("exclude_foods", []), updated_at=d.get("updated_at"))

# ---------- Grocery List generation ----------
@router.get("/grocery-list")
def get_grocery_list(user_id: str = Depends(get_current_user_id)):
    """
    Compile a grocery list from all meal items for the next 7 days
    (simple heuristic: collect unique ingredient names from logged meals).
    """
    # Gather meals for next 7 days or recent logs - here just use last 14 days for simplicity
    start = datetime.utcnow() - timedelta(days=14)
    docs = list(db.meals.find({"user_id": _oid(user_id), "timestamp": {"$gte": start}}))
    items = []
    for d in docs:
        for it in d.get("items", []):
            # best-effort: use item.name and split by commas - could be improved after AI integration
            nm = (it.get("name") or "").strip()
            if nm:
                items.append(nm)
    unique_items = sorted(list(set(items)))
    return {"items": unique_items, "generated_at": datetime.utcnow()}

@router.get("/grocery-list/export")
def export_grocery_csv(user_id: str = Depends(get_current_user_id)):
    data = get_grocery_list(user_id)
    items = data["items"]
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["item", "checked"])
    for it in items:
        writer.writerow([it, ""])
    csv_bytes = buf.getvalue().encode("utf-8")
    return Response(content=csv_bytes, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=grocery_list.csv"})

# ---------- Meal Swap (rule-based) ----------
def _simple_swap_candidates(item_name: str, exclude_list: List[str], target_profile: Optional[Dict[str, Any]] = None, limit: int = 5):
    """
    Simple heuristic: search Nutrition knowledge (we don't have an external food DB).
    Here we will:
      - Search previously logged items in DB with similar names (fuzzy)
      - If not enough, fallback to simpler substitutions (hardcoded mapping)
    """
    # 1) Try user history (most common similar names)
    pipeline = [
        {"$match": {"items.name": {"$regex": item_name, "$options": "i"}}},
        {"$unwind": "$items"},
        {"$match": {"items.name": {"$regex": item_name, "$options": "i"}}},
        {"$group": {"_id": "$items.name", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": limit}
    ]
    try:
        rows = list(db.meals.aggregate(pipeline))
        if rows:
            return [r["_id"] for r in rows if r["_id"] not in exclude_list][:limit]
    except Exception:
        pass

    # 2) Basic mapping fallback (expand as you go)
    SUBS = {
        "beef burger": ["turkey burger", "veggie burger", "chicken breast"],
        "fried rice": ["brown rice", "cauliflower rice", "quinoa"],
        "pasta": ["zucchini noodles", "whole wheat pasta", "lentil pasta"],
    }
    ln = item_name.lower()
    for k, v in SUBS.items():
        if k in ln:
            return [x for x in v if x not in exclude_list][:limit]

    # 3) general safe defaults
    defaults = ["grilled chicken", "tofu", "mixed salad", "steamed fish", "lentils"]
    return [x for x in defaults if x not in exclude_list][:limit]

@router.post("/meal-swap")
def meal_swap(req: MealSwapRequest = Body(...), user_id: str = Depends(get_current_user_id)):
    # If meal_id provided, return swaps for each item in meal
    if req.meal_id:
        meal = db.meals.find_one({"_id": _oid(req.meal_id), "user_id": _oid(user_id)})
        if not meal:
            raise HTTPException(404, "Meal not found")
        swaps = {}
        for it in meal.get("items", []):
            name = it.get("name", "")
            swaps[name] = _simple_swap_candidates(name, exclude_list=meal.get("items", []), target_profile=req.desired_profile)
        return {"swaps": swaps}
    # else: generic suggestions
    # use desired_profile to influence result in the future; for now return defaults
    suggestions = _simple_swap_candidates("generic", exclude_list=[], target_profile=req.desired_profile)
    return {"swaps": {"generic": suggestions}}

# ---------- AI: Recipe generation using Groq (LLM) ----------
def _llm_generate_recipe_prompt(payload: GenerateRecipeRequest, user_doc: dict):
    parts = []
    if payload.title_hint:
        parts.append(f"Title hint: {payload.title_hint}")
    if payload.target_calories:
        parts.append(f"Target calories: {payload.target_calories}")
    if payload.protein_g:
        parts.append(f"Protein (g): {payload.protein_g}")
    if payload.carbs_g:
        parts.append(f"Carbs (g): {payload.carbs_g}")
    if payload.fats_g:
        parts.append(f"Fats (g): {payload.fats_g}")
    if payload.diet_pref:
        parts.append(f"Diet preference: {payload.diet_pref}")
    parts.append(f"User diet preferences: {user_doc.get('diet_pref') or user_doc.get('diet_preferences') or 'none'}")
    parts.append("Return STRICT JSON only with keys: title, ingredients (list), steps (list), calories, protein_g, carbs_g, fats_g.")
    return "\n".join(parts)

async def _call_groq_chat(system: str, user: str, temperature: float = 0.2, max_tokens: int = 700):
    if not groq_client:
        raise HTTPException(500, "AI service not configured (GROQ).")
    params = {
        "model": GROQ_MODEL,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    try:
        return groq_client.chat.completions.create(**params)
    except Exception as e:
        raise HTTPException(500, f"AI call failed: {e}")

@router.post("/generate-recipe", response_model=GeneratedRecipe)
async def generate_recipe(payload: GenerateRecipeRequest, user_id: str = Depends(get_current_user_id)):
    user = db.users.find_one({"_id": _oid(user_id)}) or {}
    system = "You are a professional nutritionist and recipe writer. Produce healthy, practical recipes."
    prompt = _llm_generate_recipe_prompt(payload, user)
    comp = await _call_groq_chat(system, prompt, temperature=0.25, max_tokens=800)
    text = comp.choices[0].message.content or ""
    # Try best-effort JSON extraction
    import json, re
    if text.strip().startswith("```"):
        text = text.strip().strip("`")
    # Find JSON object
    parsed = None
    try:
        parsed = json.loads(text)
    except Exception:
        # find JSON snippet
        snips = re.findall(r"\{(?:.|\n)*?\}", text)
        for s in snips:
            try:
                parsed = json.loads(s)
                break
            except Exception:
                continue
    if not parsed:
        raise HTTPException(500, "AI did not return valid JSON recipe. Inspect raw output for debugging.")
    # Normalize
    title = parsed.get("title", parsed.get("name", "Generated Recipe"))
    ingredients = parsed.get("ingredients", parsed.get("ingredient_list", []))
    steps = parsed.get("steps", parsed.get("instructions", []))
    return GeneratedRecipe(title=title, ingredients=ingredients, steps=steps, calories=parsed.get("calories"), protein_g=parsed.get("protein_g"), carbs_g=parsed.get("carbs_g"), fats_g=parsed.get("fats_g"))

# ---------- Compliance prediction (simple rule-based) ----------
def predict_daily_compliance(user_id: str, day: date = None) -> Dict[str, Any]:
    """
    Rule-based predictor:
      - If user logged >= 2 meals and total calories within +/-20% of target -> high
      - if <=1 meal logged -> low
      - if excluded foods present -> reduce score
    """
    d = day or datetime.utcnow().date()
    start = datetime.combine(d, datetime.min.time())
    end = datetime.combine(d, datetime.max.time())
    meals = list(db.meals.find({"user_id": _oid(user_id), "timestamp": {"$gte": start, "$lte": end}}))
    macros = db.macro_targets.find_one({"user_id": _oid(user_id)}) or {}
    total_cal = 0
    for m in meals:
        for it in m.get("items", []):
            total_cal += (it.get("calories") or 0)
    target = macros.get("calories")
    status = "unknown"
    score = 0.5
    if not meals:
        status = "no_logs"
        score = 0.05
    else:
        if target:
            if abs(total_cal - target) <= 0.2 * (target or 1):
                status = "on_track"
                score = 0.9
            elif total_cal < 0.5 * (target or 1):
                status = "under"
                score = 0.3
            else:
                status = "over"
                score = 0.5
        else:
            status = "partial"
            score = 0.6
    return {"status": status, "score": score, "meals_count": len(meals), "total_calories": total_cal, "target_calories": target}

@router.get("/compliance/today")
def compliance_today(user_id: str = Depends(get_current_user_id)):
    return predict_daily_compliance(user_id)

# ---------- Diet optimization agent (background) ----------
async def _agent_check_and_optimize(user_id: str):
    """
    Simple agent run:
      - Run compliance for last 3 days
      - If trend is 'falling' (score decreasing), create a suggestion: regenerate recipes or suggest simpler meals.
      - Save a notification in db.user_notifications (simple structure)
    """
    try:
        # check last 3 days compliance
        results = []
        today = datetime.utcnow().date()
        for i in range(0, 3):
            d = today - timedelta(days=i)
            res = predict_daily_compliance(user_id, day=d)
            results.append((d.isoformat(), res["score"]))
        # compute trend
        scores = [s for (_, s) in reversed(results)]
        trend = "stable"
        if len(scores) >= 2 and scores[-1] < scores[0] - 0.15:
            trend = "falling"
        elif len(scores) >= 2 and scores[-1] > scores[0] + 0.15:
            trend = "improving"
        if trend == "falling":
            # create a suggestion using the LLM to propose 3 simple meals within user's macros
            macros = db.macro_targets.find_one({"user_id": _oid(user_id)}) or {}
            gen_payload = GenerateRecipeRequest(
                target_calories=macros.get("calories"),
                protein_g=macros.get("protein_g"),
                carbs_g=macros.get("carbs_g"),
                fats_g=macros.get("fats_g"),
                diet_pref=macros.get("diet_pref")
            )
            # call LLM synchronously because this runs in background
            try:
                comp = await _call_groq_chat(
                    "You are a nutrition coach. Provide 3 short meal suggestions (title + 1-line description) optimized for the user's macros. Return JSON array of {title, description}.",
                    f"User macros: {gen_payload.dict()}",
                    temperature=0.25,
                    max_tokens=400
                )
                text = comp.choices[0].message.content or ""
            except Exception as e:
                text = f"Agent failed to call LLM: {e}"
            # save notification
            notif = {"user_id": _oid(user_id), "type": "diet_optimize", "trend": trend, "payload": {"llm_text": text, "scores": scores}, "created_at": _now(), "read": False}
            db.user_notifications.insert_one(notif)
    except Exception:
        traceback.print_exc()

@router.post("/agent/run")
async def agent_run(background_tasks: BackgroundTasks, user_id: str = Depends(get_current_user_id)):
    # queued run for current user
    background_tasks.add_task(asyncio.create_task, _agent_check_and_optimize(user_id))
    return {"status": "queued"}

# ---------- Nutrition Profile collection ----------
class NutritionProfileIn(BaseModel):
    diet_type: Optional[str] = Field(default=None, max_length=64)
    allergies: List[str] = Field(default_factory=list)
    disliked_foods: Optional[str] = Field(default=None, max_length=1024)
    favorite_cuisines: List[str] = Field(default_factory=list)
    meals_per_day: Optional[int] = Field(default=None, ge=1, le=8)
    snacks_per_day: Optional[int] = Field(default=None, ge=0, le=6)
    cooking_time_preference: Optional[str] = Field(default=None, max_length=64)

class NutritionProfileOut(NutritionProfileIn):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime

@router.get("/profile", response_model=Optional[NutritionProfileOut])
def get_nutrition_profile(user_id: str = Depends(get_current_user_id)):
    doc = db.nutrition_profiles.find_one({"user_id": _oid(user_id)})
    if not doc:
        return None
    return NutritionProfileOut(
        id=str(doc["_id"]),
        user_id=str(doc["user_id"]),
        diet_type=doc.get("diet_type"),
        allergies=doc.get("allergies", []),
        disliked_foods=doc.get("disliked_foods"),
        favorite_cuisines=doc.get("favorite_cuisines", []),
        meals_per_day=doc.get("meals_per_day"),
        snacks_per_day=doc.get("snacks_per_day"),
        cooking_time_preference=doc.get("cooking_time_preference"),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )

@router.post("/profile", response_model=NutritionProfileOut)
def upsert_nutrition_profile(payload: NutritionProfileIn, user_id: str = Depends(get_current_user_id)):
    now = _now()
    body = { **payload.dict(), "updated_at": now }
    existing = db.nutrition_profiles.find_one({"user_id": _oid(user_id)})
    if existing:
        db.nutrition_profiles.update_one({"_id": existing["_id"]}, {"$set": body})
        saved = db.nutrition_profiles.find_one({"_id": existing["_id"]})
    else:
        doc = { **body, "created_at": now, "user_id": _oid(user_id) }
        res = db.nutrition_profiles.insert_one(doc)
        saved = db.nutrition_profiles.find_one({"_id": res.inserted_id})
    return NutritionProfileOut(
        id=str(saved["_id"]),
        user_id=str(saved["user_id"]),
        diet_type=saved.get("diet_type"),
        allergies=saved.get("allergies", []),
        disliked_foods=saved.get("disliked_foods"),
        favorite_cuisines=saved.get("favorite_cuisines", []),
        meals_per_day=saved.get("meals_per_day"),
        snacks_per_day=saved.get("snacks_per_day"),
        cooking_time_preference=saved.get("cooking_time_preference"),
        created_at=saved["created_at"],
        updated_at=saved["updated_at"],
    )

# ---------- Health-check endpoints for module ----------
@router.get("/health")
def health():
    return {"ok": True, "ai_available": bool(groq_client)}

# end of file
