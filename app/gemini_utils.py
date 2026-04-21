import asyncio
from google import genai
from google.genai.errors import APIError
import logging


_gemini_client = None
def _get_gemini_client(api_key):
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = genai.Client(api_key=api_key)
    return _gemini_client


async def call_gemini_with_retry(api_key: str, prompt: str, max_retries: int = 3, initial_delay: float = 1.0):
    if not api_key:
        return "No API Key provided."

    client = _get_gemini_client(api_key)

    delay = initial_delay
    for attempt in range(max_retries):
        try:
            response = await client.aio.models.generate_content(model='gemini-1.5-flash', contents=prompt)
            return response.text
        except APIError as e:
            if "429" in str(e) or "Resource Exhausted" in str(e):
                if attempt < max_retries - 1:
                    print(f"Gemini API rate limit exceeded. Retrying in {delay} seconds...")
                    await asyncio.sleep(delay)
                    delay *= 2  # Exponential backoff
                else:
                    print("Gemini API rate limit exceeded. Max retries reached.")
                    return "Error: Rate limit exceeded (429). Falling back to algorithmic analysis."
            else:
                logging.exception("Full Gemini API error")
                return "Error: Gemini API failure"
        except Exception as e:
            logging.exception("Full Gemini API error")
            return "Error: Gemini API failure"


    return "Error: Could not complete Gemini API request."
