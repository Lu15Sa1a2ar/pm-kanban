import json
import os
from typing import Any

import httpx

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "openai/gpt-oss-120b"


class AIConfigurationError(RuntimeError):
    pass


class AIRequestError(RuntimeError):
    pass


def ask_openrouter(question: str) -> str:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise AIConfigurationError("OPENROUTER_API_KEY is not configured")

    try:
        response = httpx.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": MODEL,
                "messages": [{"role": "user", "content": question}],
            },
            timeout=30.0,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
    except (httpx.HTTPError, KeyError, IndexError, TypeError) as error:
        raise AIRequestError("OpenRouter request failed") from error

    if not isinstance(content, str) or not content.strip():
        raise AIRequestError("OpenRouter returned an empty response")
    return content


def ask_openrouter_structured(
    question: str, board: dict[str, Any], history: list[dict[str, str]]
) -> dict[str, Any]:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise AIConfigurationError("OPENROUTER_API_KEY is not configured")

    messages = [
        {
            "role": "system",
            "content": (
                "You are a project management assistant. Use the board JSON and conversation "
                "history to answer the user. Only return a board update when requested. "
                "Your reply is shown in a narrow chat sidebar: keep it short, use plain text "
                "in short paragraphs and simple '-' lists, and never use headings, tables, "
                "code blocks or images. Answer in the language of the question."
            ),
        },
        *history,
        {
            "role": "user",
            "content": f"Board JSON:\n{json.dumps(board)}\n\nQuestion:\n{question}",
        },
    ]
    schema = {
        "type": "object",
        "properties": {
            "response": {"type": "string"},
            "board": {"anyOf": [{"type": "object"}, {"type": "null"}]},
        },
        "required": ["response", "board"],
        "additionalProperties": False,
    }

    try:
        response = httpx.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": MODEL,
                "messages": messages,
                "response_format": {
                    "type": "json_schema",
                    "json_schema": {"name": "kanban_assistant", "strict": True, "schema": schema},
                },
            },
            timeout=30.0,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        result = json.loads(content)
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as error:
        raise AIRequestError("OpenRouter structured request failed") from error

    if not isinstance(result, dict) or not isinstance(result.get("response"), str):
        raise AIRequestError("OpenRouter returned an invalid structured response")
    return result