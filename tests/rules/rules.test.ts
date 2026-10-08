// @vitest-environment node
import fs from 'node:fs';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc } from 'firebase/firestore';

describe('Issue 29: Firestore Security Rules Unit Tests', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-factory-ledger',
      firestore: {
        rules: fs.readFileSync('firestore.rules', 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();
    }
  });

  it('owner can create records in their own subcollections', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(
      setDoc(doc(alice, 'users/alice/dispatches/d1'), { id: 'd1', updatedAt: 200 })
    );
    await assertSucceeds(
      setDoc(doc(alice, 'users/alice/parties/p1'), { id: 'p1', updatedAt: 200 })
    );
    await assertSucceeds(
      setDoc(doc(alice, 'users/alice/lots/lot1'), { id: 'lot1', supplier: 'Hashim Coal', updatedAt: 200 })
    );
  });

  it('stale update is denied when updatedAt is older than stored document', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(
      setDoc(doc(alice, 'users/alice/dispatches/d1'), { id: 'd1', updatedAt: 200 })
    );
    await assertFails(
      setDoc(doc(alice, 'users/alice/dispatches/d1'), { id: 'd1', updatedAt: 100 }, { merge: true })
    );
  });

  it('equal timestamp is allowed (idempotent write/retry)', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(
      setDoc(doc(alice, 'users/alice/dispatches/d1'), { id: 'd1', updatedAt: 200 })
    );
    await assertSucceeds(
      setDoc(doc(alice, 'users/alice/dispatches/d1'), { id: 'd1', updatedAt: 200 }, { merge: true })
    );
  });

  it('newer timestamp is allowed', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(
      setDoc(doc(alice, 'users/alice/dispatches/d1'), { id: 'd1', updatedAt: 200 })
    );
    await assertSucceeds(
      setDoc(doc(alice, 'users/alice/dispatches/d1'), { id: 'd1', updatedAt: 300 }, { merge: true })
    );
  });

  it('other user is denied reading another user private documents', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    const bob = testEnv.authenticatedContext('bob').firestore();
    await assertSucceeds(
      setDoc(doc(alice, 'users/alice/dispatches/d1'), { id: 'd1', updatedAt: 200 })
    );
    await assertFails(getDoc(doc(bob, 'users/alice/dispatches/d1')));
  });

  it('unauthenticated user is denied reading or writing', async () => {
    const unauth = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(unauth, 'users/alice/dispatches/d1'), { id: 'd1', updatedAt: 200 })
    );
    await assertFails(getDoc(doc(unauth, 'users/alice/dispatches/d1')));
  });

  it('unknown arbitrary root path is denied', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, 'random/x'), { a: 1 }));
  });

  it('stale settings update is denied', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(
      setDoc(doc(alice, 'users/alice/settings/config'), { businessName: 'Coal Corp', updatedAt: 500 })
    );
    await assertFails(
      setDoc(doc(alice, 'users/alice/settings/config'), { businessName: 'Stale Corp', updatedAt: 300 }, { merge: true })
    );
  });

  it('Scenario S1: soft delete with newer timestamp rejects stale resurrection update', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    // Device A soft-deletes dispatch at timestamp 500
    await assertSucceeds(
      setDoc(doc(alice, 'users/alice/dispatches/d1'), { id: 'd1', deleted: true, updatedAt: 500 })
    );
    // Device B (stale, timestamp 300) attempts to push old non-deleted dispatch
    await assertFails(
      setDoc(doc(alice, 'users/alice/dispatches/d1'), { id: 'd1', deleted: false, updatedAt: 300 }, { merge: true })
    );
    // Verify cloud document is still deleted
    const snap = await getDoc(doc(alice, 'users/alice/dispatches/d1'));
    expect(snap.data()?.deleted).toBe(true);
    expect(snap.data()?.updatedAt).toBe(500);
  });

  it('Scenario S2: stale settings write is denied without blocking valid dispatches', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    // Device A updated business settings at timestamp 500
    await assertSucceeds(
      setDoc(doc(alice, 'users/alice/settings/config'), { businessName: 'Factory HQ', updatedAt: 500 })
    );
    // Device B tries to push stale settings at 300 -> denied
    await assertFails(
      setDoc(doc(alice, 'users/alice/settings/config'), { businessName: 'Stale Factory', updatedAt: 300 }, { merge: true })
    );
    // But Device B's new dispatch at timestamp 600 -> succeeds!
    await assertSucceeds(
      setDoc(doc(alice, 'users/alice/dispatches/d2'), { id: 'd2', truckNumber: 'TK-999', updatedAt: 600 })
    );
  });

  it('Scenario S3: concurrent offline dispatch edits - higher updatedAt wins', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(
      setDoc(doc(alice, 'users/alice/dispatches/d_conflict'), { id: 'd_conflict', note: 'Initial', updatedAt: 100 })
    );
    // Device A was edited offline to 400 and synced
    await assertSucceeds(
      setDoc(doc(alice, 'users/alice/dispatches/d_conflict'), { id: 'd_conflict', note: 'Device A edit', updatedAt: 400 }, { merge: true })
    );
    // Device B had edited offline to 350; pushing 350 is denied because 400 > 350
    await assertFails(
      setDoc(doc(alice, 'users/alice/dispatches/d_conflict'), { id: 'd_conflict', note: 'Device B edit', updatedAt: 350 }, { merge: true })
    );
    const snap = await getDoc(doc(alice, 'users/alice/dispatches/d_conflict'));
    expect(snap.data()?.note).toBe('Device A edit');
    expect(snap.data()?.updatedAt).toBe(400);
  });
});
