# OMS Admin (oms-web)

Admin UI for OMS Core. **W0.1a** built the design system and app shell against local
fixtures only. **W0.1b** connects it to a real, locally-running OMS: a generated API
client, cookie-based auth (login, logout, accept-invite, password reset, forced
password-change), and permission gating. Every other screen — brands, categories,
attributes, products, team, audit — is still fixture-only stub content; each ships as its
own task.

## Stack

React · TypeScript (strict) · Vite · Tailwind CSS v4 · TanStack Query · TanStack Table ·
React Router · React Hook Form + Zod · openapi-typescript + openapi-fetch · Vitest +
Testing Library. See `D:\Habbit\orchestrator\DECISIONS.md` (D2.14–D2.18) for why.

## Running it

You need a locally running OMS Core to log into (see below) — the UI itself has no offline
mode once you're past `/login`.

```bash
npm install
npm run dev              # start the dev server (http://localhost:5173)
npm run build            # generate:api:check && tsc -b && vite build
npm run lint              # eslint --max-warnings 0
npm run format             # prettier --write
npm run test               # vitest run
npm run test:watch
npm run generate:api        # regenerate src/api/schema.gen.ts from the committed contract
npm run generate:api:check  # fails if the committed contract and generated file disagree
```

### Running OMS Core locally to develop against

```bash
cd D:\Habbit\oms-core-service
mvn spring-boot:run
```

This defaults to the `local` Spring profile (see that repo's README — `SPRING_PROFILES_ACTIVE`
in `.env` does **not** select a profile; the Maven plugin sets `local` for you). It needs a
reachable Postgres and Redis — that repo's `.env` has the connection details. On first boot
it seeds a Super Admin in `INVITED` state with no password and logs a one-time
`/accept-invite?token=...` link to the console; use that link (or a subsequent
`/reset-password` request) to set a password and get in the first time.

### Environment variables

| Variable | Purpose | Default if unset |
|---|---|---|
| `VITE_API_BASE_URL` | Where OMS Core is running | `http://localhost:8080` |

Copy `.env.example` to `.env` to override. Most local setups don't need a `.env` at all —
OMS Core's own default port matches the fallback here, and its `local` profile's default
`CORS_ALLOWED_ORIGINS` already includes this app's default dev port (5173).

## Project structure

```
src/
  api/
    schema.gen.ts     GENERATED — never hand-edit. Types from the committed OpenAPI contract.
    client.ts          The one HTTP client OMS is called through: credentials, CSRF header,
                        401 handling, error unwrapping. Nothing else may call fetch()/axios
                        (enforced by eslint.config.js).
    query-client.ts     The shared TanStack QueryClient (defaults: no refetch-on-focus, no
                        retry on 4xx) — imported by client.ts too, so a 401 can clear it.
    auth.ts             Query/mutation hooks: profile, login, logout, accept-invite, password
                        reset (request + complete), change-password, update-profile.
    permission-catalog.ts   The full permission catalog (GET /api/admin/permissions) —
                        best-effort; nothing in this task blocks on it.
  auth/
    RequireAuth.tsx      Route guard: loading / redirect-to-login / redirect-to-force-
                        password-change / render.
    RequirePermission.tsx  Route-level nav-permission gate (convenience only — D2.17).
    usePermissions.ts   Reads the current member's effective permissions off the profile query.
  components/
    ui/                 shadcn-style primitives (Button, Input, Select, Dialog, Table, ...)
    data-table/          DataTable — TanStack Table wrapper (sorting, pagination, column
                        visibility, expandable rows, empty/loading states)
    tree/                CategoryTree — react-arborist wrapper + pure reparent logic
    form/                MoneyInput, MultiSelect, ImageUrlField — the form primitives that
                        don't come from shadcn out of the box
  layouts/
    AppShell.tsx        Sidebar (permission-filtered) + header (real signed-in member +
                        logout) + breadcrumb slot + content area
    AuthLayout.tsx       Bare centered layout for /login, /accept-invite, /reset-password,
                        /force-password-change
    breadcrumb-context.tsx  useBreadcrumb() hook pages call to set the header's trail
    nav-items.ts         Sidebar nav config, each item optionally naming a required permission
  pages/                One file per route. Auth pages and /profile are wired to the real
                        API; every business screen is still a fixture-only stub.
  fixtures/             Local fixture data for the still-stubbed business screens
  lib/
    utils.ts             cn() — clsx + tailwind-merge
    money.ts              minor-unit <-> rupee string conversion (D3.2), no floating point
    api-error.ts          ApiError/ApiClientError + applyApiErrorToForm() — maps the shared
                        error shape (D3.4) onto react-hook-form fields, falls back to a
                        toast with the trace id
  router.tsx             Route table — auth layout vs. RequireAuth-gated app shell, plus the
                        global 401 -> redirect-to-login wiring
```

## Auth, session and permissions

- **Session** is an `httpOnly` cookie (`oms_session`) set by OMS on login — this app never
  reads or stores a token itself (D2.16). Verified in a real browser: `document.cookie` is
  empty, and `localStorage`/`sessionStorage` never get touched by anything auth-related.
- **CSRF**: every non-GET request carries `X-OMS-Csrf: 1` (D2.18), added by a client
  middleware in `api/client.ts` — no screen has to remember this itself.
- **401 handling**: any 401 from the API clears the whole TanStack Query cache and redirects
  to `/login` — *except* from `/auth/login` and `/profile/change-password`, where a 401
  means "that credential was wrong" (a normal, inline-handleable form outcome), not "the
  session died". Getting this distinction wrong was caught during manual verification: an
  earlier version bounced a member straight back out of the change-password form on a typo,
  even though their session was perfectly fine.
- **403**: rendered in place as a real "not permitted" view (`pages/ForbiddenPage.tsx`), not
  a redirect or a blank screen. `RequirePermission` renders it client-side from the
  profile's own permission list (nav-hiding's server-verified counterpart); the server is
  always the actual authority (D2.17) — confirmed independently by calling a hidden
  endpoint directly and getting a real 403 back.
- **Forced password change**: `LoginResponse.mustChangePassword` sends the member to
  `/force-password-change` (outside `RequireAuth`, so it doesn't redirect-loop) instead of
  the shell; they use their current password once more to set a new one via
  `POST /profile/change-password`, same as changing it voluntarily from `/profile`.
- **Logout** clears the entire query cache before redirecting — a stale cache would leak the
  previous member's data into the next session on a shared machine.

## Regenerating the API client

```bash
npm run generate:api
```

Reads `D:\Habbit\orchestrator\contracts\openapi\oms-core.json` (never `/v3/api-docs` at
build time — that file is the committed contract) and writes
`src/api/schema.gen.ts`. **Never hand-edit that file or hand-write a type it already
describes (D2.15)** — `npm run build` runs `generate:api:check` first and fails if the
committed contract and the generated file disagree, so a field OMS removes breaks this
app's *build*, not its production behavior.

## Where the primitives live, and how to use them

- **DataTable** (`components/data-table/DataTable.tsx`) — pass `columns` (TanStack
  `ColumnDef[]`) and `data`. Pass `renderSubRow` to enable expandable rows (see
  `pages/ProductsPage.tsx` for variants-under-product). Column visibility is a built-in
  dropdown; sorting is click-to-toggle on any column with `accessorKey`/`accessorFn`.
- **CategoryTree** (`components/tree/CategoryTree.tsx`) — pass `data` shaped like
  `GET /api/admin/categories/tree` (id, name, slug, status, live, children) and `onChange`.
  Drag-and-drop reparenting is handled by react-arborist; the actual tree-splicing logic is
  a pure function, `reparentTree()` in `components/tree/reparent.ts`, tested directly rather
  than through simulated drag events (jsdom drag-and-drop is unreliable to assert against).
- **Form fields** — compose `components/ui/form.tsx` (`Form`, `FormField`, `FormItem`,
  `FormLabel`, `FormControl`, `FormMessage`) around React Hook Form + Zod, same pattern as
  shadcn. `MoneyInput` displays rupees but is controlled entirely in minor units (paise);
  `MultiSelect` and `ImageUrlField` round out the set (see their tests in
  `components/form/__tests__` for usage — no current screen needs all of them at once).
- **Error mapping** — call `applyApiErrorToForm(error, form)` from `lib/api-error.ts` after
  any write, where `error` is the `ApiClientError` a rejected mutation throws (see any
  `onError` in `pages/auth/*` or `pages/ProfilePage.tsx`). It sets `form.setError()` for
  every field in `fieldErrors` that matches a known field, and shows a toast (with the
  trace id) for the top-level message or any unmatched field error.

## Tree library choice

**react-arborist** (`react-arborist@3`). shadcn ships no tree component (per the task
spec), so the choice was between react-arborist and hand-rolling one. react-arborist gives
virtualized rendering, keyboard navigation, and drag-and-drop reparenting out of the box —
exactly what the category picker needs for D4.7 (ancestor-gated `LIVE` status) and the
reparenting requirement. We own the tree *data* and reparenting logic ourselves
(`reparentTree()`), and only hand react-arborist a node renderer — keeps the actual
tree-splicing testable as plain functions instead of through the DnD library.

## Known rough edges

- The `shadcn` CLI (`npx shadcn@latest init`) currently fails on this machine/repo with
  "Could not load the workspace config" on every version tried (4.16–4.18), even right
  after writing a valid `components.json`. All `components/ui/*` primitives were
  hand-written to match shadcn's own conventions instead (same `cn()`, `cva()`, Radix
  wrapping, `data-slot` attributes) — safe to add real shadcn components on top later once
  (if) the CLI is fixed; the aliases in `components.json` already match.
- Toasts use `sonner`, not Radix's own `Toast` primitive.
- TanStack Table is pinned to `^8.21.3`. Plain `npm install @tanstack/react-table` (and
  `npm create vite`'s own dependency resolution) currently default to a `9.x` pre-release
  with a completely different, breaking API — don't let a future `npm update` drift back to
  it without deliberately porting `DataTable.tsx`.
