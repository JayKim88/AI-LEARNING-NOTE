---
title: "Supabase Auth + FastAPI JWT Verification: HS256 → ES256 Migration"
date: 2026-02-27
description: "New Supabase projects sign JWTs using the ES256 algorithm. How to verify with PyJWT + JWKS client and how to resolve macOS Python SSL issues."
category: learnings
tags: ["supabase", "fastapi", "jwt", "oauth", "python", "next-js", "authentication"]
lang: en
draft: false
---

## Key Concepts

### Supabase JWT Algorithm Change (HS256 → ES256)

Supabase signs JWTs using **ES256 (ECDSA)** for new projects.
Legacy projects use HS256 (HMAC), but newly created projects default to ES256.

| Item | HS256 | ES256 |
|------|-------|-------|
| Method | Symmetric key (shared secret) | Asymmetric key (public/private key pair) |
| Verification | Local verification with `SUPABASE_JWT_SECRET` | Fetch public key from JWKS endpoint |
| Network Request | None | Yes (first request only, cached thereafter) |
| Key Rotation | Manual | Automatic via JWKS |

### JWKS (JSON Web Key Set)

Standard endpoint for exposing public keys externally. When verifying a JWT, reads the key ID (`kid`) from the header and fetches the matching public key from the JWKS.

Supabase JWKS URL: `https://[project-ref].supabase.co/auth/v1/.well-known/jwks.json`

---

## New Learnings

### Before (HS256 Assumption)

```python
# Wrong approach — causes 401 on new Supabase projects
payload = jwt.decode(
    token,
    settings.SUPABASE_JWT_SECRET,
    algorithms=["HS256"],
    audience="authenticated",
)
```

**Why it fails**: Decoding the token header reveals `"alg": "ES256"`, but the code only attempts HS256 verification → `InvalidAlgorithmError` → 401.

### After (JWKS/ES256)

```python
from functools import lru_cache
import ssl, certifi
import jwt
from jwt import PyJWKClient

@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient:
    jwks_url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
    ssl_context = ssl.create_default_context(cafile=certifi.where())
    return PyJWKClient(jwks_url, cache_keys=True, ssl_context=ssl_context)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer()),
) -> UUID:
    token = credentials.credentials
    signing_key = _jwks_client().get_signing_key_from_jwt(token)
    payload = jwt.decode(
        token,
        signing_key.key,
        algorithms=["ES256", "RS256"],   # Allow both — forward compatibility
        audience="authenticated",
    )
    return UUID(payload["sub"])
```

**Key changes**:
- `SUPABASE_JWT_SECRET` env var → `SUPABASE_URL` env var
- `jwt.decode(token, secret)` → `PyJWKClient.get_signing_key_from_jwt(token)` + decode with public key
- `lru_cache(maxsize=1)` — prevents JWKS fetch on every request, cached in-process

---

## Practical Examples

### Checking Token Algorithm (Debugging)

JWT has the structure `base64(header).base64(payload).signature`. You can check the algorithm by decoding only the header.

```python
import base64, json

token = "eyJ..."  # Copied from browser cookie
header_b64 = token.split(".")[0]
# Fix base64 padding
header_b64 += "=" * (4 - len(header_b64) % 4)
header = json.loads(base64.b64decode(header_b64))
print(header)
# {"alg": "ES256", "kid": "2cf1098a-...", "typ": "JWT"}
```

### macOS Python 3.13 SSL Certificate Issue

macOS Python installed from Python.org **does not use the system keychain**. When making HTTPS requests via `urllib`, it cannot find CA certificates, causing `CERTIFICATE_VERIFY_FAILED` errors.

```
ssl.SSLCertVerificationError: [SSL: CERTIFICATE_VERIFY_FAILED]
certificate verify failed: unable to get local issuer certificate
```

**Fix**: Explicitly inject the CA bundle from the `certifi` package.

```python
import ssl, certifi

# Create SSLContext using certifi's CA bundle
ssl_context = ssl.create_default_context(cafile=certifi.where())

# Inject into PyJWKClient
client = PyJWKClient(jwks_url, ssl_context=ssl_context)
```

> **Why wasn't this a problem before?**
> HS256 uses `jwt.decode(token, secret)` — local computation, no network request.
> ES256/JWKS uses `urlopen(jwks_url)` — makes an external HTTPS request → exposes SSL issue.

### requirements.txt

```
PyJWT==2.9.0
cryptography>=43.0.0   # ES256 support (PyJWT cryptography dependency)
certifi>=2024.0.0      # CA bundle (explicit declaration)
```

> Without `cryptography`, running `jwt.decode(..., algorithms=["ES256"])` raises `InvalidAlgorithmError`.

### Next.js 15: RequestCookies.set() Signature Change

```typescript
// ❌ Type error in Next.js 15
request.cookies.set(name, value, options)
// Type error: Argument of type '[string, string, Partial<SerializeOptions>]'
// is not assignable to parameter of type '[key: string, value: string]'

// ✅ Correct usage
request.cookies.set(name, value)
// options only supported on ResponseCookies
supabaseResponse.cookies.set(name, value, options)  // response is OK
```

### Supabase Session Mode Pooler (IPv4 Compatible)

```
# IPv6 only — fails on Render/macOS
db.csztisxjdwkfyqqfowpk.supabase.co:5432

# IPv4 compatible — Session Mode Pooler
aws-0-ap-southeast-1.pooler.supabase.com:5432
```

asyncpg ignores `sslmode=require` in the DSN. Remove from URL and pass as kwarg:

```python
if "sslmode=require" in database_url:
    database_url = database_url.replace("?sslmode=require", "")
    ssl = "require"
pool = await asyncpg.create_pool(dsn=database_url, ssl=ssl)
```

---

## Common Misconceptions

**"JWT can be verified with the Supabase JWT Secret"**
→ Only valid for legacy projects (HS256). New projects use ES256, and the JWT Secret is not used for signing. That's why the Supabase dashboard labels it "Legacy".

**"certifi is installed automatically as an httpx dependency, so it's fine to import"**
→ Fine in production, but explicit dependency declaration is the principle. List it directly in `requirements.txt`.

**"JWKS fetch happens on every request"**
→ Cached in-process with `PyJWKClient(cache_keys=True)` + `@lru_cache`. Only one network request on first call.

---

## References

- `backend/app/deps/auth.py` — JWKS-based JWT verification dependency
- `backend/app/core/config.py` — `SUPABASE_URL` configuration
- `frontend/middleware.ts` — Next.js middleware route protection
- `frontend/lib/supabase/server.ts` — server-side Supabase client
- [PyJWT JWKS Documentation](https://pyjwt.readthedocs.io/en/stable/usage.html#retrieve-rsa-signing-keys-from-a-jwks-endpoint)
- [Supabase Auth: Verifying JWTs](https://supabase.com/docs/guides/auth/jwts)

---

## Next Steps

- [ ] Check Supabase JWKS key rotation interval (no cache invalidation strategy currently in place)
- [ ] Verify `session.access_token` refresh logic on token renewal (confirm whether Supabase SSR handles this automatically)
- [ ] Confirm whether `CERTIFICATE_VERIFY_FAILED` reproduces on production Render (Linux uses system CA, so it shouldn't occur)
