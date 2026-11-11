
import os
from dotenv import load_dotenv
from openai import OpenAI

# Load API key from .env
load_dotenv()

api_key = os.getenv("OPENAI_API_KEY")
model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

if not api_key:
    print("ERROR: API key not found in .env")
    raise SystemExit(1)

try:
    client = OpenAI(api_key=api_key)

    print("Testing OpenAI API...")

    response = client.responses.create(
        model=model,
        input="Summarize this sentence in five words: "
              "Personal notes manager stores and organizes notes."
    )

    print("SUCCESS! OpenAI API is working.")
    print("AI Summary:", response.output_text)

except Exception as e:
    print("API TEST FAILED:")
    print(type(e).__name__, str(e))