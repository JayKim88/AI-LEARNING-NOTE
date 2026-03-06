---
title: "2026-03-06 Session Log"
date: 2026-03-06
description: "indie-maker-pipeline-review: full pipeline audit — 17 flow issues fixed, end-to-end test run; build-your-body: fixed communities feed showing wrong posts and broken infinite scroll; lingua-rag: PronunciationModal mic lifecycle overhaul"
tags: ["indie-maker", "pipeline-review", "skill-design", "build-your-body", "next-js", "mongodb", "bugfix", "lingua-rag", "web-speech-api", "react"]
---

## Today's Topics

- [indie-maker — Pipeline Internal Review](#indie-maker-pipeline-review)
- [build-your-body — Communities Feed Bug Sprint](#build-your-body)
- [lingua-rag — PronunciationModal Bug Sprint](#lingua-rag)

---

## indie-maker-pipeline-review

> Full internal pipeline review of the 11-skill indie-maker system. Goal: find every point where a real product sprint would get blocked, confused, or produce bad output.

This session was a complete audit of the indie-maker agent pipeline — 11 skill files covering everything from market research to Kill/Go decision. The process: simulate a real sprint end-to-end, surface every ambiguity and blocking point, then fix them all before the next real product is built through the system.

---

### How it worked

Three parallel sub-agents reviewed the skill files simultaneously, each focused on a different phase. All findings were collected, triaged by actual sprint impact (not theoretical severity), and classified into P0/P1/P2.

The triage question was: *"Would a real founder building a real product get stuck here?"* If yes, it's P0. If it would cause confusion or inconsistent output, P1. If it's friction but not blocking, P2.

**Result: 17 issues found across 8 skill files. All 17 were fixed.**

---

### P0 fixes — sprint blockers

**1. No pivot path on 🔴 demand failure (indie-planner)**
The skill would warn the user that demand validation returned No Signal, then offer only two options: continue anyway or re-run research. No pivot path. A real founder staring at a red signal needs three options: continue with additional evidence, reframe the angle for a different target, or replace the idea entirely. Added all three.

**2. Kill criteria had no reference benchmarks (indie-planner)**
Q5 asked "what numbers would make you continue?" with no context. A founder doing this for the first time has no idea what numbers are reasonable. Added a benchmark table (PH upvotes, paying customers, MRR at Kill/Watch/Go thresholds) sourced from the sprint playbook, with a note that they're reference points, not rules.

**3. Backend had no routing for 18 of 19 request types (indie-backend)**
The skill classified incoming questions into 19 types but only handled DB schema questions with a full algorithm. Everything else — RLS policies, auth flows, Stripe webhooks, Edge Functions — got routed to a generic handler. Added explicit algorithm mappings for all 19 types.

**4. Plan B failure condition was AND instead of OR (indie-launcher)**
The Plan B trigger required *both* PH upvotes AND signups to be below threshold. PH upvotes = distribution signal. Signups = product signal. Either one failing means something is wrong. Changed to OR.

**5. lessons.md wasn't loaded at sprint start (indie-planner)**
The retrospective skill (indie-retro) generates `lessons.md` after a failed sprint. But indie-planner never read it. Cross-sprint learning was being silently discarded. Added a Glob + Read block at Step 0 that detects lessons.md and summarizes the key principles before the interview begins.

---

### P1 fixes — flow breaks

- **Expected Screen column** added to prd-lean.md Core Features table, so indie-ux doesn't have to infer screen count from prose descriptions
- **Mental model validation checkpoint** added at end of indie-ux Step 1 — forces user to confirm or correct the UX assumptions before the entire flow is designed on top of them
- **UX conflict detection** added to indie-designer Step 0 — reads navigation_architecture and onboarding_strategy from ux-flow.md and flags any design choices that would contradict what UX already decided
- **Activation Event** added as a required field after Q5 in indie-planner — defines the moment a user first experiences product value, connected directly to D29 Kill criteria
- **Monitoring gate** added to indie-infra — blocks launch unless Sentry, UptimeRobot, and Vercel Analytics are each verified working with a real test event
- **Channel attribution table** added to indie-launcher D15 — gives indie-analyst the referrer breakdown it needs for channel-level diagnosis
- **MRR diagnosis bridge** added to indie-growth — Step 3.5 verdict (🔴/🟡/🟢) now explicitly routes to the correct Step 3.6 experiment, instead of leaving the connection implicit
- **Sub-50 user and non-PH launch edge cases** added to indie-analyst — qualitative signals and Sean Ellis test take priority when sample size is too small for quantitative benchmarks

---

### End-to-end test

After all fixes were applied, a full pipeline test was run using **GitMessage** (a VS Code extension that auto-generates commit messages) as the fixture product. The pipeline ran from indie-planner through indie-ux, indie-designer, and indie-launcher.

**16 of 17 fixes were directly exercised.** The one exception: indie-backend's request routing dispatch (P0-3) was never triggered because a VS Code extension fixture produces no DB schema questions — the extension talks to the VS Code API, not a database. The fix exists and is correct; it just needs a web SaaS fixture to be verified end-to-end.

---

### 3 new issues found during testing

Running a real product through the system surfaced problems that the static review missed:

**Watch verdict had no exit path.** The analyst skill could recommend Watch (not Kill, not Go) but never defined when the watch period ended or what would trigger a re-evaluation. Added D43 as the standard watch duration with explicit re-evaluation criteria, saved to kill-go-report.md so the next run auto-detects it.

**Document drift between prd-lean.md and build skills.** Build skills (backend, frontend, infra) read prd-lean.md but had no way to flag when implementation scope diverged from what's written there. Added a Scope Change Protocol: when a build skill detects a discrepancy, it surfaces it explicitly and prompts the user to update the document. The user owns prd-lean.md; the skill only flags.

**Non-SaaS stack mismatch.** indie-backend assumes a Supabase + Next.js web app by default. The VS Code Extension fixture triggered the backend skill, which would have applied web SaaS patterns to a VSCode extension — wrong runtime, wrong APIs, wrong everything. Added product type detection at Step 0 with an explicit mismatch warning for VS Code extensions, CLIs, mobile apps, and desktop apps.

---

### What was decided

| Decision | Rationale |
|---|---|
| Watch period = D29 → D43 (14 days) | Long enough for a meaningful signal, short enough to avoid drift |
| Build skills flag scope changes, never edit prd-lean.md | User always owns the planning document |
| All skill pseudocode in English | Bilingual trigger phrases and Korean opening messages intentionally stay — they're for the user, not the algorithm |
| Test fixture naming: `{camelCaseProjectName}_{YYYY-MM-DD}` | Enables multi-run tracking and easy sorting |

---

### What's still open

- P0-3 (indie-backend routing dispatch) needs verification with a standard web SaaS fixture — VS Code Extension couldn't exercise it
- P2 items deferred: backlog.md auto-generation, multi-sprint research folder structure, KST timezone note

---

### Next

- [ ] Run second pipeline test with a standard web SaaS fixture to verify P0-3
- [ ] Update test-sprint/README.md index after each future test run
- [ ] Consider P2 fixes: backlog.md auto-generation, multi-sprint research folder, KST timezone note
- [ ] Commit all skill file changes to git

---

## build-your-body

### Communities Feed Bug Sprint

The communities page had a frustrating cluster of bugs: the feed showed the wrong posts on first load, toggling "Show My List" broke the list entirely, and infinite scroll stopped working in certain modes. They all shared the same root — the initial server-rendered data and the scroll-fetched data were using different filters.

---

### Bug 1: Page shows your own posts on first load

**Symptom**: Opening the communities page shows your own workout posts in the feed, even though "Show My List" is turned off.

**Root cause**: The server-rendered initial data (`getData.ts`) fetched all public posts with no user filter. Since client-side userId filtering had been removed (it was broken — more on that below), your own posts appeared in the feed from the very start.

**Fix**: Added `getServerSession` to `getData.ts` and applied a MongoDB `$ne` (not-equal) filter to exclude the current user's posts. This matches exactly what the scroll API already does for subsequent pages.

---

### Bug 2: All posts were always shown regardless of userId filter

**Symptom**: Even when the code tried to filter out your own posts, all posts appeared anyway.

**Root cause**: The client-side filter compared `v.userId !== userId` — but `v.userId` was a MongoDB `ObjectId` object and `userId` was a plain string. In JavaScript, an object is never strictly equal to a string, so the comparison was always `true`, and no posts were ever filtered out.

**Fix**: Moved filtering to the server side. The API now receives `filterUserId` and `myList` parameters and runs the comparison using `new ObjectId(filterUserId)` directly in the MongoDB query.

---

### Bug 3: Toggling "Show My List" causes an empty list

**Symptom**: Switching the toggle from off to on (or vice versa) results in an empty list that never loads.

**Root cause**: Two issues:
1. The reset logic set `setPage(1)` instead of `setPage(0)`, so the first fetch was for page 1, skipping page 0 entirely.
2. If a request was already in-flight when the toggle fired, it would complete and append wrong-mode data to the newly reset list.

**Fix**: Changed to `setPage(0)` and added an `AbortController`. When the toggle fires, the previous request is cancelled immediately before the reset happens.

---

### Bug 4: List clears on initial page load

**Symptom**: The pre-loaded server data (passed as `initialData`) disappears immediately after the page renders.

**Root cause**: The reset effect (which runs when `showMyData` changes) was also running on the very first render, wiping `initialData` before the user saw it.

**Fix**: Added an `isMounted` ref. The reset effect checks this ref and skips its first run, preserving the server data on load.

---

### Bug 5: Auto-fetch only runs once

**Symptom**: After switching modes, the page fetches one batch and stops, even if the list isn't full yet.

**Root cause**: The auto-fetch effect watched `filteredData.length` — but when all posts in a batch belonged to the current user (and were filtered out), `filteredData.length` stayed 0. The effect saw no change and didn't re-run.

**Fix**: Added `page` to the effect's dependency array. After each page loads, the effect re-runs and checks whether more data is needed.

---

### Bug 6: Google OAuth 404 error

**Symptom**: Clicking "Sign in with Google" showed a 404 page.

**Root cause**: The app was running on port 3002, but `NEXTAUTH_URL` wasn't set, so NextAuth defaulted to port 3000. Google's redirect URL didn't match.

**Fix**: Added `NEXTAUTH_URL=http://localhost:3002` to `.env.local` and registered the correct redirect URI in Google Cloud Console.

---

### Key patterns from this session

| Pattern | Why it matters |
|---|---|
| SSR and client fetches must use identical filters | Mismatch causes visible inconsistency from the first render |
| Server-side ObjectId comparison | Client-side ObjectId vs string comparison is always `true` — never filter MongoDB IDs in the browser |
| AbortController on mode switch | Prevents stale responses from a previous mode polluting the new list |
| `isMounted` ref to skip first effect run | Protects server-rendered `initialData` from being wiped on mount |

---

### Next

- [ ] Fix API error handling — 16 routes return nothing on error (bare `console.log` in catch blocks)
- [ ] Remove `as any` type casts and fix `PerfomanceData` → `PerformanceData` typo
- [ ] Add more exercises to the DB (review coverage by muscle group)
- [ ] Expand statistics graphs — weekly/monthly volume trends, PR tracking, muscle group breakdown
- [ ] [Phase 2] Generate AI workout summary after completing a session (Claude API)
- [ ] [Phase 2] Progressive Overload Advisor — analyze last 4 weeks and suggest weight/rep increases

---

## lingua-rag

### PronunciationModal Bug Sprint

Today was a deep dive into the pronunciation practice modal. The feature itself is simple on the surface — the user says a sentence out loud, the mic listens, and chips light up word by word. But the underlying Web Speech API is notoriously fiddly, and several bugs had piled up. Here's what got fixed.

---

### Bug 1: Mic stops working from the 2nd attempt onward

**Symptom**: The first pronunciation attempt works fine. From the second one, the mic indicator shows "listening" but nothing gets recognized.

**Root cause**: When a sentence is fully matched, the code calls `stop()` on the `SpeechRecognition` instance. The browser then fires one final `onresult` event with the complete transcript — *after* the phase has already been set to "done". Because there was no phase check at the top of `onresult`, this stale event re-entered the success logic, incremented the pass counter a second time, and scheduled a *second* auto-advance timer. Two timers meant `startListening()` was called twice, launching two concurrent mic instances. They fought over the microphone and both failed silently.

**Fix**: Added `if (phaseRef.current !== "listening") return` as the first line of `onresult`. Any event that arrives after the session has moved on is immediately discarded.

---

### Bug 2: Mic stays on after the modal is closed

**Symptom**: Closing the modal (X button or Escape) didn't actually stop the microphone — the browser tab kept showing the mic indicator.

**Root cause**: The cleanup function called `rec.abort()`, which triggers `onend`. But `onend` was checking `phaseRef.current === "listening"` and calling `startListening()` again, effectively undoing the cleanup.

**Fix**: Set `recRef.current = null` *before* calling `abort()`. All event handlers now start with `if (rec !== recRef.current) return`, so any callbacks fired from the dying instance see a `null` ref and exit immediately. Cleanup is clean.

---

### Bug 3: The "Listen" button makes the mic pick up TTS audio

**Symptom**: Pressing the listen button to hear the target sentence would sometimes have the mic recognize the TTS playback as the user's voice.

**Root cause**: `handleSpeak` called `recRef.current.abort()` and then scheduled a restart via `waitAndRestart`. But `abort()` fires `onend`, and since the phase was still `"listening"`, `onend` restarted the mic after just 100ms — before TTS had even started playing.

**Fix**: Set `phaseRef.current = "done"` *before* calling `abort()`. Now `onend` sees a non-listening phase and exits early. The mic only comes back via `waitAndRestart`, which polls `window.speechSynthesis.speaking` and waits until TTS is fully done.

As a bonus, `mountedRef` was added to prevent `waitAndRestart` from firing if the user closes the modal while TTS is still playing.

---

### Bug 4: Wrong-word detection created a competing restart path

**Symptom**: On wrong-word detection, the recognition would sometimes restart twice — once from `onend` and once from the auto-advance timer.

**Root cause**: When a wrong word was detected, `stop()` was called while `phaseRef` was still `"listening"`. This caused `onend` to schedule a restart *and* the wrong-word handler to schedule its own timer.

**Fix**: Same pattern as above — set `phaseRef.current = "done"` before `stop()`, making `onend` exit early. One restart path, one timer.

---

### Bug 5: Proper nouns like "Pascal" never get matched

**Symptom**: Saying "Ich bin Pascal" would match "ich" and "bin" but the "pascal" chip never lit up. Sometimes the whole session reset.

**Root cause**: Two sub-problems:
1. German STT often returns a slightly mangled version of foreign names — "Pasquale", "Baskal", or similar. The Levenshtein distance from these to "pascal" exceeds 2, which was the hard cap.
2. When the last word failed to match, the wrong-word handler reset the entire session — forcing the user to start over from "ich".

**Fix**:
- Relaxed the fuzzy match threshold for longer words: words up to length 3 allow 1 edit, up to 6 allow 2, beyond 6 allow 3. "Pasquale" → "pascal" has distance 3, which now passes.
- Removed the wrong-word reset for the *last* word. If only the final word fails, the session ends naturally and restarts — the user just needs to say the sentence again. No penalty, no full wipe.

---

### What's still open

**Real-time transcript lag**: With `continuous: false`, Chrome batches words before firing interim results. In practice this means a word only appears in the transcript *after the next word is spoken*. Switching to `continuous: true` would fix the display but broke the success-detection logic (tested and reverted). This is the main UX rough edge remaining.

---

### Key patterns from this session

| Pattern | Where it applies |
|---|---|
| Phase guard at top of `onresult` | Prevents stale events from re-entering logic after a state transition |
| `ref = null` before `abort()` | Makes cleanup instant and reliable without extra flags |
| Set phase *before* calling `stop()`/`abort()` | Controls which code path `onend` takes |
| Single restart owner | Each scenario (success, wrong-word, TTS) has exactly one timer that calls `startListening()` |

---

### Next

- [ ] Re-examine success-detection logic under `continuous: true` — can real-time display and correct matching coexist?
- [ ] Smarter proper-noun matching — detect capitalized words in the source text and apply a higher threshold only for those
- [ ] Persist pronunciation practice stats (attempts to reach 10 passes, average per session, etc.)
