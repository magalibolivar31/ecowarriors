interface ChatRateLimitState {
  timestamps: number[];
  lastSentAt: number;
}

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

const ROCCO_CHAT_RATE_LIMIT_KEY = 'rocco_chat_rate_limit';
const ROCCO_CHAT_WINDOW_MS = 60_000;
const ROCCO_CHAT_MAX_MESSAGES = 8;
const ROCCO_CHAT_MIN_INTERVAL_MS = 3_000;
const ROCCO_CHAT_MIN_WAIT_MS = 1_000;

function loadState(storage: StorageLike, key: string): ChatRateLimitState {
  try {
    const raw = storage.getItem(key);
    if (!raw) return { timestamps: [], lastSentAt: 0 };

    const parsed = JSON.parse(raw) as ChatRateLimitState;
    return {
      timestamps: Array.isArray(parsed.timestamps)
        ? parsed.timestamps.filter((value): value is number => Number.isFinite(value))
        : [],
      lastSentAt: Number.isFinite(parsed.lastSentAt) ? parsed.lastSentAt : 0,
    };
  } catch {
    return { timestamps: [], lastSentAt: 0 };
  }
}

function saveState(storage: StorageLike, key: string, state: ChatRateLimitState) {
  storage.setItem(key, JSON.stringify(state));
}

export function toWholeSeconds(milliseconds: number): number {
  return Math.ceil(milliseconds / 1000);
}

export function consumeRoccoChatQuota(
  now = Date.now(),
  storage: StorageLike | null =
    typeof window !== 'undefined' ? window.localStorage : null,
): { allowed: true } | { allowed: false; waitMs: number } {
  if (!storage) return { allowed: true };

  const state = loadState(storage, ROCCO_CHAT_RATE_LIMIT_KEY);
  const recentMessages = state.timestamps.filter((timestamp) => now - timestamp < ROCCO_CHAT_WINDOW_MS);
  const wasPruned = recentMessages.length !== state.timestamps.length;
  const minIntervalRemaining =
    state.lastSentAt > 0 ? ROCCO_CHAT_MIN_INTERVAL_MS - (now - state.lastSentAt) : 0;

  if (minIntervalRemaining > 0) {
    if (wasPruned) {
      saveState(storage, ROCCO_CHAT_RATE_LIMIT_KEY, {
        timestamps: recentMessages,
        lastSentAt: state.lastSentAt,
      });
    }
    return { allowed: false, waitMs: minIntervalRemaining };
  }

  if (recentMessages.length >= ROCCO_CHAT_MAX_MESSAGES) {
    if (wasPruned) {
      saveState(storage, ROCCO_CHAT_RATE_LIMIT_KEY, {
        timestamps: recentMessages,
        lastSentAt: state.lastSentAt,
      });
    }

    const windowRemaining = ROCCO_CHAT_WINDOW_MS - (now - recentMessages[0]);
    return { allowed: false, waitMs: Math.max(windowRemaining, ROCCO_CHAT_MIN_WAIT_MS) };
  }

  saveState(storage, ROCCO_CHAT_RATE_LIMIT_KEY, {
    timestamps: [...recentMessages, now],
    lastSentAt: now,
  });

  return { allowed: true };
}
