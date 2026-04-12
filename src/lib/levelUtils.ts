export const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000];

export const calculateLevel = (xp: number): number => {
  if (xp >= 1000) return 5;
  if (xp >= 600) return 4;
  if (xp >= 300) return 3;
  if (xp >= 100) return 2;
  return 1;
};

export const getLevelProgress = (xp: number, level: number) => {
  const currentLevelXP = LEVEL_THRESHOLDS[level - 1] || 0;
  const nextLevelXP = LEVEL_THRESHOLDS[level] || 1000;
  const xpInLevel = xp - currentLevelXP;
  const xpNeeded = nextLevelXP - currentLevelXP;
  
  return {
    progress: Math.min(100, (xpInLevel / xpNeeded) * 100),
    nextLevelXP,
    xpRemaining: nextLevelXP - xp
  };
};
