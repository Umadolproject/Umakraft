/**
 * Broadcast Pipeline — End-to-End Smoke Test
 *
 * Tests all five departments using the in-memory Archive adapter:
 *   Archive → Archive-Inspector → Archive-Transporter → Announcer → Broker
 *
 * No Discord client or SQLite required.
 */

import * as archive            from '../Archive/archive.js';
import { _reset as resetAdapter } from '../Archive/adapters/memoryAdapter.js';
import * as archiveInspector   from '../archive-inspector/archiveInspector.js';
import * as archiveTransporter from '../archive_transporter/archiveTransporter.js';
import * as announcer          from '../Announcer/announcer.js';
import * as broker             from '../Broker/broker.js';

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

function resetArchive() {
  resetAdapter();
}

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const TYPE = 'dailyWarning';
const CIRCLE_ID = 'circle-001';
const DATE = '2026-07-22';
const KEY = `daily-warning:${CIRCLE_ID}:${DATE}`;

const mockData = {
  fanTotal:     842000,
  goal:         1000000,
  memberStats:  [],
  snapshotDate: DATE,
  depotRef:     'depot-product-id-xyz',
};

const mockHandlers = {
  buildKey:          (circleId, data) => `daily-warning:${circleId}:${data.snapshotDate}`,
  checkEligibility:  (data) => data.fanTotal < data.goal,
  resolveRecipients: () => ({ channels: ['channel-111'], memberDms: ['viewer-222'], leaderDm: null }),
  selectVariant:     (data) => ({
    variant:     1,
    message:     `Fan total ${data.fanTotal} — warning`,
    imageParams: { type: 'dailyWarning', fanTotal: data.fanTotal, goal: data.goal },
  }),
};

// ─── Archive ──────────────────────────────────────────────────────────────────

console.log('\n── Archive ─────────────────────────────────────────────');

resetArchive();

const ins1 = await archive.insert({ notificationKey: KEY, type: TYPE, circleId: CIRCLE_ID, recipients: { channels: ['ch-1'], memberDms: [], leaderDm: null }, payload: { variant: 1, message: 'hello', imageParams: { type: TYPE } } });
assert('insert returns success + inserted=true',        ins1.success === true && ins1.inserted === true);

// INSERT OR IGNORE — second insert is a no-op, not an error
const ins2 = await archive.insert({ notificationKey: KEY, type: TYPE, circleId: CIRCLE_ID, recipients: {}, payload: {} });
assert('duplicate insert is a no-op (success=true inserted=false)', ins2.success === true && ins2.inserted === false);

const g1 = await archive.get(KEY);
assert('get returns the stored record',                 g1.record?.notificationKey === KEY);
assert('get record has channelSent=0 initially',        g1.record?.channelSent === 0);
assert('get record has dmMemberSent=0 initially',       g1.record?.dmMemberSent === 0);

const g2 = await archive.get('nonexistent-key');
assert('get returns null for unknown key',              g2.record === null);

// Mark flags
await archive.markChannelSent(KEY, { channelMsgId: 'msg-001', channelId: 'ch-1', guildId: 'guild-1' });
const g3 = await archive.get(KEY);
assert('markChannelSent sets channelSent=1',            g3.record?.channelSent === 1);

// Incomplete query — record has dmMemberSent=0
const inc1 = await archive.getIncomplete(CIRCLE_ID);
assert('getIncomplete returns record with unset flags',  inc1.records?.length >= 1);
assert('incomplete record has correct key',             inc1.records[0]?.notificationKey === KEY);

await archive.markDmMemberSent(KEY);
await archive.markDmLeaderSent(KEY);
const inc2 = await archive.getIncomplete(CIRCLE_ID);
assert('no incomplete records after all flags set',     inc2.records?.length === 0);

// History
await archive.recordHistory(KEY, { step: 'channel', outcome: 'success' });
await archive.recordHistory(KEY, { step: 'dm_member', outcome: 'failure', discordCode: 50007, detail: 'Cannot DM user' });
assert('recordHistory does not throw',                  true);

// Prune — all flags=1 so eligible for pruning
const p1 = await archive.prune({ olderThanDays: 0.0001 }); // 0.0001 days ≈ 8 seconds — record claimedAt is "now" so won't prune
assert('prune returns success',                         p1.success === true);

const p2 = await archive.prune({ olderThanDays: -1 });
assert('prune with invalid days returns error',         p2.success === false && p2.error === 'ARCHIVE_PRUNE_INVALID');

const ins3 = await archive.insert({ notificationKey: undefined, type: TYPE, circleId: CIRCLE_ID, recipients: {}, payload: {} });
assert('insert without key returns error',              ins3.success === false);

// ─── Archive-Inspector ────────────────────────────────────────────────────────

console.log('\n── Archive-Inspector ───────────────────────────────────');

resetArchive();

// Register a type — but we need a fresh inspector state. Since the registry is module-level
// we register once and reuse across tests.
archiveInspector.registerType(TYPE, mockHandlers);
assert('registerType does not throw',                   true);

// hasType
assert('hasType returns true for registered type',      archiveInspector.hasType(TYPE));
assert('hasType returns false for unknown type',        !archiveInspector.hasType('unknownType'));

// Evaluate — eligible: fanTotal < goal, no prior record
const env1 = { type: TYPE, circleId: CIRCLE_ID, data: mockData, fetchedAt: new Date().toISOString() };

// We pass a null client so Archive-Transporter fires but the Discord step is skipped
const ev1 = await archiveInspector.evaluate(env1, { client: null });
assert('eligible envelope is accepted',                 ev1.accepted === true);
assert('accepted result has notificationKey',           typeof ev1.notificationKey === 'string');

// Verify Archive record was written
const archRec = await archive.get(ev1.notificationKey);
assert('Archive record exists after acceptance',        archRec.record !== null);
assert('Archive record has correct type',               archRec.record?.type === TYPE);
assert('Archive record recipients have channel',        archRec.record?.recipients?.channels?.length > 0);
assert('Archive record payload has imageParams',        archRec.record?.payload?.imageParams !== null);
assert('all delivery flags default to 0',              archRec.record?.channelSent === 0 &&
                                                        archRec.record?.dmMemberSent === 0 &&
                                                        archRec.record?.dmLeaderSent === 0);

// Dedup — same envelope again
const ev2 = await archiveInspector.evaluate(env1, { client: null });
assert('duplicate evaluation is rejected (DEDUP_EXISTS)', ev2.accepted === false && ev2.reason === 'DEDUP_EXISTS');

// Ineligible — fanTotal already at goal
const ineligibleData = { ...mockData, fanTotal: 1000000 };
const ev3 = await archiveInspector.evaluate({ type: TYPE, circleId: 'circle-002', data: ineligibleData, fetchedAt: new Date().toISOString() }, { client: null });
assert('ineligible data is rejected (THRESHOLD_NOT_MET)', ev3.accepted === false && ev3.reason === 'THRESHOLD_NOT_MET');

// No recipients
archiveInspector.registerType('noRecipientType', {
  buildKey:          (circleId, data) => `no-recip:${circleId}:${data.snapshotDate}`,
  checkEligibility:  () => true,
  resolveRecipients: () => ({ channels: [], memberDms: [], leaderDm: null }),
  selectVariant:     () => ({ variant: 1, message: 'x', imageParams: { type: 'x' } }),
});
const ev4 = await archiveInspector.evaluate({ type: 'noRecipientType', circleId: 'c-99', data: { snapshotDate: DATE }, fetchedAt: new Date().toISOString() }, { client: null });
assert('no recipients rejects (NO_RECIPIENTS)',         ev4.accepted === false && ev4.reason === 'NO_RECIPIENTS');

// Unknown type
const ev5 = await archiveInspector.evaluate({ type: 'ghostType', circleId: CIRCLE_ID, data: mockData }, { client: null });
assert('unknown type is rejected (UNKNOWN_TYPE)',       ev5.accepted === false && ev5.reason === 'UNKNOWN_TYPE');

// Invalid envelope
const ev6 = await archiveInspector.evaluate(null, { client: null });
assert('null envelope is rejected',                    ev6.accepted === false && ev6.reason === 'INVALID_ENVELOPE');

// ─── Announcer — multi-channel delivery ───────────────────────────────────────

console.log('\n── Announcer (multi-channel) ───────────────────────────');

resetArchive();

// Build a mock Discord client whose channels map drives the test
function makeMockClient(channelBehavior) {
  // channelBehavior: Map<channelId, 'ok'|'fail'>
  return {
    channels: {
      fetch: async (channelId) => {
        const behavior = channelBehavior.get(channelId) ?? 'ok';
        if (behavior === 'fail') {
          const err = new Error(`Cannot send to ${channelId}`);
          err.code = 50013;
          throw err;
        }
        return {
          id:      channelId,
          guildId: 'guild-test',
          send:    async () => ({ id: `msg-${channelId}` }),
        };
      },
    },
    users: {
      fetch: async (userId) => ({
        createDM: async () => ({ send: async () => ({ id: `dm-${userId}` }) }),
      }),
    },
  };
}

// --- All channels succeed ---
const multiRecord = {
  notificationKey: `${KEY}-multi`,
  type:            TYPE,
  circleId:        CIRCLE_ID,
  channelSent:     0,
  dmMemberSent:    1, // skip DM steps for this sub-test
  dmLeaderSent:    1,
  recipients: { channels: ['ch-A', 'ch-B', 'ch-C'], memberDms: [], leaderDm: null },
  payload:    { variant: 1, message: 'multi-channel test', imageParams: { type: TYPE } },
};

await archive.insert({
  notificationKey: multiRecord.notificationKey,
  type:            multiRecord.type,
  circleId:        multiRecord.circleId,
  recipients:      multiRecord.recipients,
  payload:         multiRecord.payload,
});

const allOkClient = makeMockClient(new Map([['ch-A', 'ok'], ['ch-B', 'ok'], ['ch-C', 'ok']]));
const r_allOk = await announcer._postChannel(multiRecord, null, allOkClient);
assert('all channels succeed → step success',           r_allOk.success === true);

const rec_allOk = await archive.get(multiRecord.notificationKey);
assert('channelSent=1 after all channels succeed',      rec_allOk.record?.channelSent === 1);

// --- First channel fails, others succeed → whole step fails (channelSent stays 0) ---
resetArchive();
await archive.insert({
  notificationKey: multiRecord.notificationKey,
  type:            multiRecord.type,
  circleId:        multiRecord.circleId,
  recipients:      multiRecord.recipients,
  payload:         multiRecord.payload,
});

const partialFailClient = makeMockClient(new Map([['ch-A', 'fail'], ['ch-B', 'ok'], ['ch-C', 'ok']]));
const freshRecord = { ...multiRecord, channelSent: 0 };
const r_partial = await announcer._postChannel(freshRecord, null, partialFailClient);
assert('partial channel failure → step fails',          r_partial.success === false);
assert('partial failure lists failed channel',          r_partial.errors?.length === 1 && r_partial.errors[0].channelId === 'ch-A');

const rec_partial = await archive.get(multiRecord.notificationKey);
assert('channelSent stays 0 on partial failure',        rec_partial.record?.channelSent === 0);

// --- All channels fail ---
resetArchive();
await archive.insert({
  notificationKey: multiRecord.notificationKey,
  type:            multiRecord.type,
  circleId:        multiRecord.circleId,
  recipients:      multiRecord.recipients,
  payload:         multiRecord.payload,
});

const allFailClient = makeMockClient(new Map([['ch-A', 'fail'], ['ch-B', 'fail'], ['ch-C', 'fail']]));
const r_allFail = await announcer._postChannel({ ...multiRecord, channelSent: 0 }, null, allFailClient);
assert('all channels fail → step fails',                r_allFail.success === false);
assert('all failures listed (3 errors)',                r_allFail.errors?.length === 3);

const rec_allFail = await archive.get(multiRecord.notificationKey);
assert('channelSent stays 0 when all channels fail',   rec_allFail.record?.channelSent === 0);

// --- Second channel fails, first and third succeed → whole step still fails ---
resetArchive();
await archive.insert({
  notificationKey: multiRecord.notificationKey,
  type:            multiRecord.type,
  circleId:        multiRecord.circleId,
  recipients:      multiRecord.recipients,
  payload:         multiRecord.payload,
});

const midFailClient = makeMockClient(new Map([['ch-A', 'ok'], ['ch-B', 'fail'], ['ch-C', 'ok']]));
const r_midFail = await announcer._postChannel({ ...multiRecord, channelSent: 0 }, null, midFailClient);
assert('middle channel fail → step fails',              r_midFail.success === false);
assert('middle failure error has correct channelId',    r_midFail.errors?.[0]?.channelId === 'ch-B');

const rec_midFail = await archive.get(multiRecord.notificationKey);
assert('channelSent stays 0 on middle channel failure', rec_midFail.record?.channelSent === 0);

// ─── Archive-Transporter ──────────────────────────────────────────────────────

console.log('\n── Archive-Transporter ─────────────────────────────────');

resetArchive();

// Insert a well-formed record directly
await archive.insert({
  notificationKey: KEY,
  type:            TYPE,
  circleId:        CIRCLE_ID,
  recipients:      { channels: ['ch-1'], memberDms: [], leaderDm: null },
  payload:         { variant: 1, message: 'test', imageParams: { type: TYPE } },
});

// fetch() with null client: should not throw and should attempt Announcer.deliver
// (Announcer will handle null client gracefully)
let transporterError = null;
try {
  await archiveTransporter.fetch(KEY, null);
} catch (err) {
  transporterError = err;
}
assert('Archive-Transporter.fetch does not throw with null client', transporterError === null);

// fetch() with missing key
let missingError = null;
try {
  await archiveTransporter.fetch('no-such-key', null);
} catch (err) {
  missingError = err;
}
assert('Archive-Transporter.fetch does not throw for missing record', missingError === null);

// fetch() with null key
let nullKeyError = null;
try {
  await archiveTransporter.fetch(null, null);
} catch (err) {
  nullKeyError = err;
}
assert('Archive-Transporter.fetch does not throw with null key',    nullKeyError === null);

// ─── Announcer ────────────────────────────────────────────────────────────────

console.log('\n── Announcer ───────────────────────────────────────────');

resetArchive();

const announcerRecord = {
  notificationKey: KEY,
  type:            TYPE,
  circleId:        CIRCLE_ID,
  channelSent:     0,
  dmMemberSent:    0,
  dmLeaderSent:    0,
  recipients: { channels: ['ch-1'], memberDms: ['user-222'], leaderDm: null },
  payload:    { variant: 1, message: 'test', imageParams: { type: TYPE } },
};

// deliver() with null client skips all Discord steps but logs warnings — should not throw
let deliverError = null;
try {
  await announcer.deliver(announcerRecord, null);
} catch (err) {
  deliverError = err;
}
assert('Announcer.deliver does not throw with null client',         deliverError === null);

// deliver() with missing record
let missingRecordError = null;
try {
  await announcer.deliver(null, null);
} catch (err) {
  missingRecordError = err;
}
assert('Announcer.deliver does not throw with null record',         missingRecordError === null);

// deliver() with flags already set (all=1) — should be all-skip, no-op
const fullyDeliveredRecord = { ...announcerRecord, channelSent: 1, dmMemberSent: 1, dmLeaderSent: 1 };
let alreadyDoneError = null;
try {
  await announcer.deliver(fullyDeliveredRecord, null);
} catch (err) {
  alreadyDoneError = err;
}
assert('Announcer.deliver skips all steps when flags=1',           alreadyDoneError === null);

// announceOperationAlert — null client, no OPS_CHANNEL_ID configured → log only
let opAlertError = null;
try {
  await announcer.announceOperationAlert({
    decision:         'Critical',
    summary:          'dataSync has 2 consecutive failures',
    affectedSubjects: ['dataSync'],
    decidedAt:        new Date(),
  }, null);
} catch (err) {
  opAlertError = err;
}
assert('announceOperationAlert does not throw with null client',    opAlertError === null);

// ─── Broker ───────────────────────────────────────────────────────────────────

console.log('\n── Broker ──────────────────────────────────────────────');

resetArchive();

// setConfiguredCircles
broker.setConfiguredCircles([CIRCLE_ID, 'circle-002']);
const circles = broker.getConfiguredCircles();
assert('setConfiguredCircles stores circles',                       circles.includes(CIRCLE_ID));
assert('getConfiguredCircles returns correct count',                circles.length === 2);

// registerFetch
broker.registerFetch(TYPE, async (circleId) => ({
  ...mockData,
  snapshotDate: new Date().toISOString().substring(0, 10),
  circleId,
}));
assert('registerFetch does not throw',                             true);

// run() — triggers evaluate for each circle; Archive-Inspector is registered
// from the earlier Archive-Inspector test block so TYPE is already registered
// No Discord client needed.
let runError = null;
try {
  await broker.run(TYPE, null, [CIRCLE_ID]);
} catch (err) {
  runError = err;
}
assert('Broker.run does not throw',                                runError === null);

// run() with unknown type — should log and skip, not throw
let runUnknownError = null;
try {
  await broker.run('unknownType', null, [CIRCLE_ID]);
} catch (err) {
  runUnknownError = err;
}
assert('Broker.run with unregistered type does not throw',         runUnknownError === null);

// run() with empty circles list
let runEmptyError = null;
try {
  await broker.run(TYPE, null, []);
} catch (err) {
  runEmptyError = err;
}
assert('Broker.run with empty circles does not throw',             runEmptyError === null);

// recoverIncomplete
resetArchive();
// Insert two incomplete records
await archive.insert({ notificationKey: `${KEY}-r1`, type: TYPE, circleId: CIRCLE_ID, recipients: { channels: ['ch-1'], memberDms: [], leaderDm: null }, payload: { variant: 1, message: 'r1', imageParams: { type: TYPE } } });
await archive.insert({ notificationKey: `${KEY}-r2`, type: TYPE, circleId: CIRCLE_ID, recipients: { channels: ['ch-2'], memberDms: [], leaderDm: null }, payload: { variant: 2, message: 'r2', imageParams: { type: TYPE } } });

let recoveryError = null;
try {
  await broker.recoverIncomplete([CIRCLE_ID], null);
} catch (err) {
  recoveryError = err;
}
assert('Broker.recoverIncomplete does not throw',                   recoveryError === null);

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('\n── Results ─────────────────────────────────────────────');
console.log(`   Passed: ${passed}`);
console.log(`   Failed: ${failed}`);
console.log(`   Total:  ${passed + failed}`);

if (failed > 0) process.exit(1);
