# Codex Change Plan — Factory Ledger

**Started:** 9 October 2026
**Purpose:** A living production-readiness plan for the remaining work on Factory Ledger. This file distinguishes code changes Codex can implement safely from business decisions and operational checks that require the owner, client, accountant, Firebase account, or real devices.

## Current release decision

**Do not ship publicly yet.** The app is a strong candidate for a controlled single-business pilot after the required code fixes and business validation below. Multi-device use and public distribution remain blocked until their dedicated validation gates pass.

## Work Codex will implement

### Completed in this change set

- [x] Count every synced collection (`parties`, `dispatches`, `payments`, `pos`, `lots`, and `mines`) when deciding whether cloud data exists. This prevents inventory-only accounts from being classified as empty during reconciliation or account selection.
- [x] Add regression tests for inventory-only cloud data and full collection counts.
- [x] Apply the existing escalating lockout to failed offline recovery-key guesses, not only failed PIN guesses.
- [x] Add security regression coverage for recovery-key lockout and valid-key recovery.
- [x] Correct the synthetic fixture and test labels so they no longer claim to be verified real factory slips.
- [x] Explicitly disable clear-text network traffic for the Android application; Firebase and supported export/share flows use encrypted platform transport.
- [x] Prevent an optional browser persistent-storage permission request from blocking ledger startup forever, and give the Summary screen a recoverable load error with retry instead of a permanent spinner.
- [x] Add a regression test for a persistent-storage request that never resolves.

### Next safe engineering work

- [x] Rename the synthetic settlement fixture to `synthetic-scenarios.json` and update its only test reference.
- [ ] Add a dedicated sync integration test that covers fresh-device restoration and account-conflict handling where the cloud contains only lots and/or mines.
- [ ] Clean the remaining lint warnings, prioritising React effect warnings.
- [x] Remove unused imports and unused catch bindings identified by the linter.
- [x] Correct the `CoalSourceModal` memo/callback dependencies so availability recomputes from the current dispatch context without stale closures.
- [ ] Split the largest UI modules when they are next modified (`Settings`, `PartyLedger`, `DispatchForm`, and export generation) to reduce change risk and simplify testing.
- [x] Add `npm run verify:release`: enforces JDK 21+, requires signing material and `apksigner`, then lints, tests, builds, syncs Capacitor, assembles the release APK, and verifies its signature.
- [ ] Assess R8/minification with a release build and retain it only after Google sign-in, Capacitor plugins, exports, and biometrics are verified in the minified build.
- [ ] Keep README implementation claims aligned with the code; remove claims that cannot be traced to a tested feature.

## Business decisions required before Codex changes money rules

Codex will not guess these because each changes settlements, invoices, or inventory value. Obtain the client's answer in writing, then record it in tests and the README.

- [ ] Whether mine-to-yard freight belongs in landed cost.
- [ ] Whether moisture, ash, sulphur, or other penalties can apply in addition to pro-rata GCV adjustment.
- [ ] Whether above-target GCV earns a premium or caps at the contract rate; include any tolerance bands/minimums.
- [ ] Whether factory calculations round adjustments to whole rupees or paisa; make the form and calculation defaults agree.
- [ ] Whether negative stock is a valid “dispatch before purchase entry” workflow or should be blocked.
- [ ] Whether stock is managed as distinct purchase lots or as an aggregated supplier pool.

## Evidence required for a pilot

- [ ] Supply at least five anonymised, genuine factory settlement slips. Each fixture must identify its slip/date/source without exposing private party data, and expected values must come from the paper—not from the app.
- [ ] Compare every supplied slip with the app. Investigate and document every mismatch before changing calculations.
- [ ] Confirm the existing-install Manual Tax migration notice on the client’s device.
- [ ] Run a signed release APK on the real target phone: Google sign-in, biometric unlock, passcode recovery, receipt/image/PDF/Excel sharing, backup import/export, and recent-apps privacy.
- [ ] Run the real Firebase two-device test: create/edit/delete, offline edits, conflict resolution, cleared fields, lot consumption, settings separation, force-close recovery, and report parity.
- [ ] Keep weekly JSON backups and run a two-week single-phone pilot with a log of any unexpected number or workflow issue.

## Required before public sale or broad deployment

- [ ] Pass every pilot requirement above.
- [ ] Confirm the GitHub Actions pipeline is green, including Firestore rules tests under JDK 21.
- [ ] Deploy and verify the intended Firestore rules in the real Firebase project; confirm legacy PIN fields are absent from cloud settings documents.
- [ ] Write and publish a privacy policy using the real publisher name, support contact, Firebase project, data-retention policy, and applicable legal advice. Do not publish a generic placeholder as a legal policy.
- [ ] Record accountant/client sign-off for the money calculations and 10 genuine settlement slips.
- [ ] Establish a support, backup, incident-recovery, and release-version process.

## Constraints and product scope

- The app lock is a convenience/privacy control, not encryption at rest. Its effectiveness depends on device/OS protections; it is not appropriate as the only control for regulated data.
- The ledger is single-entry commercial accounting, not a double-entry general ledger.
- Multi-device conflicts use per-record newest-timestamp-wins behavior. Automatic date/time must stay enabled on every device.
- No code change should silently alter historical settled dispatch values without an explicit business rule and migration decision.

## Completion rule

When an item is completed, update this file, `ISSUES_AND_FIXES_PART_4.md`, and `SOLVED_ISSUES_PART_4.md` with the affected files and verification evidence. Do not mark operational/client items complete based only on a unit test.
