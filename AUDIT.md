# MediFlow frontend audit

Date: 29 October 2026. Scope: `frontend/` (the production app). No code was changed for this audit.

**How it was checked:**
- Ran typecheck, lint, unit tests and the dev server.
- Read the code for each item.
- Drove the demo flows in Chrome (Playwright, three passes) against `npm run dev` on port 5176, recording console errors and checking Tamil screens for horizontal overflow.

**Sample-data note:** the seed data has no patient called Lakshmi. Dr. Meena Sundaram is a neurologist, not a cardiologist, and Dr. Karthikeyan V (orthopaedics) can't be opened from the launcher, whose Doctor button always signs in as Dr. Senthil Kumar R. The demo flows were therefore run with these stand-ins:
- Kamala Ramasamy (Tamil patient)
- Dr. Senthil Kumar R and Dr. Kavitha Rajendran (cardiology)

## 1. Summary

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | One React app with patient, kiosk, desk, doctor, admin sections | ✅ | Single Vite app in `frontend/`. Routes `/app/*`, `/kiosk/*`, `/desk/*`, `/doctor/*`, `/admin/*` in `src/app/router.tsx`, each a lazy chunk. |
| 2 | Login page with demo accounts and role guards | ✅ | `/login` (`src/features/auth/LoginPage.tsx`) has 5 buttons (verified in the browser). Front desk, Doctor and Admin sign in with the demo accounts in `src/data/users.json`; the patient app uses phone + OTP `123456`. Guards: `RequireRole` in PatientApp `['patient']`, DeskApp `['desk','admin']`, DoctorApp `['doctor']`, AdminApp `['admin']`; wrong role → `/unauthorized`. |
| 3 | Demo artifacts removed | ✅ | No story mode, view-as switcher, wireframe, device frames, "Illustrative" badges or presenter tips in `src/`. The only "View as" match is the charts' accessible "View as table". |
| 4 | Only Tamil + English; all strings via i18n; Tamil without overflow | 🟡 | No Telugu or Devanagari text in `src/`, `index.html` or `package.json`. Fonts are Inter + Noto Sans Tamil. No hard-coded UI strings found. Tamil overflow check passed on 20 of 21 screens; **fails on `/app/doctors/:id` at 390px** (page 1162px wide, see 4.1). The desk, doctor and admin apps are English only, by user request. |
| 5 | Data from `src/data` through services; no component imports JSON | ✅ | Only `src/services/mock/seed.ts` (and tests) import `src/data/*.json`. ESLint `no-restricted-imports` enforces this in `eslint.config.js`. |
| 6 | Simulated latency; loading, empty and error states | ✅ | 150–600 ms latency (`.env.development`, `request()` in `src/services/mock/core.ts`); `VITE_MOCK_ERROR_RATE` flag. `QueryBoundary`, `ErrorState`, `EmptyState`, `Skeleton` and `DataTable` states are used across patient, desk, doctor and admin. The kiosk shows errors inline (`Notice`). |
| 7 | Responsive: patient mobile, kiosk tablet, staff desktop | 🟡 | Patient: mobile tab bar plus large-screen two-column layouts. Kiosk home fits 1366×768 with no scrolling (verified). Staff: sidebar, with a drawer below 1024px. Same overflow bug as #4 on the doctor profile at phone width. |
| 8 | Single orchestrator for user messages and hospital events | ❌ | No orchestrator. Events are handled directly inside the services (`src/services/mock/appointments.ts`) and the queue simulator (`src/services/mock/simulator.ts`). |
| 9 | Orchestrator decides which agents to call | ❌ | Not implemented. |
| 10 | Visible agent trail in the UI | ❌ | Not implemented. |
| 11 | Agent activity log with human decisions | ❌ | Not implemented. |
| 12 | Old agents removed (phone call, help, scribe, feedback, routing improvement, escalation, schedule change) | 🟡 | None of these agents were ever built. An **escalation path does exist**: the triage outcome `escalated` creates a front-desk record (`/desk/escalations`, `src/features/desk/pages/EscalationsPage.tsx`), and patient and kiosk show `EscalatedNotice`. Remove it or fold it into the orchestrator if it counts as the escalation agent. |
| 13 | Red-flag check before and after every agent reply | 🟡 | `triageStep` (`src/features/triage/engine.ts`) checks the whole conversation for red flags on every patient message, **before** replying. There is no check **after** the reply: replies are fixed templates and no LLM agent exists yet. |
| 14 | Emergency path → 108 screen, booking blocked | ✅ | Verified in the browser: a Tamil red flag ("நெஞ்சு வலி, வியர்வை அதிகமா இருக்கு") opened the full-screen alert with a `tel:108` link and no booking buttons. `src/features/triage/EmergencyScreen.tsx`. |
| 15 | No diagnosis wording; disclaimer in chat | ✅ | `Disclaimer` sits above every chat (patient `/app/assistant`, kiosk walk-in). "diagnos" appears in the locales only in disclaimers and "not a diagnosis" notes. |
| 16 | Symptom & routing agent: ta/en conversation, follow-ups, department + urgency + reason + confidence | 🟡 | Tamil, English and Tanglish conversation with follow-ups (duration, severity, age, conditions, safety); verified in Tamil → Cardiology. Outputs department + plain-language reason + matched keywords (`RecommendationCard`). **Missing:** urgency levels (only emergency vs routine) and a confidence score. It is a rule engine, not an LLM agent. |
| 17 | Booking agent: doctor + slot, book after confirmation, reschedule, cancel | 🟡 | A guided UI flow, not an agent: `/app/doctors` → profile → slot → `/app/book/:id` → confirm. Booking verified (CAR-026 with Dr. Kavitha). Reschedule and cancel dialogs are in `AppointmentDetailPage.tsx`. Double booking is blocked in the service. |
| 18 | Queue balancing agent with Accept/Dismiss on desk | ❌ | No detection or suggestions (verified: none on the board). Only a manual "Move to another doctor" on the desk (`src/features/desk/components/RowActions.tsx` → `reassign`). |
| 19 | Pre-visit summary on doctor's card when patient is 2nd in line, labelled patient-reported | 🟡 | Verified: Kamala's summary (symptoms, Tamil own words, duration, severity, conditions, safety screen) shows on the **next-patient** card with a "patient-reported, not a diagnosis" label (`src/features/doctor/components/PreVisitSummary.tsx`). It appears when the patient is **1st** in line, not 2nd, and is a formatter (`buildPreVisitSummary`), not an agent. |
| 20 | Tracks position for every patient, live without refresh | ✅ | `estimateQueue` (`src/features/queue/estimate.ts`) per appointment; 15 s polling plus instant cross-tab sync. Verified: the leave-by time changed on the open tracker after the doctor set a delay, with no reload. |
| 21 | Predicted wait from the doctor's actual pace today | ❌ | Uses the fixed `consultMins` from the doctor profile (`estimate.ts`, `queueBased = … + ahead.length * consultMins`). |
| 22 | No-show probability in predictions | ❌ | Not implemented. |
| 23 | "Leave home by" shown to the patient | ✅ | `/app/queue/:id` (`QueuePage.tsx`). Verified: 10:35 AM, updated to 11:00 AM after a 40-minute delay. |
| 24 | Explanation for each prediction | ❌ | Only the numbers (ahead, expected time, delay badge). No explanation sentence such as "4 ahead, doctor averaging 9 min". |
| 25 | Automatic updates: day-before, morning-of, wait change > 10 min, 2nd in line | 🟡 | In-app notifications are generated for: booking confirmed, rescheduled, cancelled; running late (when the doctor sets a delay); you're next (1st in line); called in; checked in; consultation done. **Missing:** day-before confirmation and morning-of message (seeded examples only), the >10 min wait-change trigger, the 2nd-in-line alert, and real SMS/WhatsApp sending. |
| 26 | Missed turn: grace period, then rebook | ❌ | The simulator marks a no-show 45 min after the slot (non-app patients only); no grace period and no rebooking. |
| 27 | Tracking visible in patient, kiosk, desk, doctor, admin | 🟡 | **Patient tracker:** token, patients ahead, expected time, leave-by and a 4-step progress strip; no timeline of updates. **Kiosk:** shows ahead and expected time only right after check-in or token issue; no "Track my token" action. **Desk:** "Running late · 40 min" badge on the doctor card (verified). **Doctor:** waiting count in the stats strip. **Admin:** predicted-vs-actual accuracy ❌. |
| 28 | Mark doctor unavailable: full day, time range or single slot, any date, reason (doctor + admin) | 🟡 | The doctor can request **leave** (date range) or a **block** (time window on one date) with a reason at `/doctor/schedule` (`LeaveRequestDrawer.tsx`); admin approves or rejects at `/admin/schedules`. **Missing:** single-slot option, admin marking directly, and same-day "off" (doctor status offers only available / on break / running late). |
| 29 | Affected patients identified and listed | ❌ | Approved leave only stops **new** bookings (`isBlocked` in `availability.ts`); existing appointments are not touched or listed. |
| 30 | Options per patient (same doctor same day → same department same day by language/gender → preferred day) | ❌ | Not implemented. |
| 31 | Patient sees options in ta/en; accept, other day or cancel | ❌ | Not implemented. |
| 32 | Urgent patients first | ❌ | Not implemented. |
| 33 | Front desk response-status view, non-responders flagged | ❌ | Not implemented. |
| 34 | Same-day unavailability → reassignment via balancing + tracking update | ❌ | Not implemented (manual move only). |
| 35 | Changes consistent across all views in one session | 🟡 | Consistency works for what exists: one browser database plus cross-tab sync (verified: booking, delay, kiosk check-in and doctor actions all showed up in the patient, kiosk, desk and doctor tabs). There are no unavailability changes to propagate. |
| 36 | Demo: Lakshmi's journey | 🟡 | Run end to end with stand-ins; every step passed: Tamil symptoms → Cardiology → booked Dr. Kavitha (CAR-026) → tracker (CAR-015, 6 ahead, leave-by 10:35) → Dr. Senthil 40 min late → leave-by 11:00 → kiosk check-in by booking ID → pre-visit summary on the doctor's next-patient card. **Gaps:** no Lakshmi / cardiologist Meena in the data. Tracking used Kamala's existing 11:00 slot with Dr. Senthil, because Dr. Kavitha has no account on the launcher. The summary shows at 1st in line. |
| 37 | Demo: emergency → 108 | ✅ | Verified (see #14). |
| 38 | Demo: Dr. Karthik 40 min late → balancing → accept → moved → notified | ❌ | Only the first part works (run with Dr. Senthil): the delay recalculates waits and the desk sees the badge. No balancing suggestion or accept; moves are manual; only app patients get the running-late notice. Dr. Karthikeyan can't be opened from the launcher. |
| 39 | Demo: Dr. Meena sudden leave → options → statuses | ❌ | Can't be run: the unavailability flow (#29–34) doesn't exist. |

## 2. Totals

| ✅ Implemented | 🟡 Partial | ❌ Missing |
|---|---|---|
| 10 | 12 | 17 |

By section:

| Section | ✅ | 🟡 | ❌ |
|---|---|---|---|
| A. Basics (1–7) | 5 | 2 | 0 |
| B. Orchestrator (8–12) | 0 | 1 | 4 |
| C. Safety (13–15) | 2 | 1 | 0 |
| D. Agents (16–19) | 0 | 3 | 1 |
| E. Tracking (20–27) | 2 | 2 | 4 |
| F. Unavailability (28–35) | 0 | 2 | 6 |
| G. Demo flows (36–39) | 1 | 1 | 2 |

## 3. Command results

| Command | Result |
|---|---|
| `npm run typecheck` | ✅ exit 0, no errors (app and config projects) |
| `npm run lint` | ✅ exit 0, no problems (`--max-warnings 0`) |
| `npm test` | ✅ 6 test files, **72 tests passed** |
| `npm run dev` | ✅ Vite 6.4.5 ready in 439 ms on port 5176, `GET /` → 200, no errors in the server log. Port 5174 (the default) was already taken by an earlier dev server, so the audit used `--port 5176`. |

The Playwright e2e suite (`npm run test:e2e`, `tests/e2e/patient.spec.ts`) exists but was not part of the requested commands. The demo flows were driven with a separate browser script instead.

## 4. Console errors and warnings during the demo flows

**None.** Across three Chrome passes, 0 console errors, 0 warnings and 0 uncaught page errors. The passes covered:
- **Launcher:** `/login`.
- **Patient app:** sign-in in Tamil, assistant (routine and emergency), doctors, doctor profile, booking, appointments, appointment detail, live queue, notifications, profile and settings, at 390px and 1440px.
- **Kiosk:** attract, language, home, booking-ID check-in.
- **Doctor:** Today (status change, complete, call next), schedule, patients, settings.
- **Front desk:** board, walk-in, escalations.
- **Admin:** all 8 pages.

### 4.1 Layout issue found

- `/app/doctors/:doctorId` at 390px wide (Tamil and English): the page is 1146–1162px wide, so it scrolls sideways.
- **Cause:** the date strip in the booking panel. The large-screen grid on this page has no explicit single-column track on phones, so the grid column grows to the date strip's full width.
- **Fix:** give the grid `grid-cols-1` / `minmax(0,1fr)` on small screens, or put `min-w-0` on its children.

## 5. Prioritised fix list

Effort: small < ½ day, medium 1–2 days, large 3+ days.

| Priority | Fix | Items | Effort |
|---|---|---|---|
| 1 | Fix the doctor-profile overflow on phones (grid `minmax(0,1fr)` / `min-w-0`) | 4, 7 | Small |
| 2 | Align sample data with the demo script: add patient Lakshmi (Tamil, Warangal → Coimbatore), make Dr. Meena a cardiologist (or rename the script), and let the launcher open Dr. Karthik and Dr. Meena (doctor picker under the Doctor button) | 36, 38, 39 | Small |
| 3 | **Orchestrator foundation:** one service that receives patient messages and hospital events (check-in, consult start/end, doctor late/unavailable, no-show, emergency), calls agents in order, records an agent trail and an activity log of human decisions (accepted / edited / dismissed / auto). Show the trail in the patient chat and tracker, and add an "Agent activity" page for staff. Route the existing triage, booking and queue code through it. | 8–11, 13 | Large |
| 4 | **Live Queue Tracking agent:** wait prediction from today's actual consult durations, no-show probability per patient ahead, an explanation line per prediction, and an update timeline on the tracker | 21, 22, 24, 27 | Medium–large |
| 5 | **Automatic patient updates:** day-before confirmation, morning-of message, alert when the predicted wait moves more than 10 min, "you're 2nd in line" alert (in-app, with an SMS/WhatsApp adapter stub) | 25 | Medium |
| 6 | **Queue Balancing agent:** detect late or overloaded doctors, suggestion cards with Accept/Dismiss on the desk board, accepted moves call `reassign`, the tracking agent recalculates, and patients are notified | 18, 38 | Medium |
| 7 | **Doctor unavailability:** doctor and admin mark full day / time range / single slot on any date with a reason. Then: list affected patients; generate options in the required order (language/gender match, urgent patients first); patient options screen in ta/en (accept, other day, cancel); desk response-status board with non-responder flags; same-day cases handed to the balancing agent | 28–34, 39 | Large |
| 8 | Missed-turn handling: grace period after being called, then rebook into the next free slot and notify | 26 | Medium |
| 9 | Remaining tracking surfaces: kiosk "Track my token" (enter token or booking ID → live position), admin predicted-vs-actual accuracy chart | 27 | Medium |
| 10 | Symptom agent output: urgency level (routine / soon / urgent) and confidence on the recommendation | 16 | Small–medium |
| 11 | Pre-visit summary timing: prepare and show it when the patient is 2nd in line ("Up next" list on the doctor's Today page) | 19 | Small |
| 12 | Decide on the escalation path: remove it, or keep it as an orchestrator outcome (not a separate agent) | 12 | Small |
| 13 | When agents produce free-text replies, run the red-flag check on the agent's reply as well as the patient's message | 13 | Small (after #3) |

**Suggested order for a complete demo:**
1. Items 1–2: quick wins, about a day.
2. Item 3: everything else plugs into it.
3. Items 4–5: the main agent.
4. Item 6.
5. Item 7.
6. Items 8–13.
