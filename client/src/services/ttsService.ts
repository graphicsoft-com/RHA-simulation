// ─────────────────────────────────────────────
//  TTS Service — Browser Web Speech API
//  Per-room instances to avoid cross-room bleed
// ─────────────────────────────────────────────

import type { Socket } from 'socket.io-client';
import type { IAgentRole } from '@org/shared-types';

// ── Voice helpers ──────────────────────────────────────────────────────────

function getVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) { resolve(voices); return; }
    window.speechSynthesis.addEventListener(
      'voiceschanged',
      () => resolve(window.speechSynthesis.getVoices()),
      { once: true }
    );
  });
}

async function selectVoice(role: IAgentRole): Promise<SpeechSynthesisVoice | null> {
  const voices = await getVoices();

  if (role === 'caregiver') {
    return (
      voices.find((v) => v.name.includes('David')) ||
      voices.find((v) => v.name.includes('Alex')) ||
      voices.find((v) => v.name.includes('Daniel')) ||
      voices.find((v) => v.name.toLowerCase().includes('male')) ||
      voices.find((v) => v.lang === 'en-US') ||
      voices[0]
    ) ?? null;
  } else {
    return (
      voices.find((v) => v.name.includes('Samantha')) ||
      voices.find((v) => v.name.includes('Zira')) ||
      voices.find((v) => v.name.includes('Karen')) ||
      voices.find((v) => v.name.toLowerCase().includes('female')) ||
      voices.find((v) => v.lang === 'en-GB') ||
      voices[1] ||
      voices[0]
    ) ?? null;
  }
}

// ── Per-room TTS instance ──────────────────────────────────────────────────

export class RoomTTS {
  private _socket: Socket | null = null;
  private _roomId: string = '';
  private _isDashboard: boolean = false;
  private _currentUtterance: SpeechSynthesisUtterance | null = null;
  private _isSpeaking: boolean = false;

  init(socket: Socket, roomId: string, isDashboard = false): void {
    this._socket = socket;
    this._roomId = roomId;
    this._isDashboard = isDashboard;
  }

  async speak(text: string, role: IAgentRole): Promise<void> {
    // Server gates turns via tts_done so this should never fire,
    // but guard anyway to prevent double-queuing in the same tab
    if (this._isSpeaking) {
      console.warn(`[TTS] Already speaking in ${this._roomId} — skipping`);
      return;
    }

    return new Promise(async (resolve) => {
      this._isSpeaking = true;

      const utterance = new SpeechSynthesisUtterance(text);
      this._currentUtterance = utterance;

      const voice = await selectVoice(role);
      if (voice) utterance.voice = voice;

      if (role === 'caregiver') {
        utterance.rate  = 0.92;
        utterance.pitch = 0.9;
      } else {
        utterance.rate  = 1.05;
        utterance.pitch = 1.15;
      }

      utterance.lang   = 'en-US';
      utterance.volume = 1.0;

      utterance.onend = () => {
        this._isSpeaking = false;
        // Only the dedicated room tab acks — dashboard must never emit tts_done
        if (this._socket && this._roomId && !this._isDashboard) {
          this._socket.emit('tts_done', this._roomId);
          console.log(`🔔  tts_done emitted for ${this._roomId}`);
        }
        this._currentUtterance = null;
        resolve();
      };

      utterance.onerror = (e) => {
        this._isSpeaking = false;
        console.warn(`TTS error (${role}):`, e.error);
        if (this._socket && this._roomId && !this._isDashboard) {
          this._socket.emit('tts_done', this._roomId);
        }
        this._currentUtterance = null;
        resolve();
      };

      // ✅ Just speak — do NOT call cancel() first.
      // cancel() is global to the browser process and would kill other tabs' audio.
      window.speechSynthesis.speak(utterance);
    });
  }

  stop(): void {
    this._isSpeaking = false;
    if (this._currentUtterance) {
      this._currentUtterance.onend = null;
      this._currentUtterance.onerror = null;
      this._currentUtterance = null;
    }
    // Do NOT call window.speechSynthesis.cancel() — it kills every tab's audio
  }
}

// ── Per-room instance registry ─────────────────────────────────────────────

const _instances: Record<string, RoomTTS> = {};

export function getRoomTTS(roomId: string): RoomTTS {
  if (!_instances[roomId]) {
    _instances[roomId] = new RoomTTS();
  }
  return _instances[roomId];
}

// ── Legacy shim — keeps existing callers working ───────────────────────────

export function initTTS(socket: Socket, roomId: string, isDashboard = false): void {
  getRoomTTS(roomId).init(socket, roomId, isDashboard);
}

export async function speak(text: string, role: IAgentRole, roomId: string): Promise<void> {
  return getRoomTTS(roomId).speak(text, role);
}

export function stopSpeaking(): void {
  // Intentionally NOT calling window.speechSynthesis.cancel().
  // That API is global to the browser process — calling it from one tab
  // cancels audio that may be playing in every other tab on the same machine.
  // Each RoomTTS instance manages its own utterance lifecycle via stop().
}

export function isTTSSupported(): boolean {
  return 'speechSynthesis' in window;
}

export async function logAvailableVoices(): Promise<void> {
  const voices = await getVoices();
  console.log('🔊  Available TTS voices:');
  voices.forEach((v, i) => {
    console.log(`  [${i}] ${v.name} (${v.lang})${v.default ? ' ← default' : ''}`);
  });
}
