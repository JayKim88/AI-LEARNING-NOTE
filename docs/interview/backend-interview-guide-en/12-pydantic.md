# 12. Pydantic v2

### Why This Section Matters

Pydantic v2 is FastAPI's validation engine — it runs on every request. Understanding it means you can write correct validation logic, handle complex models efficiently, and debug cryptic 422 errors fast.

Beyond FastAPI, Pydantic v2 is used for config loading, API client models, AI pipeline data contracts (LangChain uses it extensively), and any place where structured data crosses a boundary.

**What interviewers actually probe:**
- What's the difference between `field_validator` and `model_validator`?
- How does `model_config = ConfigDict(from_attributes=True)` work with ORM objects?
- What changed between Pydantic v1 and v2 that breaks existing code?
- How do you handle optional vs required fields correctly?

---

## 12.1 BaseModel — The Foundation

Every Pydantic model inherits from `BaseModel`. Fields are declared as class attributes with type annotations. Pydantic validates and coerces data on instantiation.

```python
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class VocabItem(BaseModel):
    id: str
    word: str = Field(min_length=1, max_length=100)
    language: str = Field(pattern=r"^[a-z]{2}$")   # ISO 639-1
    difficulty: int = Field(ge=1, le=5, description="1=easy, 5=hard")
    created_at: datetime
    notes: Optional[str] = None                      # optional — defaults to None

# Validation happens here — raises ValidationError if input is invalid
item = VocabItem(
    id="abc123",
    word="Wanderlust",
    language="de",
    difficulty=3,
    created_at="2024-01-01T00:00:00Z",  # string → datetime coercion
)
```

**What Pydantic v2 does automatically:**
- Type coercion: `"3"` → `int(3)` for `int` fields (in lax mode)
- String trimming with `str_strip_whitespace` config
- Datetime parsing from ISO strings
- UUID validation

**Common confusion:** Pydantic v2 defaults to "strict" for some types in validators, but "lax" when parsing from JSON or FastAPI. If you're validating manually with `Model.model_validate(data)`, the behavior differs slightly from `Model(**data)`. Use `model_validate` explicitly when you need consistent behavior.

---

## 12.2 Field Validators — `field_validator`

`field_validator` validates or transforms a single field's value. It replaces v1's `@validator`.

```python
from pydantic import BaseModel, field_validator
import re

class CreateUser(BaseModel):
    email: str
    username: str
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()             # normalize before storing

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not re.match(r"^[a-zA-Z0-9_]{3,20}$", v):
            raise ValueError("Username must be 3-20 chars, alphanumeric and underscore only")
        return v.lower()

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v
```

**`mode` parameter — `before` vs `after`:**

By default, validators run *after* Pydantic's type coercion (`mode="after"`). Use `mode="before"` to intercept raw input before type conversion.

```python
@field_validator("tags", mode="before")
@classmethod
def parse_tags(cls, v):
    # Accept "python,fastapi,pydantic" as input, convert to list
    if isinstance(v, str):
        return [tag.strip() for tag in v.split(",")]
    return v
```

---

## 12.3 Model Validators — `model_validator`

`model_validator` validates across multiple fields together. Use it when one field's validity depends on another.

```python
from pydantic import BaseModel, model_validator
from typing import Optional

class DateRange(BaseModel):
    start_date: date
    end_date: date
    include_end: bool = True

    @model_validator(mode="after")
    def validate_date_order(self) -> "DateRange":
        if self.end_date < self.start_date:
            raise ValueError(f"end_date ({self.end_date}) must be >= start_date ({self.start_date})")
        return self

class PasswordConfirm(BaseModel):
    password: str
    confirm_password: str

    @model_validator(mode="after")
    def passwords_match(self) -> "PasswordConfirm":
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self
```

**`mode="before"` for model validators** — receives raw dict before any field validation:

```python
@model_validator(mode="before")
@classmethod
def handle_legacy_format(cls, data: dict) -> dict:
    # Old API used "user_name", new uses "username"
    if "user_name" in data and "username" not in data:
        data["username"] = data.pop("user_name")
    return data
```

---

## 12.4 `from_attributes` — ORM Integration

Pydantic models can't read SQLAlchemy ORM objects by default because ORM objects expose data as attributes, not as dict keys. `from_attributes=True` enables attribute access.

```python
from pydantic import BaseModel, ConfigDict

# SQLAlchemy model (ORM)
class UserORM(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(primary_key=True)
    email: Mapped[str]
    created_at: Mapped[datetime]

# Pydantic schema (API response)
class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)   # enables .id, .email access

    id: str
    email: str
    created_at: datetime

# In a route handler:
async def get_user(user_id: str, db: AsyncSession = Depends(get_db)):
    user = await db.get(UserORM, user_id)    # returns ORM object
    return UserResponse.model_validate(user)  # reads attributes directly
```

Without `from_attributes=True`, `model_validate(orm_object)` raises a `ValidationError` because Pydantic tries to treat the ORM object as a dict.

> **Nativ connection:** Every API response schema in Nativ uses `from_attributes=True` to convert SQLAlchemy `VocabItem` and `User` ORM objects directly to the response Pydantic schema without manual dict conversion.

---

## 12.5 `model_dump` and `model_dump_json`

These replace v1's `.dict()` and `.json()`.

```python
item = VocabItem(id="1", word="Wanderlust", language="de", difficulty=3, created_at=datetime.now())

# Export to dict
data = item.model_dump()
# {'id': '1', 'word': 'Wanderlust', 'language': 'de', 'difficulty': 3, 'created_at': datetime(...), 'notes': None}

# Export only set fields (useful for PATCH — partial update)
partial = item.model_dump(exclude_unset=True)

# Exclude fields
safe = item.model_dump(exclude={"notes"})

# Export to JSON string (faster than json.dumps(model.model_dump()))
json_str = item.model_dump_json()

# Include/exclude nested models
nested = item.model_dump(include={"word", "language"})
```

**`exclude_unset` is essential for PATCH endpoints.** If a client sends `{"difficulty": 4}`, only `difficulty` is "set" — `exclude_unset=True` gives you `{"difficulty": 4}`. Without it, you'd get all fields including defaults, overwriting data you didn't intend to change.

```python
@app.patch("/vocab/{item_id}")
async def update_vocab(
    item_id: str,
    update: VocabItemUpdate,
    db: AsyncSession = Depends(get_db),
):
    item = await db.get(VocabItem, item_id)
    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(item, field, value)    # only update fields the client actually sent
    await db.commit()
    return item
```

---

## 12.6 Discriminated Unions — Handling Polymorphic Data

When a field can be one of several types (e.g., different notification types), discriminated unions provide clean routing without `isinstance` chains.

```python
from pydantic import BaseModel
from typing import Literal, Union, Annotated
from pydantic import Field

class EmailNotification(BaseModel):
    type: Literal["email"]
    recipient: str
    subject: str
    body: str

class PushNotification(BaseModel):
    type: Literal["push"]
    device_token: str
    title: str
    message: str

class SMSNotification(BaseModel):
    type: Literal["sms"]
    phone_number: str
    text: str

# Discriminated union — Pydantic routes based on the "type" field
Notification = Annotated[
    Union[EmailNotification, PushNotification, SMSNotification],
    Field(discriminator="type")
]

class NotificationRequest(BaseModel):
    notification: Notification
    priority: int = 1

# Pydantic picks the right model based on `type`
req = NotificationRequest(notification={"type": "email", "recipient": "...", "subject": "Hi", "body": "..."})
assert isinstance(req.notification, EmailNotification)
```

Without a discriminator, Pydantic tries each union member in order, which is slow and produces confusing error messages. The discriminator field makes routing O(1) and error messages precise.

---

## 12.7 Pydantic v1 → v2 Breaking Changes

The most important changes for anyone maintaining v1 code:

| v1 | v2 | Impact |
|----|----|----|
| `@validator` | `@field_validator` + `@classmethod` | All validators need refactoring |
| `.dict()` | `.model_dump()` | Widespread call sites |
| `.json()` | `.model_dump_json()` | Widespread call sites |
| `class Config:` | `model_config = ConfigDict(...)` | Every model with config |
| `orm_mode = True` | `from_attributes = True` | All ORM-reading schemas |
| `@root_validator` | `@model_validator` | Cross-field validators |
| `schema_extra` | `json_schema_extra` | OpenAPI customization |

**The silent performance change:** Pydantic v2 is rewritten in Rust (via `pydantic-core`). Validation is 5–50x faster than v1. If you migrated a high-traffic app from v1 to v2, this alone is worth mentioning in an interview — it's a real production win.

---

## 12.8 Interview Answer Scripts

**Q: "What's the difference between `field_validator` and `model_validator`?"**

> "Both run during model validation, but at different scopes. `field_validator` operates on a single field in isolation — it receives the field's value and either returns a transformed version or raises a `ValueError`. `model_validator` operates on the whole model after all fields are validated — it's the right place to enforce constraints that span multiple fields, like 'end_date must be after start_date' or 'if payment_method is card, card_token is required.' In practice: single-field logic goes in `field_validator`, cross-field invariants go in `model_validator`. Both support `mode='before'` and `mode='after'` — before means raw input before type coercion, after means the typed, validated instance."

**Q: "How does Pydantic integrate with SQLAlchemy ORM responses?"**

> "By default, Pydantic expects a dict-like object — it reads fields by key access. SQLAlchemy ORM objects expose data as attributes. Setting `model_config = ConfigDict(from_attributes=True)` tells Pydantic to use attribute access instead. Then you call `UserResponse.model_validate(orm_object)` and Pydantic reads `.id`, `.email`, etc. directly. Without this setting, `model_validate` raises a ValidationError because it can't find the data by key. In Nativ, every API response schema has `from_attributes=True` so we can pass ORM objects directly to the response model without building an intermediate dict."

**Q: "When would you use `exclude_unset=True` in `model_dump()`?"**

> "`exclude_unset=True` is essential for PATCH endpoints. When a client sends a partial update — say, only changing the difficulty of a vocab item — you want to update only that field, not touch everything else. If you call `model_dump()` without `exclude_unset`, you get all fields including defaults, and you'd overwrite fields the client never intended to change with None or default values. With `exclude_unset=True`, you only get fields the client explicitly included in the request body. The pattern in Nativ: iterate `update.model_dump(exclude_unset=True).items()` and `setattr(orm_object, field, value)` for each — only the client's changes land in the database."

**Q: "What changed between Pydantic v1 and v2?"**

> "The most disruptive changes are the decorator API — `@validator` becomes `@field_validator` with `@classmethod` required, `@root_validator` becomes `@model_validator`. The config class syntax changes: `class Config: orm_mode = True` becomes `model_config = ConfigDict(from_attributes=True)`. Method names change: `.dict()` → `.model_dump()`, `.json()` → `.model_dump_json()`. These break quietly — they either fail loudly or silently produce wrong behavior. The upside is that v2 is rewritten in Rust via pydantic-core and is 5–50x faster. On a high-throughput FastAPI service, switching from v1 to v2 reduced validation overhead measurably without changing any application logic."

---

## 12.9 Self-Tests

Try answering these before looking at the answers.

1. A client sends `{"word": "  Wanderlust  "}` (with leading/trailing spaces). How do you ensure the stored value is `"Wanderlust"` without trimming every string globally?
2. You have a `model_validator(mode="after")` that checks `start_date < end_date`. A client sends `start_date` as a string `"2024-01-01"` and `end_date` as `"2024-01-31"`. Does the validator receive strings or `date` objects? Why?
3. Your FastAPI endpoint returns `UserResponse.model_validate(user_orm)` but you're getting a `ValidationError: value is not a valid dict`. What's wrong?
4. You add a new `Optional[str]` field to a Pydantic model that's used as both an API request schema and a response schema. What's the difference in behavior on the request side vs the response side?
5. A colleague defines a Union field with 4 possible types. Pydantic validation is slow and error messages are confusing. What's the fix and why does it help?

<details>
<summary>Answers</summary>

1. Use a `field_validator` with `mode="after"` (default) on the `word` field: `return v.strip()`. This runs after type coercion, receives a string, and returns the trimmed version. The global option `str_strip_whitespace=True` in `model_config` would strip all string fields — use that if you want consistent trimming everywhere, but a field_validator is cleaner when you only want it for specific fields.

2. The validator receives `date` objects, not strings. `mode="after"` (the default for `model_validator`) runs *after* Pydantic has validated and coerced all fields. By that point, `"2024-01-01"` has been parsed into `datetime.date(2024, 1, 1)`. This is exactly why `mode="after"` is preferred for model validators — you work with typed, validated data, not raw strings. If you used `mode="before"`, you'd receive raw dicts and need to handle string dates yourself.

3. The ORM object's schema is missing `model_config = ConfigDict(from_attributes=True)`. Without it, `model_validate()` tries to read fields from the ORM object as if it were a dict (key access), which fails because SQLAlchemy ORM objects expose data as attributes. Adding `from_attributes=True` tells Pydantic to use attribute access (`.id`, `.email`) instead of key access.

4. **Request side:** An `Optional[str] = None` field means the client can omit it — the field defaults to `None` and is not required. This is correct request behavior. **Response side:** The field always appears in the JSON response, even when `None` — your API clients will see `"notes": null` in every response. If you want to exclude `None` values from responses, use `model_dump(exclude_none=True)` in the response, or use `response_model_exclude_none=True` in the FastAPI route decorator. These are two different concerns that share the same model — worth separating into a request schema and a response schema if they diverge significantly.

5. Add a discriminator field. Define a `Literal` type field (e.g., `type: Literal["email"]`) on each Union member, then use `Annotated[Union[...], Field(discriminator="type")]`. Without a discriminator, Pydantic tries each type in order until one validates — O(n) per validation, and when all fail the error shows all attempts. With a discriminator, Pydantic reads the `type` field first and routes directly to the matching type — O(1). Error messages also become precise: "Input is not a valid EmailNotification" rather than a wall of all 4 validation attempts.

</details>

---

← Back to [11. FastAPI Advanced](11-fastapi.md) | Next → [13. JavaScript Core](13-javascript.md)
