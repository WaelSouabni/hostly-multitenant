# Hostly implementation status

Implemented in develop:
- Credentials authentication with tenant-aware authorization and host approval.
- Super Admin host creation and tenant status management.
- Tenant-scoped property CRUD and publication.
- Manual blocked dates and availability queries.
- Seasonal/weekend/minimum-night pricing rules.
- Promo codes.
- Server-side booking calculation and PostgreSQL advisory lock + serializable transaction to prevent concurrent double booking.
- Host dashboard, booking status operations and invoice generation.
- Public booking tunnel.
- Stripe Connect Express onboarding, Checkout on connected accounts and webhook confirmation.
- Vitest unit test + Playwright smoke test.
- GitHub Actions CI with PostgreSQL, typecheck, lint, unit and E2E tests.

Still required before production:
- Email verification/password reset and production email provider.
- Full shadcn/ui admin UX, rich calendar/Gantt, image upload/storage.
- Legal invoice rules for the exact jurisdiction, VAT/tourist-tax configuration and PDF rendering.
- Stripe webhook idempotency/event persistence and payment/refund lifecycle.
- End-to-end Stripe test with Stripe CLI/test account.
- Database migration generated from the final schema and production backup/rollback procedure.
- CI must be observed on GitHub and any real failures corrected before declaring develop stable.
