# 30. DevOps Essentials

### Why This Section Matters

At AI startups, engineers are expected to deploy and operate their own services — there often isn't a dedicated DevOps team. Knowing how CI/CD, Docker, and basic cloud deployment work is a baseline expectation, not a specialization.

Interviewers probe whether you can ship code confidently: do you understand what Docker actually does, can you read a GitHub Actions workflow, and do you know the difference between blue-green and rolling deployments?

**What interviewers actually probe:**
- What does Docker do and why do we use it?
- How does a CI/CD pipeline work?
- What is the difference between a blue-green and a rolling deployment?
- How do you deploy a FastAPI + PostgreSQL service?

---

## 30.1 Docker — What It Actually Does

Docker packages an application and its dependencies into a **container** — a lightweight, isolated process that runs consistently across any environment. Not a virtual machine — containers share the host OS kernel.

```
Without Docker:                    With Docker:
Developer's machine runs Python 3.9  Container has Python 3.11 + all dependencies
Production server has Python 3.11     Same container runs everywhere
"It works on my machine" →            Reproducible environment
Production bug nobody can reproduce
```

**Dockerfile for a FastAPI app:**
```dockerfile
# Base image — Python 3.11 on slim Debian
FROM python:3.11-slim

WORKDIR /app

# Install dependencies first — Docker layer cache
# If requirements.txt doesn't change, this layer is cached
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port (documentation only — doesn't actually open port)
EXPOSE 8000

# Run the app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Key Docker concepts:**
- **Image** — the blueprint (immutable). Built from a Dockerfile.
- **Container** — a running instance of an image.
- **Layer cache** — each instruction in the Dockerfile creates a layer. If a layer's content doesn't change, Docker reuses the cached layer. Copy requirements before code for faster builds.
- **Multi-stage builds** — use a build stage to compile, a slim runtime stage to run:

```dockerfile
# Build stage
FROM python:3.11 AS builder
RUN pip install poetry
COPY pyproject.toml .
RUN poetry export -f requirements.txt > requirements.txt

# Runtime stage — no poetry, no dev tools
FROM python:3.11-slim
COPY --from=builder /requirements.txt .
RUN pip install -r requirements.txt
COPY app/ app/
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 30.2 Docker Compose — Local Development

Docker Compose runs multi-container applications with a single command. Defines the full stack (API + database + Redis) in one file.

```yaml
# docker-compose.yml
version: "3.9"
services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/nativ
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      db:
        condition: service_healthy   # wait until DB is ready
    volumes:
      - .:/app   # mount local code for hot reload
    command: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: nativ
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

```bash
docker compose up          # start all services
docker compose up -d       # detached (background)
docker compose down        # stop and remove containers
docker compose logs -f api # follow API logs
```

---

## 30.3 CI/CD with GitHub Actions

CI (Continuous Integration) runs tests automatically on every push. CD (Continuous Deployment) deploys automatically when tests pass on the main branch.

```yaml
# .github/workflows/ci.yml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install dependencies
        run: pip install -r requirements.txt

      - name: Run tests
        env:
          DATABASE_URL: postgresql+asyncpg://postgres:postgres@localhost:5432/test_db
        run: pytest tests/ -v

  deploy:
    needs: test        # only runs if test job passes
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'    # only on main branch

    steps:
      - uses: actions/checkout@v4

      - name: Build and push Docker image
        run: |
          docker build -t ghcr.io/${{ github.repository }}:${{ github.sha }} .
          docker push ghcr.io/${{ github.repository }}:${{ github.sha }}

      - name: Deploy to Render/Railway/Fly.io
        env:
          DEPLOY_API_KEY: ${{ secrets.DEPLOY_API_KEY }}
        run: |
          curl -X POST "https://api.render.com/v1/services/srv-xxx/deploys" \
            -H "Authorization: Bearer $DEPLOY_API_KEY"
```

---

## 30.4 Deployment Strategies

Different approaches to releasing new versions with different tradeoff between speed and risk.

**Rolling deployment:** Gradually replace old instances with new ones. At any point, some instances run the old version, some run the new.
- Risk: mixed versions serving traffic simultaneously — API compatibility must be maintained
- Good for: most deploys where backward compatibility is maintained

**Blue-green deployment:** Run two identical environments (blue = current, green = new). Switch traffic entirely at once.

```
Blue (v1): 100% traffic
Green (v2): 0% traffic

Testing: route 5% to Green
Verified: Switch to Green 100%

Green (v2): 100% traffic
Blue (v1): standby (instant rollback by switching back)
```

- Risk: requires double infrastructure cost during transition
- Good for: database migrations, major version changes

**Canary deployment:** Route a small percentage of traffic to the new version, monitor, and gradually increase.
- Risk: small number of users may see issues in the canary
- Good for: high-traffic services where a rolling deploy is too fast

**What to do on a bad deploy:**
```bash
# Kubernetes rolling rollback
kubectl rollout undo deployment/api

# Docker Swarm
docker service update --rollback api

# Render / Railway / Fly.io
# Each has a "rollback to previous deploy" button in the UI
```

---

## 30.5 Environment Variables and Secrets

Never hardcode secrets. Always inject via environment variables.

```python
# app/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    redis_url: str
    openai_api_key: str
    jwt_secret: str
    environment: str = "development"

    class Config:
        env_file = ".env"         # loads from .env locally
        env_file_encoding = "utf-8"

settings = Settings()
```

```bash
# .env (never commit to git — add to .gitignore)
DATABASE_URL=postgresql+asyncpg://...
OPENAI_API_KEY=sk-...
JWT_SECRET=long-random-string

# In production: inject via platform (Render, Railway, Fly.io)
# or secrets manager (AWS Secrets Manager, HashiCorp Vault)
```

---

## 30.6 Interview Answer Scripts

**Q: "What does Docker do and why do we use it?"**

> "Docker packages an application with all its runtime dependencies — Python version, libraries, system packages — into a container image. A container is a running instance of that image. The value: the image runs identically on any machine that has Docker — developer laptop, CI server, production server. No more 'it works on my machine.' For a FastAPI app, the image includes the exact Python version, all pip packages, and the application code. The image is immutable and versioned — you can always roll back to a previous image. The secondary benefit for production: containers start in seconds (vs minutes for VMs), can be scaled horizontally by running more instances, and have resource limits that prevent one service from starving another."

**Q: "What's the difference between blue-green and rolling deployments?"**

> "Both are strategies for deploying new versions without downtime. Rolling deployment gradually replaces old instances with new ones — at any moment, some requests are handled by the old version and some by the new. It's resource-efficient but requires API backward compatibility, because both versions serve traffic simultaneously. Blue-green maintains two complete environments: the live environment (blue) and the new release (green). You test green, then switch all traffic at once. If green has issues, you switch back to blue instantly — instant rollback. The cost is running double the infrastructure during the transition. I use blue-green for major releases or database migrations — the instant rollback capability is worth the cost. Rolling deployment is fine for routine feature deploys where backward compatibility is maintained."

**Q: "How does CI/CD work in a FastAPI project?"**

> "CI runs on every PR and push. The GitHub Actions workflow spins up a PostgreSQL service container, installs dependencies, and runs the full test suite against the real test database. If tests pass, the CD job builds a Docker image, pushes it to a container registry (GitHub Container Registry or ECR), and triggers a deployment to the production environment. In Nativ, deployment is a POST to Render's deploy API with the new image tag. The key safeguards: tests must pass before deploy (the `deploy` job has `needs: test`), the deploy only triggers on the main branch, and environment variables are injected from GitHub Secrets — never in the code."

**Q: "What's the difference between a Docker image and a container, and how does layer caching work?"**

> "An image is an immutable, layered blueprint — think of it as a snapshot of a filesystem with metadata about what command to run. A container is a running instance of an image — a process with its own writable layer on top of the image layers. You can run many containers from the same image, and they share the image layers without duplicating them. Layer caching is Docker's build optimization: each instruction in a Dockerfile creates a new layer. If the instruction and all its inputs (the command + the files it copies) haven't changed since the last build, Docker reuses the cached layer without re-running it. This is why you copy `requirements.txt` and run `pip install` before copying the application code: `requirements.txt` changes rarely, so the `pip install` layer stays cached across most builds. If you copy everything first, any code change invalidates the cache and triggers a full `pip install` — rebuilds take minutes instead of seconds."

---

## 30.7 Self-Tests

Try answering these before looking at the answers.

1. Your Docker image is 1.2GB and takes 4 minutes to build. What are two things you'd change?
2. A developer commits `OPENAI_API_KEY=sk-...` directly to the repo. What do you do immediately, and what process prevents this in the future?
3. You deploy a new version that changes a database column name. You have rolling deployment with 3 instances. The 2 old instances still use the old column name. What breaks and how do you fix it?
4. Your CI pipeline runs `pytest` but the tests pass even when the database code is broken because the tests mock the database. What's the problem and how do you fix the pipeline?
5. You have 3 FastAPI instances behind a load balancer. One instance has a memory leak and uses 95% of its memory. The others are fine. How would you detect this and what would you do?

<details>
<summary>Answers</summary>

1. (a) **Order Dockerfile instructions for layer cache efficiency** — COPY `requirements.txt` and RUN `pip install` before COPY `. .` (application code). If only the code changes (not dependencies), the expensive `pip install` layer is cached and not re-run. (b) **Use multi-stage builds** — use a full Python image for building/installing, then copy only the installed packages and app code to a slim final image. Reduces image size from 1.2GB to perhaps 150-300MB. Other optimizations: use `--no-cache-dir` in pip install (reduces size), use `.dockerignore` to exclude `.git`, `__pycache__`, test files, and docs from the build context.

2. **Immediate actions**: (a) Rotate the API key immediately — go to OpenAI and generate a new key, invalidate the old one. A committed secret is compromised even if you delete the commit — git history is permanent unless you force-push with history rewriting, and git hosting providers often have already indexed it. (b) Search the full git history for the secret: `git log -p | grep "sk-"`. (c) Notify the team. **Prevention**: (a) Add `.env` to `.gitignore`. (b) Use `pre-commit` hooks with `detect-secrets` or `truffleHog` to scan for secrets before commit. (c) Enable GitHub's secret scanning — it detects known secret patterns in pushes and notifies you.

3. **Breaking**: The old instances query with the old column name and get `column "old_name" does not exist` errors. The new instances use the new column name and work. During the rolling deploy, ~50% of requests fail. **Fix with expand/contract pattern**: First deploy adds the new column name (both old and new exist). Application code is updated to read from either (backward compatible). Second deploy removes the old column once all instances use the new name. This two-deploy approach means no version mismatch — both versions can work simultaneously. Alternatively: use blue-green deployment so there's never a mixed-version state.

4. The CI pipeline has a test isolation problem: unit tests that mock the database tell you the application logic is correct, but not that the database queries work. Fix: add integration tests to the CI pipeline that run against a real test database. GitHub Actions supports service containers — add a PostgreSQL service, run integration tests with `DATABASE_URL` pointing to it. These tests exercise the actual SQLAlchemy queries, schema, and database behavior. Mark slow integration tests with `pytest.mark.integration` and run them in a separate CI step — still fast enough to run on every PR, but now catching real database bugs.

5. **Detection**: Check instance-level memory metrics. If you're on Kubernetes: `kubectl top pods` shows per-pod memory. If on a cloud platform (AWS ECS, Railway): each instance's memory graph will show one diverging upward. Or: container logs may show OOM warnings before the instance crashes. Set up an alert: if any instance's memory exceeds 80%, trigger a page. **Response**: restart the affected instance (rolling restart — it drains connections, restarts, rejoins the pool). Investigate root cause: take a heap dump before restarting, use `tracemalloc` or `memray` to identify what's growing. Add memory metrics to dashboards so you can see the rate of growth and predict when the next instance will need a restart.

</details>

---

← Back to [29. Observability & Debugging](29-observability.md) | Next → [31. Linux / Process Basics](31-linux.md)
