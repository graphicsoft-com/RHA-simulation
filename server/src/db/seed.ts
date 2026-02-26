/**
 * ─────────────────────────────────────────────
 *  RHA Seed Script — Database Connection Test
 *
 *  Run with:
 *    npx ts-node apps/server/src/db/seed.ts
 *
 *  What it does:
 *    1. Connects to MongoDB Atlas
 *    2. Creates a test Session in room1
 *    3. Creates 3 test Messages on that session
 *    4. Reads them back and prints to console
 *    5. Cleans up (deletes the test data)
 *    6. Disconnects cleanly
 * ─────────────────────────────────────────────
 */

import 'dotenv/config';
import connectDB, { disconnectDB } from './connection';
import Session from '../models/Session';
import Message from '../models/Message';

const TEST_ROOM = 'room1';

const SEED_MESSAGES = [
  {
    role: 'clinician' as const,
    text: 'Good morning, what brings you in today?',
  },
  {
    role: 'patient' as const,
    text: "I've had a persistent cough and low grade fever for about three days now.",
  },
  {
    role: 'clinician' as const,
    text: 'I see. Is the cough productive, meaning are you bringing up any mucus?',
  },
];

async function runSeed() {
  console.log('\n🌱  RHA Database Seed Test\n' + '─'.repeat(40));

  // ── 1. Connect ──────────────────────────────
  await connectDB();

  // ── 2. Clean up any leftover test data ──────
  await Session.deleteMany({ roomId: TEST_ROOM, patientProfile: '__SEED_TEST__' });
  console.log('🧹  Cleared previous seed data');

  // ── 3. Create a test Session ─────────────────
  const session = await Session.create({
    roomId: TEST_ROOM,
    patientProfile: '__SEED_TEST__',
    status: 'active',
    startTime: new Date(),
    messageCount: 0,
  });

  console.log('\n✅  Session created:');
  console.log(`    _id:     ${session._id}`);
  console.log(`    roomId:  ${session.roomId}`);
  console.log(`    status:  ${session.status}`);
  console.log(`    started: ${session.startTime.toISOString()}`);

  // ── 4. Create test Messages ──────────────────
  const messages = await Promise.all(
    SEED_MESSAGES.map((m) =>
      Message.create({
        sessionId: session._id,
        roomId: TEST_ROOM,
        role: m.role,
        text: m.text,
        timestamp: new Date(),
      })
    )
  );

  // Update messageCount on session
  await Session.findByIdAndUpdate(session._id, {
    messageCount: messages.length,
  });

  console.log(`\n✅  ${messages.length} messages created:`);
  messages.forEach((m, i) => {
    const label = m.role === 'clinician' ? '👨‍⚕️  Clinician' : '🧑  Patient  ';
    console.log(`    [${i + 1}] ${label}: "${m.text}"`);
  });

  // ── 5. Read back and verify ──────────────────
  const fetchedSession = await Session.findById(session._id);
  const fetchedMessages = await Message.find({ sessionId: session._id }).sort({ timestamp: 1 });

  console.log('\n✅  Read-back verification:');
  console.log(`    Session messageCount: ${fetchedSession?.messageCount}`);
  console.log(`    Messages fetched:     ${fetchedMessages.length}`);

  if (fetchedMessages.length === SEED_MESSAGES.length) {
    console.log('\n🎉  All data verified — MongoDB is working correctly!\n');
  } else {
    console.error('\n❌  Message count mismatch — something went wrong\n');
  }

  // ── 6. Clean up test data ────────────────────
  await Message.deleteMany({ sessionId: session._id });
  await Session.findByIdAndDelete(session._id);
  console.log('🧹  Test data cleaned up');

  // ── 7. Disconnect ────────────────────────────
  await disconnectDB();
  console.log('\n✅  Seed test complete\n' + '─'.repeat(40));
}

runSeed().catch((err) => {
  console.error('\n❌  Seed failed:', err);
  process.exit(1);
});