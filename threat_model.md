# Threat Model

## Project Overview

This project is a pnpm TypeScript monorepo for a Hebrew RTL e-commerce platform. The production application consists of an Express 5 API server in `artifacts/api-server`, a React/Vite storefront and admin UI in `artifacts/store`, PostgreSQL via Drizzle in `lib/db`, generated API schemas/clients in `lib/api-zod` and `lib/api-client-react`, and object storage access through `artifacts/api-server/src/lib/objectStorage.ts`.

Users include unauthenticated shoppers, authenticated customers, and privileged admin/manager users. The platform handles catalog browsing, carts, orders, loyalty points, support messages, media management, supplier/inventory operations, and email-based account workflows.

Production assumptions for future scans:
- `NODE_ENV=production` in deployed environments.
- Platform TLS protects client-to-server traffic in production.
- `artifacts/mockup-sandbox` is development-only and should be ignored unless production reachability is demonstrated.

## Assets

- **User accounts and sessions** — customer and manager/admin identities, bearer tokens, password hashes, password reset tokens, OTP flows, and account activation state. Compromise enables impersonation and privileged access.
- **Customer PII** — names, emails, phone numbers, addresses, order history, loyalty balances, and support correspondence. Exposure creates privacy and fraud risk.
- **Commercial data** — order totals, coupon settings, inventory levels, product pricing, supplier records, analytics, and exports. Tampering directly affects revenue and fulfillment.
- **Administrative capabilities** — manager privilege assignments, site settings, media uploads, messaging functions, and import/export endpoints. Abuse can change storefront content or leak operational data.
- **Application secrets and integrations** — SMTP/IMAP credentials, database access, object storage access, and any signed object URLs. Leakage can expose external systems or private data.
- **Stored files and objects** — uploaded media plus object-storage content served through `/storage/public-objects/*`, `/storage/objects/*`, and `/api/uploads/*`. Misclassification or missing ACL enforcement can disclose or overwrite files.

## Trust Boundaries

- **Browser to API** — all request bodies, query params, headers, uploaded files, and origins are untrusted. The API must authenticate and authorize every sensitive operation server-side.
- **API to PostgreSQL** — route handlers have broad read/write access to business data. Authorization bugs or injection at the API layer can become full data compromise.
- **API to SMTP/IMAP providers** — support mail and auth emails cross into third-party infrastructure using stored credentials. HTML handling, transport security, and link construction matter here.
- **API to object storage and filesystem-backed uploads** — presigned uploads, object reads, and `/api/uploads/*` serving cross from application trust into stored content. Upload validation, response headers, ACL metadata, and read authorization must be enforced explicitly.
- **Public to authenticated to manager/admin surfaces** — storefront browsing is public, account/cart/order functions are customer-scoped, and admin/manager routes must be restricted and privilege-checked server-side.
- **Production to dev-only surfaces** — `artifacts/mockup-sandbox`, many files in `attached_assets`, and one-off scripts are not production scope unless proven otherwise.

## Scan Anchors

- **Production entry points**: `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/*.ts`, `artifacts/store/src/main.tsx`, `artifacts/store/src/App.tsx`.
- **Highest-risk server areas**: `routes/auth.ts`, `lib/managerAuth.ts`, `routes/admin.ts`, `routes/users.ts`, `routes/orders.ts`, `routes/messages.ts`, `routes/siteSettings.ts`, `routes/storage.ts`, `routes/media.ts`, `routes/cart.ts`, `routes/ads.ts`, `routes/{categories,brands,products,productVariations,coupons,suppliers,analytics,inventory,loyalty}.ts`, and any route using `requireAdminOrManager()` or `requireManagerPrivilegeCheck()`.
- **Public surfaces**: catalog/product/category/brand routes, auth routes, `/contact`, public cart/session APIs, `/api/uploads/*`, and public object serving.
- **Authenticated customer surfaces**: `/auth/me`, `/auth/profile`, order history/detail, wishlist/comparison/recently-viewed, loyalty history, reviews.
- **Manager/admin surfaces**: `/admin/*`, `/users*`, `/managers*`, inventory, analytics, supplier, media mutation, coupon/product/category/brand/order management, site settings, and imports.
- **Usually ignore unless reachability changes**: `artifacts/mockup-sandbox/**`, `scripts/**`, `attached_assets/**`.

## Confirmed Production Hotspots (2026-04-25)

- **Authentication and session integrity remains a primary hotspot**. `artifacts/api-server/src/lib/managerAuth.ts` now HMAC-signs customer and manager tokens, so the older unsigned-token integrity concern is stale. However, the custom bearer-token design still has major weaknesses: tokens are effectively permanent because verification does not enforce expiry, logout does not revoke them, and password resets do not invalidate existing sessions. `artifacts/api-server/src/routes/auth.ts` also still contains a live `/auth/register` path that bypasses the storefront OTP sign-up flow, allows multiple concurrent password-reset links for the same account, stores passwords with a fast hard-coded SHA-256 scheme, and exposes enumeration/brute-force surfaces that future scans should keep prioritizing.
- **Authorization coverage is still inconsistent and should be treated as high risk by default**. The main current pattern is not unsigned tokens but route-level privilege mistakes: multiple mutation routes use `requireAdminOrManager()` and therefore ignore the finer-grained manager privilege model in `lib/db/src/schema/managers.ts`. There is also at least one fully unauthenticated business mutation (`POST /api/products/:id/duplicate`) and a public variation endpoint that leaks internal product data. New or changed routes in `admin`, `users`, `inventory`, `loyalty`, `ads`, `siteSettings`, `products`, and `productVariations` should be assumed risky until proven otherwise.
- **Content and file surfaces are a confirmed code-execution and phishing hotspot**. `artifacts/api-server/src/app.ts` publishes uploaded files under `/api/uploads/*`, and `artifacts/api-server/src/routes/media.ts` trusts multipart MIME metadata while preserving attacker-controlled file extensions, enabling same-origin hosting of active HTML/SVG content. Separately, rich HTML from product descriptions and public site-info pages is stored server-side and rendered with `dangerouslySetInnerHTML` in `artifacts/store/src/pages/product-detail.tsx` and `artifacts/store/src/pages/info-page.tsx`, making stored XSS a recurring risk. Inbound HTML email rendered in the admin message center is also security-sensitive because styling and links survive sanitization well enough to support phishing/UI-redress in privileged browsers.
- **Cart, coupon, and loyalty state need explicit review on every scan**. `artifacts/api-server/src/routes/cart.ts` and `artifacts/api-server/src/routes/orders.ts` allow value-bearing state to drift between a caller-controlled session ID and the final authenticated order identity. Confirmed examples include loyalty discounts that can be applied to guest checkouts without spending the matching points and coupon per-user limits that are bypassed during guest checkout. Session-scoped commerce logic should therefore be treated as a standing hotspot even where classic IDOR is not proven.
- **Mail and reset-link handling needs continued monitoring, but one previously documented issue is mitigated**. Password-reset links are now built from `APP_URL` rather than request headers, so the older host-header-based reset-link issue should not be re-reported unless the implementation changes again. The remaining mail risk is primarily unsafe rendering of inbound HTML and abuse potential in public auth/email flows.
- **Production exclusions remain unchanged**. `artifacts/mockup-sandbox/**`, `scripts/**`, and `attached_assets/**` remain out of production scope unless a future code change proves live reachability.

## Threat Categories

### Spoofing

The application uses custom HMAC-signed bearer tokens for customers and managers instead of a standard session framework. The system must ensure every protected endpoint validates tokens as authentic, time-bounded, revocable when account state changes, and bound to the intended subject. Email-based registration and password-reset flows must only generate codes and links that cannot be guessed, replayed, or reused after recovery.

### Tampering

Customers can influence carts, coupons, loyalty redemption, profile updates, contact submissions, and file uploads. Managers can influence products, inventory, supplier data, site settings, media, and messaging. The backend must treat all client input as hostile, enforce business rules server-side, constrain file upload type/size/path, sanitize or isolate rendered HTML, and prevent unauthorized changes to commercial data or operational settings.

### Information Disclosure

This codebase stores and exposes PII, support messages, orders, analytics, manager records, supplier data, internal product economics, and stored files. API responses, exports, and file-serving endpoints must only return data to authorized callers. Public catalog-adjacent endpoints must not leak cost price, stock posture, hidden variants, or private storage content.

### Denial of Service

Public-facing auth, password reset, contact, upload, and search-like endpoints can be abused to consume CPU, storage, mailbox quota, or database resources. The production system should bound request size, file size, upload count, polling frequency, and brute-force attempts, especially for OTP/password-reset and file/media paths.

### Elevation of Privilege

The platform has a strong privilege boundary between shoppers, authenticated customers, managers, and admins. All admin, manager, analytics, export, inventory, user-management, support-mail, and content-management operations must enforce server-side authorization based on trusted identity and explicit privilege records. Any route that trusts a broad “any manager” gate where section-specific privileges exist, or that exposes active same-origin content from attacker-controlled uploads, should be treated as a high-priority escalation path.