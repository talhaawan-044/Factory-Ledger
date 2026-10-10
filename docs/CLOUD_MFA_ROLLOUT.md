# Cloud MFA rollout checklist

## Purpose

Factory Ledger now requires a Firebase second-factor assertion for every cloud ledger read and write. This removes the former browser-local "authorized device" claim as an account-security control. It does not create a server-side approved-device registry.

Do not deploy the updated Firestore rules until TOTP multi-factor authentication is enabled and tested in the corresponding Firebase/Identity Platform project. Otherwise every client will correctly be denied ledger access.

## Staging first

1. Create or select a Firebase staging project that mirrors the production Authentication and Firestore setup.
2. Upgrade/enable Identity Platform for the project and enable TOTP MFA in the Identity Platform Authentication configuration. This is a console/admin action outside this repository.
3. Confirm Google is an enabled Firebase Authentication provider and that the staging web/native OAuth configuration is valid.
4. Deploy the updated Firestore rules only to staging first.
5. Create two non-production Google test accounts. Do not use a real factory ledger or a shared administrator account.

## Required staged acceptance test

Perform the following in a clean browser profile (and later on a non-production Android device). Record the account, time, outcome, and any Firebase console errors.

1. Sign in with the first test account before it has an authenticator enrolled. Confirm the app displays Cloud Account Security as locked and no ledger collection is restored or synced.
2. From Settings, choose Set Up. Complete the fresh Google reauthentication, add the displayed setup key to a TOTP authenticator, and enter its current numeric code.
3. Confirm the app signs the user out after enrollment. Sign in again and complete the TOTP challenge.
4. Confirm a valid second-factor session can create, sync, restore, edit, and read only its own test ledger data.
5. In a new clean browser profile, sign in with the same Google account but deliberately do not complete the TOTP challenge. Confirm Firestore reads and writes are denied and no cloud ledger is downloaded.
6. Enter an invalid or expired code. Confirm no cloud data becomes available. Cancel the challenge and confirm access remains locked.
7. Sign in as the second test account. Confirm it cannot read the first account's ledger, with or without its own MFA enrollment.
8. Test Google account switching, sign-out, token refresh, browser restart, restore confirmation, offline edits followed by MFA sign-in, and the denied-first-factor state.
9. Follow the account recovery process owned by the business. Confirm that recovery is deliberate, logged outside the client, and does not silently weaken access to the ledger.

## Production rollout

1. Obtain a named business owner approval for the staged evidence and a recovery/contact procedure.
2. Enable TOTP MFA in production Identity Platform before publishing the new Firestore rules.
3. Enrol at least two controlled owner/admin accounts and keep recovery material in the approved business process, not in the Factory Ledger database or browser storage.
4. Deploy the application and rules in a planned maintenance window. Verify the deployed Firestore rules rather than assuming the repository copy is live.
5. Repeat the clean-browser first-factor-denial and valid-TOTP tests against production using non-sensitive test records if possible.
6. Monitor support channels for lockouts and sync failures. Do not remove the old rules rollback path until successful MFA sign-ins, synchronizations and restores have been observed.

## Remaining architecture decision

TOTP MFA protects against a stolen Google first factor. It does not by itself deliver an administrator-approved device register, remote device revocation, immutable authorization audit history, or protection when an enrolled device/account is compromised. If the business requires those guarantees, design a backend-controlled device-enrolment and revocation service before claiming them.
