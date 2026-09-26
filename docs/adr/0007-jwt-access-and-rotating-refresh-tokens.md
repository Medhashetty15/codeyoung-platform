# 0007 - Email/password auth with stateless JWT access and rotating opaque refresh tokens

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Author
- **Related:** [03 - Backend design §6](../03-backend-design.md), [05 - Frontend design §10](../05-frontend-design.md)

## Context

- Parents need accounts to book and manage bookings. Requested: simple email + password with a JWT
  access token and a refresh token, standard expiry.
- The SPA must not store long-lived credentials where scripts can read them (XSS exposure).
- Scope: forgot/reset and change password are in the MVP; "log out of all devices" and email
  verification are not.

## Decision

- **Passwords:** argon2id (OWASP parameters), rehash on login when parameters change; policy 8 to 128 chars,
  not in a common-password list, not containing the email local part.
- **Access token:** JWT HS256, 15 minutes, claims `sub`, `sid`, `role`, `iss`, `aud`. Kept in SPA memory only.
  Verified **statelessly** (no DB lookup per request).
- **Refresh token:** opaque 256-bit random value, stored as SHA-256 hash, 7-day lifetime, **rotated on
  every use**, session hard cap 30 days. Sent as `httpOnly`, `Secure`, `SameSite=Strict` cookie scoped to
  `/api/v1/auth`. Cookie endpoints also require `X-Requested-With` (CSRF defence).
- **Reuse detection:** presenting an already-used refresh token revokes the whole session, except within a
  20-second grace window that tolerates parallel tabs refreshing together.
- **Brute force:** per-IP and per-email rate limits; 10 failures in 15 minutes locks login for 15 minutes;
  identical responses and timing for unknown email vs wrong password.
- **Password reset/change** revokes other sessions' refresh tokens.
- SPA and API are served same-site (proxy in dev, one domain in prod).

## Alternatives considered

| Option | Why not |
|--------|---------|
| JWT refresh token | Cannot be revoked without a denylist; leaks claims if stolen; opaque + hashed is simpler and safer. |
| Tokens in `localStorage` | Readable by any injected script. |
| Server sessions only (cookie session id) | Valid choice; JWT access tokens were requested and keep the API stateless for reads. |
| Per-request session check | Gives instant revocation, but its main driver (logout-all) is out of MVP scope; costs a DB hit per request. |
| Passport strategies | Extra indirection for two flows we implement directly with `@nestjs/jwt`. |
| Magic-link / OAuth | Not requested; adds email dependency to every login or third-party setup. |

## Consequences

**Positive**
- Stolen access tokens expire in 15 minutes; stolen refresh tokens are detected on reuse.
- No DB hit on authenticated reads.

**Negative / accepted trade-offs**
- After logout, password change or reset, an already-issued access token keeps working until it expires (at most 15 minutes).
- Requires same-site deployment for the strict cookie.
- No email verification: a mistyped email means the parent misses emails (mitigated by on-screen details and My bookings).

## Revisit when

"Log out of all devices", admin/mentor roles, or stricter compliance needs arise (add a per-request
session check or short-TTL cache); or cross-site hosting becomes necessary.
