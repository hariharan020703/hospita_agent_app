# MediFlow frontend

MediFlow is an AI patient-journey platform for multi-specialty hospitals in Tamil Nadu. Patients describe their symptoms by voice or text in Tamil or English. The assistant routes them to the right department (it never diagnoses), and they book a slot and track a live queue so they arrive on time. Walk-in patients use a kiosk at the entrance, the front desk handles exceptions, doctors see an AI pre-visit summary, and administrators manage doctors, schedules, departments and operational analytics.

This folder is the production frontend. Until a backend is connected, all data comes from static files in `src/data` through a service layer (see [Switching to a real API](#switching-to-a-real-api)).

> The repository root contains an earlier presentation prototype. It is separate from this app and is not used by it.

## Apps and routes

| App | Route | Who | Language | Notes |
|---|---|---|---|---|
| MediFlow home | `/login` | Everyone | English | One button per app: Patient app, Kiosk, Front desk, Doctor, Admin |
| Patient app | `/app` | Patients | Tamil + English | Mobile-first, installable (PWA) |
| Kiosk | `/kiosk` | Walk-in patients | Tamil + English | Touch screen at the entrance, Tamil first, resets after 60 s idle |
| Front desk | `/desk` | Reception (and admins) | English | Live OPD board, walk-ins, AI escalations |
| Doctor | `/doctor` | Doctors | English | Today's queue, pre-visit summaries, consultation scribe, patient follow-ups, schedule, patients |
| Admin | `/admin` | Administrators | English | Dashboard, doctors, departments, schedules, appointments, patients, reports, AI agents, settings |

Every app has a **Log out** button that returns to the MediFlow home page.

## Getting started

Requires Node.js 20 or newer.

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5174. Voice input uses the browser's Web Speech API (Chrome, Edge or Safari). In other browsers the assistant works by typing.

| Command | What it does |
|---|---|
| `npm run dev` | Development server on port 5174 |
| `npm run build` | Type check, then production build into `dist/` (includes the PWA service worker) |
| `npm run preview` | Serve the production build on port 4174 |
| `npm run typecheck` | TypeScript check (app + config files) |
| `npm run lint` | ESLint (zero warnings allowed) |
| `npm run format` / `format:check` | Prettier |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright, uses the installed Chrome) |

Fonts (Inter, Noto Sans Tamil) are bundled with the app, so it works offline.

## Demo accounts

The MediFlow home page (`/login`) has one button per app. The staff buttons open the app already signed in with that role's demo account:

| Button | Opens | Signed in as |
|---|---|---|
| Patient app | `/app` | You sign in with a mobile number (below) |
| Kiosk | `/kiosk` | No sign-in (public device) |
| Front desk | `/desk` | Karthik Selvaraj, front desk |
| Doctor | `/doctor` | Dr. Meena Sundaram, Cardiology |
| Admin | `/admin` | Priya Natarajan, administrator |

Patients sign in at `/app` with their mobile number and the one-time code **123456**:

| Mobile | Patient | Household |
|---|---|---|
| 98765 43210 | Kamala Ramasamy, 52, Peelamedu | Spouse, mother-in-law and daughter. Today: Cardiology at 11:00 with Dr. Meena Sundaram (token CAR-015), who is running 15 minutes late. Two health records and a care plan from her General Medicine visit 12 days ago |
| 98430 12345 | Rajesh Kannan, 39, Saibaba Colony | ENT appointment tomorrow; one health record and a care plan from his ENT visit 20 days ago |
| 97900 12345 | Lakshmi Murugan, 52, Peelamedu | Prefers Tamil, has high blood pressure. Today she is **in Dr. Meena's room** (Cardiology, token CAR-003) after a Tamil symptom conversation, with her BP prescription and lipid report uploaded. Also an old discharge summary and a finished fever care plan. The patient in the AI agents walkthrough below |

Any other 10-digit mobile number creates a new patient account, followed by registration and consent.

### Sample data and the clock

- Sample data covers a fictional 120-bed hospital in Coimbatore: 10 departments, 16 doctors, about 200 patients, about 1,000 appointments from 14 days ago to 7 days ahead, and 90 days of analytics.
- Dates are relative to today, so the data never goes stale.
- In development the clock starts at **09:30** (`VITE_FIXED_NOW` in `.env.development`), so the morning OPD is in progress. Leave it empty to use real time.
- A background simulation moves the queues forward: patients arrive, consultations finish, and doctors call the next patient. It leaves alone any doctor who is signed in and running their own queue.
- Data is kept in the browser's local storage and shared between tabs. Open the patient app, kiosk, front desk, doctor and admin apps in separate tabs and changes appear everywhere: bookings, check-ins, doctor status, admin edits.
- Admin → Settings → **Reset sample data** restores everything (mock mode only).

## AI agents

All "AI" is simulated in the browser from static data: no AI, OCR or speech service is called, and there are no API keys. Voice uses the browser's Web Speech API (with typing as the fallback) and "Listen" uses the browser's speech synthesis.

| Agent | Runs in | What it does | Human check |
|---|---|---|---|
| Orchestrator | Patient app, kiosk | Single entry point for conversations and agent events. Reads intent from free Tamil, English or Tanglish, then calls one agent or a tool: `searchDoctors`, `getSlots`, `bookAppointment`, `rescheduleAppointment`, `cancelAppointment`, `getQueueStatus`, `getPatientProfile`, `sendNotification` (in-app only). Each reply shows its trail, e.g. Orchestrator → Triage agent → searchDoctors → bookAppointment. | The patient confirms every booking, change and cancellation |
| Triage agent | Patient app, kiosk | Complaint-specific follow-up questions; department, urgency (routine / soon / emergency), confidence and plain-language reasons | Below 70% confidence the patient is offered the front desk |
| Medical records agent | Patient app, doctor | Reads uploaded prescriptions, lab reports and discharge summaries (sample scans or any photo/PDF); builds the doctor's pre-visit summary, with a link to the source of every item | The patient checks and corrects each document before saving |
| Consultation scribe | Doctor | Live transcript of the consultation, then a draft note and prescription | Every AI-filled field is marked until the doctor edits or confirms it; nothing is final before "Sign & save" |
| Care companion | Patient app, doctor | Care plan from the signed prescription (medicine times, today's checklist, advice, tests, follow-up, Listen), a chat that answers only from the plan, and follow-up check-ins | Anything outside the plan and every dose question goes to the doctor's "Patient follow-ups" list |

**Safety layer.** Before every reply: warning signs anywhere in what the patient has said open the emergency screen (108 and the hospital's emergency number) and block booking for the rest of the conversation; questions about medicine doses are never answered by an agent. After every reply: free text is checked for diagnosis wording. Warning signs in a care-plan check-in raise an urgent alert to the doctor and tell the patient to come in or call 108.

**Activity log.** Every outcome is logged with time, user, intent, agents and tools called, a short summary, confidence and the human decision (accepted, edited, dismissed). Admin → **Agents** shows each agent's purpose, where it runs, its human check, an on/off switch, today's numbers, a workflow diagram, the confidence spread, the edit/override rate and a live activity feed. Pausing an agent hides its screens and the normal flow takes over (for example, with the triage agent paused, patients choose a department themselves).

**Sample data.** No agent screen starts empty: saved health records with their scans (`src/data/records/records.json`), eight care plans with chat history, check-ins and doctor replies (`src/data/care/plans.json`), and Dr. Meena's patient follow-ups (an urgent warning-sign alert, an open question, a check-in update, two answered). Her waiting patients have pre-visit summaries with documents.

**Where the behaviour comes from.** `src/data/agents` (intents, safety rules, agent definitions, earlier activity), `src/data/triage` (Tanglish synonyms, follow-up question trees, risk conditions), `src/data/records` (sample scans and their extractions), `src/data/scribe` (four scripted consultations, including Lakshmi's) and `src/data/care` (question intents, check-ins, warning signs, approved Tamil phrases for advice). The agents run behind the `AgentService` interface (`src/services/types.ts`); only the mock implementation (`src/services/mock/agents`) exists. Agent data lives in the same in-browser database as everything else, so it is shared between tabs and survives a refresh; **Reset sample data** clears it.

### Walkthrough: Lakshmi's visit

Open the doctor app and the patient app in two tabs. Lakshmi is already in Dr. Meena's room, so the scribe can be tried straight away. Dr. Meena runs her own queue: the background simulation does not move it, so Lakshmi stays in the room until you complete the consultation.

1. **Doctor app** (Dr. Meena). On Today, **Current consultation** shows Lakshmi (CAR-003). **Pre-visit summary** shows her Tamil complaint, follow-up answers, Amlodipine from her old prescription and cholesterol 238 marked high, each linked to the conversation or the scan.
2. Press **Start listening**: the Tamil and English consultation streams in with Doctor and Patient labels. Pause or stop at any time, then **Stop & draft note**. Change Atorvastatin 10 mg to 20 mg, confirm or edit the AI-filled fields, then **Sign & save**. Press **Complete** to call the next patient.
3. **Patient app**, mobile 97900 12345, Tamil. The notification opens "Your care plan". Tap **Listen**, tick a medicine, and ask `night tablet marandhuten, enna pannanum?`. The answer quotes the doctor's missed-dose advice and names the night medicine.
4. Tap **Simulate day 3** and reply "I feel breathless" (or `மூச்சு வாங்குகிறது`). The patient is told to come in today or call 108, and Dr. Meena gets an urgent alert in **Patient follow-ups**.

To try the triage agent and the records agent from the start, use the patient app's assistant: type `மூணு நாளா நெஞ்சு கனமா இருக்கு` (or `chest la heavy ah iruku`) and answer the quick replies. The result is Cardiology, "see a doctor soon", 87%, because of chest discomfort, age 52 and BP history. "Book for me" books through the tools, and "Upload old reports" opens the document reader with sample scans. Any other patient in Dr. Meena's queue gets a scripted consultation for their department when called in.

Emergency path: in the assistant or at the kiosk, type `chest pain and sweating` to get the full-screen 108 screen with booking blocked.

## Architecture

```
src/
  app/          router, providers (TanStack Query, data sync), StaffLayout, error boundary, 404/403 pages
  features/
    auth/       staff sign-in, route guards, session store
    patient/    patient app pages and layout
    kiosk/      kiosk flows (walk-in, QR check-in, emergency, idle reset)
    desk/       front-desk OPD board, walk-ins, escalations
    doctor/     doctor workspace
    admin/      admin console
    assistant/  orchestrator conversation (hook, thread, cards, trail, department picker)
    triage/     symptom-routing engine and assessment (pure), disclaimer, emergency screen
    records/    lab value range check (pure)
    appointments/  slot availability rules (pure)
    queue/      queue estimate (pure)
  components/
    ui/         design-system primitives (Button, Field, DataTable, Modal, Tabs, DatePicker, TimeSlotPicker, ...)
    domain/     shared domain components (PatientForm, cards, booking QR, date strip)
  services/     data access: interfaces, mock implementation (in-browser database), REST implementation;
                services/mock/agents: the simulated orchestrator, agents, tools and safety layer
  data/         static seed data (JSON); agents/, triage/, records/, scribe/, care/ drive the simulated agents
  types/        zod schemas and inferred types for every entity
  hooks/        TanStack Query hooks (hooks/queries), locale, speech, preferences
  i18n/         i18next setup and locales/{en,ta}/*.json
  lib/          clock, dates, formatting, downloads (CSV, .ics), storage
  config/       environment configuration
  styles/       Tailwind layers and design tokens (light and dark themes)
```

**How data flows:**

```
src/data/*.json ─▶ zod validation ─▶ mock database ─▶ services ─▶ TanStack Query hooks ─▶ components
                   (src/types)        (services/mock)  (src/services)  (src/hooks/queries)
```

- Components never import JSON or a specific service implementation; ESLint enforces this. They use the hooks in `src/hooks/queries`, which call `@/services`.
- Mock services add realistic latency (150–600 ms). Set `VITE_MOCK_ERROR_RATE` to make some requests fail, which exercises error states and retries.
- Mutations declare their success message and the queries to refresh (`meta`), so every change shows a toast and the screens stay consistent.
- **Triage engine** (`src/features/triage/engine.ts`), a set of pure functions:
  1. Red flags are checked on everything the patient has said, in English and Tamil, ignoring negated mentions such as "no sweating" or "வியர்வை இல்லை".
  2. A request to talk to a person is escalated.
  3. Follow-up answers are read: duration, severity, age, long-term conditions.
  4. Keyword scoring picks the department. Tamil words are matched by stem, and Tanglish words are read through a synonym list.
  5. Follow-up questions depend on the complaint (for chest discomfort: when it comes on, what comes with it).
  6. A department-specific safety question comes last.
  7. Unclear cases go to the front desk as escalations.

  `src/features/triage/assessment.ts` turns the finished conversation into urgency, confidence and reasons.

  Routing rules and red flags are editable in Admin.
- **Availability** (`src/features/appointments/availability.ts`): slots come from weekly schedules minus approved leave, blocks, holidays and existing bookings. Booking re-checks the slot, so double booking is impossible.
- **Queue estimate** (`src/features/queue/estimate.ts`): patients ahead, doctor delay or break, expected start, and when to leave home based on the patient's travel time.

**Design system.** Teal brand `#0E7C86`, semantic colour tokens as CSS variables (`src/styles/index.css`) with light and dark themes, and an 8px spacing grid. Red is reserved for emergencies and destructive actions. Every data view has loading, empty and error-with-retry states.

**Languages.** The patient app and the kiosk are in Tamil and English. The patient app asks on first launch; the kiosk starts in Tamil for every visitor. The MediFlow home page, front desk, doctor and admin apps are English only.

All text lives in `src/i18n/locales/{en,ta}`, one file per app (namespace), loaded on demand. Translation keys are type-checked. The bilingual namespaces (`common`, `validation`, `auth`, `patient`, `triage`, `kiosk`) have identical keys in both languages. The staff namespaces (`desk`, `doctor`, `admin`) exist in English only. Dates, times and rupee amounts are formatted with `Intl` for `ta-IN` / `en-IN`, and the page's `lang` attribute follows the active language.

> The Tamil text was written for this build and should be reviewed by a native speaker, especially the clinical safety questions and the consent text, before it is used with patients.

**Safety.** The assistant routes to a department and never diagnoses. Every conversation shows "This assistant helps you find the right doctor. It does not give medical diagnosis." Red-flag symptoms open a full-screen emergency screen with tap-to-call 108 and the hospital's emergency number. That screen never offers booking.

## Switching to a real API

1. Set the data source in `.env.local` (or your deployment environment):

   ```bash
   VITE_DATA_SOURCE=api
   VITE_API_BASE_URL=https://api.your-hospital.example
   ```

2. Implement the endpoints listed in `src/services/api/index.ts`. Each service method maps to one REST call, for example `GET /doctors`, `POST /appointments`, `POST /appointments/{id}/check-in`. Responses are validated against the same zod schemas as the sample data, so contract mismatches fail loudly.
3. Return errors as `{ "code": "SLOT_TAKEN", "message": "..." }`, using a code from `src/services/errors.ts`, so the UI can show the right message. Otherwise HTTP status codes are mapped (404 → not found, 409 → conflict, 422 → validation).
4. Sign-in endpoints return `{ token, session }`. The client sends the token as a bearer token on every request.
5. No UI code changes are needed. In API mode the sample-data seed and the queue simulation are not used, and "Reset sample data" is unavailable. For live updates (queue changes from other devices), add a WebSocket or SSE listener in `services/api` that calls the `subscribe` callback. The app already refetches when it fires.

## Configuration

All `VITE_*` variables are documented in `.env.example`: data source, API URL, mock latency and error rate, pinned clock and clock speed.
