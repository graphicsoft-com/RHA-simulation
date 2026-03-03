// ─────────────────────────────────────────────
//  Conversation State Manager
//  Tracks what has been said per session so
//  prompts stay dynamic across 1200+ turns
// ─────────────────────────────────────────────

export type TopicCategory =
  | 'wellbeing'
  | 'sleep'
  | 'appetite'
  | 'pain'
  | 'mobility'
  | 'mood'
  | 'activities'
  | 'family'
  | 'medication'
  | 'room_comfort'
  | 'appointments'
  | 'memories'
  | 'concerns'
  | 'weather'
  | 'news'
  | 'religion'
  | 'past_career'
  | 'childhood'
  | 'holidays';

export type EmotionalTone =
  | 'neutral'
  | 'cheerful'
  | 'tired'
  | 'nostalgic'
  | 'anxious'
  | 'content'
  | 'frustrated'
  | 'lonely';

export interface ConversationState {
  sessionId:       string;
  roomId:          string;
  turn:            number;

  // Topic tracking
  topicsDiscussed: TopicCategory[];
  topicTurnMap:    Record<TopicCategory, number>; // last turn each topic was discussed
  currentTopic:    TopicCategory | null;

  // Phrase tracking — prevents repetitive filler
  recentPhrases:   string[];        // last 20 phrase openings used
  bannedThisTurn:  string[];        // dynamically built each turn

  // Emotional arc tracking
  tenantTone:      EmotionalTone;
  caregiverTone:   EmotionalTone;
  toneHistory:     EmotionalTone[]; // last 10 tones

  // Memory tracking — topics the tenant mentioned
  tenantMemories:  string[];        // brief summaries of stories told
  caregiverShared: string[];        // personal details caregiver shared

  // Concern tracking
  flaggedConcerns: string[];        // things to follow up on
  followUpDue:     boolean;

  // Session phase
  phase: 'opening' | 'main' | 'deep' | 'closing';
}

// ── All available topics with weights (higher = more likely to be picked) ──

const TOPIC_WEIGHTS: Record<TopicCategory, number> = {
  wellbeing:   10,
  sleep:        8,
  appetite:     8,
  pain:         9,
  mobility:     7,
  mood:         9,
  activities:   6,
  family:       8,
  medication:   5,
  room_comfort: 4,
  appointments: 4,
  memories:     7,
  concerns:     6,
  weather:      3,
  news:         3,
  religion:     3,
  past_career:  5,
  childhood:    5,
  holidays:     4,
};

const ALL_TOPICS = Object.keys(TOPIC_WEIGHTS) as TopicCategory[];

// Phrases that signal repetitive filler — tracked and rotated out
const FILLER_PHRASES = [
  'thank you for sharing',
  'i appreciate that',
  "that's wonderful",
  "that's great",
  'how wonderful',
  'that means a lot',
  'i really appreciate',
  'thank you so much',
  "that's so kind",
  "you're so kind",
  "that's lovely",
  'how lovely',
  'absolutely',
  'certainly',
  'of course',
];

// ── State factory ───────────────────────────────────────────────────────────

export function createConversationState(
  sessionId: string,
  roomId: string
): ConversationState {
  return {
    sessionId,
    roomId,
    turn: 0,
    topicsDiscussed:  [],
    topicTurnMap:     {} as Record<TopicCategory, number>,
    currentTopic:     null,
    recentPhrases:    [],
    bannedThisTurn:   [],
    tenantTone:       'neutral',
    caregiverTone:    'neutral',
    toneHistory:      [],
    tenantMemories:   [],
    caregiverShared:  [],
    flaggedConcerns:  [],
    followUpDue:      false,
    phase:            'opening',
  };
}

// ── Phase management ────────────────────────────────────────────────────────

export function updatePhase(state: ConversationState): void {
  if (state.turn < 6)        state.phase = 'opening';
  else if (state.turn < 40)  state.phase = 'main';
  else if (state.turn < 100) state.phase = 'deep';
  else                       state.phase = 'main'; // cycles back for long sessions
}

// ── Topic selection ─────────────────────────────────────────────────────────

export function selectNextTopic(state: ConversationState): TopicCategory {
  // If there's a flagged concern, follow up on it first
  if (state.followUpDue && state.flaggedConcerns.length > 0) {
    state.followUpDue = false;
    return state.currentTopic ?? 'wellbeing';
  }

  // Never repeat a topic discussed in the last 10 turns
  const recentlyDiscussed = new Set(
    Object.entries(state.topicTurnMap)
      .filter(([, turn]) => state.turn - turn < 10)
      .map(([topic]) => topic as TopicCategory)
  );

  // Weight topics — deprioritize recent ones
  const candidates = ALL_TOPICS.filter(t => !recentlyDiscussed.has(t));
  const pool = candidates.length > 0 ? candidates : ALL_TOPICS;

  // Weighted random selection
  const totalWeight = pool.reduce((sum, t) => sum + TOPIC_WEIGHTS[t], 0);
  let rand = Math.random() * totalWeight;

  for (const topic of pool) {
    rand -= TOPIC_WEIGHTS[topic];
    if (rand <= 0) return topic;
  }

  return pool[0];
}

// ── Tone variation ──────────────────────────────────────────────────────────

const TONE_TRANSITIONS: Record<EmotionalTone, EmotionalTone[]> = {
  neutral:    ['cheerful', 'tired', 'nostalgic', 'neutral'],
  cheerful:   ['neutral', 'nostalgic', 'content', 'cheerful'],
  tired:      ['neutral', 'frustrated', 'lonely', 'tired'],
  nostalgic:  ['cheerful', 'content', 'neutral', 'nostalgic'],
  anxious:    ['neutral', 'tired', 'frustrated'],
  content:    ['cheerful', 'neutral', 'nostalgic'],
  frustrated: ['neutral', 'tired', 'anxious'],
  lonely:     ['neutral', 'nostalgic', 'tired'],
};

export function evolveTone(currentTone: EmotionalTone): EmotionalTone {
  const options = TONE_TRANSITIONS[currentTone];
  return options[Math.floor(Math.random() * options.length)];
}

// ── Dynamic instruction injection ──────────────────────────────────────────
// Called every turn to build fresh constraints for the prompt

export function buildCaregiverDirectives(state: ConversationState): string {
  const lines: string[] = [];

  // Current topic
  const nextTopic = selectNextTopic(state);
  state.currentTopic = nextTopic;
  lines.push(`CURRENT FOCUS: Naturally steer toward "${nextTopic.replace('_', ' ')}" this turn.`);

  // Topics to avoid (discussed recently)
  const avoidTopics = Object.entries(state.topicTurnMap)
    .filter(([, turn]) => state.turn - turn < 8)
    .map(([t]) => t.replace('_', ' '));
  if (avoidTopics.length > 0) {
    lines.push(`AVOID these topics (discussed recently): ${avoidTopics.join(', ')}.`);
  }

  // Phrase bans — rotate based on recent use
  const bannedPhrases = FILLER_PHRASES.filter(p =>
    state.recentPhrases.some(r => r.toLowerCase().includes(p))
  );
  if (bannedPhrases.length > 0) {
    lines.push(`DO NOT use these phrases (used too recently): "${bannedPhrases.join('", "')}".`);
  }

  // Emotional tone instruction
  const newTone = evolveTone(state.caregiverTone);
  state.caregiverTone = newTone;
  lines.push(`YOUR TONE THIS TURN: ${newTone} — let it show subtly in word choice.`);

  // Phase-specific instructions
  if (state.phase === 'opening') {
    lines.push('This is early in the visit — keep it warm and light, build rapport.');
  } else if (state.phase === 'deep') {
    lines.push('You are deep into the visit — it is natural to have a more meaningful exchange.');
  } else if (state.phase === 'closing') {
    lines.push('The visit is wrapping up — begin naturally concluding the check-in.');
  }

  // Follow up on concerns
  if (state.flaggedConcerns.length > 0 && Math.random() < 0.3) {
    const concern = state.flaggedConcerns[state.flaggedConcerns.length - 1];
    lines.push(`FOLLOW UP: Check back on "${concern}" — you mentioned it earlier.`);
    state.followUpDue = false;
  }

  // Sentence starter variety
  if (state.turn > 0 && state.turn % 5 === 0) {
    lines.push('Vary your sentence starter — do not begin with the same word as your last turn.');
  }

  // Personal sharing
  if (state.turn > 0 && state.turn % 12 === 0) {
    lines.push('Share one brief personal detail about yourself naturally — makes the visit feel human.');
  }

  return lines.join('\n');
}

export function buildTenantDirectives(state: ConversationState): string {
  const lines: string[] = [];

  // Emotional tone
  if (state.turn % 8 === 0) {
    const newTone = evolveTone(state.tenantTone);
    state.tenantTone = newTone;
  }
  lines.push(`YOUR MOOD THIS TURN: ${state.tenantTone}.`);

  // Memory deduplication
  if (state.tenantMemories.length > 0) {
    lines.push(`Do NOT repeat these stories you already told: ${state.tenantMemories.slice(-5).join('; ')}.`);
  }

  // Phrase bans
  const bannedPhrases = FILLER_PHRASES.filter(p =>
    state.recentPhrases.some(r => r.toLowerCase().includes(p))
  );
  if (bannedPhrases.length > 0) {
    lines.push(`DO NOT use: "${bannedPhrases.join('", "')}".`);
  }

  // Occasional question back to caregiver
  if (state.turn > 4 && state.turn % 7 === 0) {
    lines.push('This turn, ask the caregiver something genuine about their life or day.');
  }

  // Occasional mild complaint
  if (state.turn > 6 && state.turn % 11 === 0) {
    lines.push('Mention one small mild complaint naturally — the food, the noise, being bored, missing home.');
  }

  // Occasional positive moment
  if (state.turn > 8 && state.turn % 13 === 0) {
    lines.push('Share something positive — a good dream, a fond memory, or something you are looking forward to.');
  }

  return lines.join('\n');
}

// ── State updater — called after each turn ──────────────────────────────────

export function updateStateAfterTurn(
  state: ConversationState,
  role: 'caregiver' | 'tenant',
  text: string
): void {
  state.turn++;
  updatePhase(state);

  // Track recent phrase openings (first 8 words, lowercased)
  const words = text.toLowerCase().split(' ').slice(0, 8).join(' ');
  state.recentPhrases.push(words);
  if (state.recentPhrases.length > 20) state.recentPhrases.shift();

  // Track topic usage
  if (state.currentTopic) {
    if (!state.topicsDiscussed.includes(state.currentTopic)) {
      state.topicsDiscussed.push(state.currentTopic);
    }
    state.topicTurnMap[state.currentTopic] = state.turn;
  }

  // Detect concerns in tenant speech
  if (role === 'tenant') {
    const concernKeywords = [
      'pain', 'hurts', 'fell', 'dizzy', 'confused', 'scared',
      'worried', 'trouble sleeping', "can't eat",
    ];
    for (const keyword of concernKeywords) {
      if (text.toLowerCase().includes(keyword)) {
        const concern = `${keyword} (turn ${state.turn})`;
        if (!state.flaggedConcerns.includes(concern)) {
          state.flaggedConcerns.push(concern);
          state.followUpDue = true;
          console.log(`🚩  [${state.roomId}] Concern flagged: ${keyword}`);
        }
      }
    }

    // Track memories mentioned
    if (
      text.toLowerCase().includes('remember') ||
      text.toLowerCase().includes('used to') ||
      text.toLowerCase().includes('back when') ||
      text.toLowerCase().includes('years ago')
    ) {
      const summary = text.split('.')[0].slice(0, 60);
      if (!state.tenantMemories.includes(summary)) {
        state.tenantMemories.push(summary);
        if (state.tenantMemories.length > 15) state.tenantMemories.shift();
      }
    }
  }
}
