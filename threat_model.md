# Threat Model

## Project Overview

This project is a pnpm TypeScript monorepo for a Hebrew RTL e-commerce platform. The production application consists of an Express 5 API server in `artifacts/api-server`, a React/Vite storefront and admin UI in `artifacts/store`, PostgreSQL via Drizzle in `lib/db`, generated API schemas/clients in `lib/api-zod` and `lib/api-client-react`, and object storage access through `artifacts/api-server/src/lib/objectStorage.ts`.

Users include unauthenticated shoppers, authenticated customers, and privileged admin/manager users. The platform handles catalog browsing, carts, orders, loyalty points, support messages, media management, supplier/inventory operations, and email-based account workflows.

Production assumptions for future scans:
- `NODE_ENV=production` in deployed environments.
- Platform TLS protects client-to-server traffic in production.
- `artifacts/mockup-sandbox` is development-only and should be ignored unless production reachability is demonstrated.

## Assets

- **User accounts and sessions** — customer and manager/admin identities, bearer tokens, password hashes, password reset tokens, and account activation state. Compromise enables impersonation and privileged access.
- **Customer PII** — names, emails, phone numbers, addresses, order history, loyalty balances, and support correspondence. Exposure creates privacy and fraud risk.
- **Commercial data** — order totals, coupon settings, inventory levels, product pricing, supplier records, analytics, and exports. Tampering directly affects revenue and fulfillment.
- **Administrative capabilities** — manager privilege assignments, site settings, media uploads, messaging functions, and import/export endpoints. Abuse can change storefront content or leak operational data.
- **Application secrets and integrations** — SMTP/IMAP credentials, database access, object storage access, and any signed object URLs. Leakage can expose external systems or private data.
- **Stored files and objects** — uploaded media plus object-storage content served through `/storage/public-objects/*` and `/storage/objects/*`. Misclassification or missing ACL enforcement can disclose or overwrite files.

## Trust Boundaries

- **Browser to API** — all request bodies, query params, headers, uploaded files, and origins are untrusted. The API must authenticate and authorize every sensitive operation server-side.
- **API to PostgreSQL** — route handlers have broad read/write access to business data. Authorization bugs or injection at the API layer can become full data compromise.
- **API to SMTP/IMAP providers** — support mail and auth emails cross into third-party infrastructure using stored credentials. TLS verification and origin/link construction matter here.
- **API to object storage** — presigned uploads and object reads cross from application trust into bucket-backed storage. Upload paths, ACL metadata, and read authorization must be enforced explicitly.
- **Public to authenticated to manager/admin surfaces** — storefront browsing is public, account/cart/order functions are customer-scoped, and admin/manager routes must be restricted and privilege-checked server-side.
- **Production to dev-only surfaces** — `artifacts/mockup-sandbox`, many files in `attached_assets`, and one-off scripts are not production scope unless proven otherwise.

## Scan Anchors

- **Production entry points**: `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/*.ts`, `artifacts/store/src/main.tsx`, `artifacts/store/src/App.tsx`.
- **Highest-risk server areas**: `routes/auth.ts`, `lib/managerAuth.ts`, `routes/admin.ts`, `routes/users.ts`, `routes/orders.ts`, `routes/messages.ts`, `routes/siteSettings.ts`, `routes/storage.ts`, `routes/media.ts`, `routes/cart.ts`, `routes/ads.ts`, `routes/{categories,brands,products,productVariations,coupons,suppliers,analytics,inventory,loyalty}.ts`, and any `routes/*` files using `requireManagerPrivilegeCheck`.
- **Public surfaces**: catalog/product/category/brand routes, auth routes, `/contact`, public cart/session APIs, public object serving.
- **Authenticated customer surfaces**: `/auth/me`, `/auth/profile`, order history/detail, wishlist/comparison/recently-viewed, loyalty history, reviews.
- **Manager/admin surfaces**: `/admin/*`, `/users*`, `/managers*`, inventory, analytics, supplier, media mutation, coupon/product/category/brand/order management.
- **Usually ignore unless reachability changes**: `artifacts/mockup-sandbox/**`, `scripts/**`, `attached_assets/**`.

## Confirmed Production Hotspots (2026-04-25)

- **Authentication/session integrity is currently a primary hotspot**. Customer, admin, and manager bearer tokens are unsigned base64 payloads in `artifacts/api-server/src/routes/auth.ts` and `artifacts/api-server/src/lib/managerAuth.ts`, and several routes trust decoded IDs directly. Future scans should treat custom token parsing and any new token consumer as high priority until a real server-validated session mechanism exists.
- **Authorization coverage is broadly inconsistent**. The manager gate in `artifacts/api-server/src/lib/managerAuth.ts` currently allows any non-manager `Authorization` header through the privilege check path, and many admin/business routes have no server-side auth at all. New routes added under `admin`, `users`, `orders`, `analytics`, `inventory`, `loyalty`, `suppliers`, `ads`, `siteSettings`, and catalog-management files should be assumed high risk until verified.
- **Content and file surfaces are high risk**. `artifacts/api-server/src/routes/media.ts` and `artifacts/api-server/src/routes/storage.ts` are production-reachable and must be reviewed for both mutation authorization and file-serving ACL enforcement. `artifacts/api-server/src/app.ts` also matters because it publishes uploaded files under `/api/uploads/*`.
- **Mail and messaging flows remain security-sensitive**. `artifacts/api-server/src/routes/auth.ts` constructs password-reset links from request headers, while `artifacts/api-server/src/lib/mail.ts` handles inbound HTML email and outbound SMTP/IMAP transport settings. Future scans should continue to prioritize reset-link construction, HTML sanitization, and mail transport verification.
- **Cart/session isolation needs explicit review**. `artifacts/api-server/src/routes/cart.ts` trusts caller-supplied session identifiers and has a dangerous default-session fallback that interacts with loyalty data, so cart/session state should not be treated as isolated unless proven.
- **Production exclusions remain unchanged**. `artifacts/mockup-sandbox/**`, `scripts/**`, and `attached_assets/**` remain out of production scope unless a future code change proves live reachability.

## Threat Categories

### Spoofing

The application uses custom bearer tokens for customers and managers instead of a standard signed session mechanism. The system must ensure every protected endpoint validates bearer tokens as authentic, non-forgeable, and bound to the intended subject. Password reset links and email-based registration flows must only generate links and codes that cannot be guessed, replayed, or misdirected through attacker-controlled request metadata.

### Tampering

Customers can influence carts, coupons, loyalty redemption, profile updates, contact submissions, and file uploads. Managers can influence products, inventory, supplier data, site settings, media, and messaging. The backend must treat all client input as hostile, enforce business rules server-side, constrain file upload type/size/path, and prevent unauthorized changes to commercial data or operational settings.

### Information Disclosure

This codebase stores and exposes PII, support messages, orders, analytics, manager records, and object-storage files. API responses, exports, and file-serving endpoints must only return data to authorized callers. Logs, emails, and error responses must not leak secrets or sensitive internals. Private object storage paths must remain unreadable without explicit authorization.

### Denial of Service

Public-facing auth, password reset, contact, upload, and search-like endpoints can be abused to consume CPU, storage, mailbox quota, or database resources. The production system should bound request size, file size, upload count, polling frequency, and brute-force attempts, especially for OTP/password-reset and file/media paths.

### Elevation of Privilege

The platform has a strong privilege boundary between shoppers, authenticated customers, managers, and admins. All admin, manager, analytics, export, inventory, user-management, support-mail, and content-management operations must enforce server-side authorization based on trusted identity and privilege records. Any route that relies on frontend routing, bearer-token parsing without integrity protection, or inconsistent helper behavior risks full privilege escalation.
