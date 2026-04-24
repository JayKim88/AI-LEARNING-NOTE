# 16. Next.js App Router

### Why This Section Matters

The App Router (introduced in Next.js 13, stable in 14) is a fundamental shift in how Next.js works — from page-based to layout-based, from getServerSideProps to React Server Components. Many engineers know the Pages Router; fewer understand why the App Router exists and what tradeoffs it introduces.

At AI startups, Next.js is often the fullstack framework — you'll be asked about rendering strategies, data fetching patterns, and how to architect features that mix server and client components.

**What interviewers actually probe:**
- What are React Server Components (RSC) and what's the key difference from client components?
- What is the difference between `loading.tsx`, `error.tsx`, and `layout.tsx`?
- When would you use Server Actions vs API routes?
- How does Next.js caching work in the App Router?

---

## 16.1 React Server Components (RSC) — The Fundamental Shift

The App Router is built on React Server Components. This changes the default: components render on the server, and only components explicitly marked with `"use client"` become client components.

**Server Component (default):**
- Renders on the server, sends HTML to the client
- Can `await` directly — no `useEffect` for data fetching
- Cannot use browser APIs, state (`useState`), effects (`useEffect`), or event handlers
- Zero JavaScript bundle impact — server component code never ships to the browser

**Client Component (`"use client"`):**
- Renders on the client (and optionally pre-rendered on the server for HTML)
- Can use hooks, event handlers, browser APIs
- Adds to the JavaScript bundle

```typescript
// app/vocab/[id]/page.tsx — Server Component (no directive needed)
// This runs on the server — the DB call never appears in client JS bundle
async function VocabPage({ params }: { params: { id: string } }) {
    const item = await db.query.vocabItems.findFirst({
        where: eq(vocabItems.id, params.id)
    });

    if (!item) notFound();

    return (
        <div>
            <h1>{item.word}</h1>
            <VocabActions item={item} />  {/* Client component for interactions */}
        </div>
    );
}

// components/VocabActions.tsx — Client Component
"use client";

import { useState } from "react";

function VocabActions({ item }: { item: VocabItem }) {
    const [reviewing, setReviewing] = useState(false);
    // Can use hooks and event handlers here
    return <button onClick={() => setReviewing(true)}>Review</button>;
}
```

**The key mental model:** Server components are the default. Reach for `"use client"` only when you need interactivity. Server components can import and render client components, but client components cannot import server components (they'd need to ship them to the browser).

---

## 16.2 App Router File Conventions

The App Router uses file-system routing with special file names that define behavior at each route segment.

```
app/
  layout.tsx        ← wraps all routes — persists across navigation
  page.tsx          ← renders the route
  loading.tsx       ← Suspense boundary — shows while page.tsx is loading
  error.tsx         ← error boundary — "use client" required
  not-found.tsx     ← renders when notFound() is called
  template.tsx      ← like layout but re-mounts on navigation (rare)

  vocab/
    layout.tsx      ← wraps all /vocab/** routes
    page.tsx        ← /vocab route
    [id]/
      page.tsx      ← /vocab/:id route
      loading.tsx   ← loading state for /vocab/:id specifically
```

**`layout.tsx`** — wraps children and persists across navigations. State in a layout survives navigating between child routes. Use for: navigation bars, sidebars, auth wrappers.

**`loading.tsx`** — automatically wraps `page.tsx` in a Suspense boundary. Next.js shows the loading component while the server component (page) is fetching data. This enables streaming HTML.

**`error.tsx`** — catches errors thrown by `page.tsx` or children. Must be `"use client"` because it receives and re-renders interactively on error. Implements `ErrorBoundary` behavior.

```typescript
// app/vocab/error.tsx — must be client component
"use client";

export default function VocabError({
    error,
    reset,
}: {
    error: Error;
    reset: () => void;
}) {
    return (
        <div>
            <h2>Something went wrong loading vocabulary.</h2>
            <button onClick={reset}>Try again</button>
        </div>
    );
}
```

---

## 16.3 Data Fetching in the App Router

Data fetching in the App Router is done directly in async server components — no more `getServerSideProps` or `getStaticProps`.

```typescript
// app/vocab/page.tsx — server component, direct async fetch
async function VocabListPage() {
    // This fetch runs on the server
    const items = await fetch("https://api.example.com/vocab", {
        headers: { Authorization: `Bearer ${process.env.API_KEY}` }
    }).then(r => r.json());

    return <VocabList items={items} />;
}
```

**Parallel data fetching with `Promise.all`:**

```typescript
async function DashboardPage() {
    // ❌ Sequential — each awaits the previous
    const user = await getUser();
    const vocab = await getVocabItems(user.id);  // waits for user first

    // ✅ Parallel — both start concurrently
    const [user, recentItems] = await Promise.all([
        getUser(),
        getRecentVocabItems(),
    ]);

    return <Dashboard user={user} items={recentItems} />;
}
```

**`cache()` function — deduplication across components:**

```typescript
import { cache } from "react";

// Wrapped with cache() — called multiple times but DB hit only once per request
export const getUser = cache(async (id: string) => {
    return db.query.users.findFirst({ where: eq(users.id, id) });
});

// Layout calls getUser(id) — DB hit #1
// Page also calls getUser(id) — deduplicated, returns cached value
```

---

## 16.4 Next.js Caching — Four Layers

The App Router has four distinct caching mechanisms, which is one of its most confusing aspects.

| Layer | What it caches | Duration | Opt out |
|-------|---------------|----------|---------|
| Request Memoization | Same `fetch()` in one render pass | Single request | n/a |
| Data Cache | `fetch()` results across requests | Persistent (until invalidated) | `fetch(url, { cache: "no-store" })` |
| Full Route Cache | Pre-rendered HTML + RSC payload | Persistent (at build time) | Dynamic functions in route |
| Router Cache | Client-side prefetched pages | 30s (dynamic), 5min (static) | `router.refresh()` |

**The practical patterns:**

```typescript
// Force dynamic — not cached, always fresh
fetch(url, { cache: "no-store" })

// Revalidate on interval — cached but refreshes every 60s
fetch(url, { next: { revalidate: 60 } })

// Tagged cache invalidation — revalidate specific data
fetch(url, { next: { tags: ["vocab", `user-${userId}`] } })

// In a Server Action or API route:
import { revalidateTag } from "next/cache";
revalidateTag("vocab");  // invalidates all fetches tagged "vocab"
```

**When a route is dynamic vs static:**
- Route is static (cached at build) unless it uses: `cookies()`, `headers()`, `searchParams`, or `fetch(..., { cache: 'no-store' })`
- These "dynamic functions" make Next.js render the route on every request

---

## 16.5 Server Actions — Forms Without API Routes

Server Actions let you write server-side mutations directly in component files, without creating separate API routes.

```typescript
// app/vocab/actions.ts
"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";

export async function createVocabItem(formData: FormData) {
    const word = formData.get("word") as string;
    const language = formData.get("language") as string;

    // Runs on the server — safe to access db directly
    await db.insert(vocabItems).values({ word, language });

    revalidateTag("vocab");  // invalidate cached vocab list
}

// app/vocab/new/page.tsx
import { createVocabItem } from "../actions";

export default function NewVocabPage() {
    return (
        <form action={createVocabItem}>  {/* action = Server Action */}
            <input name="word" />
            <input name="language" />
            <button type="submit">Add</button>
        </form>
    );
}
```

**Server Actions vs API routes:**

| | Server Actions | API Routes (`route.ts`) |
|---|---|---|
| Best for | Form submissions, mutations tied to UI | External clients, webhooks, REST API |
| Type safety | End-to-end (same codebase) | Manual typing of request/response |
| Caching integration | Built-in `revalidatePath`/`revalidateTag` | Manual |
| Progressive enhancement | Works without JS (native form) | Requires JS |
| Access from external clients | ❌ No | ✅ Yes |

---

## 16.6 Interview Answer Scripts

**Q: "What is a React Server Component and what are the limitations?"**

> "React Server Components run exclusively on the server — they never ship their code to the browser, so you can import database drivers, access environment variables, and run server-only code directly in the component tree. They can be async, so you can await a database query at the top of the component without useEffect or useState. The limitations: no browser APIs, no React hooks that depend on client state (useState, useReducer, useEffect), and no event handlers like onClick. Any interactivity requires a Client Component — you mark it with 'use client'. The architectural pattern is: server components handle data fetching and pass data down to client components as props. This moves the data-fetching boundary closer to where data is consumed, reduces client bundle size, and eliminates waterfalls caused by multiple round trips for data."

**Q: "What's the difference between `layout.tsx`, `loading.tsx`, and `error.tsx`?"**

> "They're different slots in Next.js's route segment system. `layout.tsx` wraps a route segment — it persists across child navigation, so state in the layout (like a sidebar or nav) doesn't reset when you navigate between child routes. `loading.tsx` is automatically wrapped in a Suspense boundary around the page — when the server component is fetching data, Next.js streams the loading UI immediately and swaps in the real content when it's ready. This is how you get instant loading states without `useEffect`. `error.tsx` is an error boundary — it catches errors thrown during rendering or data fetching in its segment. It must be a client component because error recovery (the reset button) needs client-side interaction. Together, these three let you compose loading, error, and success states per route segment without lifting state or prop drilling."

**Q: "When would you use a Server Action instead of an API route?"**

> "Server Actions are ideal for mutations that are tightly coupled to a UI component — form submissions, button clicks that update data, anything where the caller is a React component in the same codebase. You get end-to-end type safety (the function signature is typed, no separate request/response types), progressive enhancement (the form works without JavaScript), and native integration with Next.js cache invalidation via `revalidateTag`. API routes are better when the endpoint needs to be called from outside the Next.js app — webhooks from Stripe, requests from a mobile app, integration with external systems. For Nativ, user-facing mutations like creating vocab items or recording reviews use Server Actions; the LLM streaming endpoint is an API route because it needs specific streaming response handling."

**Q: "Explain Next.js App Router caching."**

> "There are four layers. Request memoization deduplicates identical fetch calls within a single render pass — if a layout and a page both call the same API, it only hits the network once. The data cache persists fetch results across requests — by default, fetches are cached indefinitely and only revalidated on a time interval or explicit tag invalidation. The full route cache stores pre-rendered HTML for static routes at build time. The router cache is client-side — prefetched pages are stored in memory for fast navigation. The most common sources of confusion: `cache: 'no-store'` opts out of the data cache for a specific fetch, but doesn't affect the router cache. And dynamic functions like `cookies()` and `headers()` inside a route make the whole route dynamic — bypassing the full route cache."

---

## 16.7 Self-Tests

Try answering these before looking at the answers.

1. You move a component from the Pages Router to the App Router. It uses `useState` and `useEffect`. What do you need to change and why?
2. Your dashboard page fetches user data and then, inside the rendered JSX, fetches each user's order count. After profiling, you notice each user requires a separate sequential DB query. How do you fix this with App Router patterns?
3. A Server Action creates a new record and calls `revalidateTag("vocab")`. The user refreshes the page but still sees old data. What could be wrong?
4. You have a layout that fetches the current user (for the navigation bar). The page inside it also needs the current user. How do you avoid making two separate DB calls?
5. Your API route returns a streaming response. You try to call it from a Server Component with `await fetch(url)`. What happens?

<details>
<summary>Answers</summary>

1. Add `"use client"` as the first line of the file. In the App Router, all components are server components by default — they can't use `useState`, `useEffect`, browser APIs, or event handlers. Adding `"use client"` makes it a client component, restoring all React hooks. If the component only uses `useEffect` for data fetching, consider refactoring: move the fetch to a server component parent and pass data as props, which eliminates the effect and improves performance by running the fetch on the server.

2. The pattern of fetching inside rendered JSX creates a waterfall: fetch users → for each user, fetch orders. Fix: fetch everything you need upfront in the server component using `Promise.all` or a joined query. If the data comes from a database, rewrite as a single query with `SELECT users.*, COUNT(orders.id) FROM users LEFT JOIN orders ON orders.user_id = users.id GROUP BY users.id`. If the data comes from an API, `Promise.all(users.map(u => fetchOrderCount(u.id)))` parallelizes the calls. The App Router doesn't magically fix N+1 — you still need to structure queries correctly.

3. Several possibilities: (a) The `revalidateTag` call succeeded, but the client's Router Cache still has the old page cached. The router cache is client-side and persists independently. `router.refresh()` from the client would clear it, or the user needs to do a hard refresh. (b) The component doing the fetch isn't actually tagged — check that the `fetch()` call has `{ next: { tags: ["vocab"] } }`. If the fetch has no tag, `revalidateTag("vocab")` won't affect it. (c) The page is statically rendered (no dynamic functions) and was cached at build time — the revalidation invalidated the data cache, but the full route cache may not have been cleared.

4. Use React's `cache()` function to wrap the DB call. Both the layout and the page can call `getUser(id)` — `cache()` ensures the underlying DB call runs only once per request, with the result memoized. This is request-level memoization, not persistent caching. The pattern: export `const getUser = cache(async (id) => db.getUser(id))` from a shared module, then import and call it independently from layout and page — no props drilling, no context, one DB hit.

5. Awaiting a streaming response from a Server Component doesn't stream — `await fetch(url)` buffers the entire response before returning. You'd lose all streaming benefits. Server Components don't support streaming their own data fetching through a streaming fetch. For streaming AI responses in the App Router, the pattern is: a Client Component makes the fetch call using the `fetch` API with a `ReadableStream`, or uses a hook like `useCompletion` from Vercel AI SDK. The streaming logic must be in a Client Component, and the streaming API route itself stays as a route handler (`app/api/stream/route.ts`).

</details>

---

← Back to [15. Node.js Backend](15-nodejs.md) | Next → [17. Streaming (SSE / WebSocket)](17-streaming.md)
