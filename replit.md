# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   └── object-storage-web/ # Uppy-based upload hook for GCS presigned URLs
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Project: Hebrew RTL E-Commerce Platform (טק-סטור)

A production-ready Israeli tech/electronics store with full Hebrew RTL UI.

### Artifacts
- `artifacts/api-server` — Express 5 API server on port 8080
- `artifacts/store` — React/Vite frontend (Hebrew RTL)

### Features
- Product catalog with filters (category, brand, price, search)
- Product detail pages with related products, add to cart, wishlist
- Shopping cart (session-based via `x-session-id` header)
- User authentication (SHA-256 hash, base64 token)
- Wishlist, product comparison, recently viewed
- Loyalty points program
- Coupon/discount codes
- Inventory management (multi-warehouse)
- Full admin panel (dashboard, products, orders, users, analytics, coupons, loyalty, inventory)
- Hebrew UI (he-IL), RTL layout, Heebo font, ₪ price format

### Test Credentials
- Admin: `admin@store.co.il` / `Admin123!`
- User: `yossi@example.co.il` / `User123!`

### Known Bugs Fixed
- `categoryId`/`brandId` empty string params were parsed to `NaN` and broke SQL queries — now guarded with `isNaN()` checks
- `/api/products/[object Object]/related` — frontend was passing options object instead of product ID to `useGetRelatedProducts`

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

## Accessibility Improvements (WCAG 2.2 AA)

The following accessibility improvements were implemented across the store frontend:

### Global (index.css)
- **Skip link** (`.skip-link`) — visible on keyboard focus, jumps to `#main-content`
- **Focus rings** — `*:focus-visible` outline: 3px solid primary, offset 2px
- **`prefers-reduced-motion`** — disables all animations and transitions
- **Touch target size** — `min-height/min-width: 44px` on mobile for all interactive elements
- **`.sr-only`** utility class for screen-reader-only text

### Layout (layout.tsx)
- Skip-to-main `<a>` as first child of root element
- `<main id="main-content" tabIndex={-1}>` — skip link target
- `role="banner" aria-label` on top announcement bar
- `<header>` with mobile button `aria-expanded` and `aria-controls` pointing to sheet ID
- Desktop search wrapped in `role="search"` form with `<label htmlFor="desktop-search">`
- Mobile search with `<label htmlFor="mobile-search">`
- `<nav aria-label="ניווט קטגוריות">` for desktop category bar
- `<nav aria-label="ניווט ראשי">` for mobile drawer nav
- `SheetContent id="mobile-nav-sheet"` matching hamburger's `aria-controls`
- Wishlist/cart `<Link>` have descriptive `aria-label` including count (e.g., "עגלת קניות, 3 פריטים")
- Logout button has `aria-label="התנתק מהחשבון"`; all icons are `aria-hidden`

### Product Card (product-card.tsx)
- Wishlist button: `aria-label={הוסף את ${name} למועדפים}`
- Add-to-cart button: `aria-label={הוסף את ${name} לעגלת הקניות}`
- Sale badge: `aria-hidden="true"` (visual only; price already announced via `aria-label`)
- Price container `aria-label` announces full price context (sale + original)
- Image link `aria-label` describes destination product

### Cart (cart.tsx)
- Quantity group wrapped in `role="group" aria-label={כמות של ${name}}`
- `-/+` buttons: `aria-label` with product name and action; span counts get `aria-live="polite"`
- Remove button: `aria-label={הסר ${name} מהעגלה}`
- Cart total: `aria-live="polite" aria-atomic="true"` for live updates
- Coupon input: `id="coupon-code"` with `<label htmlFor>` and `aria-describedby` hint
- Loyalty input: sr-only `<label>` with range info and `aria-describedby` hint
- Item row `aria-busy={isPending}` during API call

### Checkout (checkout.tsx)
- All form fields have `id` + `Label htmlFor` associations (firstName, lastName, phone, city, street, houseNumber, zipCode, addressNote)
- `autoComplete` attributes on all fields
- `aria-required="true"` on required fields
- Step number circles are `aria-hidden="true"`; step heading text is descriptive
- Edit step button has `aria-label="ערוך פרטי משלוח"`

### Auth (auth.tsx)
- Login form: `aria-label="טופס התחברות" noValidate`
- Login email/password: `id` + `Label htmlFor` + `autoComplete`
- Show/hide password buttons: `aria-label` toggling between הסג/הסתר
- Login errors: `role="alert" aria-live="assertive"`
- Registration form: `aria-label="טופס הרשמה" noValidate`
- All register fields have `id` + `Label htmlFor` + `autoComplete`
- Email error: `id="reg-email-error"` + `aria-describedby` + `role="alert"` + `aria-invalid`
- Password rules list wrapped in `aria-live="polite"` div
- OTP input group: `role="group" aria-label="הזנת קוד אימות בן 6 ספרות"` with `aria-label` per digit
- `autoComplete="one-time-code"` on first OTP digit
- All confirmation and registration errors: `role="alert"`

### Accessibility Statement Page (/info/accessibility)
- Comprehensive Hebrew statement stored as `page_accessibility` in `site_settings`
- Mentions online-only operation, WCAG 2.2 AA target, specific improvements made, limitations, contact info, date

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
