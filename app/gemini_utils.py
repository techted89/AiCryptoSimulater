import asyncio
import google.generativeai as genai
from google.api_core.exceptions import ResourceExhausted

async def call_gemini_with_retry(api_key: str, prompt: str, max_retries: int = 3, initial_delay: float = 1.0):
    if not api_key:
        return "No API Key provided."

    genai.configure(api_key=api_key)
    # Use gemini-1.5-flash as default fast agent model
    model = genai.GenerativeModel('gemini-1.5-flash')

    delay = initial_delay
    for attempt in range(max_retries):
        try:
            response = await model.generate_content_async(prompt)
            return response.text
        except ResourceExhausted:
            if attempt < max_retries - 1:
                print(f"Gemini API rate limit exceeded. Retrying in {delay} seconds...")
                await asyncio.sleep(delay)
                delay *= 2  # Exponential backoff
            else:
                print("Gemini API rate limit exceeded. Max retries reached.")
                return "Error: Rate limit exceeded (429). Falling back to algorithmic analysis."
        except Exception as e:
            print(f"Gemini API error: {e}")
            return f"Error: Gemini API failure: {e}"

    return "Error: Could not complete Gemini API request."
