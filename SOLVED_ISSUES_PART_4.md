# Factory Ledger: Solved Issues & Implementation Archive (Part 4)

> **Application:** Factory Ledger (`com.factoryledger.app`)
> **Review Baseline:** Commit `7328618`, following `ISSUES_AND_FIXES_PART_4.md` (Issues 37–48)
> **Purpose:** Detailed historical record of all Part 4 post-features code review issues resolved in the repository.

---

## Table of Contents

- [Issue 37: Pro-Rata Deduction & Premium Display Across Receipts, Exports, and Shares](#issue-37)
- [Issue 38: False "Overdrawn" Warning When Editing Existing Dispatches](#issue-38)
- [Issue 39: Per-Lot Overdraw Aggregation Across Multi-Row Coal Blends](#issue-39)
- [Issue 40: Local Timezone Date String Guard in Inventory & CI Tripwire](#issue-40)
- [Issue 41: Documentation Alignment with Active Implementation](#issue-41)
- [Issue 42: Real-World Factory Paper Slips Verification](#issue-42)
- [Issue 43: Physical Hardware APK, Real Firebase Sync, and Pilot Validation](#issue-43)
- [Issue 44: Client Consultation & Business Rules Confirmation](#issue-44)
- [Issue 45: Default Tax Method Settings Migration for Existing Devices](#issue-45)
- [Issue 46: Additional Penalties / Deductions in Pro-Rata Mode](#issue-46)
- [Issue 47: Inventory Follow-Ups (Adjustments, Supplier Summary, Repricing)](#issue-47)
- [Issue 48: Repo Hygiene, Leftover Tombstones, and Code Cleanups (48a–48g)](#issue-48)
- [Issue 49: Cloud Inventory Classification and Recovery-Key Lockout](#issue-49)
- [Issue 50: Stock-Lot Allocation, Landed-Cost Valuation, and iOS Workflow](#issue-50)
- [Issue 51: Bottom Navigation Liquid-Glass Treatment](#issue-51)
- [Issue 52 (F-01): Local Restore Confirmation (superseded as security control)](#issue-52)
- [Issue 53 (F-02): Sync Conflict Audit Logging and Non-Silent Merge Tracking](#issue-53)
- [Issue 54 (F-04): Complete Elimination of Browser Dialogs](#issue-54)
- [Issue 55 (F-05): Complete Purge of Gradients and Emojis](#issue-55)
- [Issue 56 (F-06): Native iOS 404 Catch-All Route](#issue-56)
- [Issue 57 (F-07): Production Chunk Size Warning Limit Tuning](#issue-57)
- [Issue 58 (F-01 follow-up): MFA-Gated Cloud Ledger Access](#issue-58)

---

### Issue 37: Pro-Rata Deduction & Premium Display Across Receipts, Exports, and Shares

- **Severity:** High (Paperwork & Settlement Transparency Discrepancy)
- **Status:** RESOLVED
- **Files Modified:**
  - `src/utils/calculations.ts`
  - `src/components/DispatchReceipt.tsx`
  - `src/components/DispatchPreviewModal.tsx`
  - `src/pages/DispatchForm.tsx`
  - `src/utils/exportSharing.ts`
  - `.github/workflows/ci.yml`
  - `tests/calculations.test.ts`

#### Detail of the Issue

Receipts, preview modals, WhatsApp text, PDF exports, and Excel exports read raw `dispatch.manualDeduction` / `dispatch.manualPremium` fields directly. For a pro-rata dispatch these fields are both `0` (never written), so the slip showed no GCV adjustment at all — the numbers were wrong and the settlement line was opaque.

#### How It Was Solved

1. Added `getEffectiveAdjustments(dispatch, settings)` to `calculations.ts` — calls `calculateSettlement()` and extracts the actual deduction/premium with `isProrata` flag and `ruleLabel`.
2. Added `buildDispatchSlipRows(dispatch, settings)` pure builder producing typed `DispatchSlipRow[]` for settlement slips.
3. All display sites updated to use `getEffectiveAdjustments()`: DispatchReceipt, DispatchPreviewModal, DispatchForm summary panel, and all four sites in exportSharing.ts.
4. CI tripwire added: `grep -rn ".manualDeduction|.manualPremium" src/components src/utils/exportSharing.ts` fails build if any display code bypasses `getEffectiveAdjustments`.
5. Tests T30 and T31 added covering pro-rata and manual dispatches respectively.

#### Verification Performed

- 107/107 tests pass
- Build clean (0 TS errors)
- CI guard validated

---

### Issue 38: False "Overdrawn" Warning When Editing Existing Dispatches

- **Severity:** High (UI Clutter & False Alarms on Saved Dispatches)
- **Status:** RESOLVED
- **Files Modified:**
  - `src/utils/calculations.ts`
  - `src/pages/DispatchForm.tsx`
  - `tests/inventory.test.ts`

#### Detail of the Issue

When editing a saved dispatch using 10 t from a 15 t lot, the form showed "5.0 t available" and triggered the overdraw warning because it included the current dispatch in allDispatches. True available was 15 t.

#### How It Was Solved

1. New pure function `calculateLotAvailabilityForDispatch(lot, allDispatches, draft)` in `calculations.ts`:
   - Filters out the draft dispatch by ID from allDispatches before computing available stock.
   - Sums ALL coal input rows in the draft referencing this lot (fixes Issue 39 simultaneously).
   - Returns `{ availableBeforeThis, draftUse, remainingAfter, isOverdraw }`.
2. DispatchForm updated to call this function and display correct "Xt available" and "Overdrawn by Xt".
3. `ledger_data_changed` listener added to keep allDispatches fresh.
4. Tests T32a–d covering all four cases from the reviewer's table.

#### Verification Performed

- All T32 sub-cases pass in npm run test.

---

### Issue 39: Per-Lot Overdraw Aggregation Across Multi-Row Coal Blends

- **Severity:** Medium (Silent Overdraws in Multi-Weighment Blends)
- **Status:** RESOLVED (part of Issue 38 solution)
- **Files Modified:**
  - `src/utils/calculations.ts`
  - `tests/inventory.test.ts`

#### How It Was Solved

`calculateLotAvailabilityForDispatch` aggregates all `draft.coalInputs` referencing the same `lotId` via `.reduce()`. Test T33 covers two rows of 8 t each from a 10 t lot → draftUse=16, overdrawn by 6.

---

### Issue 40: Local Timezone Date String Guard in Inventory & CI Tripwire

- **Severity:** Medium (Midnight UTC Date Drift in Pakistan Timezone UTC+5)
- **Status:** RESOLVED
- **Files Modified:**
  - `src/lib/devSeed.ts`
  - `.github/workflows/ci.yml`
  - `tests/inventory.test.ts`

#### Detail of the Issue

`devSeed.ts` used `d.toISOString().split('T')[0]` in its `dayAgo()` helper. Between midnight and 05:00 in Pakistan (UTC+5) this returns the previous day's date. The reviewer's grep found 4 matches in Inventory.tsx at the time of the review; these were already fixed in the working commit.

#### How It Was Solved

1. `devSeed.ts`: replaced `d.toISOString().split('T')[0]` with `toLocalDateString(d)`.
2. CI guard added: `grep -rn "toISOString().split" src` fails the build if this pattern is re-introduced.
3. Test T34 verifies `toLocalDateString()` returns the correct local calendar day at 02:00 local time.

#### Verification Performed

- `grep -rn "toISOString().split" src/` returns no matches.
- T34 passes.

---

### Issue 41: Documentation Alignment with Active Implementation

- **Severity:** Medium (Documentation Trust)
- **Status:** Pending (Phase I — deferred to after client call Issue 44)

Report claims per-supplier summary exists; code has a filter pill only. Will be corrected once Issue 47b is implemented or the claim is removed.

---

### Issue 42: Real-World Factory Paper Slips Verification

- **Severity:** High (Financial Calculation Confidence)
- **Status:** Pending (Requires real slips from the client)

The existing `tests/fixtures/real-slips.json` fixtures are synthetic. Real slips are needed to fill `paper` values from actual documents. Synthetic file to be renamed to `synthetic-scenarios.json` once real slips are added.

---

### Issue 43: Physical Hardware APK, Real Firebase Sync, and Pilot Validation

- **Severity:** High (Pre-Deployment Operational Gate)
- **Status:** Pending (Manual operational protocol — requires physical hardware)

Manual checklist:
1. CI Actions tab: all jobs green
2. Firebase console: four legacy PIN fields gone from `users/{uid}/settings/config`
3. Two-phone test (10-step table from the review)
4. Release APK test on the client's real phone
5. Two-week single-phone pilot with weekly JSON backups

---

### Issue 44: Client Consultation & Business Rules Confirmation

- **Severity:** Medium (Business Contract Alignment)
- **Status:** Pending (Requires one phone call with the client)

Questions for the call:
- Freight mine-to-yard: included in landed cost?
- Extra deductions on top of pro-rata (moisture, ash)?
- Premium above target GCV: paid or capped?
- Rounding convention: paisa or whole rupee?
- Negative stock: dispatches before entering purchases?
- Lot vs. supplier pool: how does the client think of stock?

---

### Issue 45: Default Tax Method Settings Migration for Existing Devices

- **Severity:** Low-Medium (Default Experience for Prior Installs)
- **Status:** RESOLVED
- **Files Modified:**
  - `src/pages/Settings.tsx`

#### Detail of the Issue

New installs default to `Manual` tax but existing users who already stored settings with `formula_18_5` keep the old default because `{ ...INITIAL_SETTINGS, ...parsed }` lets stored values win.

#### How It Was Solved

A one-time migration notice banner in `Settings.tsx`:
- Shown when `settings.defaultTaxMethod === 'formula_18_5'` AND `migrations.manualTaxNotice_v1` localStorage flag is absent.
- **"Switch to Manual"** → saves the setting immediately and sets the flag.
- **"Keep Formula"** → sets the flag without changing settings.
- Never appears again after either button is tapped.
- Styled with the iOS-orange colour scheme to communicate informational context (not an error).

#### Verification Performed

- Flag is set on both button paths.
- Banner only renders for the exact condition (formula default, no migration flag).
- `npm run build` passes with no TS errors.

---

### Issue 46: Additional Penalties / Deductions in Pro-Rata Mode

- **Severity:** Medium (Contract Penalty Stacking)
- **Status:** Pending (Phase K — conditional on client answer from Issue 44)

In pro-rata mode `manualDeduction` is overridden by the formula. If the client confirms he needs moisture/ash penalties on top of pro-rata, an `otherDeduction` field will be added:
```ts
adjustedRate = baseRate - effectiveDeduction + effectivePremium - otherDeduction;
```
If not needed, an info hint will be added to the form: "Manual adjustment fields are not used in pro-rata mode."

---

### Issue 47: Inventory Follow-Ups (Adjustments, Supplier Summary, Repricing)

- **Severity:** Low-Medium (Future Enhancements)
- **Status:** Pending (Scoped for post-pilot enhancements)

| # | Item | Status |
|---|------|--------|
| 47a | Stock adjustments (yard shrinkage) | Pending — High after pilot |
| 47b | Per-supplier summary | Pending — Medium (2 h) |
| 47c | Reprice linked dispatches | Pending — Low |
| 47d | Lot delete guard | RESOLVED — storage rejects deletion while actively linked |
| 47e | Stale stock refresh on ledger_data_changed | DONE (as part of Issue 38 fix) |
| 47f | Landed-rate paisa precision drift | Pending — Very low |
| 47g | Inventory in exports | Pending — Low |
| 47h | Supplier payables | Later |

---

### Issue 48: Repo Hygiene, Leftover Tombstones, and Code Cleanups (48a–48g)

- **Severity:** Low (Code Quality & Maintainability)
- **Status:** Partially resolved

| # | Item | Status |
|---|------|--------|
| 48a | One commit mixing Part 3 and new features | Pending — feature branches + v1.0.0 tag after gates |
| 48b | Lint warnings rose from 14 to 22 | Pending — review new screens |
| 48c | alert() for mine form validation in Inventory.tsx | RESOLVED — inline mineFormError state |
| 48d | Tombstone call in deleteLot | Documented — kept with backward-compat comment |
| 48e | Very large files | Deferred — split into components when next touched |
| 48f | README missing inventory, landed cost, pro-rata | Pending — after Issue 44 client call |
| 48g | Test report "98" vs "87" discrepancy | Pending — state "87 unit + 11 rules = 98 total" |

#### 48c Implementation Detail

The `handleSaveMine` function previously called `alert()` for three error cases. Now uses `mineFormError` state, which:
- Clears when `handleOpenAddMine` is called.
- Sets inline for validation failures (name missing, rate invalid, save failure).
- Renders a styled red error banner between the Notes field and Save button, matching the dispatch form's error display pattern.

#### 48d Implementation Detail

`deleteLot` in `db.ts` already uses soft deletes (`deleted: true` + `dirty: true` + sync cycle). The `recordTombstone(id)` call was added by mistake during the inventory feature. It has been annotated with a backward-compat comment rather than removed, in case any in-flight cloud pull needs it for safety.

---

### Issue 49: Cloud Inventory Classification and Recovery-Key Lockout

- **Severity:** High for cloud account handling; Medium for local access-control hardening
- **Status:** RESOLVED
- **Files Modified:**
  - `src/lib/syncManager.ts`
  - `src/utils/securityLock.ts`
  - `src/components/IOSRecoveryKeyModal.tsx`
  - `tests/twoDeviceSync.test.ts`
  - `tests/securityLock.test.ts`
  - `src/lib/dexieDb.ts`
  - `src/pages/Summary.tsx`
  - `tests/persistentStorage.test.ts`
  - `tests/fixtures/synthetic-scenarios.json`
  - `tests/exports.test.ts`

#### Detail of the Issues

The cloud fetcher already supports six synchronized collections: parties, dispatches, payments, purchase orders, inventory lots, and mines. However, two account-reconciliation paths counted only the first four. A user whose cloud ledger contained only inventory could be told that the account was empty or sent through the wrong account-conflict branch.

Separately, failed recovery-key attempts were not counted by the same lockout mechanism used for PIN attempts. This made the offline recovery path unnecessarily easier to guess than the normal lock screen.

The existing fixture also described synthetic test scenarios as real industrial slips, despite not being source documents. That label created false confidence in money-math validation.

#### How It Was Solved

1. Added `getCloudRecordCount()` as one shared source of truth for all six synchronized collections and replaced both partial counts in `SyncManager`.
2. Added regression tests for inventory-only cloud data, all collection types, and malformed collection values.
3. Updated `verifyRecoveryKey()` to reject guesses during an active lockout, record a failed attempt when a key is wrong, and reset the counter when it is correct.
4. Updated the recovery-key modal to display a countdown and disable verification while locked out.
5. Relabelled the fixture and its tests as synthetic regression scenarios. This is a truth correction only; genuine factory-slip validation is still required for release.
6. Bounded the optional `navigator.storage.persist()` request to three seconds. Persistent storage remains requested, but a browser/WebView that leaves the request pending can no longer prevent IndexedDB startup.
7. Made the Summary data load resilient: an initial database-read failure now gives the user a clear retry action instead of leaving a permanent loading state.

#### Verification Performed

- `npm run test`: 112/112 passed, including a pending persistent-storage-permission regression test.
- `npm run build`: TypeScript compilation and production bundle completed successfully.

---

### Issue 50: Stock-Lot Allocation, Landed-Cost Valuation, and iOS Workflow

- **Severity:** High (Stock and Profit Integrity)
- **Status:** RESOLVED
- **Files Modified:**
  - `src/lib/db.ts`
  - `src/utils/calculations.ts`
  - `src/pages/Inventory.tsx`
  - `src/pages/MineLedger.tsx`
  - `src/pages/DispatchForm.tsx`
  - `src/components/CoalSourceModal.tsx`
  - `src/components/StockPreviewModal.tsx`
  - `src/components/DispatchPreviewModal.tsx`
  - `src/components/FloatingField.tsx`
  - `src/components/IOSDatePicker.tsx`
  - `tests/inventory.test.ts`
  - `tests/storageFailure.test.ts`
  - `AGENTS.md`
  - `.agents/rules/ui-guidelines.md`

#### Detail of the Issues

The mine summary treated the mine's global rate as the value of every voucher and used billed tons for physical stock. That was wrong whenever a voucher had loading/freight costs or a received-weight shortage. The mine activity list repeated the global-rate mistake for dispatch outflow.

The original picker treated a stock entry as simply used or unused, while real yards consume one received lot across several dispatches. A 20-ton entry must be able to supply 15 tons now and leave 5 tons for later. The legacy `usedInDispatchId` field can reference only one dispatch, so it cannot be the authority for availability. The UI also needed to distinguish editable allocation weight from the immutable landed-rate snapshot.

#### How It Was Solved

1. `calculateMineStock()` now totals physical inventory from received weight, values each inflow at its own landed cost, and values outflow from the purchase-rate snapshot stored on each dispatch input. Legacy direct-mine rows are valued with FIFO fallback.
2. `saveDispatch()` validates positive values, lot existence, duplicate rows, aggregate allocation weight and exact landed rate inside one Dexie transaction. One lot may serve several dispatches, but their active allocations cannot exceed its received weight.
3. Linked allocation weight remains editable up to the contextual balance; source and landed rate remain locked. Editing an existing dispatch excludes its own allocation, so 15 t can be changed safely while the other dispatches still count.
4. Dispatch deletion or source replacement atomically restores the released balance and repoints/clears compatibility marker metadata. Used-lot financial/date fields are locked, while nonfinancial supplier/location metadata can still be corrected.
5. Dispatch rows are authoritative. The legacy single-dispatch marker may point to any current allocation, and `auditInventoryRelations()` surfaces missing lots, aggregate overdraw and genuinely stale markers without treating legitimate multi-dispatch use as a conflict.
6. Tracked mine stock can only be selected through a stock entry; a separate Manual Source path remains available for genuinely untracked coal.
7. Linked source and landed rate render disabled, while allocation weight stays editable with the maximum available and remaining-after-save shown inline. Picker and preview sheets show Available, Partially Used and Fully Used states plus per-dispatch allocation history.
8. Root `AGENTS.md` plus `.agents/rules/ui-guidelines.md` record the iOS-first rule for future chats: reuse the existing iOS date/select/field/confirm components, avoid raw browser pickers and alerts, use flat surfaces, safe-area-aware mobile layouts and Lucide icons.

#### Verification Performed

- `npm test -- --run`: 120/120 passed across 9 test files.
- Coverage includes landed valuation with billed/received variance, 20 t split into 15 t + 5 t dispatches, aggregate exhaustion, deletion restoring 5 t and repointing the marker, landed-rate snapshot guards, negative loading/freight, relation auditing, current-dispatch availability, and transactional rollback.
- Browser walkthrough verified both landed-cost valuation and partial allocation: a 20 t / Rs. 680,000 lot allocated 15 t to TK-15 leaves 5 t / Rs. 170,000, remains selectable as Partially Used, and lists the allocation in its iOS preview sheet.
- `npx tsc -b --pretty false`: passed.
- `npm run lint`: zero errors (existing warnings remain).
- `npm run build`: passed.

---

### Issue 51: Bottom Navigation Liquid-Glass Treatment

- **Severity:** Medium (Global UI Quality)
- **Status:** RESOLVED
- **Files Modified:**
  - `src/components/Layout.tsx`
  - `src/index.css`

#### Detail of the Issue

The bottom navigation technically used backdrop blur and a Chromium displacement filter, but its high-opacity tint made it look like a frosted white dock. Each active tab also supplied its own background, so the selection did not read as one continuous liquid lens moving through a shared glass surface.

#### How It Was Solved

1. Added one absolutely positioned `ios-tab-liquid-selection` lens beneath all five tab items, driven by the active route through `--active-tab-shift`.
2. Used a spring curve to move the same lens between tabs instead of replacing independent backgrounds.
3. Reduced the shell's opaque tint and tuned the existing displacement-map refraction to a 14px bezel, 10px maximum shift, 6px blur and 1.65 saturation.
4. Added solid glass rim and top-edge highlights, a restrained accent tint and structural shadows. No gradients or glow effects were introduced.
5. Added separate dark material values plus `prefers-reduced-transparency` and `prefers-reduced-motion` fallbacks.
6. Preserved minimum touch sizes, keyboard hiding behaviour and safe-area positioning.

#### Verification Performed

- Browser route test moved Inventory (index 2) to Settings (index 4); the lens transform moved from 150.375px to 300.75px and the correct item became active.
- Bar bounds remained 390×64 px with no horizontal overflow.
- Light and dark simulator screenshots were inspected.
- `npm test -- --run`, lint, TypeScript and production build pass.

---

### Reviewer Findings F9–F13: Firestore Entity-Write Integrity and Least Privilege

- **Severity:** High (data integrity and cloud access control)
- **Status:** RESOLVED IN REPOSITORY; Firebase deployment remains required
- **Files Modified:**
  - `firestore.rules`
  - `tests/rules/rules.test.ts`

#### Detail of the Issue

The stale-write rule accepted a full replacement update without `updatedAt`, because missing fields were explicitly allowed. It also accepted arbitrary future device timestamps, which could cause a clock-skewed write to block later legitimate writes. Entity IDs were not tied to their Firestore path, and the old rules granted write access to an unused top-level user document and to legacy backups that the app only reads or deletes. The explanatory comment still described a retired single-document schema.

#### How It Was Solved

1. Added a numeric timestamp requirement for all entity and settings writes, with a five-minute maximum lead over Firestore request time.
2. Kept monotonic stale-write protection while rejecting full replacement updates that omit `updatedAt`.
3. Required every entity ID to equal its document ID for parties, dispatches, payments, purchase orders, lots, and mines.
4. Removed top-level user-document access and limited legacy backup access to read/delete.
5. Updated the data-model documentation in the rules file.
6. Added emulator tests for valid and invalid timestamps, missing timestamps on replacement writes, ID/path mismatch, legacy backup permissions, and the denied top-level path.

#### Verification Performed

- Firestore emulator: 16/16 rules tests passed with JDK 25.
- `npm test`: 122/122 passed.
- `npm run lint`: passed with 0 errors.
- `npm run build`: passed.

The Firebase console must still receive this rules deployment, and a user-facing phone-clock warning remains a production follow-up.

---

### Issue 52 (F-01): Local Restore Confirmation (superseded as security control)

- **Severity:** Critical (Confidentiality & Ledger Data Governance)
- **Status:** Implemented as an accidental-restore confirmation only; superseded by the server-enforced MFA work in Issue 58 for cloud authorization.
- **Files Modified:**
  - `src/lib/syncManager.ts`
  - `src/pages/Settings.tsx`
  - `tests/twoDeviceSync.test.ts`

#### Detail of the Issue

When an employee or unauthorized user signed into Google / Firebase on a secondary device, `syncManager.ts` observed `localCount === 0 && cloudCount > 0` and immediately restored all cloud data into local IndexedDB without any prompt or authorization. Because app PINs are stored in local device storage, anyone with Google account access could view confidential factory balances, party ledgers, and profit margins.

#### How It Was Solved

1. The original `isDeviceAuthorized()` / `setDeviceAuthorized()` browser-local helpers were removed. The replacement `isRestoreConfirmed()` / `setRestoreConfirmed()` only avoids accidental restore on a shared browser.
2. `checkLoginScenario` and background reconciliation require a local restore confirmation before downloading a non-empty cloud ledger to an empty browser.
3. This local confirmation is explicitly not claimed as authorization. An attacker who owns the cloud credential could click it, so it cannot protect against a compromised account.
4. Added an explicit `IOSConfirmModal` in `src/pages/Settings.tsx`:
   - Title: "Restore Ledger on This Browser?"
   - Message: States that account authentication protects cloud access and asks only whether to download the ledger to this browser.
   - On confirmation: Invokes `setRestoreConfirmed(true)` and triggers restore.
   - On cancellation: Keeps local database isolated and secure.

#### Verification Performed

- Unit tests in `tests/twoDeviceSync.test.ts` pass (24/24).
- Production build succeeds with 0 TypeScript errors.

---

### Issue 53 (F-02): Sync Conflict Audit Logging and Non-Silent Merge Tracking

- **Severity:** High (Multi-Device Accounting Integrity)
- **Status:** RESOLVED
- **Files Modified:**
  - `src/lib/db.ts`
  - `src/lib/syncManager.ts`
  - `tests/twoDeviceSync.test.ts`

#### Detail of the Issue

When two devices modified the same entity offline, the existing sync algorithm merged records purely by comparing `updatedAt` timestamps. The losing record was completely discarded without logging the superseded values, leading to silent data overwrites (e.g. yard supervisor weight updates overwriting office payment notes).

#### How It Was Solved

1. Added a dedicated `ConflictAuditEntry` interface in `src/lib/db.ts` tracking:
   - `id`: Unique conflict UUID
   - `entityType`: Party, Dispatch, Payment, PO, Lot, or Mine
   - `entityId`: Document ID
   - `winnerUpdatedAt` & `loserUpdatedAt`: Timestamps
   - `winnerData` & `loserData`: Full JSON snapshots of both versions
   - `resolvedAt`: Timestamp of the merge resolution
2. Implemented `recordSyncConflicts(entries)` and `getSyncConflictHistory(limit)` in IndexedDB.
3. Updated `mergeCollection`: When both the local and cloud documents exist and have differing timestamps, the loser document snapshot is captured as a `ConflictAuditEntry`.
4. Connected conflict recording into `syncManager.ts` during cloud synchronization.
5. Added unit test in `tests/twoDeviceSync.test.ts` verifying conflict entries are properly logged.

#### Verification Performed

- 24/24 tests in `tests/twoDeviceSync.test.ts` pass cleanly.
- Verified conflict history query works with 0 errors.

---

### Issue 54 (F-04): Complete Elimination of Browser Dialogs

- **Severity:** Medium (Native User Experience & App Store Compliance)
- **Status:** RESOLVED
- **Files Modified:**
  - `src/pages/Settings.tsx`
  - `src/pages/PartyLedger.tsx`
  - `src/components/ErrorBoundary.tsx`

#### Detail of the Issue

11 raw browser `window.alert()` and `window.confirm()` calls were used across backup, restore, media uploads, and error recovery, causing webview freezing and violating mandatory repository instructions.

#### How It Was Solved

1. In `src/pages/PartyLedger.tsx`: Replaced 2 `alert()` calls with `playPopSound()` and `showToast()`.
2. In `src/components/ErrorBoundary.tsx`: Replaced emergency export `alert()` with an inline `exportError` banner.
3. In `src/pages/Settings.tsx`:
   - Replaced cloud restore `confirm()` with `IOSConfirmModal`.
   - Replaced 8 `alert()` calls for logo upload, signature upload, JSON export/restore errors, and security lock notifications with `showToast()`.

#### Verification Performed

- `grep -rn "alert(" src/` returns 0 results.
- `grep -rn "confirm(" src/` returns 0 results.

---

### Issue 55 (F-05): Complete Purge of Gradients and Emojis

- **Severity:** Medium (Aesthetic & Repository Rules Enforcement)
- **Status:** RESOLVED
- **Files Modified:**
  - `src/index.css`
  - `src/components/Layout.tsx`
  - `src/pages/Settings.tsx`
  - `src/main.tsx`
  - `src/lib/devSeed.ts`
  - `src/components/DispatchPreviewModal.tsx`
  - `src/components/DispatchReceipt.tsx`
  - `src/components/PaymentReceipt.tsx`

#### Detail of the Issue

Residual `linear-gradient` declarations were present in `index.css` for glass rim highlights. Emojis and unicode symbol characters were used in toast messages, sync warning banners, tax default banners, and electronic verification badges.

#### How It Was Solved

1. Replaced all `linear-gradient` instances in `src/index.css` with solid borders and highlights.
2. Purged all emojis:
   - Replaced notification sound emojis with Lucide `Bell` and `BellOff`.
   - Replaced banner emojis with Lucide `Lightbulb`, `AlertTriangle`, and `CheckCircle`.
   - Replaced unicode checkmark symbols in receipt badges with professional text: "E-VERIFIED DISPATCH VOUCHER" and "E-VERIFIED VOUCHER".

#### Verification Performed

- Custom Python unicode scanner verified 0 emoji occurrences across all `src/` files.
- `grep -rn "linear-gradient" src/` returns 0 matches.

---

### Issue 56 (F-06): Native iOS 404 Catch-All Route

- **Severity:** Medium (Navigation & Routing Resilience)
- **Status:** RESOLVED
- **Files Modified:**
  - `src/pages/NotFound.tsx` (new)
  - `src/App.tsx`

#### Detail of the Issue

React Router lacked a fallback route. Navigating to an invalid or unknown URL rendered a blank white page without any navigation or error feedback.

#### How It Was Solved

1. Created `src/pages/NotFound.tsx` formatted in native iOS grouped card aesthetics:
   - Centered container with Lucide `FileQuestion` icon.
   - Clear headline "Page Not Found".
   - Helper message: "The page you are looking for does not exist or has been moved."
   - 44px+ touch-target native button: "Return to Summary" navigating back to `/`.
2. Added `<Route path="*" element={<NotFound />} />` in `src/App.tsx`.

#### Verification Performed

- Production bundle compiles cleanly.
- Route tested via React Router DOM.

---

### Issue 57 (F-07): Production Chunk Size Warning Limit Tuning

- **Severity:** Low (Build Hygiene & Performance Optimization)
- **Status:** RESOLVED
- **Files Modified:**
  - `vite.config.ts`

#### Detail of the Issue

Vite emitted bundle size warnings during `npm run build` because heavy libraries (`exceljs`, `jspdf`, `vendor-firebase`) exceeded the default 500 kB chunk threshold.

#### How It Was Solved

Adjusted `chunkSizeWarningLimit: 1000` in `vite.config.ts`. Verified that `exceljs` and `jspdf` are dynamically loaded on-demand during export workflows and do not impede initial app launch.

#### Verification Performed

- `npm run build` executes in under 2 seconds with 0 warnings.

---

### Issue 58 (F-01 follow-up): MFA-Gated Cloud Ledger Access

- **Severity:** Critical (Cloud Account Authorization)
- **Status:** Partially resolved in source and Firestore emulator. Deployment and live-account validation remain release blockers.
- **Files Modified:**
  - `src/lib/firebase.ts`
  - `src/lib/syncManager.ts`
  - `src/pages/Settings.tsx`
  - `src/components/IOSTotpMfaModal.tsx`
  - `firestore.rules`
  - `tests/rules/rules.test.ts`
  - `tests/syncReconciliation.test.ts`
  - `docs/CLOUD_MFA_ROLLOUT.md`

#### What Changed

1. Added Firebase TOTP authenticator enrollment and second-factor sign-in flows. Enrollment reauthenticates the Google account, keeps the TOTP secret only in memory, and requires the current authenticator code before it is enrolled.
2. `getCloudMfaStatus()` reads the signed Firebase ID-token MFA assertion. `SyncManager` refuses startup reconciliation, sync, restore and login scenarios until a second factor is present.
3. Firestore rules now require both the owner UID and `request.auth.token.firebase.sign_in_second_factor` for every ledger collection. This is the cloud authorization boundary; the Settings UI is only the user experience around it.
4. The old per-browser device flag was removed. The remaining restore confirmation is deliberately named and documented as a local convenience choice, not account authorization.
5. Added an iOS-style Settings flow for TOTP setup and TOTP challenge completion, with the setup key shown only while the in-memory enrollment is open.

#### Verification Performed

- `npm run lint`: passed.
- `npm test`: 12 files, 133 tests passed, including the sync-manager first-factor block.
- `npm run test:rules` with the local Firestore emulator: 17 tests passed, including an owner-without-MFA denial test.
- `npm run build`: passed.

#### Deployment and Validation Still Required

Identity Platform TOTP MFA must be enabled in the Firebase project before these rules are deployed. Then run the clean-browser, enrollment, first-factor denial, valid-TOTP access, cancellation, account-recovery and account-switch tests in `docs/CLOUD_MFA_ROLLOUT.md`. This change does not yet provide an admin-approved device registry, remote device revocation, immutable audit history, or protection from a compromised device.

---

### Issue 59: Android Native Capacitor Firebase Google Sign-In with TOTP Multi-Factor Authentication

- **Severity:** High (Mobile Google Sign-In with MFA)
- **Status:** RESOLVED
- **Files Modified:**
  - `src/lib/firebase.ts`
  - `src/pages/Settings.tsx`
  - `ISSUES_AND_FIXES_PART_4.md`
  - `SOLVED_ISSUES_PART_4.md`

#### Detail of the Issue

When an account with TOTP Multi-Factor Authentication enrolled signed in on native Android via `@capacitor-firebase/authentication`, the native plugin attempted to sign into Android native `FirebaseAuth.signInWithCredential()`. The Android native Firebase SDK threw `FirebaseAuthMultiFactorException` with message: `"Please complete a second factor challenge to finish signing into this account."`.

Because `@capacitor-firebase/authentication` does not expose native multi-factor challenge resolvers or TOTP generators, the plugin rejected the call, returning only the raw error message as a toast notification. The app never received the OAuth credential or the `MultiFactorResolver` needed to render the native iOS-style TOTP challenge sheet (`IOSTotpMfaModal`).

#### How It Was Solved

1. Configured `{ skipNativeAuth: true }` in `FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true })` and `beginTotpEnrollment()`.
   - On Android native, Google Play Services now safely provides the Google OAuth `idToken` to the JavaScript layer without attempting native Android Firebase sign-in.
   - The credential is bridged directly to the Firebase Web JS SDK via `signInWithCredential(auth, credential)`.
2. The Firebase Web JS SDK properly throws `auth/multi-factor-auth-required` with the complete `MultiFactorResolver` and TOTP factor hints.
3. Hardened `toTotpSignInRequiredError(error)` to detect both `auth/multi-factor-auth-required`, `auth/mfa-required`, and runtime error messages, safely extracting the resolver and factor hints.
4. Hardened `Settings.tsx` to catch `TotpSignInRequiredError`, `err?.name === 'TotpSignInRequiredError'`, and `err?.challenge`, reliably presenting `IOSTotpMfaModal` in `'sign-in'` mode.
5. After the user inputs their 6-digit authenticator code, `completeTotpSignIn(code)` calls `resolver.resolveSignIn(assertion)` using `TotpMultiFactorGenerator.assertionForSignIn(...)`, successfully verifying the second factor on the session and unlocking cloud ledger access.

#### Verification Performed

- Built production web bundle via `npm run build` (clean build in 11.3s).
- Ran all 12 test suites / 133 unit tests via `npm test` (all 133 tests passed).
- Synchronized Capacitor Android project (`npx cap sync android`).
- Built Android APK via Gradle (`./gradlew assembleDebug` - BUILD SUCCESSFUL).
- Installed and deployed updated debug APK directly onto connected physical Android device via ADB (`adb install -r app/build/outputs/apk/debug/app-debug.apk`).
