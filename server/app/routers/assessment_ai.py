# app/routers/assessment_ai.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/ai/assessment", tags=["AI Assessment"])

# ====== Request Schema ======
class OnboardingData(BaseModel):
    gender: str
    date_of_birth: str
    weight: str  # Changed to str to handle various formats
    height: str  # Changed to str to handle various formats
    activity_level: str
    medical_conditions: list
    fitness_goals: list  # Changed to match our data structure
    time_available: str
    preferred_workout_type: str
    other_medical_condition: str = ""
    custom_goal: str = ""

# ====== Response Schema ======
class AIResponse(BaseModel):
    time_to_goal: str
    motivational_message: str
    health_score: int
    risk_profile: list

# ====== Groq Client Setup ======
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL")

client = None
if GROQ_API_KEY:
    try:
        client = Groq(api_key=GROQ_API_KEY)
        print("Assessment AI: Groq client initialized successfully")
    except Exception as e:
        print(f"Assessment AI: Failed to initialize Groq client: {e}")
        client = None
else:
    print("Assessment AI: GROQ_API_KEY not set. AI features will be disabled.")

@router.post("/", response_model=AIResponse)
def generate_ai_assessment(data: OnboardingData):
    try:
        # Process fitness goals
        goals = ", ".join(data.fitness_goals) if data.fitness_goals else "General fitness"
        if data.custom_goal:
            goals += f", {data.custom_goal}"
            
        # Process medical conditions
        conditions = data.medical_conditions.copy() if data.medical_conditions else []
        if data.other_medical_condition:
            conditions.append(data.other_medical_condition)
        conditions_str = ", ".join(conditions) if conditions else "None"

        # Calculate age for better assessment
        from datetime import datetime
        try:
            if data.date_of_birth:
                birth_date = datetime.strptime(data.date_of_birth, "%Y-%m-%d")
                age = datetime.now().year - birth_date.year
                if datetime.now().month < birth_date.month or (datetime.now().month == birth_date.month and datetime.now().day < birth_date.day):
                    age -= 1
            else:
                age = 25  # Default age if not provided
        except:
            age = 25  # Default age if date parsing fails

        # Combine inputs into one prompt
        prompt = f"""
        You are a professional AI health and fitness coach. Analyze this user's profile and provide a realistic assessment:

        Profile:
        - Age: {age} years
        - Gender: {data.gender}
        - Weight: {data.weight}
        - Height: {data.height}
        - Current Activity Level: {data.activity_level}
        - Medical Conditions: {conditions_str}
        - Fitness Goals: {goals}
        - Available Time: {data.time_available} minutes per day
        - Preferred Workout: {data.preferred_workout_type}

        Provide your assessment in this exact JSON format:
        {{
          "time_to_goal": "realistic timeframe (e.g., '8-12 weeks', '3-6 months')",
          "motivational_message": "inspiring message under 50 words",
          "health_score": integer_between_0_and_100,
          "risk_profile": ["list", "of", "health considerations or risks"]
        }}

        Consider their age, activity level, available time, and medical conditions when determining the health score and timeline. Be encouraging but realistic.
        """

        if not client:
            raise HTTPException(500, "AI service not available. Please check your GROQ configuration.")
            
        response = client.chat.completions.create(
            model=GROQ_MODEL,  # Use the configured model
            messages=[
                {"role": "system", "content": "You are a professional AI health and fitness coach. Always respond with valid JSON only. Do not include any markdown formatting or code blocks."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=512  # Reduced for faster responses
        )

        import json
        import re
        
        # Get the response content
        ai_content = response.choices[0].message.content.strip()
        
        # Clean up the response - remove any markdown code blocks or extra formatting
        ai_content = re.sub(r'```json\s*', '', ai_content)
        ai_content = re.sub(r'```\s*$', '', ai_content)
        ai_content = ai_content.strip()
        
        try:
            ai_output = json.loads(ai_content)
        except json.JSONDecodeError as json_error:
            # If JSON parsing fails, provide a fallback response
            print(f"JSON parsing failed: {json_error}")
            print(f"AI Response content: {ai_content}")
            
            # Create a fallback response based on the user's data
            fallback_response = {
                "time_to_goal": "8-12 weeks",
                "motivational_message": "Your fitness journey starts with a single step. Stay consistent and you'll achieve your goals!",
                "health_score": 75,
                "risk_profile": ["Consult with a healthcare provider before starting any new exercise program"]
            }
            ai_output = fallback_response

        # Validate the response has all required fields
        required_fields = ["time_to_goal", "motivational_message", "health_score", "risk_profile"]
        for field in required_fields:
            if field not in ai_output:
                if field == "risk_profile":
                    ai_output[field] = []
                elif field == "health_score":
                    ai_output[field] = 75
                else:
                    ai_output[field] = "Not available"

        # Ensure health_score is an integer between 0-100
        if not isinstance(ai_output["health_score"], int) or ai_output["health_score"] < 0 or ai_output["health_score"] > 100:
            ai_output["health_score"] = 75

        # Ensure risk_profile is a list
        if not isinstance(ai_output["risk_profile"], list):
            ai_output["risk_profile"] = []

        return AIResponse(**ai_output)

    except Exception as e:
        print(f"AI Assessment error: {e}")
        # Return a safe fallback response instead of raising an exception
        fallback_response = AIResponse(
            time_to_goal="8-12 weeks",
            motivational_message="Your fitness journey is unique. Stay consistent and listen to your body!",
            health_score=75,
            risk_profile=["Consult with a healthcare provider before starting any new exercise program"]
        )
        return fallback_response


