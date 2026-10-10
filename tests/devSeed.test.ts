import { beforeEach, describe, expect, it } from 'vitest';
import { clearAllData, seedTestData } from '../src/lib/devSeed';
import { getDispatches, getLots, getMines, getParties, getPayments, getPurchaseOrders } from '../src/lib/db';

describe('development seed data', () => {
  beforeEach(async () => {
    await clearAllData({ reload: false });
  });

  it('loads every documented entity without rejecting a linked landed-rate snapshot', async () => {
    await seedTestData({ reload: false });

    const [parties, dispatches, payments, pos, lots, mines] = await Promise.all([
      getParties(),
      getDispatches(),
      getPayments(),
      getPurchaseOrders(),
      getLots(),
      getMines(),
    ]);

    expect(parties).toHaveLength(6);
    expect(dispatches).toHaveLength(12);
    expect(payments).toHaveLength(12);
    expect(pos).toHaveLength(5);
    expect(lots).toHaveLength(14);
    expect(mines).toHaveLength(5);
  });
});
