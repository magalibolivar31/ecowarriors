import { 
  FileText, 
  Eye, 
  MessageSquare, 
  CheckCircle2, 
  Users, 
  ShieldCheck,
  LucideIcon
} from 'lucide-react';

export interface Mission {
  id: string;
  title: string;
  description: string;
  objective: string;
  reward: number;
  icon: LucideIcon;
  color: string;
  status: 'available' | 'in-progress' | 'completed';
  suggestedAction: string;
  progress: number; // 0 to 100
}

const LIGHT_MISSION_BACKGROUNDS = new Set([
  'bg-soft-maya-blue',
  'bg-maya-blue',
  'bg-soft-teal'
]);

export const getMissionIconTextClass = (color: string) =>
  LIGHT_MISSION_BACKGROUNDS.has(color) ? 'text-zinc-900' : 'text-white';

export const MISSIONS: Omit<Mission, 'status' | 'progress'>[] = [
  {
    id: 'primer-reporte',
    title: 'Primer Reporte',
    description: 'Crear un reporte con imagen',
    objective: 'Documentar visualmente un problema ambiental para facilitar su identificación.',
    reward: 50,
    icon: FileText,
    color: 'bg-stormy-teal',
    suggestedAction: 'Buscá un problema en tu zona, tomá una foto y reportalo.'
  },
  {
    id: 'ojo-aguila',
    title: 'Ojo de Águila',
    description: 'Reportar una zona no previamente reportada',
    objective: 'Expandir la cobertura del mapa de EcoWarriors a nuevas áreas.',
    reward: 100,
    icon: Eye,
    color: 'bg-soft-maya-blue',
    suggestedAction: 'Explorá una zona del mapa que no tenga reportes activos y creá uno.'
  },
  {
    id: 'ojo-critico',
    title: 'Ojo Crítico',
    description: 'Agregar una actualización a un reporte existente',
    objective: 'Mantener la información actualizada para un mejor seguimiento.',
    reward: 30,
    icon: MessageSquare,
    color: 'bg-maya-blue',
    suggestedAction: 'Buscá un reporte cercano y agregá un comentario o foto sobre su estado actual.'
  },
  {
    id: 'cierre-responsable',
    title: 'Cierre Responsable',
    description: 'Marcar un reporte como resuelto con evidencia',
    objective: 'Confirmar la resolución de problemas con pruebas visuales.',
    reward: 150,
    icon: CheckCircle2,
    color: 'bg-emerald-action',
    suggestedAction: 'Cuando veas que un problema se solucionó, actualizalo a "Resuelto" subiendo una foto.'
  },
  {
    id: 'accion-comunitaria',
    title: 'Acción Comunitaria',
    description: 'Inscribirse a una cuadrilla',
    objective: 'Fomentar la participación en actividades grupales de impacto.',
    reward: 80,
    icon: Users,
    color: 'bg-soft-teal',
    suggestedAction: 'Unite a una de las cuadrillas activas en la pestaña de Comunidad.'
  },
  {
    id: 'prevencion-activa',
    title: 'Prevención Activa',
    description: 'Configurar un contacto y usar Modo Crisis',
    objective: 'Estar preparado para situaciones de emergencia.',
    reward: 120,
    icon: ShieldCheck,
    color: 'bg-stormy-teal',
    suggestedAction: 'Completá el onboarding del Modo Crisis y configurá tus contactos de confianza.'
  }
];
