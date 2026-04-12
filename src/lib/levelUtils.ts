export const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000];
export const MAX_LEVEL = LEVEL_THRESHOLDS.length;

export const calculateLevel = (xp: number): number => {
  for (let level = MAX_LEVEL; level > 1; level--) {
    if (xp >= LEVEL_THRESHOLDS[level - 1]) return level;
  }
  return 1;
};

export const getLevelProgress = (xp: number, level: number) => {
  const normalizedLevel = Math.max(1, Math.min(level, MAX_LEVEL));
  const currentLevelXP = LEVEL_THRESHOLDS[normalizedLevel - 1] || 0;
  const nextLevelXP = LEVEL_THRESHOLDS[normalizedLevel] || LEVEL_THRESHOLDS[MAX_LEVEL - 1];
  const xpInLevel = xp - currentLevelXP;
  const xpNeeded = nextLevelXP - currentLevelXP;

  if (xpNeeded <= 0) {
    return {
      progress: 100,
      nextLevelXP,
      xpRemaining: 0,
    };
  }

  return {
    progress: Math.max(0, Math.min(100, (xpInLevel / xpNeeded) * 100)),
    nextLevelXP,
    xpRemaining: Math.max(0, nextLevelXP - xp),
  };
};
