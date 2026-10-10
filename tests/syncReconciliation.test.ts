import { beforeEach, describe, expect, it, vi } from 'vitest';

const firebaseMocks = vi.hoisted(() => ({
  fetchLedgerFromCloud: vi.fn(),
  syncLedgerToCloud: vi.fn(),
  getCloudMfaStatus: vi.fn(),
}));

vi.mock('../src/lib/firebase', () => ({
  auth: { currentUser: null },
  isFirebaseConfigured: true,
  fetchLedgerFromCloud: firebaseMocks.fetchLedgerFromCloud,
  syncLedgerToCloud: firebaseMocks.syncLedgerToCloud,
  deleteSingleEntityFromCloud: vi.fn(),
  subscribeToAuth: vi.fn(),
  logoutUser: vi.fn(),
  purgeLegacySecurityFieldsFromCloud: vi.fn(),
  getCloudMfaStatus: firebaseMocks.getCloudMfaStatus,
}));

vi.mock('../src/utils/securityLock', () => ({
  disableAppLock: vi.fn(),
}));

import { SyncManager, getCloudRecordCount } from '../src/lib/syncManager';
import { clearAllData, deleteParty, getLedgerForSync, saveParty } from '../src/lib/db';

const emptyCloud = () => ({
  parties: [],
  dispatches: [],
  payments: [],
  pos: [],
  lots: [],
  mines: [],
  settings: {},
});

describe('startup reconciliation', () => {
  beforeEach(async () => {
    await clearAllData({ resetOwner: true, resetSettings: true });
    firebaseMocks.fetchLedgerFromCloud.mockReset();
    firebaseMocks.syncLedgerToCloud.mockReset();
    firebaseMocks.getCloudMfaStatus.mockReset().mockResolvedValue({
      isSignedIn: true,
      isSecondFactorVerified: true,
      signInSecondFactor: 'totp',
      enrolledFactorCount: 1,
    });
    firebaseMocks.syncLedgerToCloud.mockResolvedValue({
      success: true,
      timestamp: '2026-10-10T00:00:00.000Z',
      message: 'Synced',
    });
  });

  it('does not count soft-deleted cloud documents as restorable ledger records', () => {
    expect(getCloudRecordCount({
      ...emptyCloud(),
      parties: [{ id: 'deleted-party', deleted: true }],
      lots: [{ id: 'active-lot' }],
    })).toBe(1);
  });

  it('flushes an offline-created record before merging cloud data at startup', async () => {
    await saveParty({
      id: 'party-offline-create',
      name: 'Offline Factory',
      contactPerson: '',
      phone: '',
      address: '',
      createdAt: 100,
      updatedAt: 100,
    });
    const [localParty] = (await getLedgerForSync(true)).parties;
    const cloudBeforeFlush = {
      ...emptyCloud(),
      parties: [{ id: 'party-cloud', name: 'Cloud Factory', updatedAt: 50, createdAt: 50 }],
    };
    const cloudAfterFlush = {
      ...cloudBeforeFlush,
      parties: [...cloudBeforeFlush.parties, { ...localParty, dirty: false }],
    };
    firebaseMocks.fetchLedgerFromCloud
      .mockResolvedValueOnce(cloudBeforeFlush)
      .mockResolvedValueOnce(cloudAfterFlush);

    const manager = new SyncManager();
    await manager.reconcileWithCloud('user-1');

    expect(firebaseMocks.syncLedgerToCloud).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ parties: [expect.objectContaining({ id: 'party-offline-create', dirty: true })] }),
      { deltaOnly: true },
    );
    expect(firebaseMocks.fetchLedgerFromCloud).toHaveBeenCalledTimes(2);
    expect(manager.getState()).toMatchObject({ status: 'synced', hasPendingChanges: false });
  });

  it('flushes an offline soft delete before it can be restored from cloud', async () => {
    await saveParty({
      id: 'party-offline-delete',
      name: 'Deleted Factory',
      contactPerson: '',
      phone: '',
      address: '',
      createdAt: 100,
      updatedAt: 100,
    });
    await deleteParty('party-offline-delete');
    const [deletedParty] = (await getLedgerForSync(true)).parties;
    const cloudBeforeFlush = {
      ...emptyCloud(),
      parties: [{ id: 'party-offline-delete', name: 'Deleted Factory', updatedAt: 100, createdAt: 100 }],
    };
    const cloudAfterFlush = {
      ...emptyCloud(),
      parties: [{ ...deletedParty, dirty: false }],
    };
    firebaseMocks.fetchLedgerFromCloud
      .mockResolvedValueOnce(cloudBeforeFlush)
      .mockResolvedValueOnce(cloudAfterFlush);

    const manager = new SyncManager();
    await manager.reconcileWithCloud('user-1');

    expect(firebaseMocks.syncLedgerToCloud).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ parties: [expect.objectContaining({ id: 'party-offline-delete', deleted: true, dirty: true })] }),
      { deltaOnly: true },
    );
    expect(manager.getState()).toMatchObject({ status: 'synced', hasPendingChanges: false });
  });

  it('keeps local changes pending when the pre-merge cloud flush fails', async () => {
    await saveParty({
      id: 'party-push-fails',
      name: 'Pending Factory',
      contactPerson: '',
      phone: '',
      address: '',
      createdAt: 100,
      updatedAt: 100,
    });
    firebaseMocks.fetchLedgerFromCloud.mockResolvedValue({
      ...emptyCloud(),
      parties: [{ id: 'party-cloud', name: 'Cloud Factory', updatedAt: 50, createdAt: 50 }],
    });
    firebaseMocks.syncLedgerToCloud.mockResolvedValue({
      success: false,
      timestamp: '2026-10-10T00:00:00.000Z',
      message: 'Permission denied',
      unresolvedCount: 1,
    });

    const manager = new SyncManager();
    await manager.reconcileWithCloud('user-1');

    expect(firebaseMocks.fetchLedgerFromCloud).toHaveBeenCalledTimes(1);
    expect(manager.getState()).toMatchObject({
      status: 'error',
      hasPendingChanges: true,
      unresolvedCount: 1,
      lastError: 'Permission denied',
    });
  });

  it('never reads cloud data when the Google first factor has not completed MFA', async () => {
    firebaseMocks.getCloudMfaStatus.mockResolvedValue({
      isSignedIn: true,
      isSecondFactorVerified: false,
      signInSecondFactor: null,
      enrolledFactorCount: 1,
    });

    const manager = new SyncManager();
    await manager.reconcileWithCloud('user-1');

    expect(firebaseMocks.fetchLedgerFromCloud).not.toHaveBeenCalled();
    expect(manager.getState()).toMatchObject({
      status: 'error',
      cloudMfaStatus: { isSecondFactorVerified: false },
    });
  });
});
