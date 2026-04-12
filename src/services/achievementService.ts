import { Report, Squad } from '../types';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
}

export function calculateAchievements(reports: Report[], squads: Squad[]): Achievement[] {
  const achievements: Achievement[] = [
    {
      id: 'first-report',
      title: 'Primer Reporte',
      description: 'Documentaste tu primer problema ambiental.',
      unlocked: reports.length > 0
    },
    {
      id: 'problem-solver',
      title: 'Solucionador',
      description: 'Ayudaste a resolver al menos un reporte.',
      unlocked: reports.some(r => r.currentStatus === 'Resuelto')
    },
    {
      id: 'community-hero',
      title: 'Héroe Comunitario',
      description: 'Participaste en tu primera cuadrilla.',
      unlocked: squads.length > 0
    },
    {
      id: 'active-guardian',
      title: 'Guardián Activo',
      description: 'Realizaste más de 5 reportes.',
      unlocked: reports.length >= 5
    },
    {
      id: 'crisis-responder',
      title: 'Rescatista',
      description: 'Reportaste una situación de crisis.',
      unlocked: reports.some(r => r.type === 'crisis')
    },
    {
      id: 'squad-leader',
      title: 'Líder de Cuadrilla',
      description: 'Participaste en 3 o más cuadrillas.',
      unlocked: squads.length >= 3
    },
    {
      id: 'environmental-expert',
      title: 'Experto Ambiental',
      description: 'Reportaste en 3 categorías diferentes.',
      unlocked: new Set(reports.map(r => r.aiAnalysis?.categoria).filter(Boolean)).size >= 3
    }
  ];

  return achievements.filter(a => a.unlocked);
}
