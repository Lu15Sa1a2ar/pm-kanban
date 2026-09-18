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


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    question: str = Field(min_length=1)
    history: list[ChatMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    response: str
    board: BoardData | None = None