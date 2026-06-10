import test from 'node:test';
import assert from 'node:assert/strict';

import { checkAnchorReadinessWithDependencies } from '../src/modules/contracts/service.js';

test('checkAnchorReadiness returns a safe readiness summary without sending a transaction', async () => {
  const provider = {
    getCode: async () => '0x6080604052',
    getNetwork: async () => ({ chainId: 80002n, name: 'matic-amoy' }),
    getBalance: async () => 1234567890123456789n,
  };

  const wallet = { address: '0x0000000000000000000000000000000000000001' };
  const contract = {
    anchorRoot: {
      staticCall: async () => true,
    },
  };

  const result = await checkAnchorReadinessWithDependencies('0x0000000000000000000000000000000000000002', {
    provider,
    wallet,
    createContract: () => contract,
    formatEther: () => '1.234567890123456789',
    keccak256: () => '0x1234',
    toUtf8Bytes: (value) => Buffer.from(value, 'utf8'),
  });

  assert.equal(result.ready, true);
  assert.equal(result.contractExists, true);
  assert.equal(result.canAnchor, true);
  assert.equal(result.rpcConnected, true);
  assert.equal(result.walletLoaded, true);
  assert.equal(result.walletBalance, '1.234567890123456789');
  assert.equal(result.anchorSimulation, true);
});
