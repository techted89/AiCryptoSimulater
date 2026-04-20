import asyncio
import google.generativeai as genai
from google.api_core.exceptions import ResourceExhausted
import logging


_gemini_model = None
def _get_gemini_model(api_key):
    global _gemini_model
    if _gemini_model is None:
        genai.configure(api_key=api_key)
        _gemini_model = genai.GenerativeModel('gemini-1.5-flash')
    return _gemini_model

async def call_gemini_with_retry(api_key: str, prompt: str, max_retries: int = 3, initial_delay: float = 1.0):
    if not api_key:
        return "No API Key provided."

    model = _get_gemini_model(api_key)

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
            logging.exception("Full Gemini API error")
            return "Error: Gemini API failure"

    return "Error: Could not complete Gemini API request."
