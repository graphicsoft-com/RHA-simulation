import OpenAI from 'openai';
import Session from '../models/Session';
import Message from '../models/Message';
import { getCaregiverPrompt, getRandomTenantPrompt } from './prompts';
import { IAgentRole } from '../../../shared-types/src/index';

// ─────────────────────────────────────────────
//  Agent Service
//  Manages the AI conversation loop per room
// ─────────────────────────────────────────────

// DeepInfra is OpenAI-compatible — only the baseURL and key change
const openai = new OpenAI({
  apiKey: process.env.DEEPINFRA_API_KEY,
  baseURL: 'https://api.deepinfra.com/v1/openai',
});

// Tracks which rooms are currently running
const activeRooms: Record<string, boolean> = {};

// Per-room TTS acknowledgment resolvers
// When client emits 'tts_done', we resolve the promise to unblock the loop
const ttsAckResolvers: Record<string, (() => void) | null> = {};

const ttsAckTimeouts: Record<string, ReturnType<typeof setTimeout> | null> = {};

// Fallback timeout — if client never acks (tab closed, error),
// unblock after this many ms so the server doesn't hang forever
const TTS_ACK_TIMEOUT_MS = 30_000;

// Short natural pause AFTER ack before generating next turn (ms)
// Simulates the human "thinking" gap between turns
const POST_ACK_PAUSE_MS = 800;

// How many turns per session (30 turns ≈ 15 exchanges ≈ ~10 min of conversation)
const TURNS_PER_SESSION = 30;

// ── Types ──────────────────────────────────────────────────────────────────

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

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
    console.log(`🔔  [${roomId}] TTS ack received — advancing to next turn`);
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

async function getAgentResponse(
  systemPrompt: string,
  history: AgentMessage[],
  retries = 3
): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-Turbo',
        messages: [{ role: 'system', content: systemPrompt }, ...history],
        max_tokens: 150,
        temperature: 0.8,
      });
      return response.choices[0]?.message?.content?.trim() ?? '[no response]';
    } catch (err: any) {
      // OpenAI SDK wraps fetch errors two levels deep:
      //   APIConnectionError → TypeError: fetch failed → Error: getaddrinfo EAI_AGAIN
      const rootCause = err?.cause?.cause ?? err?.cause ?? err;
      const isConnectionError =
        rootCause?.code === 'EAI_AGAIN' ||
        rootCause?.code === 'ENOTFOUND' ||
        rootCause?.code === 'ECONNREFUSED' ||
        rootCause?.code === 'ECONNRESET' ||
        err?.message?.includes('Connection error') ||
        err?.constructor?.name === 'APIConnectionError';

      if (isConnectionError && attempt < retries) {
        const waitMs = attempt * 2000; // 2s, 4s, 6s
        console.warn(
          `⚠️  [DNS error] Retrying in ${waitMs / 1000}s ` +
          `(attempt ${attempt}/${retries}) — root cause: ${rootCause?.code ?? err?.message}`
        );
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      throw err; // give up after all retries
    }
  }
  throw new Error('Max retries reached');
}

function flipHistory(history: AgentMessage[]): AgentMessage[] {
  return history.map((m) => ({
    role: m.role === 'assistant' ? 'user' : 'assistant',
    content: m.content,
  }));
}

function pause(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Core Loop ──────────────────────────────────────────────────────────────

export async function runRoom(
  roomId: string,
  sessionId: string,
  onMessage?: OnMessageCallback
): Promise<void> {

  console.log(`\n🟢  [${roomId}] Starting simulation (session: ${sessionId})`);

  const { prompt: tenantSystemPrompt, profile, caregiverName, tenantName } = getRandomTenantPrompt(roomId);
  const caregiverSystemPrompt = getCaregiverPrompt(roomId);
  await Session.findByIdAndUpdate(sessionId, { tenantProfile: profile, caregiverName, tenantName });

  const history: AgentMessage[] = [];
  activeRooms[roomId] = true;

  for (let turn = 0; turn < TURNS_PER_SESSION; turn++) {

    if (!activeRooms[roomId]) {
      console.log(`🔴  [${roomId}] Stopped at turn ${turn}`);
      break;
    }

    let text: string;
    let role: IAgentRole;

    try {
      if (turn % 2 === 0) {
        role = 'caregiver';
        text = await getAgentResponse(caregiverSystemPrompt, history);
        history.push({ role: 'assistant', content: text });
      } else {
        role = 'tenant';
        text = await getAgentResponse(tenantSystemPrompt, flipHistory(history));
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
      console.error(`❌  [${roomId}] DB save failed:`, err);
    }

    const label = role === 'caregiver' ? '👩‍⚕️  Caregiver' : '🧓  Tenant   ';
    console.log(`\n[${roomId}] Turn ${turn + 1} — ${label}\n  "${text}"`);

    // ── Emit message to browser ──────────────────────
    onMessage?.({ roomId, sessionId, role, text, timestamp });

    // ── WAIT for browser TTS to finish before next turn ──
    // Browser will emit 'tts_done' when speechSynthesis.onend fires
    await waitForTTSAck(roomId);

    // Small natural pause after speech ends
    await pause(POST_ACK_PAUSE_MS);
  }

  await Session.findByIdAndUpdate(sessionId, {
    status: 'stopped',
    endTime: new Date(),
  });

  delete activeRooms[roomId];
  ttsAckResolvers[roomId] = null;
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