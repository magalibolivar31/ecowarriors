import { Mission, MISSIONS } from '../constants/missions';
import { Report, ReportUpdate, Squad, UserSettings } from '../types';

interface MissionProgressInput {
  userReports: Report[];
  allReports: Report[];
  userUpdates: ReportUpdate[];
  userSquads: Squad[];
  userSettings: UserSettings | null;
}

export function calculateMissionProgress({
  userReports,
  allReports,
  userUpdates,
  userSquads,
  userSettings,
}: MissionProgressInput): Mission[] {
  return MISSIONS.map((mission) => {
    let progress = 0;
    let status: 'available' | 'in-progress' | 'completed' = 'available';

    switch (mission.id) {
      case 'primer-reporte': {
        const hasReportWithImage = userReports.some((report) => report.initialImageUrl);
        progress = hasReportWithImage ? 100 : 0;
        break;
      }
      case 'ojo-aguila': {
        const userReportIds = new Set(userReports.map((report) => report.id));
        const firstReports = allReports.slice(-10); // Last 10 created (desc order)
        const isPioneer = firstReports.some((report) => userReportIds.has(report.id));
        progress = isPioneer ? 100 : userReports.length > 0 ? 50 : 0;
        break;
      }
      case 'ojo-critico':
        progress = userUpdates.length > 0 ? 100 : 0;
        break;
      case 'cierre-responsable': {
        const hasResolvedWithEvidence = userUpdates.some(
          (update) => update.newStatus === 'Resuelto' && update.imageUrl,
        );
        progress = hasResolvedWithEvidence ? 100 : 0;
        break;
      }
      case 'accion-comunitaria':
        progress = userSquads.length > 0 ? 100 : 0;
        break;
      case 'prevencion-activa': {
        const hasContacts = (userSettings?.trustedContacts?.length || 0) > 0;
        const onboardingDone = userSettings?.onboardingCompleted || false;
        progress = hasContacts && onboardingDone ? 100 : hasContacts || onboardingDone ? 50 : 0;
        break;
      }
    }

    if (progress === 100) status = 'completed';
    else if (progress > 0) status = 'in-progress';

    return { ...mission, progress, status } as Mission;
  });
}
