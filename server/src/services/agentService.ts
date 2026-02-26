import 'dotenv/config';

import OpenAI from 'openai';
import Session from '../models/Session';
import Message from '../models/Message';
import { CLINICIAN_SYSTEM_PROMPT, getRandomPatientPrompt } from './prompts';
import { IAgentRole } from '../../../shared-types/src/index';


//  Agent Service

const openai = new OpenAI({
  apiKey: process.env.DEEPINFRA_API_KEY,
  baseURL: process.env.OPEN_AI_BASE_URL,
});

// Tracks which rooms are currently running
const activeRooms: Record<string, boolean> = {};

// When client emits 'tts_done', we resolve the promise to unblock the loop
const ttsAckResolvers: Record<string, (() => void) | null> = {};

// Per-room timeout handles — stored so each turn can clear the previous
// one and start a fresh 30s countdown
const ttsAckTimeouts: Record<string, ReturnType<typeof setTimeout> | null> = {};

// Fallback timeout — if client never acks (tab closed, error),
// unblock after this many ms so the server doesn't hang forever
const TTS_ACK_TIMEOUT_MS = 30_000;

// Short natural pause AFTER ack before generating next turn (ms)
const POST_ACK_PAUSE_MS = 800;

// How many turns per session (30 turns ≈ 15 exchanges ≈ ~10 min of conversation)
const TURNS_PER_SESSION = 30;

// ── Types ──────────────────────────────────────────────────────────────────

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Callback fired after each turn — used by Socket.io to push to frontend
export type OnMessageCallback = (payload: {
  roomId: string;
  sessionId: string;
  role: IAgentRole;
  text: string;
  timestamp: Date;
}) => void;

// ── Called by socketHandler when client emits 'tts_done' ──────────────────
export function acknowledgeTTS(roomId: string): void {
  const resolve = ttsAckResolvers[roomId];
  if (resolve) {
    console.log(`[${roomId}] TTS ack received — advancing to next turn`);
    // Clear the running timeout so it doesn't fire on the next turn
    if (ttsAckTimeouts[roomId]) {
      clearTimeout(ttsAckTimeouts[roomId]!);
      ttsAckTimeouts[roomId] = null;
    }
    ttsAckResolvers[roomId] = null;
    resolve();
  }
}

// ── Wait for client TTS to finish (with fallback timeout) ─────────────────
function waitForTTSAck(roomId: string): Promise<void> {
  return new Promise((resolve) => {
    ttsAckResolvers[roomId] = resolve;
    // Clear any leftover timeout from a previous turn before starting fresh
    if (ttsAckTimeouts[roomId]) {
      clearTimeout(ttsAckTimeouts[roomId]!);
    }
    // Fresh 30s countdown for this turn
    ttsAckTimeouts[roomId] = setTimeout(() => {
      if (ttsAckResolvers[roomId]) {
        console.warn(`[${roomId}] TTS ack timeout — advancing anyway`);
        ttsAckResolvers[roomId] = null;
        ttsAckTimeouts[roomId] = null;
        resolve();
      }
    }, TTS_ACK_TIMEOUT_MS);
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────

function pause(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function getAgentResponse(
  systemPrompt: string,
  history: AgentMessage[]
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-Turbo', // fast + high quality on DeepInfra
    messages: [{ role: 'system', content: systemPrompt }, ...history],
    max_tokens: 150,       // keeps responses short — 2-3 sentences
    temperature: 0.8,      // slight creativity so it doesn't sound repetitive
  });

  return response.choices[0]?.message?.content?.trim() ?? '[no response]';
}

// The patient agent sees the conversation history from ITS perspective
// so we flip assistant ↔ user before passing to the patient model
function flipHistory(history: AgentMessage[]): AgentMessage[] {
  return history.map((m) => ({
    role: m.role === 'assistant' ? 'user' : 'assistant',
    content: m.content,
  }));
}

// ── Core Loop ──────────────────────────────────────────────────────────────

export async function runRoom(
  roomId: string,
  sessionId: string,
  onMessage?: OnMessageCallback
): Promise<void> {

  console.log(`\n🟢  [${roomId}] Starting simulation (session: ${sessionId})`);

  // Get a random patient for this session
  const { prompt: patientSystemPrompt, profile: patientProfile } = getRandomPatientPrompt();

  // Update the session with the selected patient profile
  await Session.findByIdAndUpdate(sessionId, { patientProfile });

  // Shared conversation history — from the CLINICIAN's perspective
  // (clinician = assistant, patient = user)
  const history: AgentMessage[] = [];

  activeRooms[roomId] = true;

  for (let turn = 0; turn < TURNS_PER_SESSION; turn++) {

    // Check if room was stopped externally
    if (!activeRooms[roomId]) {
      console.log(`🔴  [${roomId}] Stopped at turn ${turn}`);
      break;
    }

    let text: string;
    let role: IAgentRole;

    try {
      if (turn % 2 === 0) {
        // ── Clinician's turn ─────────────────────────
        role = 'clinician';
        text = await getAgentResponse(CLINICIAN_SYSTEM_PROMPT, history);

        // Add to history as assistant (clinician IS the assistant in this thread)
        history.push({ role: 'assistant', content: text });

      } else {
        // ── Patient's turn ───────────────────────────
        role = 'patient';

        // Patient sees a flipped view of history so IT is the assistant
        text = await getAgentResponse(patientSystemPrompt, flipHistory(history));

        // Add patient response to history as user (from clinician's POV)
        history.push({ role: 'user', content: text });
      }

    } catch (err) {
      console.error(`❌  [${roomId}] Turn ${turn} failed:`, err);
      continue;
    }

    const timestamp = new Date();

    // ── Save to MongoDB ──────────────────────────────
    try {
      await Message.create({ sessionId, roomId, role, text, timestamp });
      await Session.findByIdAndUpdate(sessionId, { $inc: { messageCount: 1 } });
    } catch (err) {
      console.error(`❌  [${roomId}] Failed to save message to DB:`, err);
    }

    // ── Log to console ───────────────────────────────
    const label = role === 'clinician' ? '👨‍⚕️  Clinician' : '🧑  Patient  ';
    console.log(`\n[${roomId}] Turn ${turn + 1} — ${label}`);
    console.log(`  "${text}"`);

    // ── Fire callback (Socket.io will use this) ──────
    onMessage?.({ roomId, sessionId, role, text, timestamp });

    // ── WAIT for browser TTS to finish before next turn ──
    // Browser will emit 'tts_done' when speechSynthesis.onend fires
    await waitForTTSAck(roomId);

    // Small natural pause after speech ends
    await pause(POST_ACK_PAUSE_MS);
  }

  // ── Session complete ─────────────────────────────────────────────────────
  await Session.findByIdAndUpdate(sessionId, {
    status: 'stopped',
    endTime: new Date(),
  });

  delete activeRooms[roomId];
  ttsAckResolvers[roomId] = null;
  if (ttsAckTimeouts[roomId]) {
    clearTimeout(ttsAckTimeouts[roomId]!);
    ttsAckTimeouts[roomId] = null;
  }
  console.log(`\n✅  [${roomId}] Session complete`);
}

// ── Public Controls ────────────────────────────────────────────────────────

export function stopRoom(roomId: string): void {
  if (activeRooms[roomId]) {
    activeRooms[roomId] = false;
    console.log(`🛑  [${roomId}] Stop signal sent`);
  } else {
    console.log(`⚠️   [${roomId}] Was not running`);
  }
}

export function getRoomStatus(roomId: string): boolean {
  return !!activeRooms[roomId];
}

export function getAllRoomStatuses(): Record<string, boolean> {
  return { ...activeRooms };
}