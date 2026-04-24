# 28. Testing

### Why This Section Matters

Testing questions reveal your development philosophy. "How many tests do you write?" is less important than "What do you test and why?" Interviewers probe whether you understand test pyramids, the difference between unit and integration tests, and when mocking helps vs hurts.

At AI startups with 163-test suites (like Nativ), the story isn't just the number — it's what those tests cover and what they protect.

**What interviewers actually probe:**
- What's the difference between unit, integration, and end-to-end tests?
- When would you mock a dependency vs hit the real thing?
- What is test-driven development (TDD) and do you use it?
- How do you test async FastAPI endpoints?

---

## 28.1 The Test Pyramid

The test pyramid describes the ideal distribution of test types: many fast unit tests at the base, fewer integration tests in the middle, and even fewer slow E2E tests at the top.

```
       ┌──────────────┐
       │  E2E Tests   │  ← Fewest, slowest, most brittle
       │ (5-10 tests) │
       └──────────────┘
      ┌────────────────────┐
      │ Integration Tests  │  ← Test components together
      │   (50-100 tests)   │
      └────────────────────┘
    ┌──────────────────────────┐
    │      Unit Tests          │  ← Most, fastest, most reliable
    │    (100-500 tests)       │
    └──────────────────────────┘
```

**Unit tests** — test one function/method in isolation, all dependencies mocked:
```python
def test_validate_vocab_item():
    # Pure function — no database, no network, no filesystem
    valid = VocabItem(word="test", language="de", difficulty=3)
    assert valid.word == "test"

    with pytest.raises(ValidationError):
        VocabItem(word="", language="de", difficulty=3)  # empty word
```

**Integration tests** — test multiple components together (e.g., API + database):
```python
async def test_create_vocab_item(async_client, db_session):
    response = await async_client.post("/vocab", json={
        "word": "Wanderlust",
        "language": "de",
        "difficulty": 3,
    }, headers={"Authorization": f"Bearer {test_token}"})

    assert response.status_code == 201
    # Verify in the actual database
    item = await db_session.get(VocabItem, response.json()["id"])
    assert item.word == "Wanderlust"
```

**E2E tests** — test the full user journey through the real UI or API:
```python
# Playwright or Cypress — tests from the user's perspective
async def test_user_can_add_and_review_vocab(page: Page):
    await page.goto("/login")
    await page.fill("#email", "user@example.com")
    await page.click('[type=submit]')
    # ... navigate to vocab, add item, verify it appears
```

---

## 28.2 Testing FastAPI with pytest

FastAPI's `TestClient` (for sync) and `httpx.AsyncClient` (for async) let you write integration tests against your real routes without starting a server.

```python
# tests/conftest.py — shared fixtures
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from app.main import app
from app.database import Base

TEST_DB_URL = "postgresql+asyncpg://test:test@localhost/test_db"

@pytest_asyncio.fixture(scope="session")
async def engine():
    engine = create_async_engine(TEST_DB_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest_asyncio.fixture
async def db_session(engine):
    async with AsyncSession(engine) as session:
        yield session
        await session.rollback()   # rollback after each test — clean state

@pytest_asyncio.fixture
async def async_client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
```

```python
# tests/test_vocab.py
import pytest

@pytest.mark.asyncio
async def test_create_vocab(async_client, test_user_token):
    response = await async_client.post(
        "/vocab",
        json={"word": "Wanderlust", "language": "de", "difficulty": 3},
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["word"] == "Wanderlust"
    assert "id" in data
```

---

## 28.3 When to Mock vs When Not To

Mocking replaces a dependency with a controlled fake. The question isn't "should I mock?" but "what's the purpose of this test?"

**Mock when:**
- The dependency is slow (external API, email service) — mock the `send_email` function
- The dependency is non-deterministic (current time, random numbers) — mock `datetime.now()`
- The dependency has side effects you want to prevent (payments, SMS) — mock `stripe.charge()`
- You're testing a unit in isolation (unit test) — mock the database

**Don't mock when:**
- You're writing integration tests — the whole point is to test components working together
- You'd be mocking the thing you're trying to test (mocking the database to test a database query)
- The mock doesn't behave like the real thing — false confidence

```python
# ✅ Mock the external LLM API — it's slow, costs money, non-deterministic
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_generate_explanation(async_client, test_token):
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text='{"definition": "strong desire to travel"}')]

    with patch("app.services.ai.client.messages.create", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_response
        response = await async_client.post(
            "/vocab/explain",
            json={"word": "Wanderlust"},
            headers={"Authorization": f"Bearer {test_token}"},
        )

    assert response.status_code == 200
    assert "travel" in response.json()["definition"]
```

```python
# ❌ Don't mock the database to test a database operation
# This tests the mock, not the query
with patch("app.db.session.execute") as mock_exec:
    mock_exec.return_value = MagicMock(...)
    # This test tells you nothing about whether your query works
```

---

## 28.4 Testing AI Pipeline Components

Testing LLM-integrated code requires special patterns:

**Deterministic evaluation tests:**
```python
# Test that the pipeline produces correct output for known inputs
# Uses real LLM but is slower — run in CI, not in unit test suite
@pytest.mark.integration
@pytest.mark.asyncio
async def test_rag_accuracy():
    questions = [
        ("What is Wanderlust?", "desire to travel"),
        ("What is Schadenfreude?", "pleasure at others' misfortune"),
    ]
    for question, expected_keyword in questions:
        answer = await generate_answer(question)
        assert expected_keyword.lower() in answer.lower(), \
            f"Answer '{answer}' doesn't contain '{expected_keyword}'"
```

**RAGAS-style evaluation:**
```python
# Run periodically (not on every commit) — evaluate retrieval and generation quality
def evaluate_rag_pipeline():
    dataset = load_golden_dataset()  # pre-built (question, answer, context) pairs
    results = ragas.evaluate(dataset, metrics=[faithfulness, answer_relevancy])
    assert results["faithfulness"] >= 0.85, f"Faithfulness dropped: {results}"
    assert results["answer_relevancy"] >= 0.80
```

---

## 28.5 TDD — Test-Driven Development

TDD is a development workflow: write a failing test first, write minimal code to pass it, then refactor.

**Red → Green → Refactor:**
```
Red:    Write test_create_vocab → test fails (route doesn't exist yet)
Green:  Implement /vocab POST → test passes
Refactor: Clean up the implementation without breaking the test
```

**When TDD works well:**
- Pure functions with clear input/output contracts
- Business logic that can be specified as rules before implementation
- Refactoring existing code (tests serve as a regression safety net)

**When TDD adds friction:**
- UI components (hard to specify visually before building)
- AI pipeline outputs (non-deterministic, hard to specify upfront)
- Exploratory prototyping (requirements unclear)

TDD is a tool, not a religion. The honest answer in an interview: "I write tests alongside or right after implementation for business logic. I don't always write tests first for exploratory work or UI, but I make sure critical paths have coverage before shipping."

---

## 28.6 Interview Answer Scripts

**Q: "How would you test a FastAPI endpoint that calls an LLM?"**

> "I'd separate the tests by what they're verifying. For unit/integration tests of the endpoint itself, I mock the LLM call — I don't want every unit test to make real API calls. I use `unittest.mock.patch` to replace the LLM client with a mock that returns a predetermined response. This tests that the endpoint correctly handles the LLM response, validates input, updates the database, and returns the right shape. For testing the LLM behavior itself — whether it actually produces correct output — I have a separate integration test suite that uses the real LLM but runs less frequently (not on every commit). These are marked with `pytest.mark.integration` and run in CI before deploys. For Nativ, I'd also maintain a golden dataset of question/answer pairs and run RAGAS evaluations periodically to catch prompt regressions."

**Q: "What's in Nativ's 163-test suite?"**

> "The suite covers three layers. Unit tests for validation logic — Pydantic schemas, business rules (vocabulary limit checks, difficulty validation), and utility functions. These are fast and run on every save. Integration tests for the API endpoints — creating and retrieving vocabulary items, authentication flows, the hybrid search endpoint. These use a real test database that rolls back after each test, and mock external dependencies (LLM API, email service). System tests for the RAG pipeline — a small golden dataset of vocabulary queries and expected responses, testing that the retrieval + generation pipeline returns relevant answers. The 163 number means I can confidently refactor the database layer or change chunking strategy and know immediately if anything regressed."

**Q: "How do you test async FastAPI endpoints?"**

> "Use `pytest-asyncio` and `httpx.AsyncClient`. The key setup: an async test client that can make real HTTP requests to the application without a running server. In conftest.py, create an `AsyncClient` mounted with `ASGITransport(app=app)` — this runs the app in-process. Configure a test database that uses the same schema as production but rolls back after each test. The `anyio_backend` fixture selects asyncio as the backend. For each test: `async def test_create_vocab(client, db_session)`. The `db_session` fixture creates a savepoint, the test runs, and the fixture rolls back — so tests are isolated without recreating the database. Async tests need `@pytest.mark.asyncio` or a global `asyncio_mode = 'auto'` in `pytest.ini`. Common pitfall: using `TestClient` (sync) for an async app works but doesn't test true async behavior — use `AsyncClient` to test concurrent request handling."

**Q: "What do you mock vs not mock in integration tests?"**

> "The rule: mock at system boundaries, not at implementation details. Mock external services (LLM API, payment processor, email provider) because: they cost money, they're flaky, they have rate limits, and their behavior in tests should be deterministic. Don't mock the database — use a real test database. Teams that mock the database discover prod bugs only in production: the mock returned a clean dict but the real ORM raised `DetachedInstanceError`; the mock didn't enforce foreign key constraints; the mock didn't test the actual SQL. The database is the most important integration to test for real. Similarly, don't mock your own service's internal layers — if you test the HTTP handler but mock the service layer, you're not testing the most important paths. Mock the LLM response with a pre-set string, but let the actual prompt-building, database writes, and response serialization run through real code."

---

## 28.7 Self-Tests

Try answering these before looking at the answers.

1. You write a unit test for a function that calls `datetime.now()` to set a `created_at` field. The test is flaky — it fails when run at midnight. How do you fix it?
2. Your integration test suite takes 8 minutes to run because each test creates and destroys the database from scratch. How do you speed it up?
3. You want to test that an error in the database rollback doesn't expose sensitive data in the error response. What kind of test is this and how do you write it?
4. A colleague argues that high test coverage (90%+) means the code is well-tested. What's your counterargument?
5. You have a function `calculate_review_score(vocab_item, review_history)` that implements spaced repetition logic. How would you test it and what edge cases matter?

<details>
<summary>Answers</summary>

1. Mock `datetime.now()` to return a fixed, known timestamp. `from unittest.mock import patch, MagicMock`: `with patch('app.services.datetime') as mock_dt: mock_dt.now.return_value = datetime(2024, 1, 15, 12, 0, 0)`. Now the test is deterministic — the `created_at` field is always the mocked time, and you can assert exact values. An alternative: inject the current time as a function parameter (`def create_item(data, now=datetime.now)`) which makes the dependency explicit and easily overridable in tests.

2. Use a single database session per test module (not per test) and wrap each test in a transaction that rolls back. `scope="session"` for the database engine — created once. `scope="function"` for transactions — each test starts a transaction, does its work, and rolls back without committing. No actual data is persisted between tests. The database schema is created once at the start of the session. This reduces 8 minutes to under a minute for most suites. Alternatively, use a database-level savepoint: begin a transaction in the fixture, create a savepoint before each test, roll back to the savepoint after each test.

3. This is an integration test — you need the real database layer to trigger a rollback. Test: set up a scenario where the database transaction fails during rollback (e.g., using a mock that raises during rollback). Call the API endpoint. Assert that: (a) the response status code is 500, (b) the response body contains a generic error message (not stack trace or SQL details), (c) logs contain the full error with context. Use `with patch("sqlalchemy.orm.Session.rollback", side_effect=Exception("DB error"))` to trigger the failure. Then verify the response with `assert "Internal server error" in response.json()["detail"]`.

4. **Coverage measures which lines were executed, not whether they were tested meaningfully.** You can achieve 90% coverage by writing tests that call every function but assert nothing. Real problems with coverage-only focus: (a) Tests that test the happy path cover the line but not the edge case that causes the bug. (b) "Tests" that just verify the function doesn't raise cover lines without asserting behavior. (c) 90% coverage means 10% is untested — and bugs often hide in edge case branches. Better metric: mutation testing — a tool introduces bugs into the code and checks whether your tests catch them. If they don't, your tests don't have meaningful assertions.

5. **Testing spaced repetition logic:** The function is pure (no I/O, deterministic for given inputs) — ideal for unit tests. Test cases: (a) First review: no history → return initial interval (e.g., 1 day). (b) Correct answer after short interval → increase interval (e.g., 1 day → 3 days). (c) Incorrect answer → reset interval to 1 day regardless of history. (d) Multiple correct answers → exponential growth with a cap. (e) Edge case: review history is empty list. (f) Edge case: all answers were wrong. (g) Edge case: item just created, reviewed immediately. Each test: call `calculate_review_score(item, history)`, assert the returned next review date or interval. Because it's pure, no mocking needed — fast and reliable.

</details>

---

← Back to [27. Security (OWASP)](27-security.md) | Next → [29. Observability & Debugging](29-observability.md)
