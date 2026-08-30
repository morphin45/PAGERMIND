# ADR-003: Sandbox authentication, real authorization

## Status
Accepted

## Date
2026-02-15

## Context
The demo must show `authenticated ≠ authorized` without shipping a fake
password system (which would be security theater and a rules violation —
no credentials in the submission).

## Options considered

### Option 1 — Email/password accounts
Security theater at sandbox scale; invites real password-handling flaws;
violates the spirit of "no credentials in the submission".

### Option 2 — Asserted identity + sessions + service-side role checks
Reviewer picks a roster identity; a session token is issued; **all** role
checks happen in `services.ts`; denials return `403` *and* are written to
the audit ledger. The swap point for a real IdP is one function.

### Option 3 — No auth at all
Cannot demonstrate the authorization boundary the rubric and ground rules
require.

## Decision
Option 2.

## Reason
Demonstrates the boundary that matters (role enforcement + denial auditing)
without pretending to be an identity provider. Honest, and explicitly
labeled "sandbox roster" in the UI.

## Consequences
- Easier: zero secrets, testable authz (401/403 paths in vitest).
- Harder: identity assertion is trust-based — acceptable for synthetic data,
  and the IdP swap point is documented in `docs/ARCHITECTURE.md`.

## Alternatives rejected
Option 1 was theater; option 3 skipped a graded requirement.
