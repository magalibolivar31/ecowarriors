import { auth } from '../firebase';
import { Mission } from '../constants/missions';
import { calculateMissionProgress } from '../lib/missionProgress';
import { Report, Squad, UserSettings, ReportUpdate } from '../types';

export async function calculateMissions(
  userReports: Report[],
  allReports: Report[],
  userUpdates: ReportUpdate[],
  userSquads: Squad[],
  userSettings: UserSettings | null
): Promise<Mission[]> {
  if (!auth.currentUser) return [];

  try {
    return calculateMissionProgress({
      userReports,
      allReports,
      userUpdates,
      userSquads,
      userSettings,
    });
  } catch (error) {
    console.error('Error calculating missions:', error);
    return [];
  }
}
