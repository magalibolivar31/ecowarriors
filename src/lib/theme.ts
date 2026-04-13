const LIGHT_MISSION_COLORS = new Set([
  'bg-soft-maya-blue',
  'bg-maya-blue',
  'bg-soft-teal'
]);

export const getMissionIconTextColor = (missionColor: string): string =>
  LIGHT_MISSION_COLORS.has(missionColor) ? 'text-dark-teal' : 'text-white';
