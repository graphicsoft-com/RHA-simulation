// ─────────────────────────────────────────────
//  TTS Service — Browser Web Speech API
//  Speaks text aloud then emits 'tts_done'
//  back to server so next turn is unlocked
// ─────────────────────────────────────────────

import type { Socket } from 'socket.io-client';
import type { IAgentRole } from '@org/shared-types';

// Socket reference — injected once from useSocket hook
let _socket: Socket | null = null;
let _currentRoomId: string = '';

export function initTTS(socket: Socket, roomId: string): void {
  _socket = socket;
  _currentRoomId = roomId;
}

// ── Voice Selection ────────────────────────────────────────────────────────
// Browsers load voices asynchronously — we wait for them to be ready

function getVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }
    // Voices not loaded yet — wait for the event
    window.speechSynthesis.addEventListener(
      'voiceschanged',
      () => {
        resolve(window.speechSynthesis.getVoices());
      },
      { once: true }
    );
  });
}

async function selectVoice(role: IAgentRole): Promise<SpeechSynthesisVoice | null> {
  const voices = await getVoices();

  if (role === 'clinician') {
    return (
      voices.find((v) => v.name.includes('David')) || // Windows
      voices.find((v) => v.name.includes('Alex')) || // macOS
      voices.find((v) => v.name.includes('Daniel')) || // macOS UK
      voices.find((v) => v.name.toLowerCase().includes('male')) ||
      voices.find((v) => v.lang === 'en-US') ||
      voices[0]
    ) ?? null;
  } else {
    return (
      voices.find((v) => v.name.includes('Samantha')) || // macOS
      voices.find((v) => v.name.includes('Zira')) || // Windows
      voices.find((v) => v.name.includes('Karen')) || // macOS AU
      voices.find((v) => v.name.toLowerCase().includes('female')) ||
      voices.find((v) => v.lang === 'en-GB') ||
      voices[1] ||
      voices[0]
    ) ?? null;
  }
}

// ── Core speak — returns promise that resolves AFTER speech ends ───────────

export async function speak(text: string, role: IAgentRole): Promise<void> {
  return new Promise(async (resolve) => {
    // Cancel anything currently speaking
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = await selectVoice(role);
    if (voice) utterance.voice = voice;

    if (role === 'clinician') {
      utterance.rate  = 0.92;
      utterance.pitch = 0.9;
    } else {
      utterance.rate  = 1.05;
      utterance.pitch = 1.15;
    }

    utterance.lang   = 'en-US';
    utterance.volume = 1.0;

    // Track if we already emitted tts_done to avoid duplicate emissions
    let ackEmitted = false;
    let fallbackTimerId: ReturnType<typeof setTimeout> | null = null;

    function emitAck() {
      if (ackEmitted) return;
      ackEmitted = true;
      // Clear fallback timeout if it exists
      if (fallbackTimerId) {
        clearTimeout(fallbackTimerId);
        fallbackTimerId = null;
      }
      if (_socket && _currentRoomId) {
        console.log(`📡  Emitting tts_done for ${_currentRoomId}`);
        _socket.emit('tts_done', _currentRoomId);
      } else {
        console.warn(`⚠️   Cannot emit tts_done: socket=${!!_socket}, roomId=${_currentRoomId}`);
      }
    }

    utterance.onstart = () => {
      console.log(`🎙️  Started speaking (${role}): "${text.substring(0, 60)}..."`);
    };

    utterance.onend = () => {
      console.log(`✅  Speech ended naturally for ${role}`);
      emitAck();
      resolve();
    };

    utterance.onerror = (e) => {
      console.warn(`❌ TTS error (${role}):`, e.error);
      emitAck();
      resolve();
    };

    // Fallback timeout: estimate how long speech should take
    // Add safety margin to avoid cutting off mid-speech
    const estimatedMs = Math.max(500, (text.length / 140) * 1000 * 1.2);
    fallbackTimerId = setTimeout(() => {
      if (!ackEmitted) {
        console.warn(`⏱️  TTS fallback timeout after ${estimatedMs}ms (onend not fired)`);
        emitAck();
        resolve();
      }
    }, estimatedMs + 2000); // +2s extra buffer

    window.speechSynthesis.speak(utterance);
  });
}

export function stopSpeaking(): void {
  window.speechSynthesis.cancel();
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
