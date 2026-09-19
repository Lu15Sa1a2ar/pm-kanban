from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Card(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=200)
    details: str = Field(max_length=2000)


class Column(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=200)
    cardIds: list[str] = Field(max_length=200)


class BoardData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    columns: list[Column] = Field(min_length=1, max_length=20)
    cards: dict[str, Card]

    @model_validator(mode="after")
    def validate_card_references(self) -> "BoardData":
        column_ids = [column.id for column in self.columns]
        if len(column_ids) != len(set(column_ids)):
            raise ValueError("Column IDs must be unique")

        referenced_cards = [card_id for column in self.columns for card_id in column.cardIds]
        if len(referenced_cards) != len(set(referenced_cards)):
            raise ValueError("Each card must appear in exactly one column")
        if set(referenced_cards) != set(self.cards):
            raise ValueError("Columns and cards must reference the same card IDs")
        if any(card.id != card_id for card_id, card in self.cards.items()):
            raise ValueError("Card keys must match card IDs")
        return self


# Hard caps enforced while parsing; `trim_conversation` in ai.py trims further
# (MAX_MESSAGE_CHARS, MAX_HISTORY_TURNS) so a normal client is never rejected.
MAX_CHAT_TEXT = 4000
MAX_HISTORY_MESSAGES = 40


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=1, max_length=200)


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "assistant"]
    content: str = Field(max_length=MAX_CHAT_TEXT)


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str = Field(min_length=1, max_length=MAX_CHAT_TEXT)
    history: list[ChatMessage] = Field(default_factory=list, max_length=MAX_HISTORY_MESSAGES)


class ChatResponse(BaseModel):
    response: str
    board: BoardData | None = None