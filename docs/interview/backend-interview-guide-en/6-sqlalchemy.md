# 6. SQLAlchemy 2.x

### Why This Section Matters

SQLAlchemy 2.0 introduced a new API that's cleaner, more consistent, and fully async-capable. Many tutorials still show the old 1.x patterns — if you write `session.query(User)` in an interview, it signals you haven't used the current version.

More importantly, SQLAlchemy knowledge demonstrates you understand the ORM/database boundary: when the ORM helps, when it gets in the way, and how to write efficient queries when the ORM's defaults aren't enough.

**What interviewers actually probe:**
- What's the difference between `session.execute(select(User))` and `session.query(User)`?
- A query is doing N+1 database calls. How do you fix it in SQLAlchemy?
- What does `async with AsyncSession()` guarantee, and why do you yield it from a dependency?
- When would you write raw SQL instead of using the ORM?

---

## 6.1 The 2.x API — Core Changes from 1.x

SQLAlchemy 2.0 unified the "Core" and "ORM" styles and made async first-class.

```python
# ❌ Old 1.x style — still works but deprecated
users = session.query(User).filter(User.active == True).all()

# ✅ New 2.x style — explicit select(), execute()
from sqlalchemy import select

result = session.execute(select(User).where(User.active == True))
users = result.scalars().all()
```

The key difference: `session.execute()` returns a `Result` object. You call `.scalars()` to get ORM objects, `.all()` to materialize the list.

**Why the change?** The new API works identically for sync and async sessions, for ORM and Core queries, and for single vs multiple columns — one mental model instead of four.

```python
# Single column
result = session.execute(select(User.name).where(User.active == True))
names = result.scalars().all()   # List[str]

# Multiple columns (tuples)
result = session.execute(select(User.id, User.name, User.email))
rows = result.all()              # List[Row(id, name, email)]

# Single object
user = session.get(User, user_id)  # by primary key — still valid

# Single result or None
user = session.execute(
    select(User).where(User.email == email)
).scalar_one_or_none()
```

---

## 6.2 Models and Relationships

SQLAlchemy 2.x uses `DeclarativeBase` and type annotations for clean model definitions:

```python
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import String, ForeignKey
from datetime import datetime
import uuid

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    # One-to-many: user has many vocab sessions
    sessions: Mapped[list["VocabSession"]] = relationship(back_populates="user")

class VocabSession(Base):
    __tablename__ = "vocab_sessions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    language: Mapped[str] = mapped_column(String(10), nullable=False)

    user: Mapped["User"] = relationship(back_populates="sessions")
```

`Mapped[T]` uses Python type annotations to infer column types and nullability — `Mapped[str]` is `NOT NULL`, `Mapped[str | None]` is nullable.

---

## 6.3 Session Management — The Dependency Pattern

The session must be properly opened and closed. In FastAPI, a `yield` dependency ensures cleanup even when exceptions occur:

```python
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from fastapi import Depends

engine = create_async_engine("postgresql+asyncpg://...", pool_size=10)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        # AsyncSessionLocal() __aexit__ closes the session

# Usage in a route
@app.get("/users/{user_id}")
async def get_user(user_id: str, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404)
    return user
```

**`expire_on_commit=False`** — by default, SQLAlchemy expires all attributes after a commit, meaning accessing them requires a new DB query. In async code, this often causes `MissingGreenlet` errors. Setting `expire_on_commit=False` keeps the last-fetched values in memory after commit, which is almost always what you want in an API context.

---

## 6.4 Relationship Loading — Avoiding N+1

By default, SQLAlchemy uses **lazy loading**: related objects are fetched from the database the moment you access them. In async code, lazy loading is disabled (you'd need a sync database call inside an async context), which means accessing a lazy relationship raises a `MissingGreenlet` error.

You must explicitly choose a loading strategy.

**`selectinload`** — fetches related objects in a separate IN query after the main query. Best for one-to-many.

```python
from sqlalchemy.orm import selectinload

# Fetch users with their sessions — 2 queries total
result = await db.execute(
    select(User).options(selectinload(User.sessions))
)
users = result.scalars().all()

# 2 queries:
# SELECT * FROM users;
# SELECT * FROM vocab_sessions WHERE user_id IN (uuid1, uuid2, ...);
```

**`joinedload`** — fetches related objects in the same query via JOIN. Best for many-to-one (avoids row multiplication).

```python
from sqlalchemy.orm import joinedload

# Fetch sessions with their user — 1 JOIN query
result = await db.execute(
    select(VocabSession).options(joinedload(VocabSession.user))
)
sessions = result.unique().scalars().all()  # .unique() needed after JOIN

# 1 query: SELECT sessions.*, users.* FROM vocab_sessions JOIN users ON ...
```

**`lazy="raise"`** — make lazy loading raise an error at definition time so you catch N+1 bugs in development:

```python
class User(Base):
    sessions: Mapped[list["VocabSession"]] = relationship(
        back_populates="user",
        lazy="raise"    # accessing .sessions without eager load → error
    )
```

**When to write raw SQL instead of ORM:** Complex aggregations, window functions, CTEs, and bulk operations. SQLAlchemy can express these, but the ORM syntax becomes more complex than the SQL it produces. At that point, use `text()` or the Core expression language directly.

```python
from sqlalchemy import text

# Raw SQL when ORM is more complex than it's worth
result = await db.execute(
    text("""
        SELECT user_id, COUNT(*) as session_count,
               AVG(score) as avg_score
        FROM vocab_sessions
        WHERE created_at > :since
        GROUP BY user_id
        HAVING COUNT(*) > 5
    """),
    {"since": datetime(2026, 1, 1)},
)
rows = result.fetchall()
```

---

## 6.5 Bulk Operations

ORM `add()` / `add_all()` is convenient but slow for large inserts — each row goes through Python objects, validation, and identity map tracking.

```python
# ❌ Slow for bulk — O(n) Python overhead
for item in items:
    db.add(VocabItem(**item))
await db.flush()

# ✅ Fast bulk insert — bypasses ORM overhead
await db.execute(
    insert(VocabItem),
    [{"word": w, "language": l, "user_id": u} for w, l, u in items],
)

# ✅ Bulk update with RETURNING (PostgreSQL-specific)
result = await db.execute(
    update(VocabItem)
    .where(VocabItem.user_id == user_id)
    .values(last_reviewed=datetime.utcnow())
    .returning(VocabItem.id)
)
updated_ids = result.scalars().all()
```

---

## 6.6 Interview Answer Scripts

**Q: "What changed between SQLAlchemy 1.x and 2.x?"**

> "The main change is the query API. In 1.x you used `session.query(User).filter(...)`, which was ORM-only. In 2.x the unified API is `session.execute(select(User).where(...))`, and it returns a `Result` object you call `.scalars().all()` on. This same API works for ORM objects, raw columns, Core expressions, and async sessions — one mental model. They also made async a first-class citizen with `AsyncSession` and `create_async_engine`. The practical implication: lazy loading is disabled in async mode, so you have to explicitly choose `selectinload` or `joinedload` — which is actually a good forcing function because it makes N+1 problems visible at startup instead of silently in production."

**Q: "When do you use `selectinload` vs `joinedload`?"**

> "The choice depends on the relationship cardinality. `joinedload` uses a SQL JOIN, which means if a user has 100 sessions, you get 100 rows returned from the JOIN — you're multiplying data across the wire and in memory. For many-to-one (session → user), each session has exactly one user, so JOIN doesn't multiply anything — `joinedload` is efficient. For one-to-many (user → sessions), `selectinload` sends a second query with `WHERE user_id IN (...)` — the data doesn't multiply, and the IN query is a single round trip. The rule of thumb: many-to-one → `joinedload`, one-to-many → `selectinload`. I use `lazy='raise'` on all relationships in development so I catch any accidental lazy loading before it reaches production."

**Q: "Why do you use `yield` and not `return` in the database dependency?"**

> "The `yield` pattern guarantees cleanup runs even when the route handler raises an exception. If I used `return`, the session would be created and handed to the handler, but if the handler raises, there's no mechanism to roll back the transaction or close the session — you'd leak connections and leave partial transactions open. With `yield`, FastAPI's dependency injection wraps the handler call in a try/finally equivalent — the code after `yield` runs regardless of what happens in the handler. So the commit/rollback/close logic is guaranteed to execute. It's the FastAPI equivalent of Python's context manager pattern — `__enter__` before yield, `__exit__` after."

**Q: "How do you handle the N+1 problem in an async SQLAlchemy application?"**

> "N+1 happens when you load a collection of objects and then access a relationship on each one, triggering one extra query per object. In async SQLAlchemy, the problem is immediately visible at startup if you configure `lazy='raise'` on relationships — any lazy load attempt raises an error rather than silently issuing a query. The fix is explicit eager loading at query time: `selectinload` for one-to-many (issues a single IN query for all related objects), `joinedload` for many-to-one (uses a JOIN, efficient when each object has exactly one related object). In Nativ, the vocabulary list endpoint uses `selectinload(VocabItem.review_history)` to preload review records in one query instead of N. Without this, loading 100 vocab items would fire 101 queries — one for the list, one per item for its review history."

> **Nativ connection:** SQLAlchemy 2.x with `AsyncSession` is Nativ's entire database layer — every route that touches vocabulary items, user records, or review history goes through this ORM. The `lazy='raise'` configuration on all relationships catches N+1 bugs in development before they reach production.

---

## 6.7 Self-Tests

Try answering these before looking at the answers.

1. You access `session.get(User, user_id)` and then access `user.sessions` in the same async request. What happens and why?
2. Your route fetches 50 posts and their authors in one query using `joinedload`. The response includes the author data correctly, but `result.scalars().all()` is returning duplicate posts. Why and how do you fix it?
3. You need to delete all vocabulary items older than 90 days for a specific user. Write the SQLAlchemy 2.x query. How is this different from fetching them one by one and calling `db.delete(item)`?
4. After `await db.commit()`, your code tries to access `user.email` and gets a `DetachedInstanceError`. What causes this, and what's the fix?
5. A colleague uses `text("SELECT * FROM users WHERE email = '" + email + "'")` to run a raw SQL query. What's the problem?

<details>
<summary>Answers</summary>

1. In async SQLAlchemy, lazy loading is disabled. Accessing `user.sessions` without having loaded it eagerly raises `sqlalchemy.exc.MissingGreenlet: greenlet_spawn has not been called` (or a similar lazy loading error). The fix: use `selectinload(User.sessions)` in the original query — `await db.execute(select(User).options(selectinload(User.sessions)).where(User.id == user_id))` — or set `lazy='raise'` on the relationship to catch this at development time.

2. `joinedload` on a one-to-many relationship (Post → Author is many-to-one, so no duplication, but if Post → Comments is one-to-many, the JOIN produces one row per comment per post). When you call `scalars().all()` on a result with duplicate ORM object rows, SQLAlchemy returns one instance per row. Fix: call `.unique().scalars().all()` — `.unique()` deduplicates ORM objects by identity map. Alternatively, use `selectinload` instead of `joinedload` for one-to-many relationships to avoid row multiplication entirely.

3. ```python
   from sqlalchemy import delete
   from datetime import datetime, timedelta

   cutoff = datetime.utcnow() - timedelta(days=90)
   await db.execute(
       delete(VocabItem)
       .where(VocabItem.user_id == user_id)
       .where(VocabItem.created_at < cutoff)
   )
   await db.commit()
   ```
   This executes a single `DELETE` statement. Fetching and deleting one by one issues N SELECT + N DELETE statements. For large datasets this is orders of magnitude slower. The bulk delete also doesn't load objects into Python memory. The tradeoff: SQLAlchemy won't fire `after_delete` events or cascade deletes through Python-side relationships — if you need those, fetch first, then delete.

4. `DetachedInstanceError` means the object is no longer associated with a session. After `commit()`, SQLAlchemy expires all instance attributes by default (`expire_on_commit=True`). When you access `user.email`, SQLAlchemy tries to lazy-load it from the database — but if the session was closed, the instance is detached and can't load. Fix: set `expire_on_commit=False` on the session maker. This keeps the last-loaded attribute values in memory after commit, which is almost always correct for API responses that return the object right after persisting it.

5. **SQL injection vulnerability.** String concatenation in SQL queries allows an attacker to inject arbitrary SQL. If `email = "' OR '1'='1"`, the query becomes `SELECT * FROM users WHERE email = '' OR '1'='1'` — returns all users. Always use parameterized queries: `text("SELECT * FROM users WHERE email = :email"), {"email": email}`. SQLAlchemy handles escaping for you; never build SQL strings with user input.

</details>

---

← Back to [5. PostgreSQL Deep Dive](5-postgresql.md) | Next → [7. Alembic](7-alembic.md)
