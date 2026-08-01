# Authentication threat model (D-028)

Plan 6 replaces `charId`-as-identity with a bounded account and session
boundary. This document is the locked security contract for the slice. It
does not claim to be a complete live-service identity platform.

## Assets and trust boundaries

- Passwords and their derived records authenticate accounts.
- Opaque session tokens authorize a short-lived connection without replaying
  a password.
- Account-to-character ownership determines which persistent character the
  authoritative simulation may load.
- Character and world saves remain server-owned and are never accepted from
  the online browser.
- Browser/WebSocket input is untrusted. `AuthGateway` is the only path from a
  WebSocket to `ServerCore`; `ServerCore` also checks the authenticated
  identity before honoring `hello`.
- The server data directory and deployment environment are operator-trusted.

## Locked flow

1. A new socket has no `ServerCore` client and can send only `register`,
   `login`, or `resume` authentication messages.
2. Registration creates one account-owned character. Passwords are never
   persisted or logged; the stored record is scrypt with a random 16-byte
   salt, `N=131072`, `r=8`, `p=1`, and a 64-byte key.
3. Login returns the same public failure for an unknown username and an
   incorrect password. A dummy scrypt verification reduces the timing
   distinction. Expensive scrypt work is serialized to bound server memory.
4. Success issues a 32-byte CSPRNG token (256 bits, base64url on the wire).
   Only its SHA-256 digest is kept server-side. Sessions have an eight-hour
   absolute lifetime and a five-session-per-account cap.
5. Resume consumes the prior token and returns a replacement. Replaying the
   consumed token fails. Sessions are deliberately memory-only, so a server
   restart signs every connection out.
6. Only after success does `AuthGateway` create a `ServerCore` connection.
   `hello` can select only a character in that account's authenticated
   ownership list; the display name also comes from that server-owned list.
7. The browser keeps credentials only until authentication succeeds and keeps
   the session token only in JavaScript memory. Neither enters localStorage,
   sessionStorage, cookies, logs, or the URL.

## Abuse and transport controls

- Passwords accept 15–128 Unicode code points (up to 512 UTF-8 bytes), spaces,
  paste, and password managers. There are no composition or periodic-change
  rules. A small embedded common-password denylist is a baseline, not a
  breached-password service.
- Login attempts are independently limited per normalized username and per
  source address. Registration and session-resume paths have their own source
  limits. Public login failures are generic.
- Authentication messages are capped at 2 KiB and all WebSocket messages at
  8 KiB; the WebSocket adapter enforces the same maximum payload.
- Plain `ws://` is accepted only on loopback for development. Remote traffic
  must be encrypted directly or arrive through an explicitly trusted HTTPS
  proxy (`CLAURIM_TRUST_PROXY=1`). Forwarded source addresses are ignored
  unless that trust switch is set and the first value is a valid IP address.
- Browser origins outside loopback must exactly match an entry in
  `CLAURIM_ALLOWED_ORIGINS` (comma-separated origins). Origin-less native QA
  clients are allowed because the protocol has no ambient cookie authority.
- `auth.json` uses atomic replacement and requests owner-only (`0600`)
  permissions where the filesystem supports POSIX modes.

## Threat cases and evidence

| Threat | Control | Evidence |
|---|---|---|
| Claim another character by knowing its ID | Authenticated ownership check in `ServerCore` | `tests/authentication.test.ts` cross-account claim |
| Send gameplay before authentication | Gateway creates no core connection | unauthenticated `hello` test |
| Steal plaintext password from persistence | Salted scrypt record only | persistence/restart and production-hasher tests |
| Replay a stolen/old session token | Digest-only storage, absolute expiry, rotation on resume | rotate/replay/expiry tests |
| Enumerate accounts through login text | Generic missing/wrong response and dummy verify | generic-failure test |
| Online guessing or registration flood | Account/source rate limits and bounded scrypt queue | independent account-limit test |
| Send credentials over remote plaintext | fail-closed transport check | secure-transport tests |
| Abuse browser connection cross-origin | explicit remote origin allowlist | origin-policy tests |
| Inflate parser/resource use | adapter and gateway byte caps | protocol boundary plus WebSocket smoke |

## Deliberate remaining limits

- There is no email verification, account recovery, password reset, MFA,
  administrative account tooling, security-event audit trail, or external
  breached-password lookup.
- FileStorage is a single-process milestone store. It provides no database
  transactions, horizontal session sharing, backup policy, or online schema
  migration service.
- The Node host does not manage production certificates. A deployment must
  provide a correctly configured TLS terminator, allowed-origin list, secret
  filesystem permissions, monitoring, backups, and denial-of-service controls
  outside this process.
- A password change/revocation interface is not yet exposed. Restarting the
  server invalidates all sessions as the current emergency revocation path.

These limits keep public operations and account-recovery work explicitly
outside Plan 6; they must be locked before an Internet service is announced.

## Standards basis

- [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html) for
  password length, Unicode/paste support, blocklists, and rate limiting.
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
  for the scrypt fallback parameters when Argon2id is unavailable.
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
  for generic login errors and throttling.
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
  for CSPRNG opaque tokens, server-side meaning, and secure transport.
- [Node.js crypto documentation](https://nodejs.org/api/crypto.html) for
  `scrypt`, `randomBytes`, and constant-time comparison behavior.
