# ADR-012: Admin Authentication Strategy

## Status

Accepted

## Context

CLOUD-01B shipped the Control Plane Core with no authentication at all - every route is
unauthenticated by design (see [ADR-011](./ADR-011-openapi-as-contract-with-pos-admin-web.md)'s
security note). CLOUD-01C-A needs to establish administrative identity and login without yet
building RBAC, protecting existing routes, or implementing installation-device authentication
(separate concerns, deferred to CLOUD-01C-B and beyond - see
[admin-authentication.md](../architecture/admin-authentication.md)).

The options considered for session strategy:

1. **Stateless JWT only** (long-lived, no server-side session record) - simplest to implement, but
   revocation is impossible before expiry (logout, credential compromise, or replay cannot actually
   end a session early) unless a separate blocklist is introduced anyway - at which point it is no
   longer truly stateless.
2. **Server-side session only** (e.g. a session id in Redis/PostgreSQL, no JWT) - trivially
   revocable, but every request pays a session-store round trip, and there is no natural way to
   scale the "current identity" check to a future stateless consumer (e.g. a different service
   validating the same token without querying the session store).
3. **Short JWT access token + opaque rotating refresh session (chosen)** - the access token is
   stateless and cheap to verify (no DB hit) for the 15-minute window it is valid; the refresh token
   is a real, revocable PostgreSQL row, so logout/replay/compromise can actually end a session
   instead of only expiring naturally.

## Decision

- **Access token**: JWT, HS256, 15-minute default TTL, `sub`/`sid`/`typ` claims only - never a
  password, hash, or refresh material. Verified with pinned issuer/audience/algorithm.
- **Refresh token**: opaque (`<sessionId>.<secret>`, 256 bits of random entropy in `secret`), never
  a JWT. Transported only as an `HttpOnly`/`SameSite=Lax` cookie scoped to `/api/v1/auth`, never
  returned in a JSON body.
- **Password hashing**: Argon2id (the `argon2` npm package), OWASP-floor parameters (19456 KiB
  memory, timeCost 2, parallelism 1) - see [admin-authentication.md](../architecture/admin-authentication.md#password-hashing)
  for the exact values and the library-choice fallback plan if a platform-specific native-binary
  problem had appeared (none did: `argon2`'s prebuilt N-API binaries covered Windows dev, Linux/
  Alpine Docker, and Node 24 cleanly).
- **Refresh-session authority: PostgreSQL, not Redis.** Redis is already part of this stack, but
  session state here is security-critical, must survive a Redis restart/eviction without silently
  logging out (or worse, silently _not_ revoking) an admin, and already needs to participate in a
  real ACID transaction with row-level locking for atomic rotation (`SELECT ... FOR UPDATE` - see
  `AdminSessionUnitOfWork`). PostgreSQL already provides both durability and that transactional
  guarantee; Redis would need to reimplement both (e.g. via `WATCH`/`MULTI` or Lua scripting) for no
  benefit over what PostgreSQL already does natively. Redis remains available for a future, purely
  performance-motivated cache in front of this if session-lookup latency ever becomes a real
  problem - not needed yet.
- **Refresh rotation is mandatory, not optional**: every successful `POST /auth/refresh` issues a
  new session and revokes the old one, recording `replacedBySessionId` to form a chain. This is what
  makes replay detection possible at all (see below) - a refresh strategy that reused the same
  refresh token indefinitely would have no way to distinguish a legitimate second use from a stolen
  one.
- **Replay/reuse response is account-wide, not session-specific**: presenting an already-rotated
  (revoked) refresh token whose secret still hashes correctly is treated as proof of compromise for
  that AdminUser, not just that one session - every other active session for the same user is
  revoked. A narrower response (revoke only the replayed session) would leave an attacker's
  concurrently-stolen sessions untouched.
- **Bootstrap-only account creation**: no `POST /auth/register` exists or is planned. The very first
  AdminUser is created exclusively via an operator-run CLI tool
  (`admin:bootstrap`), refusing to run a second time. Any HTTP-reachable
  account-creation endpoint would need to be authenticated by _something_ that doesn't exist yet
  (there is no admin to authenticate the request that creates the first admin) - bootstrap avoids
  that chicken-and-egg problem entirely instead of working around it with a one-time setup token or
  similar.

## Trade-offs

- Every access-protected request still costs one JWT verification (cheap, no I/O) but zero database
  round trips; only login and the (relatively rare) refresh call touch PostgreSQL for
  authentication purposes.
- A compromised access token cannot be revoked before its 15-minute expiry - this is an accepted,
  bounded exposure window in CLOUD-01C-A, not an oversight; shortening it further, or adding an
  access-token revocation list, is realistic future hardening if the threat model demands it.
- The refresh cookie's `Path=/api/v1/auth` scoping means it is never sent to any other route,
  including the (currently unauthenticated) Customers/Licenses/Installations business routes -
  intentional isolation, not an accident of the default cookie path.
- HS256 (symmetric) is adequate for this modular monolith, where only `apps/api` ever needs to
  verify an admin access token. If a separate service ever needs to verify tokens without holding
  the signing secret, migrating to RS256/ES256 (asymmetric) becomes the relevant future decision -
  not made here, since no such consumer exists yet.

## Future hardening (explicitly out of scope for CLOUD-01C-A)

Rate limiting on `/auth/login`/`/auth/refresh`, MFA/TOTP, password recovery/email verification,
access-token revocation before natural expiry, RBAC (roles/permissions - CLOUD-01C-B), and blanket
Control Plane route protection (also CLOUD-01C-B). See
[admin-authentication.md](../architecture/admin-authentication.md#not-implemented-in-cloud-01c-a)
for the complete list.
