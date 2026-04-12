# Copilot Instructions for EcoWarriors

## Build, test, and lint commands

### Root app (`/`)
- Install deps: `npm install`
- Run dev server: `npm run dev`
- Type/lint check: `npm run lint`
- Run unit + integration tests: `npm run test`
- Run tests with coverage thresholds: `npm run test:coverage`
- Run a single test file: `npm run test -- src/lib/utils.test.ts`
- Production build: `npm run build`
- Preview production build: `npm run preview`

The app depends on env vars from `.env.example` (`VITE_FIREBASE_*` and `VITE_GEMINI_API_KEY`).

### Firebase Functions (`/functions`)
- Install deps: `cd functions && npm install`
- Build: `cd functions && npm run build`
- Run unit + integration tests: `cd functions && npm run test`
- Run tests with coverage: `cd functions && npm run test:coverage`
- Run a single test file: `cd functions && npm run test -- src/index.integration.test.ts`
- Run local emulator for functions: `cd functions && npm run serve`
- Deploy functions: `cd functions && npm run deploy`

Note: a `lint` script exists in `functions/package.json`, but the current CI workflow does not run it.

### Tests
- Root app uses Vitest.
- Test files follow `src/**/*.test.ts` and include both **unit** and **integration** tests.
- Coverage is enforced via `npm run test:coverage` (configured in `vitest.config.ts`).
- `functions/` also uses Vitest, with coverage configured in `functions/vitest.config.ts`.
- Deploy CI (`.github/workflows/deploy.yml`) validates both layers with coverage:
  - Root app: `npm run test:coverage`
  - Functions: `npm --prefix functions run test:coverage`

## High-level architecture

- `src/main.tsx` bootstraps a single-page React app and wraps `<App />` with `ErrorBoundary`.
- `src/App.tsx` is the main orchestration layer: auth lifecycle, Firestore subscriptions, tab navigation (`DASHBOARD`, `REPORTES`, `COMUNIDAD`, `MAPA`, `CHATBOT`, `PERFIL`), and feature actions (report creation, marketplace, squads, crisis mode).
- `src/contexts/SettingsContext.tsx` provides i18n (`es`/`en` dictionaries), UI preferences (language/notifications/privacy/dark mode), and global alert/confirm modals.
- Firebase client setup is centralized in `src/firebase.ts` (Auth, Firestore, Storage) plus shared write/error helpers.
- Domain/service logic is mostly in `src/services/*`:
  - `reportService.ts` handles reports in both `reports` and `emergency_reports`, uploads report images to Storage, manages `updates` subcollections, and normalizes legacy report data.
  - `marketplaceService.ts`, `squadService.ts`, `userService.ts`, and `missionService.ts` implement feature-specific Firestore behavior.
  - `geminiService.ts` runs client-side Gemini validation/analysis used by report and marketplace flows.
- `functions/src/index.ts` exposes Firebase HTTPS functions for AI-related operations (analysis, chat, validation, summaries, mission generation); this is a separate backend surface from client-side `geminiService`.
- `functions/src/lib/*` centralizes reusable backend helpers (Gemini client + HTTP/API-key/JSON utilities) used by handlers in `index.ts`.
- Access/security constraints are defined in `firestore.rules` and `storage.rules` and must stay aligned with client data shapes.

## Key conventions in this repository

- **Sanitize before persisting**: user-provided text should pass through `sanitizeText` (`src/lib/utils.ts`), and objects written to Firestore should go through `cleanFirestoreData` (`src/firebase.ts`) to remove unsupported `undefined` values.
- **Firestore error pattern**: service-layer operations use `handleFirestoreError(error, OperationType.<...>, path)` and then rethrow, so callers can surface failures.
- **Report model consistency is strict**:
  - Status values are Spanish string unions (for example `Abierto (nuevo)`, `Resuelto`, `Cargado por error`) shared across `src/types.ts`, services, and `firestore.rules`.
  - Report location canonical shape is `{ lat: number, lng: number }`; normalization helpers are centralized in `src/lib/reportNormalization.ts`.
  - Report history is stored as subcollection docs under `updates`.
- **Settings/i18n workflow**: new UI strings should use translation keys and be added for both languages in `SettingsContext` (not hardcoded inline text).
- **Theme/settings persistence**: settings are persisted in `localStorage` keys (`app_lang`, `app_notifications`, `app_privacy`, `app_dark_mode`), and dark mode is controlled by toggling the `dark` class on `document.documentElement`.
- **Deployment path awareness**: Vite uses `base: '/ecowarriors/'` (`vite.config.ts`), so links/assets should not assume root `/`.
