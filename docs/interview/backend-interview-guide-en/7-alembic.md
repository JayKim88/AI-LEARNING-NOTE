# 7. Alembic

### Why This Section Matters

Schema changes are one of the riskiest operations in a production system. A migration that adds a `NOT NULL` column without a default can lock your entire table for minutes on a large dataset. Alembic is the standard migration tool for SQLAlchemy projects — knowing how to use it correctly signals production awareness.

Interviewers rarely quiz Alembic commands specifically, but they do ask about migration strategy: zero-downtime deployments, rollback plans, and how you add a required column without downtime.

**What interviewers actually probe:**
- How do you add a column to a table with 50 million rows without downtime?
- What's the difference between `upgrade` and `autogenerate`?
- How do you create an index without locking the table?
- What's your rollback strategy for a bad migration?

---

## 7.1 How Alembic Works

Alembic tracks schema changes as a chain of migration scripts, each with an `upgrade()` and `downgrade()` function. It stores the current revision ID in an `alembic_version` table in your database.

```
migrations/
  env.py          ← configuration, connects to your models
  versions/
    a1b2c3_add_user_table.py
    d4e5f6_add_email_index.py   ← current head
```

```python
# Example migration script
"""add language column to vocab_items"""
revision = "d4e5f6"
down_revision = "a1b2c3"   # forms the chain

def upgrade() -> None:
    op.add_column("vocab_items", sa.Column("language", sa.String(10), nullable=True))
    # Add as nullable first — see §7.2 for why

def downgrade() -> None:
    op.drop_column("vocab_items", "language")
```

**Core commands:**

```bash
# Generate a new migration by comparing models to current DB state
alembic revision --autogenerate -m "add language column"

# Apply all pending migrations
alembic upgrade head

# Roll back one migration
alembic downgrade -1

# Roll back to a specific revision
alembic downgrade d4e5f6

# Check current revision
alembic current

# Show pending migrations
alembic history --indicate-current
```

**`autogenerate` limitations:** It detects added/dropped tables and columns, index changes, and some constraint changes. It does NOT detect: Python-side defaults, check constraints in some cases, changes to stored procedures, or renaming (it sees rename as drop + add). Always review generated migrations before running them.

---

## 7.2 Zero-Downtime Migrations

The naive approach to adding a required column locks the table and breaks running instances. The safe approach is a multi-step process.

**Adding a NOT NULL column the safe way:**

```python
# ❌ Dangerous — locks table, breaks old app instances that don't know the column
def upgrade():
    op.add_column("users", sa.Column("phone", sa.String, nullable=False, server_default=""))
    # On large tables: AccessExclusiveLock for the duration of the rewrite
```

```python
# ✅ Safe — 3-step process

# Step 1: Add as nullable (no lock, no rewrite)
def upgrade_step1():
    op.add_column("users", sa.Column("phone", sa.String, nullable=True))

# Step 2: Backfill in batches (separate deploy)
# Run in application code or a script, not in the migration:
# UPDATE users SET phone = '' WHERE phone IS NULL LIMIT 10000; (repeat)

# Step 3: Add NOT NULL constraint once all rows have values
def upgrade_step3():
    op.alter_column("users", "phone", nullable=False)
    # PostgreSQL 12+: if all values are non-null, this is metadata-only — no rewrite
```

**Creating an index without locking:**

```python
# ❌ Blocks all writes while building the index
def upgrade():
    op.create_index("idx_users_email", "users", ["email"])

# ✅ CONCURRENTLY — builds without a write lock (takes longer, uses more resources)
def upgrade():
    op.execute("CREATE INDEX CONCURRENTLY idx_users_email ON users (email)")
    # Note: cannot use op.create_index() for CONCURRENTLY — use raw SQL
    # Also: cannot run CONCURRENTLY inside a transaction — disable autocommit:

def upgrade():
    connection = op.get_bind()
    connection.execution_options(isolation_level="AUTOCOMMIT")
    connection.execute(
        sa.text("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users (email)")
    )
```

**Rename a column safely:**

Direct rename breaks running app instances reading the old column name. Safe pattern: add new column → dual-write old+new → backfill → switch reads to new → drop old.

---

## 7.3 Rollback Strategy

Every migration should have a working `downgrade()`. But rollback is not always simple.

**Data-destructive downgrades:** If the migration added a column and data was written to it, `downgrade()` that drops the column loses that data. Document this explicitly in the migration comment.

**What to include in `downgrade()`:**
- Reverse exactly what `upgrade()` did
- For data migrations, the downgrade is often a no-op or marked as irreversible
- Test downgrades before production — run `alembic downgrade -1` in staging

**The deploy strategy that makes rollbacks safe:**

1. Deploy migration (schema change only — backward compatible with old code)
2. Deploy new application code
3. If step 2 fails, roll back app code to old version — schema is still compatible
4. Only after step 2 is stable: optionally clean up compatibility shims

This "expand/contract" pattern means schema changes are always backward compatible with the previous app version.

---

## 7.4 Interview Answer Scripts

**Q: "How do you add a NOT NULL column to a 50 million row table without downtime?"**

> "You can't do it in one migration safely — you have to break it into steps. First, add the column as nullable. That's a metadata-only operation in PostgreSQL — no table rewrite, no lock. Then backfill existing rows in batches, outside the migration, to avoid a single long-running transaction that blocks reads. Once all rows have a value, set the column to NOT NULL. In PostgreSQL 12+, if no nulls exist, this constraint check is done in a single scan without a rewrite — it's fast. The old approach of adding with `server_default` and `nullable=False` in one step works but takes an AccessExclusiveLock for the entire backfill duration on older PostgreSQL versions — that's a full table lock, which means query timeouts for your users."

**Q: "What's the risk of running `CREATE INDEX` in a migration on a production table?"**

> "A plain `CREATE INDEX` takes a ShareLock — it blocks all writes (INSERT, UPDATE, DELETE) while the index is being built. On a large table that could take minutes or longer. During that time, any write to the table queues up, your connection pool exhausts, and the site effectively goes down. The fix is `CREATE INDEX CONCURRENTLY` — it builds the index without blocking writes. It takes roughly twice as long and uses more I/O, but production stays up. The caveat: `CONCURRENTLY` can't run inside a transaction, so you need to set isolation level to `AUTOCOMMIT` in the Alembic migration or use `op.execute()` with raw SQL."

**Q: "How do you structure Alembic in a project with multiple environments?"**

> "The migration files are environment-agnostic — they run the same SQL on dev, staging, and production. What differs is the database URL, which `env.py` reads from the environment at runtime (`os.environ['DATABASE_URL']`). The workflow: migrations are authored and tested locally, committed to the repo, and applied to staging via CI before being applied to production. The CI/CD pipeline runs `alembic upgrade head` as a step in the deploy job, before the new application version starts. This ordering is critical: the new app version may depend on the new schema, so the migration must run first. For Nativ, I also keep a `migration_check` test that runs `alembic check` in CI — this fails if there are model changes that don't have a corresponding migration, catching the case where a developer changed a model but forgot to generate the migration file."

**Q: "What do you do when a migration fails in production halfway through?"**

> "First, stay calm — Alembic wraps migrations in a transaction by default, so a failure mid-migration rolls back automatically. The `alembic_version` table still shows the previous revision, and the database state is clean. The steps: (a) Read the error. Is it a constraint violation? A missing table? A syntax error? The error message tells you what went wrong. (b) Fix the migration file locally, test it against a copy of the production schema in staging. (c) Re-run `alembic upgrade head` in production once the fix is verified. The only complex case: migrations that include non-transactional commands (`CREATE INDEX CONCURRENTLY`, `ALTER TYPE`). These can't be rolled back automatically — you need to check whether the partial operation completed and write a compensating step manually. Document this explicitly in the migration comments when you write it."

> **Nativ connection:** Every schema change in Nativ goes through Alembic — adding the `embedding` column, creating the pgvector index, adding the `review_schedule` table. The zero-downtime patterns here (CONCURRENTLY, expand/contract) directly apply to keeping Nativ available during schema evolution.

---

## 7.5 Self-Tests

Try answering these before looking at the answers.

1. `alembic autogenerate` says "No changes to schema detected" but you clearly added a new model. What's the most likely cause?
2. You run `alembic upgrade head` in production and the migration fails halfway through. What state is the database in, and how does Alembic know where to resume?
3. Your `downgrade()` function just has `pass`. When is this acceptable, and when is it dangerous?
4. You need to rename a column `user_name` to `username` in a zero-downtime way. Outline the steps.
5. A teammate runs migrations directly against the production database from their laptop. What's the risk and what process would you put in place instead?

<details>
<summary>Answers</summary>

1. Most likely cause: the new model is not imported in `env.py`. Alembic's autogenerate compares `Base.metadata` (your model definitions) against the current database schema. If the new model's module was never imported, it doesn't appear in `Base.metadata` — Alembic can't see it. Fix: ensure all model modules are imported before `Base.metadata` is used in `env.py`. Typically done with an `import models` line in `env.py` or via the `target_metadata = Base.metadata` assignment after importing.

2. Alembic wraps each migration in a transaction by default. If the migration fails partway through, the transaction rolls back — the database is in the same state as before the migration started. Alembic's `alembic_version` table is only updated on successful commit, so it still shows the previous revision. Re-running `alembic upgrade head` will attempt the same migration again from the start. Exception: operations that can't run inside a transaction (`CREATE INDEX CONCURRENTLY`, `CREATE DATABASE`) — for these, you use `op.execute()` with `AUTOCOMMIT` and must handle partial failure manually.

3. `pass` in `downgrade()` is acceptable when: the migration only adds new tables, columns, or indexes that are purely additive — downgrading just means those things stay (a harmless no-op). It's dangerous when: the migration drops a column, modifies data, removes constraints, or makes changes that old app code relies on being present. Document irreversible migrations explicitly: `raise NotImplementedError("This migration is irreversible — manual intervention required")`. Never silently swallow a downgrade that would leave the schema in an inconsistent state.

4. Zero-downtime column rename in four deploys: (a) Migration: add new `username` column as nullable. App code: write to both `user_name` and `username`, read from `user_name`. (b) Backfill: `UPDATE users SET username = user_name WHERE username IS NULL`. (c) Migration: add `NOT NULL` constraint to `username`. App code: read from `username`, still write to both. (d) Migration: drop old `user_name` column. App code: remove writes to `user_name`. Each step is backward compatible with the previous app version, so rollback is safe at any point.

5. Risks: no audit trail of who ran what when, no review process, developer's local environment may have different Alembic state than staging, accidental `upgrade head` on a table with millions of rows during peak traffic. Process to put in place: (a) Migrations run only via CI/CD pipeline, triggered by a merge to main. (b) Migration is previewed in staging first, with a rollback plan. (c) Production migration runs during low-traffic hours or behind a maintenance flag. (d) Every migration PR includes a rollback test result from staging. (e) `alembic history` output in CI logs for audit trail.

</details>

---

← Back to [6. SQLAlchemy 2.x](6-sqlalchemy.md) | Next → [8. pgvector](8-pgvector.md)
