import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  collectionGroup
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { MISSIONS, Mission } from '../constants/missions';
import { Report, Squad, UserSettings, ReportUpdate } from '../types';

export async function calculateMissions(
  userReports: Report[],
  allReports: Report[],
  userUpdates: ReportUpdate[],
  userSquads: Squad[],
  userSettings: UserSettings | null
): Promise<Mission[]> {
  if (!auth.currentUser) return [];
  const uid = auth.currentUser.uid;

  try {
    // 5. Calculate progress for each mission
    return MISSIONS.map(m => {
      let progress = 0;
      let status: 'available' | 'in-progress' | 'completed' = 'available';

      switch (m.id) {
        case 'primer-reporte':
          const hasReportWithImage = userReports.some(r => r.initialImageUrl);
          progress = hasReportWithImage ? 100 : 0;
          break;
        case 'ojo-aguila':
          // Check if user has a report in a zone that was relatively empty
          // Simplified: if user has a report and it's one of the first 10 reports in the system
          const userReportIds = new Set(userReports.map(r => r.id));
          const firstReports = allReports.slice(-10); // Last 10 created (desc order)
          const isPioneer = firstReports.some(r => userReportIds.has(r.id));
          progress = isPioneer ? 100 : (userReports.length > 0 ? 50 : 0);
          break;
        case 'ojo-critico':
          progress = userUpdates.length > 0 ? 100 : 0;
          break;
        case 'cierre-responsable':
          const hasResolvedWithEvidence = userUpdates.some(u => u.newStatus === 'Resuelto' && u.imageUrl);
          progress = hasResolvedWithEvidence ? 100 : 0;
          break;
        case 'accion-comunitaria':
          progress = userSquads.length > 0 ? 100 : 0;
          break;
        case 'prevencion-activa':
          const hasContacts = (userSettings?.trustedContacts?.length || 0) > 0;
          const onboardingDone = userSettings?.onboardingCompleted || false;
          progress = (hasContacts && onboardingDone) ? 100 : (hasContacts || onboardingDone ? 50 : 0);
          break;
      }

      if (progress === 100) status = 'completed';
      else if (progress > 0) status = 'in-progress';

      return { ...m, progress, status } as Mission;
    });
  } catch (error) {
    console.error("Error calculating missions:", error);
    return [];
  }
}
