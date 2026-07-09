# /// script
# dependencies = [
#     "google-genai",
#     "python-dotenv",
# ]
# ///

import sys
import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

# Load GEMINI_API_KEY from .env if present
load_dotenv()

# Initialize the Gemini Client. 
# Expects GEMINI_API_KEY to be set in your current terminal workspace context.
api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
if not api_key:
    print("[Agent Error] Missing API Key! Please set GEMINI_API_KEY in your environment.")
    sys.exit(1)

client = genai.Client(api_key=api_key)
WORLD_FILE = "public/world.jsonl"

SYSTEM_PROMPT = """You are a master 3D space structural data engineer. Your sole responsibility is to evaluate an existing world layout state and emit a modified, optimized, or completely rewritten JSONL specification based on user commands.

AVAILABLE ENGINE VOCABULARY SCHEMA:
Every line you output must be a single, flat, self-contained JSON object following this strict typing structure:
{
  "type": "entity",
  "id": "descriptive_unique_string_id",
  "mesh": "box" | "sphere" | "cylinder" | "torus",
  "color": "0xHEXCODE",
  "position": {"x": 0.0, "y": 0.0, "z": 0.0},
  "scale": {"x": 1.0, "y": 1.0, "z": 1.0},
  "behavior": "spin" | "bounce" | "orbit",         // Optional component key
  "behaviorSpeed": 1.0,                            // Optional modifier (float)
  "behaviorAmplitude": 1.0,                        // Optional modifier (float, used for bounce height)
  "behaviorRadius": 3.0,                           // Optional modifier (float, used for orbit radius)
  "wireframe": false                               // Optional modifier (boolean)
}

CRITICAL EXECUTION RULES:
1. Output ONLY pure, valid raw JSONL rows. One JSON object per line.
2. DO NOT wrap your output inside markdown formatting blocks like ```json ... ``` or ```. 
3. Provide zero conversational introductions, explanations, or conclusions. Your output must go straight into an automated parser.
4. If a user modifies an existing entity, preserve its 'id' exactly while altering the specific spatial parameters (position, color, scale, behavior).
5. If a user adds an element, preserve all previous intact elements while appending the new ones with distinct unique IDs.
6. The active camera is positioned looking downwards from (0, 6, 12) targeting (0, 1, 0). Keep generated entities within optimal visible viewport bounds: X: [-8 to 8], Y: [-0.5 to 6.0], Z: [-6 to 6].
7. For the 'orbit' behavior, the 'position.x' and 'position.z' elements act as the focal point center axis anchor around which the entity moves.
"""

def read_current_world():
    """Reads the raw structural context data layout from disk."""
    if not os.path.exists(WORLD_FILE):
        return ""
    with open(WORLD_FILE, "r", encoding="utf-8") as f:
        return f.read().strip()

def write_updated_world(new_content):
    """Composes a sanitized, line-by-line file update block."""
    # Split, clean up empty trailing records, and rewrite uniform system splits
    lines = [line.strip() for line in new_content.split("\n") if line.strip()]
    
    # Strict fallback wrapper block to strip accidental LLM code-block leaks
    sanitized_lines = []
    for line in lines:
        if line.startswith("```") or line.strip() == "":
            continue
        sanitized_lines.append(line)

    with open(WORLD_FILE, "w", encoding="utf-8") as f:
        for line in sanitized_lines:
            f.write(line + "\n")

def main():
    if len(sys.argv) < 2:
        print("Usage: uv run agent.py \"[Your natural language layout command here]\"")
        print("Example: uv run agent.py \"Add 3 neon-blue spheres bouncing at different offsets\"")
        sys.exit(1)
        
    user_instruction = sys.argv[1]
    current_world_state = read_current_world()
    
    print(f"[Agent] Contacting Gemini pipeline to evaluate request: '{user_instruction}'...")
    
    try:
        # Utilize gemini-2.5-flash for rapid execution and precise structural instruction following
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[
                f"CURRENT WORLD LAYOUT STATE:\n{current_world_state}\n\nUSER MODIFICATION COMMAND:\n{user_instruction}"
            ],
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.1,  # Keep deterministic structure generation high
            )
        )
        
        ai_output = response.text.strip()
        
        # Double check parsing boundaries to strip formatting fences if they slipped by
        if ai_output.startswith("```"):
            # Strip first line and last line safely
            split_lines = ai_output.split("\n")
            if split_lines[0].startswith("```"):
                split_lines = split_lines[1:]
            if split_lines[-1].startswith("```"):
                split_lines = split_lines[:-1]
            ai_output = "\n".join(split_lines)
            
        write_updated_world(ai_output)
        print("[Agent] State transition successfully captured and saved to public/world.jsonl.")
        
    except Exception as e:
        print(f"[Agent Failure] Critical ecosystem error tracking pipeline modification: {e}")

if __name__ == "__main__":
    main()