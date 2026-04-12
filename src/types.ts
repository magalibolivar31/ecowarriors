import { Timestamp } from 'firebase/firestore';

export type ReportType = 'ambiental' | 'crisis';

export type ReportStatus = 
  | 'Abierto (nuevo)' 
  | 'Abierto (en seguimiento)' 
  | 'Abierto (agravado)' 
  | 'Resuelto'
  | 'Cancelado'
  | 'Cargado por error';

export interface ReportLocation {
  lat: number;
  lng: number;
}

export interface Report {
  id: string;
  uid: string;
  type: ReportType;
  title: string;
  description: string;
  location: ReportLocation;
  createdAt: Timestamp;
  createdBy: string;
  createdByName: string;
  initialImageUrl: string | null;
  currentStatus: ReportStatus;
  isActive: boolean;
  aiAnalysis?: {
    categoria: string;
    subcategorias: string[];
    volumenEstimado: string;
    nivelUrgencia: number;
    analisis: string;
  };
}

export type SquadStatus = 'próxima' | 'completa' | 'finalizada' | 'cancelada';

export interface Squad {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  attendees: string[]; // UIDs
  createdBy: string;
  createdAt: Timestamp;
  status: SquadStatus;
  maxParticipants?: number;
}

export type PostStatus = 'disponible' | 'reservado' | 'entregado/resuelto' | 'vencido';

export interface MarketplacePost {
  id: string;
  uid: string;
  type: 'doy' | 'recibo';
  title: string;
  content: string;
  tag: string;
  images: string[];
  contact: string;
  status: PostStatus;
  createdAt: Timestamp;
  isActive?: boolean;
}

export type Post = MarketplacePost;

export interface UserSettings {
  uid: string;
  onboardingCompleted: boolean;
  crisisRemindersEnabled: boolean;
  meetingPoint: {
    place: string;
  };
  trustedContacts: {
    name: string;
    phone: string;
  }[];
  darkMode?: boolean;
  locationPrivacy?: boolean;
}

export interface ReportUpdate {
  id: string;
  createdAt: Timestamp;
  createdBy: string;
  createdByName: string;
  description: string;
  newStatus: ReportStatus;
  imageUrl: string | null;
}
