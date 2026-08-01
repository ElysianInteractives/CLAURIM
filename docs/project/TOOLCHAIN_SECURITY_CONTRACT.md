# Toolchain security contract

Plan 10 resolves QLT-004 and locks D-032. This contract covers development
and build tooling only; it does not authorize gameplay, runtime dependency,
content, protocol, save, or server changes.

## Supported toolchain

- `package.json` requires Node `^20.19.0 || >=22.12.0`, matching the Vite 8
  engine floor. Plan 10 qualification uses Node 26.0.0 and npm 11.12.1.
- Direct build/test tools are Vite `^8.2.0` and Vitest `^4.1.10`. Their exact
  resolved graph and integrity hashes are committed in `package-lock.json`.
- Vite 8's Rolldown/Oxc pipeline replaces the old Rollup/esbuild build path.
  Claurim keeps its explicit `es2022` production target and relative base.
- Vitest 4 uses Vite's module runner. Claurim does not rely on the removed
  `vite-node` entrypoint, deprecated mock signatures, browser runner, or
  coverage options.
- Production dependencies remain `three` and `ws`; Plan 10 does not upgrade or
  broaden the shipped runtime graph.

## Security checks

- `npm run audit:deps` audits the complete installed graph at moderate or
  higher severity.
- `npm run audit:prod` independently audits the production-only graph at the
  same threshold.
- Both commands must report zero known vulnerabilities for Plan 10 acceptance.
  They remain separate from `npm run gate` because the npm advisory service is
  networked and time-varying; record their dated result in `QA_BASELINE.md`.
- Future advisory fixes may update a tool within its compatible range. A new
  major version, Node floor change, production dependency change, or audit
  exception requires a new locked package and fresh compatibility evidence.
- Audit suppression, `--force`, lockfile deletion, and downgrading the severity
  threshold are not accepted remedies.

## Compatibility checks

The complete acceptance sequence is:

1. `npm ci` from the committed lockfile on a clean filesystem path.
2. `npm run audit:deps` and `npm run audit:prod`.
3. `npm run gate` for content/IP validation, strict typecheck, every test, and
   the Vite production build.
4. `npm run standalone` to prove the single-file packaging script still
   consumes Vite's output.
5. Start `npm run dev`, request `/`, `/src/main.ts`, and `/@vite/client`, and
   require HTTP 200 with JavaScript transformation intact.

On Windows, do not qualify Vitest 4 from the root of a substituted drive:
its module-runner URL can be mis-normalized as `R:\@id\R:\...`. This is a
test-workspace path artifact, not an application failure; use a real short
path for the clean-install gate.
