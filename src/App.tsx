import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Camera, 
  Upload, 
  AlertTriangle, 
  X, 
  Plus, 
  Search, 
  Hash, 
  ChevronRight, 
  ChevronLeft,
  MessageSquare,
  Package,
  ArrowRight,
  Loader2,
  Filter,
  Info,
  MapPin,
  Trash2,
  LayoutDashboard,
  Calendar,
  Clock,
  Map as MapIcon,
  Users,
  User,
  Edit2,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Heart,
  Phone,
  Backpack,
  Navigation,
  Activity,
  Droplets,
  Wind,
  Bot,
  Instagram,
  HeartHandshake,
  Shield,
  Zap,
  Trophy,
  Sparkles,
  Droplets as Water,
  CloudRain,
  Sun,
  Cloud,
  CloudLightning,
  CloudFog
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { cn, sanitizeText } from './lib/utils';
import { getCurrentLocation, geoErrorKey } from './lib/geolocation';
import { initializeImageOptimization } from './lib/imageOptimization';
import { analyzeReport, validateDonation, validateRequest, ReportAnalysis } from './services/geminiService';
import { CollaborativeMap, MapReport } from './components/CollaborativeMap';
import { RoccoChat } from './components/RoccoChat';
import { CrisisMode } from './components/CrisisMode';
import { ReportForm } from './components/ReportForm';
import { ReportCard } from './components/ReportCard';
import { ReportTimeline } from './components/ReportTimeline';
import { ReportMap } from './components/ReportMap';
import { ReportDetailModal } from './components/ReportDetailModal';
import { OnboardingLanding } from './components/OnboardingLanding';
import { ProfileScreen } from './components/ProfileScreen';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  where,
  getDoc,
  getDocs,
  setDoc,
  arrayUnion,
  arrayRemove,
  terminate,
  clearIndexedDbPersistence,
  Timestamp,
  limit
} from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { db, auth, handleFirestoreError, OperationType, storage, cleanFirestoreData } from './firebase';
import { 
  subscribeToActiveReports, 
  subscribeToAllReports,
  subscribeToReportUpdates,
  subscribeToAllUpdates,
  createReport as createReportService,
  addReportUpdate,
  deleteReport,
  cancelReport,
  normalizeAllReports
} from './services/reportService';
import { subscribeToSquads, toggleSquadAttendance, createSquad, updateSquad, cancelSquad, deleteSquad } from './services/squadService';
import { subscribeToMarketplace, createMarketplacePost, updatePostStatus, deleteMarketplacePost, cancelMarketplacePost } from './services/marketplaceService';
import { getUserSettings, updateUserSettings, getUserProfile } from './services/userService';
import { calculateMissions } from './services/missionService';
import { calculateLevel } from './lib/levelUtils';
import { getValidationErrorKey } from './lib/validation';
import { 
  notifyReportStatusChanged, 
  notifySquadConfirmed, 
  notifySquadCancelled, 
  notifyCrisisModeChanged, 
  notifyVolunteerRegistered,
  requestNotificationPermission
} from './services/notificationService';
import { Mission, getMissionIconTextClass } from './constants/missions';
import { SUCCESS_ANIMATION_DURATION_MS } from './constants/feedback';
import { Report, ReportUpdate, Squad, MarketplacePost, UserSettings, ReportType } from './types';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User as FirebaseUser } from 'firebase/auth';

import { SettingsProvider, useSettings } from './contexts/SettingsContext';

// --- Types ---

type Tab = 'DASHBOARD' | 'REPORTES' | 'COMUNIDAD' | 'MAPA' | 'CHATBOT' | 'PERFIL';
type Tag = 'ropa' | 'comida' | 'otros';
type PostType = 'doy' | 'recibo';

interface Post {
  id: string;
  uid: string;
  type: PostType;
  title: string;
  content?: string;
  tag: Tag;
  images?: string[];
  contact?: string;
  createdAt: any;
}

interface CrewEvent {
  id: string;
  title: string;
  description: string;
  date: any;
  location: string;
  attendees: string[];
  createdAt: any;
}

interface VolunteerData {
  uid: string;
  name: string;
  contact: string;
  zone: string;
  helpType?: string;
  schedule?: string;
  notes?: string;
  status: 'reserva';
  createdAt: any;
}

interface Volunteer {
  id: string;
  name: string;
  role: string;
  avatar: string;
  status: 'online' | 'offline';
  tasks: number;
}

interface Crew {
  id: string;
  name: string;
  members: number;
  area: string;
  active: boolean;
}

interface CarouselCard {
  id: string;
  type: 'hero' | 'info' | 'video' | 'contact';
  title: string;
  description: string;
  imageUrl?: string | null;
  tag?: string;
  videoLinks?: { label: string; url: string }[];
  contactLink?: { label: string; url: string };
}

const CAROUSEL_CARDS: CarouselCard[] = [
  {
    id: 'hero',
    type: 'hero',
    tag: 'carousel.hero_tag',
    title: 'carousel.hero_title',
    description: 'carousel.hero_desc',
    imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gemini-drive-1aff6.firebasestorage.app/o/dashboard%2Fhero.png?alt=media&token=77293349-9f2f-4dfd-8eb3-edb1e93e8792',
  },
  {
    id: 'ciclo',
    type: 'info',
    title: 'carousel.cycle_title',
    description: 'carousel.cycle_desc',
  },
  {
    id: 'videos',
    type: 'video',
    title: 'carousel.resources_title',
    description: 'carousel.resources_desc',
    videoLinks: [
      { label: 'carousel.video_presentation', url: 'https://youtu.be/lvZwQaB6-m0?si=UeL8WL246Y8Qyp3E' },
      { label: 'carousel.video_technical', url: 'https://youtu.be/Sp47OiUobtU?si=Hy4N1ytCW4IBcjdG' }
    ]
  },
  {
    id: 'contacto',
    type: 'contact',
    title: 'carousel.contact_title',
    description: 'carousel.contact_desc',
    imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gemini-drive-1aff6.firebasestorage.app/o/dashboard%2Fquestion2.png?alt=media&token=c176a4ec-4fb7-4b86-b8d2-e296ea38944d',
    contactLink: { label: 'equipoecowarriors@gmail.com', url: 'mailto:equipoecowarriors@gmail.com' }
  }
];

const FEEDBACK_FORM_URL = 'https://forms.gle/yTVGetUWAwyG7JbbA';

// --- Components ---

const Modal = ({ isOpen, onClose, children, title }: { isOpen: boolean; onClose: () => void; children: React.ReactNode; title?: string }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement;
    const focusableSelector = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex^="-"])'
    ].join(', ');

    const focusableElements = modalRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [];
    const firstFocusable = focusableElements[0] ?? null;
    const lastFocusable = focusableElements[focusableElements.length - 1] ?? null;
    const fallbackFocusable = modalRef.current;

    const initialFocusTimeout = window.setTimeout(() => {
      (firstFocusable ?? fallbackFocusable)?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key === 'Tab') {
        if (!focusableElements.length) {
          event.preventDefault();
          fallbackFocusable?.focus();
          return;
        }

        if (event.shiftKey && firstFocusable && document.activeElement === firstFocusable) {
          event.preventDefault();
          (lastFocusable ?? fallbackFocusable)?.focus();
        } else if (!event.shiftKey && lastFocusable && document.activeElement === lastFocusable) {
          event.preventDefault();
          (firstFocusable ?? fallbackFocusable)?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(initialFocusTimeout);
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused && document.contains(previouslyFocused) && 'focus' in previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;
  return (
    <div className="modal-overlay">
      <motion.div 
        ref={modalRef}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Modal'}
        tabIndex={-1}
      >
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-zinc-100 bg-brand-bg/50">
          <h3 className="text-lg sm:text-xl font-display font-black text-stormy-teal uppercase tracking-tighter">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
          {children}
        </div>
      </motion.div>
    </div>
  );
};

const UrgencyBadge = ({ level }: { level: number | string }) => {
  const { t } = useSettings();
  const numericLevel = typeof level === 'number' ? level : (level === 'critica' ? 5 : 4);
  const colors = [
    'bg-emerald-action/10 text-emerald-action border-emerald-action/20',
    'bg-maya-blue/10 text-maya-blue border-maya-blue/20',
    'bg-yellow-100 text-yellow-700 border-yellow-200',
    'bg-orange-100 text-orange-700 border-orange-200',
    'bg-red-100 text-red-700 border-red-200',
  ];
  const getUrgencyLabel = (l: number) => {
    return t(`reports.urgency_${l}`);
  };
  const safeLevel = Math.max(1, Math.min(5, numericLevel));
  return (
    <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border", colors[safeLevel - 1])}>
      {getUrgencyLabel(safeLevel)}
    </span>
  );
};

// --- Main App ---

export default function App() {
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  );
}

function AppContent() {
  const { t, language, darkMode, notificationsEnabled, showAlert, showConfirm } = useSettings();
  const [selectedReportForDetail, setSelectedReportForDetail] = useState<Report | null>(null);
  const [selectedReportForHistory, setSelectedReportForHistory] = useState<Report | null>(null);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsReady, setReportsReady] = useState(false);
  const [userUpdates, setUserUpdates] = useState<ReportUpdate[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [posts, setPosts] = useState<MarketplacePost[]>([]);
  const [crewEvents, setCrewEvents] = useState<Squad[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [isVolunteer, setIsVolunteer] = useState(false);
  const [checkingVolunteer, setCheckingVolunteer] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('DASHBOARD');
  const [isCrisisMode, setIsCrisisMode] = useState(false);
  const handleCrisisModeToggle = (active: boolean) => {
    setIsCrisisMode(active);
    if (notificationsEnabled) {
      notifyCrisisModeChanged(active);
    }
  };
  const [hasClimateAlert, setHasClimateAlert] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [carouselCards, setCarouselCards] = useState<CarouselCard[]>(CAROUSEL_CARDS);
  const isAdmin = userProfile?.role === 'admin';
  const currentUserId = auth.currentUser?.uid;

  const [showAllMissions, setShowAllMissions] = useState(false);
  const [marketplaceTypeFilter, setMarketplaceTypeFilter] = useState<'todos' | 'doy' | 'recibo'>('todos');
  const [editingPost, setEditingPost] = useState<MarketplacePost | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const [deletingReportIds, setDeletingReportIds] = useState<Set<string>>(new Set());
  const [deletingPostIds, setDeletingPostIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    initializeImageOptimization();
  }, []);

  const validateField = (name: string, value: string) => {
    if (name === 'contact' && !value.trim()) {
      setFieldErrors(prev => ({ ...prev, [name]: null }));
      return null;
    }
    const errorKey = getValidationErrorKey(name, value);
    const error = errorKey ? t(errorKey) : null;

    setFieldErrors(prev => ({ ...prev, [name]: error }));
    return error;
  };

  // Handlers para reportes
  const handleDeleteReport = async (reportId: string, reportType: 'ambiental' | 'crisis') => {
    setDeletingReportIds((prev) => {
      const next = new Set(prev);
      next.add(reportId);
      return next;
    });
    try {
      await deleteReport(reportId, reportType);
    } catch (e) {
      setDeletingReportIds((prev) => {
        const next = new Set(prev);
        next.delete(reportId);
        return next;
      });
      console.error('Error eliminando reporte:', e);
      showAlert(t('common.error'), t('dashboard.delete_error'));
    }
  };

  const handleOwnerDeleteReport = async (reportId: string, reportType: 'ambiental' | 'crisis') => {
    if (!auth.currentUser) return;
    try {
      await cancelReport(
        reportId,
        reportType,
        auth.currentUser.uid,
        userProfile?.alias || auth.currentUser.displayName || 'Usuario EcoWarrior'
      );
    } catch (e) {
      console.error('Error cancelando reporte:', e);
      showAlert(t('common.error'), t('dashboard.delete_error'));
    }
  };

  // Handlers para marketplace
  const removeFromDeletingPostIds = (postId: string) => {
    setDeletingPostIds((prev) => {
      const next = new Set(prev);
      next.delete(postId);
      return next;
    });
  };

  const handleDeletePost = async (postId: string) => {
    setDeletingPostIds((prev) => {
      const next = new Set(prev);
      next.add(postId);
      return next;
    });
    try {
      await deleteMarketplacePost(postId);
      removeFromDeletingPostIds(postId);
    } catch (e) {
      removeFromDeletingPostIds(postId);
      console.error('Error eliminando post:', e);
      showAlert(t('common.error'), t('marketplace.delete_error'));
    }
  };

  const handleOwnerDeletePost = async (postId: string) => {
    setDeletingPostIds((prev) => {
      const next = new Set(prev);
      next.add(postId);
      return next;
    });
    try {
      await cancelMarketplacePost(postId);
      removeFromDeletingPostIds(postId);
    } catch (e) {
      removeFromDeletingPostIds(postId);
      console.error('Error retirando post:', e);
      showAlert(t('common.error'), t('marketplace.cancel_error'));
    }
  };

  const [localUserCount, setLocalUserCount] = useState(0);
  const [volunteers, setVolunteers] = useState<any[]>([]);
  const [dashboardData, setDashboardData] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);

  // Derive crews for dashboard from crewEvents
  const crews = useMemo(() => {
    return crewEvents
      .filter(crew => {
        if (crew.status !== 'próxima') return false;
        if (!crew.date) return false;
        const crewDateTime = new Date(`${crew.date}T${crew.time || '00:00'}`);
        const now = new Date();
        return crewDateTime >= now;
      })
      .sort((a, b) => {
        // Sort by date ascending (closest first)
        const dateA = new Date(`${a.date}T${a.time || '00:00'}`).getTime();
        const dateB = new Date(`${b.date}T${b.time || '00:00'}`).getTime();
        return dateA - dateB;
      })
      .slice(0, 10);
  }, [crewEvents]);

  const chartTheme = useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        tickColor: '#334155',
        tooltipBackground: '#FFFFFF',
        tooltipBorder: '#D4E8E6',
        tooltipText: '#024153',
        tooltipShadow: '0 12px 30px -12px rgba(2,65,83,0.18)',
      };
    }

    const styles = getComputedStyle(document.documentElement);
    const getCssVar = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;

    return {
      tickColor: getCssVar('--text-secondary', '#334155'),
      tooltipBackground: getCssVar('--surface-elevated', '#FFFFFF'),
      tooltipBorder: getCssVar('--border', '#D4E8E6'),
      tooltipText: getCssVar('--text-primary', '#024153'),
      tooltipShadow: getCssVar('--card-shadow', '0 12px 30px -12px rgba(2,65,83,0.18)'),
    };
  }, [darkMode]);

  useEffect(() => {
    const updatedCarousel = [
      {
        id: 'hero',
        type: 'hero',
        tag: t('dashboard.hero_tag'),
        title: t('dashboard.hero_title'),
        description: t('dashboard.hero_desc'),
        imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gemini-drive-1aff6.firebasestorage.app/o/dashboard%2Fhero.png?alt=media&token=77293349-9f2f-4dfd-8eb3-edb1e93e8792',
      },
      {
        id: 'ciclo',
        type: 'info',
        title: t('dashboard.cycle_title'),
        description: t('dashboard.cycle_desc'),
      },
      {
        id: 'videos',
        type: 'video',
        title: t('dashboard.resources_title'),
        description: t('dashboard.resources_desc'),
        videoLinks: [
          { label: t('dashboard.view_presentation'), url: 'https://youtu.be/lvZwQaB6-m0?si=UeL8WL246Y8Qyp3E' },
          { label: t('dashboard.technical_video'), url: 'https://youtu.be/Sp47OiUobtU?si=Hy4N1ytCW4IBcjdG' }
        ]
      },
      {
        id: 'contacto',
        type: 'contact',
        title: t('dashboard.contact_title'),
        description: t('dashboard.contact_desc'),
        imageUrl: 'https://firebasestorage.googleapis.com/v0/b/gemini-drive-1aff6.firebasestorage.app/o/dashboard%2Fquestion2.png?alt=media&token=c176a4ec-4fb7-4b86-b8d2-e296ea38944d',
        contactLink: { label: t('dashboard.contact_label'), url: 'mailto:equipoecowarriors@gmail.com' }
      }
    ];
    setCarouselCards(updatedCarousel as CarouselCard[]);
  }, [t]);
  const [weather, setWeather] = useState<{ temp: number; code: number } | null>(null);
  const weatherData = useMemo(() => {
    if (!weather) return null;
    const codes: Record<number, string> = {
      0: t('dashboard.weather_clear'), 
      1: t('dashboard.weather_mostly_clear'), 
      2: t('dashboard.weather_partly_cloudy'), 
      3: t('dashboard.weather_cloudy'),
      45: t('dashboard.weather_fog'), 
      48: t('dashboard.weather_frost_fog'), 
      51: t('dashboard.weather_light_drizzle'), 
      53: t('dashboard.weather_moderate_drizzle'), 
      55: t('dashboard.weather_dense_drizzle'),
      61: t('dashboard.weather_light_rain'), 
      63: t('dashboard.weather_moderate_rain'), 
      65: t('dashboard.weather_heavy_rain'), 
      71: t('dashboard.weather_light_snow'), 
      73: t('dashboard.weather_moderate_snow'), 
      75: t('dashboard.weather_heavy_snow'),
      80: t('dashboard.weather_light_showers'), 
      81: t('dashboard.weather_moderate_showers'), 
      82: t('dashboard.weather_violent_showers'), 
      95: t('dashboard.weather_thunderstorm'), 
      96: t('dashboard.weather_light_hail_storm'), 
      99: t('dashboard.weather_heavy_hail_storm')
    };
    return { temp: weather.temp, condition: codes[weather.code] || t('dashboard.weather_unknown') };
  }, [weather, t]);
  const [currentSlide, setCurrentSlide] = useState(0);
  
  // Modals
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [isVolunteerModalOpen, setIsVolunteerModalOpen] = useState(false);
  const [isSquadModalOpen, setIsSquadModalOpen] = useState(false);
  const [editingSquadId, setEditingSquadId] = useState<string | null>(null);
  const [isAttendeesModalOpen, setIsAttendeesModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [selectedSquadForAttendees, setSelectedSquadForAttendees] = useState<Squad | null>(null);
  const [squadAttendeesProfiles, setSquadAttendeesProfiles] = useState<any[]>([]);
  const [postType, setPostType] = useState<PostType | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<MarketplacePost | Squad | null>(null);
  const [reportFilter, setReportFilter] = useState<'abiertos' | 'resueltos' | 'mios'>('abiertos');
  const [reportSearchQuery, setReportSearchQuery] = useState('');
  const [marketplaceSearchQuery, setMarketplaceSearchQuery] = useState('');

  // Squad Form State
  const [sTitle, setSTitle] = useState('');
  const [sDescription, setSDescription] = useState('');
  const [sDate, setSDate] = useState('');
  const [sTime, setSTime] = useState('');
  const [sLocation, setSLocation] = useState('');
  const [sMaxParticipants, setSMaxParticipants] = useState<number>(0);

  // Volunteer Form State
  const [vName, setVName] = useState('');
  const [vContact, setVContact] = useState('');
  const [vZone, setVZone] = useState('');
  const [vHelpType, setVHelpType] = useState('');
  const [vSchedule, setVSchedule] = useState('');
  const [vNotes, setVNotes] = useState('');
  const [isSubmittingVolunteer, setIsSubmittingVolunteer] = useState(false);

  // Form States
  const [loading, setLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [tag, setTag] = useState<Tag>('otros');
  const [contact, setContact] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [postCreationSuccess, setPostCreationSuccess] = useState(false);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [isConfirmingLocation, setIsConfirmingLocation] = useState(false);
  const [isAutoLocation, setIsAutoLocation] = useState(false);
  const [pendingAnalysis, setPendingAnalysis] = useState<ReportAnalysis | null>(null);
  const [descriptionError, setDescriptionError] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const postSuccessTimeoutRef = useRef<number | null>(null);

  const formatMarketplaceDate = (value: unknown) => {
    if (!value || typeof value !== 'object' || !('toDate' in value) || typeof value.toDate !== 'function') {
      return language === 'es' ? 'Reciente' : 'Recent';
    }
    try {
      return format(value.toDate(), 'dd MMM yyyy', { locale: language === 'es' ? es : enUS });
    } catch {
      return language === 'es' ? 'Reciente' : 'Recent';
    }
  };

  const getMarketplaceTimestamp = (value: unknown) => {
    if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
      try {
        return value.toDate().getTime();
      } catch {
        return 0;
      }
    }
    if (value instanceof Date) return value.getTime();
    return 0;
  };

  const normalizeMarketplaceType = (value: unknown): 'doy' | 'recibo' => {
    if (typeof value === 'string' && value.trim().toLowerCase() === 'doy') return 'doy';
    return 'recibo';
  };

  const activeMarketplacePosts = useMemo(
    () => [...posts]
      .filter((post) => post.isActive !== false && !deletingPostIds.has(post.id))
      .sort((a, b) => getMarketplaceTimestamp(b.createdAt) - getMarketplaceTimestamp(a.createdAt)),
    [posts, deletingPostIds],
  );

  const filteredMarketplacePosts = useMemo(() => {
    const searchTerm = marketplaceSearchQuery.trim().toLowerCase();
    if (!searchTerm && marketplaceTypeFilter === 'todos') return activeMarketplacePosts;
    return activeMarketplacePosts.filter((post) => {
      const normalizedTitle = typeof post.title === 'string' ? post.title : '';
      const normalizedContent = typeof post.content === 'string' ? post.content : '';
      const normalizedDescription = typeof post.description === 'string' ? post.description : '';
      const normalizedCategory = typeof post.category === 'string' ? post.category : (typeof post.tag === 'string' ? post.tag : '');
      const postType = typeof post.type === 'string' && post.type.trim().toLowerCase() === 'doy' ? 'doy' : 'recibo';
      const matchesSearch = !searchTerm ||
        normalizedTitle.toLowerCase().includes(searchTerm) ||
        normalizedContent.toLowerCase().includes(searchTerm) ||
        normalizedDescription.toLowerCase().includes(searchTerm) ||
        normalizedCategory.toLowerCase().includes(searchTerm);
      const matchesType = marketplaceTypeFilter === 'todos' || postType === marketplaceTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [activeMarketplacePosts, marketplaceSearchQuery, marketplaceTypeFilter]);

  const handleOpenFeedbackForm = () => {
    window.open(FEEDBACK_FORM_URL, '_blank', 'noopener,noreferrer');
    setIsFeedbackModalOpen(false);
  };

  // Search & Filter
  const [filterTag, setFilterTag] = useState<Tag | null>(null);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  const totalResolved = useMemo(() => reports.filter(r => r.currentStatus === 'Resuelto').length, [reports]);

  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      const matchesSearch =
        (r.title?.toLowerCase() ?? '').includes(reportSearchQuery?.toLowerCase() ?? '') ||
        (r.description?.toLowerCase() ?? '').includes(reportSearchQuery?.toLowerCase() ?? '');
      if (!matchesSearch) return false;

      if (reportFilter === 'abiertos') {
        // Solo activos y con estado abierto (no-admin no ve los inactivos)
        if (r.isActive === false && !isAdmin) return false;
        return r.currentStatus.startsWith('Abierto');
      }

      if (reportFilter === 'resueltos') {
        // Mostrar resueltos/cancelados aunque isActive=false
        return (
          r.currentStatus === 'Resuelto' ||
          r.currentStatus === 'Cancelado' ||
          r.currentStatus === 'Cargado por error'
        );
      }

      if (reportFilter === 'mios') {
        // Mis reportes: todos (activos e inactivos) creados por el usuario actual
        return r.createdBy === user?.uid;
      }

      // Fallback: solo activos
      if (r.isActive === false && !isAdmin) return false;
      return true;
    });
  }, [reports, reportFilter, reportSearchQuery, user, isAdmin]);
  const visibleReports = useMemo(
    () => filteredReports.filter((report) => !deletingReportIds.has(report.id)),
    [filteredReports, deletingReportIds],
  );
  const hasMineReports = useMemo(
    () => reports.some((report) => report.createdBy === user?.uid),
    [reports, user?.uid],
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);

  const scrollToTop = () => {
    contentScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  };

  useEffect(() => {
    const handleUnhandledRejection = async (event: PromiseRejectionEvent) => {
      if (event.reason?.message?.includes('INTERNAL ASSERTION FAILED')) {
        console.warn('Reiniciando Firestore por error crítico...');
        try {
          await terminate(db);
          await clearIndexedDbPersistence(db);
          window.location.reload();
        } catch (e) {
          window.location.reload();
        }
      }
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  }, []);

  useEffect(() => {
    scrollToTop();
  }, [activeTab]);

  useEffect(() => {
    let unsubPosts: (() => void) | null = null;
    let unsubEvents: (() => void) | null = null;
    let unsubReports: (() => void) | null = null;
    let unsubProfile: (() => void) | null = null;
    let unsubCrews: (() => void) | null = null;
    let unsubVolunteers: (() => void) | null = null;
    let unsubUpdates: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setAuthReady(true);
      setUser(currentUser);
      if (currentUser) {
        console.log("Authenticated user:", currentUser.email, currentUser.uid);
        
        // Normalizar reportes existentes al iniciar sesión (solo una vez)
        normalizeAllReports();
        
        // Ensure user profile exists
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          unsubProfile = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              setUserProfile(data);
              
              // Fetch local user count
              if (data.zone) {
                const qLocal = query(collection(db, 'users'), where('zone', '==', data.zone));
                getDocs(qLocal).then(snap => setLocalUserCount(snap.size));
                
                // Real Volunteers Effect
                const qVolunteers = query(
                  collection(db, 'users'),
                  where('zone', '==', data.zone),
                  limit(10)
                );
                
                if (unsubVolunteers) unsubVolunteers();
                unsubVolunteers = onSnapshot(qVolunteers, (snap) => {
                  setVolunteers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                });
              }
            }
          });
          
          const userDoc = await getDoc(userDocRef);
          if (!userDoc.exists()) {
            await setDoc(userDocRef, cleanFirestoreData({
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName || '',
              alias: currentUser.displayName || 'EcoWarrior',
              photoURL: currentUser.photoURL || null,
              role: 'citizen',
              level: 1,
              xp: 0,
              createdAt: serverTimestamp()
            }), { merge: true });
          }

          // Fetch user settings
          const settings = await getUserSettings();
          if (settings) {
            setUserSettings(settings);
          } else {
            const initialSettings: UserSettings = {
              uid: currentUser.uid,
              onboardingCompleted: false,
              crisisRemindersEnabled: true,
              meetingPoint: {
                place: ''
              },
              trustedContacts: [],
              locationPrivacy: false
            };
            await updateUserSettings(initialSettings);
            setUserSettings(initialSettings);
          }
        } catch (e) {
          console.error("Error ensuring user profile", e);
        }

        // Real Crews Effect
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Dashboard Data Effect
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const qDash = query(
          collection(db, 'reports'),
          where('createdAt', '>=', Timestamp.fromDate(sevenDaysAgo)),
          orderBy('createdAt', 'asc')
        );
        getDocs(qDash).then((snap) => {
          const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
          const counts: Record<string, number> = {};
          snap.docs.forEach(doc => {
            const date = doc.data().createdAt?.toDate();
            if (date) {
              const day = days[date.getDay()];
              counts[day] = (counts[day] || 0) + 1;
            }
          });
          const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            const dayName = days[d.getDay()];
            return { name: dayName, reportes: counts[dayName] || 0 };
          });
          setDashboardData(last7Days);
        });

        // Pie Data Effect
        getDocs(collection(db, 'reports')).then((snap) => {
          const typeCounts: Record<string, number> = {};
          const colors: Record<string, string> = {
            'Plástico': '#126B69',
            'Orgánico': '#6EB57D',
            'Escombros': '#75B9B3',
            'Tóxico': '#024153',
            'Vidrio': '#7CBCE8',
            'Metal': '#9DCAE9',
            'Otro': '#75B9B3'
          };
          snap.docs.forEach(doc => {
            const type = doc.data().wasteType || 'Otro';
            typeCounts[type] = (typeCounts[type] || 0) + 1;
          });
          setPieData(
            Object.entries(typeCounts).map(([name, value]) => ({
              name, value, color: colors[name] || '#75B9B3'
            }))
          );
        });

        // Carousel Images Effect
        const resolveCarouselImages = async () => {
          const updatedCards = await Promise.all(CAROUSEL_CARDS.map(async (card) => {
            if (card.imageUrl && card.imageUrl.startsWith('https://firebasestorage.googleapis.com')) {
              // Already a full URL
              return card;
            } else if (card.imageUrl) {
              try {
                const url = await getDownloadURL(ref(storage, card.imageUrl));
                return { ...card, imageUrl: url };
              } catch (e) {
                return card;
              }
            }
            return card;
          }));
          setCarouselCards(updatedCards);
        };
        resolveCarouselImages();

        // Weather Effect
        const fetchWeather = async (lat: number, lng: number) => {
          try {
            // Use current_weather=true which is a very stable endpoint
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&timezone=auto`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const data = await res.json();
            
            if (data && data.current_weather) {
              setWeather({
                temp: Math.round(data.current_weather.temperature),
                code: data.current_weather.weathercode ?? 0
              });
            } else {
              throw new Error("Invalid weather data format");
            }
          } catch (e) {
            // Log as info instead of error to avoid triggering user alerts if it's just a transient network issue
            console.info("Weather fetch failed (using fallback):", e instanceof Error ? e.message : String(e));
            // Fallback to a default weather if it fails to avoid UI errors/loading state forever
            setWeather({ temp: 22, code: 0 }); 
          }
        };
        
        // Use default to BA, but update if coords change
        fetchWeather(-34.6037, -58.3816);

        // Check volunteer status
        const checkV = async () => {
          try {
            const vDoc = await getDoc(doc(db, 'volunteers', currentUser.uid));
            setIsVolunteer(vDoc.exists());
          } catch (e) {
            console.error("Error checking volunteer status", e);
          } finally {
            setCheckingVolunteer(false);
          }
        };
        checkV();

        // Listen to marketplace posts
        setPostsLoading(true);
        setPostsError(null);
        unsubPosts = subscribeToMarketplace(
          (marketplacePosts) => {
            setPosts(marketplacePosts);
            setPostsLoading(false);
            setPostsError(null);
          },
          (message) => {
            setPostsLoading(false);
            setPostsError(message || t('community.load_posts_error'));
          },
        );

        // Listen to squads
        unsubEvents = subscribeToSquads((squads) => {
          setCrewEvents(squads);
        });

        setReportsReady(false);

        // Listen to reports using the new service
        unsubReports = subscribeToAllReports((allReports) => {
          setReports(allReports);
          setReportsReady(true);
        });

        // Listen to all updates for mission calculation
        unsubUpdates = subscribeToAllUpdates((allUpdates) => {
          // Filter updates by the current user
          const userOnlyUpdates = allUpdates.filter(u => u.createdBy === currentUser.uid);
          setUserUpdates(userOnlyUpdates);
        });
      } else {
        setCheckingVolunteer(false);
        setPosts([]);
        setPostsLoading(false);
        setPostsError(null);
        setCrewEvents([]);
        setReports([]);
        setReportsReady(false);
        setUserSettings(null);
        if (unsubPosts) unsubPosts();
        if (unsubEvents) unsubEvents();
        if (unsubReports) unsubReports();
        if (unsubProfile) unsubProfile();
        if (unsubCrews) unsubCrews();
        if (unsubVolunteers) unsubVolunteers();
        if (unsubUpdates) unsubUpdates();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubPosts) unsubPosts();
      if (unsubEvents) unsubEvents();
      if (unsubReports) unsubReports();
      if (unsubProfile) unsubProfile();
      if (unsubCrews) unsubCrews();
      if (unsubVolunteers) unsubVolunteers();
    };
  }, []);

  // Effect to calculate missions when data changes
  useEffect(() => {
    if (!user || !userProfile) return;

    const loadMissions = async () => {
      const userReports = reports.filter(r => r.createdBy === user.uid);
      const userSquads = crewEvents.filter(s => s.attendees.includes(user.uid));
      
      const calculatedMissions = await calculateMissions(
        userReports,
        reports,
        userUpdates,
        userSquads,
        userSettings
      );
      
      setMissions(calculatedMissions);

      const realXP = calculatedMissions
        .filter(m => m.status === 'completed')
        .reduce((sum, m) => sum + m.reward, 0);

      const realLevel = calculateLevel(realXP);

      if (realXP !== userProfile.xp || realLevel !== userProfile.level) {
        try {
          // Use setDoc with merge: true to avoid "No document to update" error if profile doesn't exist yet
          await setDoc(doc(db, 'users', user.uid), {
            xp: realXP,
            level: realLevel
          }, { merge: true });
        } catch (err) {
          console.error("Error updating user XP/Level:", err);
        }
      }
    };

    loadMissions();
  }, [reports, userUpdates, crewEvents, userSettings, user, userProfile?.uid]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const file = files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(language === 'es' ? 'Seleccioná un archivo de imagen válido.' : 'Please select a valid image file.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImages([reader.result as string]);
    };
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    if (postSuccessTimeoutRef.current) {
      window.clearTimeout(postSuccessTimeoutRef.current);
      postSuccessTimeoutRef.current = null;
    }
    setDescription('');
    setLocation('');
    setSelectedImages([]);
    setTitle('');
    setTag('otros');
    setContact('');
    setError(null);
    setPostCreationSuccess(false);
    setLoading(false);
    // Reset volunteer form too
    setVName('');
    setVContact('');
    setVZone('');
    setVHelpType('');
    setVSchedule('');
    setVNotes('');
    setFieldErrors({});
  };

  useEffect(() => {
    return () => {
      if (postSuccessTimeoutRef.current) {
        window.clearTimeout(postSuccessTimeoutRef.current);
      }
    };
  }, []);

  const handleCreateReport = async () => {
    if (!selectedImages[0] || !description || !location || !auth.currentUser) return;
    setLoading(true);
    setError(null);
    setDescriptionError(false);
    try {
      const base64 = selectedImages[0].split(',')[1];
      const analysis = await analyzeReport(base64, description, location);
      
      if (!analysis.isValid && !analysis.serviceUnavailable) {
        setError(analysis.validationError || t('reports.analyze_error'));
        setLoading(false);
        return;
      }

      if (!analysis.descriptionMatches && !analysis.serviceUnavailable) {
        setDescriptionError(true);
        setError(t('reports.image_mismatch'));
        setLoading(false);
        return;
      }

      setPendingAnalysis(analysis);
      setIsConfirmingLocation(true);
    } catch (err: any) {
      // Si es error de red/Cloud Function, usar fallback silencioso
      // No bloquear al usuario — permitir continuar con el reporte
      console.warn('AI analysis failed, proceeding without analysis:', err);
      // Continuar con valores por defecto en lugar de setError
    } finally {
      setLoading(false);
    }
  };

  const confirmAndUploadReport = async () => {
    if (!pendingAnalysis || !auth.currentUser) return;
    if (!coords?.lat || !coords?.lng) {
      setError('Ubicación requerida para crear un reporte.');
      return;
    }
    setLoading(true);
    try {
      const reportCoords = coords;
      
      await createReportService(
        'ambiental',
        pendingAnalysis.categoria,
        description,
        {
          lat: reportCoords.lat,
          lng: reportCoords.lng
        },
        selectedImages[0]
      );
      
      setIsReportModalOpen(false);
      setIsConfirmingLocation(false);
      setPendingAnalysis(null);
      resetForm();

      if (pendingAnalysis.nivelUrgencia === 5) {
        handleCrisisModeToggle(true);
      }
    } catch (err) {
      console.error("Error creating report:", err);
      setError(t('reports.db_save_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleEditPost = (post: MarketplacePost) => {
    const normalizedType = normalizeMarketplaceType(post.type);
    setEditingPost(post);
    setTitle(post.title);
    setDescription(post.description || post.content || '');
    setTag((post.category || post.tag || 'otros') as Tag);
    setContact(post.contact || '');
    setSelectedImages(post.imageUrl ? [post.imageUrl] : (post.images?.[0] ? [post.images[0]] : []));
    setPostType(normalizedType);
    setIsPostModalOpen(true);
  };

  const handleCreatePost = async () => {
    if (!title || !description || !auth.currentUser) return;
    if (!postType) {
      setError('Tipo de publicación inválido.');
      return;
    }

    const titleError = validateField('title', title);
    const descError = validateField('description', description);
    if (titleError || descError) return;

    setLoading(true);
    setImageUploading(Boolean(selectedImages[0] && selectedImages[0].startsWith('data:image/')));
    setError(null);
    try {
      const sanitizedTitle = sanitizeText(title);
      const sanitizedDescription = sanitizeText(description);
      const sanitizedContact = sanitizeText(contact);
      const normalizedCategory = tag || 'otros';

      if (editingPost) {
        await updateDoc(doc(db, 'marketplace', editingPost.id), {
          title: sanitizedTitle,
          description: sanitizedDescription,
          content: sanitizedDescription,
          category: normalizedCategory,
          tag: normalizedCategory,
          type: postType,
          contact: sanitizedContact || null,
          updatedAt: serverTimestamp(),
        });
        setEditingPost(null);
      } else {
        if (postType === 'doy' && selectedImages.length > 0) {
          const imagesB64 = selectedImages
            .filter((img) => img.startsWith('data:image/'))
            .map((img) => {
              const commaIndex = img.indexOf(',');
              if (commaIndex === -1) return null;
              return img.slice(commaIndex + 1);
            })
            .filter((b64): b64 is string => typeof b64 === 'string' && b64.length > 0);
          const validation = await validateDonation(imagesB64, sanitizedTitle, tag);
          if (!validation.valid) {
            setError(validation.retry ? "IA incierta. Sube una foto más clara." : "Imagen no coincide con descripción.");
            setLoading(false);
            return;
          }
          if (validation.serviceUnavailable && validation.reason) {
            showAlert(t('common.confirm'), validation.reason);
          }
        } else {
          const validation = await validateRequest(sanitizedTitle, sanitizedDescription, tag);
          if (!validation.valid) {
            setError(`No se puede publicar: ${validation.reason}`);
            setLoading(false);
            return;
          }
          if (validation.serviceUnavailable && validation.reason) {
            showAlert(t('common.confirm'), validation.reason);
          }
        }
        
        await createMarketplacePost(
          postType,
          sanitizedTitle,
          sanitizedDescription,
          normalizedCategory,
          selectedImages,
          sanitizedContact
        );
        setPostCreationSuccess(true);
        if (postSuccessTimeoutRef.current) {
          window.clearTimeout(postSuccessTimeoutRef.current);
        }
        postSuccessTimeoutRef.current = window.setTimeout(() => {
          postSuccessTimeoutRef.current = null;
          setIsPostModalOpen(false);
          resetForm();
        }, SUCCESS_ANIMATION_DURATION_MS);
        return;
      }

      setIsPostModalOpen(false);
      resetForm();
    } catch (err) {
      console.error('Error creating marketplace post:', err);
      setError(err instanceof Error ? err.message : 'Error al guardar la publicación.');
    } finally {
      setLoading(false);
      setImageUploading(false);
    }
  };

  const handleCreateSquad = async () => {
    if (!sTitle || !sDescription || !sDate || !sTime || !sLocation || !auth.currentUser) return;

    const titleError = validateField('sTitle', sTitle);
    const descError = validateField('sDescription', sDescription);
    const locationError = validateField('sLocation', sLocation);
    if (titleError || descError || locationError) return;

    // Past date validation
    const squadDateTime = new Date(`${sDate}T${sTime}`);
    if (squadDateTime < new Date()) {
      showAlert(t('common.confirm'), t('common.error_past_date'));
      return;
    }

    setLoading(true);
    try {
      const sanitizedSTitle = sanitizeText(sTitle);
      const sanitizedSDescription = sanitizeText(sDescription);
      const sanitizedSLocation = sanitizeText(sLocation);

      if (editingSquadId) {
        await updateSquad(editingSquadId, {
          title: sanitizedSTitle,
          description: sanitizedSDescription,
          date: sDate,
          time: sTime,
          location: sanitizedSLocation,
          maxParticipants: sMaxParticipants > 0 ? sMaxParticipants : undefined
        });
      } else {
        await createSquad(
          sanitizedSTitle,
          sanitizedSDescription,
          sDate,
          sTime,
          sanitizedSLocation,
          sMaxParticipants > 0 ? sMaxParticipants : undefined
        );
      }
      setIsSquadModalOpen(false);
      setEditingSquadId(null);
      setSTitle('');
      setSDescription('');
      setSDate('');
      setSTime('');
      setSLocation('');
      setSMaxParticipants(0);
    } catch (err) {
      console.error("Error creating/updating squad:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditSquad = (squad: Squad) => {
    setEditingSquadId(squad.id);
    setSTitle(squad.title);
    setSDescription(squad.description);
    setSDate(squad.date);
    setSTime(squad.time);
    setSLocation(squad.location);
    setSMaxParticipants(squad.maxParticipants || 0);
    setIsSquadModalOpen(true);
  };

  const [selectedSquadForDetail, setSelectedSquadForDetail] = useState<Squad | null>(null);
  const [squadToCancel, setSquadToCancel] = useState<string | null>(null);

  const handleCancelSquad = async (squadId: string) => {
    setSquadToCancel(squadId);
  };

  const confirmCancelSquad = async () => {
    if (!squadToCancel) return;
    setLoading(true);
    try {
      await deleteSquad(squadToCancel);
      setSquadToCancel(null);
    } catch (err) {
      console.error("Error deleting squad:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewAttendees = async (squad: Squad) => {
    setSelectedSquadForAttendees(squad);
    setIsAttendeesModalOpen(true);
    setSquadAttendeesProfiles([]);
    
    const profiles = await Promise.all(
      squad.attendees.map(uid => getUserProfile(uid))
    );
    setSquadAttendeesProfiles(profiles.filter(p => p !== null));
  };

  const handleRegisterVolunteer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const nameError = validateField('vName', vName);
    const contactError = validateField('vContact', vContact);
    const zoneError = validateField('vZone', vZone);
    const helpError = validateField('vHelpType', vHelpType);
    if (nameError || contactError || zoneError || helpError) return;

    setIsSubmittingVolunteer(true);
    try {
      const sanitizedVName = sanitizeText(vName);
      const sanitizedVContact = sanitizeText(vContact);
      const sanitizedVZone = sanitizeText(vZone);
      const sanitizedVHelpType = sanitizeText(vHelpType);
      const sanitizedVSchedule = sanitizeText(vSchedule);
      const sanitizedVNotes = sanitizeText(vNotes);

      const data: VolunteerData = {
        uid: auth.currentUser.uid,
        name: sanitizedVName,
        contact: sanitizedVContact,
        zone: sanitizedVZone,
        helpType: sanitizedVHelpType,
        schedule: sanitizedVSchedule,
        notes: sanitizedVNotes,
        status: 'reserva',
        createdAt: serverTimestamp()
      };
      await setDoc(doc(db, 'volunteers', auth.currentUser.uid), data);
      setIsVolunteer(true);
      setIsVolunteerModalOpen(false);
      resetForm();
      if (notificationsEnabled) {
        notifyVolunteerRegistered();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'volunteers');
    } finally {
      setIsSubmittingVolunteer(false);
    }
  };

  const toggleAttendance = async (eventId: string, isAttending: boolean, squadName?: string) => {
    if (!auth.currentUser) return;
    try {
      await toggleSquadAttendance(eventId, isAttending);
      if (notificationsEnabled && squadName) {
        if (isAttending) {
          notifySquadConfirmed(squadName);
        } else {
          notifySquadCancelled(squadName);
        }
      }
    } catch (err) {
      console.error("Error toggling attendance:", err);
    }
  };

  const handleGetLocation = async () => {
    setLoading(true);
    const result = await getCurrentLocation();
    setLoading(false);
    if (result.coords) {
      const { lat, lng } = result.coords;
      setLocation(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      setCoords(result.coords);
      setIsAutoLocation(true);
    } else {
      setError(t(geoErrorKey(result.error)));
    }
  };

  const handleLogout = async () => {
    try {
      scrollToTop();
      await signOut(auth);
    } catch (err) {
      console.error("Error during logout", err);
    }
  };

  const getWeatherIcon = (code?: number) => {
    if (code === undefined) return <Cloud className="w-12 h-12" />;
    if (code === 0) return <Sun className="w-12 h-12 text-amber-400" />;
    if (code <= 3) return <Cloud className="w-12 h-12 text-zinc-400" />;
    if (code <= 48) return <CloudFog className="w-12 h-12 text-zinc-300" />;
    if (code <= 67) return <CloudRain className="w-12 h-12 text-maya-blue" />;
    if (code <= 77) return <Wind className="w-12 h-12 text-zinc-200" />;
    if (code <= 82) return <CloudRain className="w-12 h-12 text-maya-blue" />;
    if (code <= 99) return <CloudLightning className="w-12 h-12 text-purple-500" />;
    return <Cloud className="w-12 h-12" />;
  };

  const getWeatherLabel = (code?: number) => {
    if (code === undefined) return t('weather.loading');
    if (code === 0) return t('weather.clear');
    if (code <= 3) return t('weather.partly_cloudy');
    if (code <= 48) return t('weather.fog');
    if (code <= 67) return t('weather.rain');
    if (code <= 77) return t('weather.snow');
    if (code <= 82) return t('weather.showers');
    if (code <= 99) return t('weather.storm');
    return t('weather.cloudy');
  };

  // --- Crisis Mode UI ---
  if (isCrisisMode) {
    return (
      <CrisisMode 
        onClose={() => handleCrisisModeToggle(false)} 
        userSettings={userSettings}
        onUpdateSettings={async (newSettings) => {
          await updateUserSettings(newSettings);
          setUserSettings(prev => prev ? { ...prev, ...newSettings } : null);
        }}
      />
    );
  }

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <OnboardingLanding />;
  }

  return (
    <div className={cn("min-h-screen flex flex-col transition-colors duration-300",
      darkMode ? "bg-brand-bg text-white" : "bg-brand-bg text-zinc-900"
    )}>
      {/* Top Header */}
      <header className="bg-white border-b border-zinc-100 sticky top-0 z-50 shadow-sm">
        <div className="app-container py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="https://firebasestorage.googleapis.com/v0/b/gemini-drive-1aff6.firebasestorage.app/o/logo%2Fecowarriors.jpg?alt=media&token=1325a27b-84b4-468e-a69e-a97a66b85333"
              alt="EcoWarriors"
              className="h-10 w-auto rounded-lg"
              loading="eager"
              decoding="async"
              fetchPriority="high"
              referrerPolicy="no-referrer"
            />
            <div className="hidden sm:block">
              <h1 className="text-xl font-display font-black tracking-tighter text-stormy-teal leading-none uppercase">ECOWARRIORS</h1>
              <span className="text-[10px] font-bold text-stormy-teal tracking-widest uppercase">{t('nav.resilience')}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFeedbackModalOpen(true)}
              className="p-2.5 bg-zinc-50 text-zinc-700 rounded-xl hover:bg-zinc-100 transition-all flex items-center gap-2"
              title={t('feedback.button')}
              aria-label={t('feedback.button')}
            >
              <MessageSquare className="w-5 h-5" />
              <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">{t('feedback.button')}</span>
            </button>

            <button 
              onClick={() => setIsCrisisMode(true)}
              className="p-2.5 bg-red-700 text-white rounded-xl hover:bg-red-800 transition-all flex items-center gap-2 border border-red-500/50 shadow-sm shadow-red-900/20"
              title={t('nav.crisis_mode')}
            >
              <ShieldAlert className="w-5 h-5" />
              <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">{t('nav.crisis_mode')}</span>
            </button>
            
            <div className="h-8 w-px bg-zinc-100 mx-2 hidden sm:block" />
            
            <div className="flex items-center gap-3 pl-2">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-black text-zinc-900 leading-none uppercase tracking-tighter">{userProfile?.alias || t('common.ecowarriors')}</p>
                <p className="text-[10px] font-bold text-stormy-teal uppercase tracking-widest">
                  {t('dashboard.level_progress').split(' • ')[0].replace('{level}', String(userProfile?.level || 1))}
                </p>
              </div>
              <button 
                onClick={() => setActiveTab('PERFIL')}
                className="w-10 h-10 rounded-xl overflow-hidden border-2 border-emerald-action/20 hover:border-emerald-action transition-all"
              >
                <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} alt="Profile" className="w-full h-full object-cover" loading="eager" decoding="async" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col sm:flex-row overflow-hidden relative">
        {/* Sidebar Navigation - Desktop */}
        <nav className="hidden sm:flex w-20 lg:w-64 bg-white border-r border-zinc-100 flex-col py-6 px-4 gap-2">
          {[
            { id: 'DASHBOARD', icon: LayoutDashboard, label: t('nav.dashboard') },
            { id: 'REPORTES', icon: MapPin, label: t('nav.reports') },
            { id: 'MAPA', icon: MapIcon, label: t('nav.map') },
            { id: 'COMUNIDAD', icon: Users, label: t('nav.community') },
            { id: 'CHATBOT', icon: Bot, label: t('nav.chatbot') },
            { id: 'PERFIL', icon: User, label: t('nav.profile') },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as Tab)}
              className={cn(
                "flex items-center gap-4 p-4 rounded-2xl transition-all group relative",
                activeTab === item.id 
                  ? "bg-stormy-teal text-white shadow-lg shadow-stormy-teal/20" 
                  : "text-zinc-400 hover:bg-zinc-50 hover:text-stormy-teal"
              )}
            >
              <item.icon className={cn("w-6 h-6 shrink-0", activeTab === item.id ? "text-white" : "group-hover:scale-110 transition-transform")} />
              <span className="hidden lg:block font-black text-xs uppercase tracking-widest">{item.label}</span>
              {activeTab === item.id && (
                <motion.div layoutId="activeTab" className="absolute left-0 w-1 h-8 bg-emerald-action rounded-r-full" />
              )}
            </button>
          ))}
          
          <div className="mt-auto pt-6 border-t border-zinc-100">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-4 p-4 w-full text-zinc-400 hover:text-red-500 transition-colors"
            >
              <X className="w-6 h-6 shrink-0" />
              <span className="hidden lg:block font-black text-xs uppercase tracking-widest">{t('nav.logout')}</span>
            </button>
          </div>
        </nav>

        {/* Content Area */}
        <div ref={contentScrollRef} className="flex-1 overflow-y-auto custom-scrollbar bg-brand-bg pb-32 sm:pb-0">
          <div className="app-container py-5 sm:py-8">
            <AnimatePresence mode="wait">
          {activeTab === 'DASHBOARD' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-5 sm:space-y-12"
            >
              {/* 1. Carrusel de Novedades (Rediseñado) */}
              <div className="relative group overflow-hidden rounded-[2rem] sm:rounded-[4rem] bg-white border border-zinc-100 shadow-sm h-[340px] sm:h-[550px]">
                <AnimatePresence mode='wait'>
                  {carouselCards.map((card, idx) => (
                    idx === currentSlide && (
                      <motion.div
                        key={card.id}
                        initial={{ opacity: 0, scale: 1.05 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute inset-0 flex flex-col"
                      >
                        {/* Hero Type */}
                        {card.type === 'hero' && (
                          <div className="relative h-full flex flex-col sm:flex-row items-center overflow-hidden bg-gradient-to-br from-[#053447] via-[#0A4F61] to-[#0B6B62]">
                            
                            <div className="relative z-20 h-full p-5 sm:p-16 flex flex-col justify-center max-w-3xl space-y-4 sm:space-y-6">
                              {card.tag && (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-action/20 backdrop-blur-md border border-emerald-action/30 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-emerald-action w-fit">
                                  <Sparkles className="w-3 h-3" />
                                  {t(card.tag)}
                                </div>
                              )}
                              <h2 className="text-2xl sm:text-7xl font-display font-black text-white tracking-tighter leading-[0.95] sm:leading-[0.9] uppercase">
                                {t(card.title)}
                              </h2>
                              <p className="text-white font-medium text-sm sm:text-xl leading-relaxed max-w-sm sm:max-w-xl">
                                {t(card.description)}
                              </p>
                              <button 
                                onClick={() => setActiveTab('REPORTES')}
                                className="w-full sm:w-fit px-4 py-2.5 sm:px-8 sm:py-4 bg-emerald-action text-white rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-sm uppercase tracking-widest shadow-xl shadow-emerald-action/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 sm:gap-3"
                              >
                                {t('dashboard.start_now')}
                                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                              </button>
                            </div>

                            {card.imageUrl && (
                              <div className="absolute right-0 bottom-0 h-[56%] sm:h-[90%] w-full sm:w-1/2 flex items-end justify-end pointer-events-none">
                                <img
                                  src={card.imageUrl}
                                  className="h-full w-auto object-contain object-right-bottom transition-transform duration-700 group-hover:scale-105"
                                  style={{ filter: 'drop-shadow(0px 20px 30px rgba(2,65,83,0.15))' }}
                                  loading="lazy"
                                  decoding="async"
                                  referrerPolicy="no-referrer"
                                  alt={card.title}
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Info Type (Ciclo) */}
                        {card.type === 'info' && (
                          <div className="h-full bg-zinc-50 p-5 sm:p-16 flex flex-col justify-center space-y-5 sm:space-y-10">
                            <div className="space-y-2 sm:space-y-4">
                              <h2 className="theme-text-primary text-2xl sm:text-5xl font-display font-black tracking-tighter uppercase">
                                {t(card.title)}
                              </h2>
                              <p className="theme-text-secondary text-xs sm:text-lg font-medium max-w-xl">
                                {t(card.description)}
                              </p>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-8">
                              {[
                                { title: t('dashboard.prevention'), desc: t('dashboard.prevention_desc'), icon: <ShieldCheck className="w-6 h-6" />, color: 'text-maya-blue bg-maya-blue/10' },
                                { title: t('dashboard.alert'), desc: t('dashboard.alert_desc'), icon: <AlertTriangle className="w-6 h-6" />, color: 'text-soft-teal bg-soft-teal/20' },
                                { title: t('dashboard.action'), desc: t('dashboard.action_desc'), icon: <Zap className="w-6 h-6" />, color: 'text-emerald-action bg-emerald-action/10' },
                                { title: t('dashboard.recovery'), desc: t('dashboard.recovery_desc'), icon: <HeartHandshake className="w-6 h-6" />, color: 'text-stormy-teal bg-stormy-teal/10' }
                              ].map((step, i) => (
                                <div key={i} className="flex items-start gap-2 sm:gap-5 group/item bg-white rounded-2xl p-2.5 sm:p-0">
                                  <div className={cn("w-9 h-9 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover/item:scale-110", step.color)}>
                                    {step.icon}
                                  </div>
                                  <div className="space-y-0.5 sm:space-y-1">
                                    <h4 className="font-black text-stormy-teal uppercase tracking-tight text-xs sm:text-lg">{step.title}</h4>
                                    <p className="text-zinc-600 text-[10px] sm:text-xs font-medium leading-tight">{step.desc}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Video Type */}
                        {card.type === 'video' && (
                            <div className="h-full bg-zinc-50 p-5 sm:p-16 flex flex-col justify-center space-y-5 sm:space-y-8">
                            <div className="space-y-4">
                              <div className="w-16 h-16 bg-stormy-teal rounded-3xl flex items-center justify-center text-white shadow-xl">
                                <Bot className="w-8 h-8" />
                              </div>
                              <h2 className="text-3xl sm:text-5xl font-display font-black text-stormy-teal tracking-tighter uppercase">
                                {t(card.title)}
                              </h2>
                              <p className="text-zinc-600 text-base sm:text-lg font-medium max-w-xl">
                                {t(card.description)}
                              </p>
                            </div>
                            
                            <div className="flex flex-wrap gap-4">
                              {card.videoLinks?.map((link, i) => (
                                <a 
                                  key={i}
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full sm:w-auto px-5 sm:px-8 py-3 sm:py-4 bg-white border-2 border-zinc-100 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest text-stormy-teal hover:border-stormy-teal transition-all flex items-center justify-center gap-3 shadow-sm"
                                >
                                  <Zap className="w-4 h-4" />
                                  {t(link.label)}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Contact Type */}
                        {card.type === 'contact' && (
                          <div className="h-full relative overflow-hidden flex flex-col items-center justify-center text-center p-5 sm:p-16 bg-gradient-to-br from-[#053447] via-[#0A4F61] to-[#0B6B62]">
                            {card.imageUrl && (
                              <div 
                                className="absolute inset-0 bg-cover bg-right-center z-0"
                                style={{ backgroundImage: `url(${card.imageUrl})` }}
                              />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-br from-[#022533]/65 via-[#063F52]/55 to-[#0A5C57]/45 z-10" />
                            
                            <div className="relative z-20 flex flex-col items-center justify-center space-y-8">
                              <div className="w-20 h-20 bg-white rounded-[2rem] flex items-center justify-center text-stormy-teal shadow-xl border border-stormy-teal/10">
                                <HeartHandshake className="w-10 h-10" />
                              </div>
                              <div className="space-y-4 max-w-xl">
                                  <h2 className="text-3xl sm:text-5xl font-display font-black text-white tracking-tighter uppercase">
                                  {t(card.title)}
                                </h2>
                                  <p className="text-white text-base sm:text-lg font-medium">
                                  {t(card.description)}
                                </p>
                              </div>
                              {card.contactLink && (
                                <a 
                                  href={card.contactLink.url}
                                  className="w-full sm:w-auto px-5 sm:px-10 py-3 sm:py-5 bg-emerald-action text-white rounded-[2rem] font-black text-[10px] sm:text-sm uppercase tracking-widest shadow-2xl shadow-emerald-action/20 hover:scale-105 active:scale-95 transition-all break-all sm:break-normal"
                                >
                                  {card.contactLink.label}
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )
                  ))}
                </AnimatePresence>
                
                {/* Controles del Carrusel */}
                <div className="absolute bottom-4 sm:bottom-8 right-4 sm:right-8 flex gap-2 sm:gap-3 z-20">
                  <button 
                    onClick={() => setCurrentSlide(prev => (prev - 1 + carouselCards.length) % carouselCards.length)} 
                    className="p-2.5 sm:p-4 bg-white rounded-xl sm:rounded-2xl hover:bg-zinc-50 transition-all border border-zinc-100 text-stormy-teal shadow-sm"
                  >
                    <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  <button 
                    onClick={() => setCurrentSlide(prev => (prev + 1) % carouselCards.length)} 
                    className="p-2.5 sm:p-4 bg-white rounded-xl sm:rounded-2xl hover:bg-zinc-50 transition-all border border-zinc-100 text-stormy-teal shadow-sm"
                  >
                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>

                {/* Dots */}
                <div className="absolute bottom-4 sm:bottom-8 left-4 sm:left-8 flex gap-1.5 sm:gap-2 z-20">
                  {carouselCards.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentSlide(i)}
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-500",
                        currentSlide === i ? "w-8 bg-emerald-action" : "w-2 bg-zinc-300"
                      )}
                    />
                  ))}
                </div>
              </div>

              {/* 2. Crisis Mode Explanatory Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-red-700 to-red-900 border border-red-500/40
                           rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 
                           text-white overflow-hidden relative shadow-lg shadow-red-950/20
                           cursor-pointer group [&_svg]:text-white
                           hover:shadow-xl 
                           hover:-translate-y-1 transition-all duration-300"
                onClick={() => handleCrisisModeToggle(true)}
              >
                <div className="absolute -top-6 -right-6 w-32 h-32 
                                bg-yellow-400/20 rounded-full blur-2xl" />
                <div className="relative z-10 space-y-4">
                  <div className="flex items-center justify-between">
                      <div className="p-3 bg-red-950/35 rounded-2xl border border-white/15">
                        <AlertTriangle className="w-7 h-7 text-yellow-400" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest 
                                     bg-yellow-400 text-red-900 px-3 py-1.5 rounded-full">
                      {t('dashboard.preparation')}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl sm:text-3xl font-display font-black 
                                   uppercase tracking-tighter leading-none">
                      {t('dashboard.crisis_mode')}
                    </h3>
                    <p className="text-sm font-medium text-white/85 leading-relaxed">
                      {t('dashboard.crisis_desc')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-yellow-300 font-black 
                                  text-xs uppercase tracking-widest 
                                  group-hover:gap-3 transition-all">
                    <span>{t('dashboard.activate_now')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </motion.div>

              {/* 3. Clima e Instagram */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Clima Real */}
                <div className="bg-white p-5 sm:p-10 rounded-[2rem] sm:rounded-[3.5rem] border border-zinc-100 shadow-sm flex items-center justify-between group hover:shadow-xl transition-all">
                  <div className="space-y-1">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('dashboard.weather_in')} {userProfile?.zone || t('dashboard.default_zone')}</p>
                    <h4 className="text-3xl sm:text-5xl font-black text-stormy-teal tracking-tighter">{weather?.temp || '--'}°C</h4>
                    <p className="text-xs font-bold text-stormy-teal uppercase tracking-widest">{getWeatherLabel(weather?.code)}</p>
                  </div>
                  <div className="text-stormy-teal/10 group-hover:scale-110 transition-transform duration-500">
                    {getWeatherIcon(weather?.code)}
                  </div>
                </div>

                {/* Instagram Feed (Simulado) */}
                <a 
                  href="https://www.instagram.com/equipoecowarriors?igsh=aXd0aGNra3JtNmY1&utm_source=qr" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-white p-5 sm:p-10 rounded-[2rem] sm:rounded-[3.5rem] text-stormy-teal flex items-center justify-between group cursor-pointer overflow-hidden relative shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-500 border border-zinc-100"
                >
                  <div className="absolute inset-0 opacity-10 group-hover:scale-110 transition-transform duration-700 bg-soft-maya-blue" />
                  <div className="relative z-10 space-y-2">
                    <Instagram className="w-10 h-10 mb-2 text-emerald-action" />
                    <h4 className="text-2xl font-black uppercase tracking-tighter leading-none">@equipoecowarriors</h4>
                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest">{t('dashboard.instagram_follow')}</p>
                  </div>
                  <ArrowRight className="w-10 h-10 relative z-10 group-hover:translate-x-2 transition-transform text-zinc-400 group-hover:text-stormy-teal" />
                </a>
              </div>

              {/* Mascot Guide Component */}
              <div className="mascot-guide">
                <div className="w-16 h-16 shrink-0 bg-white rounded-2xl flex items-center justify-center shadow-lg border border-maya-blue/20">
                  <Bot className="w-10 h-10 text-stormy-teal" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-black text-stormy-teal uppercase tracking-widest">{t('dashboard.rocco_tip_title')}</p>
                  <p className="text-sm text-zinc-600 leading-relaxed">
                    {t('dashboard.rocco_tip_desc')}
                  </p>
                </div>
              </div>

              {/* 2. Agent Card (Identity Module) */}
              <div className="bg-white p-8 sm:p-12 rounded-[2.5rem] sm:rounded-[4rem] border border-zinc-100 shadow-xl shadow-zinc-200/20 flex flex-col md:flex-row items-center gap-8 sm:gap-12 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-80 h-80 bg-brand-bg rounded-full -mr-40 -mt-40 opacity-50 group-hover:scale-110 transition-transform duration-700" />
                
                <div className="relative z-10 shrink-0">
                  <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-[2.5rem] sm:rounded-[3rem] bg-stormy-teal flex items-center justify-center text-white shadow-2xl shadow-stormy-teal/10 relative border-4 sm:border-8 border-white rotate-3 group-hover:rotate-0 transition-transform duration-500 overflow-hidden">
                    <img
                      src={userProfile?.photoURL || user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid || userProfile?.uid || 'ecowarrior'}`}
                      alt={userProfile?.alias || t('dashboard.default_alias')}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-10 h-10 sm:w-12 sm:h-12 bg-emerald-action rounded-2xl border-4 border-white flex items-center justify-center text-white shadow-lg">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                </div>
                
                <div className="flex-1 space-y-6 sm:space-y-8 relative z-10 w-full text-center md:text-left">
                  <div className="space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      <h3 className="text-4xl sm:text-5xl font-display font-black text-zinc-900 tracking-tighter uppercase leading-none">
                        {userProfile?.alias || t('dashboard.default_alias')}
                      </h3>
                      <div className="flex flex-wrap justify-center md:justify-start gap-2">
                        <span className="text-[10px] font-black text-stormy-teal bg-stormy-teal/5 px-4 py-1.5 rounded-full uppercase tracking-widest border border-stormy-teal/10">
                          {userProfile?.role === 'admin' ? t('dashboard.admin') : t('dashboard.guardian')}
                        </span>
                        <span className="text-[10px] font-black text-stormy-teal bg-emerald-action/5 px-4 py-1.5 rounded-full uppercase tracking-widest border border-emerald-action/10">
                          {t('dashboard.level_progress').split(' • ')[0].replace('{level}', String(userProfile?.level || 1))}
                        </span>
                      </div>
                    </div>
                    <p className="text-zinc-500 font-medium italic">"{userProfile?.commitment || t('dashboard.commitment_default')}"</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                      <span>{t('dashboard.level_progress').replace('{level}', String(userProfile?.level || 1))}</span>
                      <span className="text-stormy-teal font-black">{userProfile?.xp || 0} / {(userProfile?.level || 1) * 100} XP</span>
                    </div>
                    <div className="h-4 bg-zinc-100 rounded-full overflow-hidden p-1 shadow-inner">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${((userProfile?.xp || 0) % 100)}%` }}
                        transition={{ duration: 1.5, ease: "circOut" }}
                        className="h-full bg-emerald-action rounded-full shadow-[0_0_20px_rgba(110,181,125,0.5)] relative overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                      </motion.div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Voluntarios y Cuadrillas Reales */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12">
                {/* Voluntarios Reales */}
                <div className="space-y-8">
                  <div className="flex items-center justify-between px-4 sm:px-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-maya-blue rounded-2xl flex items-center justify-center text-white shadow-lg">
                        <Users className="w-6 h-6" />
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-display font-black text-zinc-900 uppercase tracking-tighter">
                        {t('community.volunteers_in').replace('{zone}', userProfile?.zone || t('onboarding.zone_placeholder'))}
                      </h3>
                    </div>
                  </div>
                  <div className="bg-white rounded-[2.5rem] sm:rounded-[3.5rem] border border-zinc-100 shadow-sm overflow-hidden">
                    {volunteers.length === 0 ? (
                      <div className="p-16 text-center space-y-4">
                        <div className="w-16 h-16 bg-brand-bg rounded-full flex items-center justify-center mx-auto opacity-20">
                          <Users className="w-8 h-8 text-stormy-teal" />
                        </div>
                        <p className="text-zinc-400 font-black uppercase tracking-widest text-xs">{t('community.no_volunteers')}</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-zinc-50">
                        {volunteers.map(v => (
                          <div key={v.id} className="p-6 sm:p-8 flex items-center gap-6 hover:bg-zinc-50 transition-colors group">
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl sm:rounded-[1.5rem] overflow-hidden border-2 border-zinc-100 group-hover:border-maya-blue transition-all">
                              <img src={v.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${v.id}`} alt={v.alias} className="w-full h-full object-cover" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                            </div>
                            <div className="flex-1">
                              <p className="font-black text-zinc-900 uppercase tracking-tighter text-lg">{v.alias}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-[#374151] uppercase tracking-widest">{t('dashboard.level_progress').split(' • ')[0].replace('{level}', String(v.level || 1))}</span>
                                <div className="w-1 h-1 bg-zinc-200 rounded-full" />
                                <span className="text-[10px] font-bold text-[#374151] uppercase tracking-widest">{v.xp || 0} XP</span>
                              </div>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-300 group-hover:bg-maya-blue group-hover:text-white transition-all">
                              <ArrowRight className="w-5 h-5" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Cuadrillas Reales */}
                <div className="space-y-8">
                  <div className="flex items-center justify-between px-4 sm:px-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-stormy-teal rounded-2xl flex items-center justify-center text-white shadow-lg">
                        <Shield className="w-6 h-6" />
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-display font-black text-zinc-900 uppercase tracking-tighter">{t('community.active_squads')}</h3>
                    </div>
                  </div>
                  <div className="space-y-6">
                    {crews.length === 0 ? (
                      <div className="bg-white p-16 rounded-[2.5rem] sm:rounded-[3.5rem] border border-zinc-100 text-center space-y-4">
                        <div className="w-16 h-16 bg-brand-bg rounded-full flex items-center justify-center mx-auto opacity-20">
                          <Shield className="w-8 h-8 text-stormy-teal" />
                        </div>
                        <p className="text-zinc-400 font-black uppercase tracking-widest text-xs">
                          {t('dashboard.no_squads')}
                        </p>
                      </div>
                    ) : (
                      crews.map(crew => (
                        <div key={crew.id} className="bg-white p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-zinc-100 shadow-sm flex items-center justify-between group hover:border-stormy-teal/20 hover:shadow-xl transition-all">
                          <div className="flex items-center gap-6">
                            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-stormy-teal/5 rounded-2xl sm:rounded-[1.5rem] flex items-center justify-center text-stormy-teal group-hover:bg-stormy-teal group-hover:text-white transition-all">
                              <Users className="w-7 h-7 sm:w-8 sm:h-8" />
                            </div>
                            <div>
                              <p className="font-black text-zinc-900 uppercase tracking-tighter text-lg sm:text-xl leading-none mb-1">{crew.title}</p>
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black text-stormy-teal dark:text-slate-200 uppercase tracking-widest">{crew.attendees.length} {t('community.participants')}</span>
                                <div className="w-1 h-1 bg-zinc-200 rounded-full" />
                                <span className="text-[10px] font-bold text-zinc-600 dark:text-slate-300 uppercase tracking-widest">{crew.location}</span>
                              </div>
                            </div>
                          </div>
                          <button onClick={() => setActiveTab('COMUNIDAD')} className="p-4 bg-zinc-50 rounded-2xl group-hover:bg-stormy-teal group-hover:text-white transition-all shadow-sm">
                            <ArrowRight className="w-6 h-6" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* 4. Priority Alerts / Crisis Mode Banner */}
              {(isCrisisMode || hasClimateAlert) && (
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  className="bg-red-600 p-8 sm:p-12 rounded-[2.5rem] sm:rounded-[4rem] text-white shadow-2xl shadow-red-200 space-y-8 sm:space-y-10 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-64 sm:w-[40rem] h-64 sm:h-[40rem] bg-white/5 rounded-full -mr-32 sm:-mr-80 -mt-32 sm:-mt-80 blur-[60px] sm:blur-[100px]" />
                  
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
                    <div className="flex items-center gap-6 sm:gap-8">
                      <div className="p-4 sm:p-6 bg-white/20 rounded-2xl sm:rounded-[2.5rem] backdrop-blur-md animate-pulse shadow-inner border border-white/20">
                        <ShieldAlert className="w-10 h-10 sm:w-16 sm:h-16" />
                      </div>
                      <div>
                        <h3 className="text-3xl sm:text-5xl font-display font-black uppercase tracking-tighter leading-none mb-2 sm:mb-3">{t('community.critical_alert')}</h3>
                        <p className="text-[10px] sm:text-sm font-black opacity-80 uppercase tracking-[0.3em]">{t('community.risk_status')}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setHasClimateAlert(false)}
                      className="p-3 sm:p-5 bg-white/10 rounded-full hover:bg-white/20 transition-colors border border-white/10 self-end sm:self-auto"
                    >
                      <X className="w-6 h-6 sm:w-8 sm:h-8" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 relative z-10">
                    <div className="bg-white/10 p-8 sm:p-10 rounded-[2rem] sm:rounded-[3.5rem] border border-white/20 backdrop-blur-sm space-y-6 sm:space-y-8">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-xl sm:rounded-2xl flex items-center justify-center">
                          <Backpack className="w-6 h-6 sm:w-8 sm:h-8" />
                        </div>
                        <h4 className="font-display font-black text-2xl sm:text-3xl uppercase tracking-tight">Checklist 72HS</h4>
                      </div>
                      <div className="space-y-3 sm:space-y-4">
                        {[
                          { label: 'Agua y Alimentos', status: 'Listo' },
                          { label: 'Botiquín de Primeros Auxilios', status: 'Revisar' },
                          { label: 'Radio y Pilas de Repuesto', status: 'Listo' }
                        ].map((item, i) => (
                          <div key={i} className="flex items-center gap-4 sm:gap-5 text-sm font-black bg-white/5 p-4 sm:p-5 rounded-2xl sm:rounded-[2rem] border border-white/5">
                            <div className={cn("w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shadow-sm", item.status === 'Revisar' ? "bg-white/20" : "bg-emerald-action")}>
                              {item.status !== 'Revisar' && <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />}
                            </div>
                            <div className="flex-1">
                              <p className="uppercase tracking-widest text-xs sm:text-sm">{item.label}</p>
                              <p className="text-[10px] uppercase tracking-widest opacity-80 text-white">{item.status}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-4 sm:space-y-6 flex flex-col justify-center">
                      <button className="w-full bg-white text-red-600 p-8 sm:p-12 rounded-[2rem] sm:rounded-[3.5rem] font-black text-3xl sm:text-4xl shadow-2xl flex items-center justify-center gap-6 sm:gap-8 hover:scale-[1.02] active:scale-95 transition-all border-b-4 sm:border-b-8 border-red-100">
                        <Phone className="w-10 h-10 sm:w-16 sm:h-16" />
                        {t('community.emergency_btn')}
                      </button>
                      <button 
                        onClick={() => handleCrisisModeToggle(true)}
                        className="w-full bg-red-700 text-white p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[3rem] font-black text-lg sm:text-xl border border-red-500/50 hover:bg-red-800 transition-all flex items-center justify-center gap-4 uppercase tracking-widest"
                      >
                        <Activity className="w-6 h-6 sm:w-8 sm:h-8" />
                        {t('dashboard.activate_crisis')}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* 4. Explore App: Quick Guide */}
              <div className="space-y-8 sm:space-y-10">
                <div className="flex items-center gap-6 px-4 sm:px-6">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 bg-stormy-teal rounded-2xl sm:rounded-[1.8rem] flex items-center justify-center text-white shadow-xl">
                    <Navigation className="w-7 h-7 sm:w-8 sm:h-8" />
                  </div>
                  <div>
                    <h3 className="text-3xl sm:text-4xl font-display font-black text-zinc-900 uppercase tracking-tighter">{t('community.explore_title')}</h3>
                    <p className="text-[10px] sm:text-xs font-black text-zinc-400 uppercase tracking-[0.3em]">{t('community.explore_desc')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
                  {[
                    { id: 'MAPA', label: t('community.map_label'), desc: t('community.map_desc'), icon: MapIcon, color: 'text-maya-blue', bg: 'bg-soft-maya-blue/30' },
                    { id: 'REPORTES', label: t('community.report_label'), desc: t('community.report_desc'), icon: Camera, color: 'text-emerald-action', bg: 'bg-emerald-action/10' },
                    { id: 'COMUNIDAD', label: t('community.community_label'), desc: t('community.community_desc'), icon: MessageSquare, color: 'text-soft-teal', bg: 'bg-soft-teal/20' },
                    { id: 'PERFIL', label: t('community.profile_label'), desc: t('community.profile_desc'), icon: User, color: 'text-stormy-teal', bg: 'bg-stormy-teal/10' },
                  ].map((item) => (
                    <motion.button 
                      key={item.id}
                      whileHover={{ y: -4 }}
                      onClick={() => setActiveTab(item.id as Tab)}
                      className="bg-white rounded-[2.5rem] sm:rounded-[3.5rem] border border-zinc-200 shadow-sm hover:shadow-md transition-all text-left overflow-hidden group flex flex-col h-full"
                    >
                      <div className={cn(
                        "w-full aspect-video flex items-center justify-center rounded-2xl mb-4",
                        item.bg
                      )}>
                        <item.icon className={cn("w-16 h-16", item.color)} />
                      </div>
                      <div className="p-6 sm:p-8 space-y-3 flex-1">
                        <p className="font-black text-xl sm:text-2xl uppercase tracking-tighter text-zinc-900 leading-none">{item.label}</p>
                        <p className="text-xs sm:text-sm text-zinc-600 font-medium leading-relaxed">{item.desc}</p>
                      </div>
                      <div className="px-6 sm:px-8 pb-6 sm:pb-8 flex items-center gap-2 sm:gap-3 text-[10px] font-black text-stormy-teal uppercase tracking-widest">
                        {t('community.go_now')} <ArrowRight className="w-4 h-4" />
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* 5. AI Missions Panel */}
              <div className="space-y-8 sm:space-y-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4 sm:px-6">
                  <div className="flex items-center gap-6">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-emerald-action rounded-2xl sm:rounded-[1.8rem] flex items-center justify-center text-white shadow-xl shadow-emerald-action/10">
                      <Bot className="w-7 h-7 sm:w-8 sm:h-8" />
                    </div>
                    <div>
                      <h3 className="text-3xl sm:text-4xl font-display font-black text-zinc-900 uppercase tracking-tighter">{t('community.rocco_missions')}</h3>
                      <p className="text-[10px] sm:text-xs font-black text-zinc-400 uppercase tracking-[0.3em]">{t('community.rocco_desc')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-emerald-action/5 px-5 sm:px-6 py-2.5 sm:py-3 rounded-full border border-emerald-action/10 shadow-sm self-start md:self-auto">
                    <div className="w-2.5 h-2.5 bg-emerald-action rounded-full animate-pulse" />
                    <span className="text-[10px] font-black text-stormy-teal uppercase tracking-widest">{t('community.context_active')}</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10">
                  {(() => {
                    const activeMissions = missions.filter(m => m.status !== 'completed');
                    const displayedMissions = showAllMissions 
                      ? activeMissions 
                      : activeMissions.slice(0, 2);
                    
                    return (
                      <>
                        {displayedMissions.map((mission, i) => (
                          <motion.div 
                            key={mission.id} 
                            whileHover={{ y: -8 }}
                            onClick={() => setSelectedMission(mission)}
                            className={cn(
                              "bg-white p-8 sm:p-12 rounded-[2.5rem] sm:rounded-[4rem] border shadow-sm flex flex-col sm:flex-row items-start gap-8 sm:gap-10 cursor-pointer group transition-all border-zinc-100 hover:shadow-md"
                            )}
                          >
                            <div className={cn("p-6 sm:p-8 rounded-2xl sm:rounded-[2.5rem] shrink-0 shadow-inner border border-white", mission.color, getMissionIconTextClass(mission.color))}>
                              <mission.icon className="w-10 h-10 sm:w-12 sm:h-12" />
                            </div>
                            <div className="flex-1 space-y-4 sm:space-y-6">
                              <div className="flex justify-between items-start">
                                <h4 className="text-2xl sm:text-3xl font-display font-black text-zinc-900 tracking-tighter uppercase leading-none">
                                  {t(`mission.title_${mission.id}`)}
                                </h4>
                                <span className="text-[10px] font-black text-stormy-teal bg-emerald-action/5 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full border border-emerald-action/10">+{mission.reward} {t('mission.reward_label')}</span>
                              </div>
                              <p className="text-zinc-600 font-medium text-sm sm:text-lg leading-relaxed">
                                {t(`mission.desc_${mission.id}`)}
                              </p>
                              <div className="w-full h-1.5 sm:h-2 bg-zinc-100 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${mission.progress}%` }}
                                  className="h-full bg-emerald-action rounded-full"
                                />
                              </div>
                              <button 
                                className="bg-stormy-teal text-white px-8 sm:px-10 py-4 sm:py-5 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-stormy-teal/90 transition-all flex items-center gap-2 sm:gap-3 group-hover:scale-105 shadow-lg shadow-stormy-teal/20"
                              >
                                {t('community.view_detail')}
                                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                              </button>
                            </div>
                          </motion.div>
                        ))}

                        {activeMissions.length > 2 && (
                          <div className="md:col-span-2">
                            <button
                              onClick={() => setShowAllMissions(!showAllMissions)}
                              className="w-full py-4 rounded-[2rem] border-2 border-dashed border-emerald-action/30 
                                         text-stormy-teal font-black text-sm uppercase tracking-widest 
                                         hover:border-emerald-action hover:bg-emerald-action/5 transition-all"
                            >
                              {showAllMissions 
                                ? t('community.view_less') 
                                : t('community.view_all_missions').replace('{count}', String(activeMissions.length))
                              }
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* 6. Community Impact Visualizer */}
              <div className="bg-white p-8 sm:p-16 rounded-[2.5rem] sm:rounded-[4.5rem] text-zinc-900 shadow-sm border border-zinc-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 sm:w-[50rem] h-64 sm:h-[50rem] bg-soft-maya-blue/20 rounded-full -mr-32 sm:-mr-[25rem] -mt-32 sm:-mt-[25rem] blur-[60px] sm:blur-[120px]" />
                
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-12 sm:gap-16 mb-12 sm:mb-20 relative z-10">
                  <div className="space-y-4 sm:space-y-6">
                    <h3 className="text-4xl sm:text-5xl font-display font-black tracking-tighter uppercase leading-none text-stormy-teal">{t('community.real_impact')}</h3>
                    <div className="flex items-center gap-4">
                      <div className="w-3 h-3 sm:w-4 sm:h-4 bg-emerald-action rounded-full animate-pulse" />
                      <p className="text-[10px] sm:text-xs font-black text-[#374151] uppercase tracking-[0.3em]">{t('community.collective_resilience')}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-16">
                    <div className="space-y-2 sm:space-y-4">
                      <p className="text-5xl sm:text-7xl font-black text-stormy-teal tracking-tighter leading-none">{totalResolved}</p>
                      <p className="text-[10px] sm:text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">{t('community.resolved_spots')}</p>
                      <p className="text-xs sm:text-sm text-zinc-600 font-medium leading-relaxed">
                        {totalResolved === 1 ? t('community.resolved_desc_singular') : t('community.resolved_desc_plural').replace('{count}', String(totalResolved))}
                      </p>
                    </div>
                    <div className="space-y-2 sm:space-y-4">
                      <p className="text-5xl sm:text-7xl font-black text-stormy-teal tracking-tighter leading-none">
                        {reports.filter(r => r.isActive).length}
                      </p>
                      <p className="text-[10px] sm:text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">{t('community.active_reports')}</p>
                      <p className="text-xs sm:text-sm text-zinc-600 font-medium leading-relaxed">{t('community.active_reports_desc')}</p>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 relative z-10">
                  <div className="lg:col-span-2 h-[250px] sm:h-[350px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dashboardData}>
                        <defs>
                          <linearGradient id="colorReportes" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-primary-light)" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="var(--color-primary-light)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid-stroke)" vertical={false} />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: chartTheme.tickColor, fontSize: 10, fontWeight: '900' }} 
                          dy={10}
                        />
                        <YAxis hide />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: chartTheme.tooltipBackground,
                            border: `1px solid ${chartTheme.tooltipBorder}`,
                            borderRadius: '24px',
                            color: chartTheme.tooltipText,
                            padding: '16px',
                            boxShadow: chartTheme.tooltipShadow
                          }}
                          itemStyle={{ color: 'var(--color-primary)', fontWeight: '900', textTransform: 'uppercase', fontSize: '12px' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="reportes" 
                          stroke="var(--color-primary-light)" 
                          strokeWidth={6} 
                          dot={{ r: 6, fill: 'var(--color-primary-light)', strokeWidth: 3, stroke: 'var(--color-primary)' }}
                          activeDot={{ r: 10, fill: chartTheme.tooltipBackground, strokeWidth: 0 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="h-[250px] sm:h-[350px] w-full min-w-0 flex flex-col items-center justify-center">
                    {pieData.length === 0 ? (
                      <div className="text-center p-8 bg-zinc-50 rounded-3xl border border-zinc-100 w-full h-full flex flex-col items-center justify-center">
                        <Package className="w-10 h-10 text-zinc-300 mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t('community.no_waste_data')}</p>
                      </div>
                    ) : (
                      <>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{
                                backgroundColor: chartTheme.tooltipBackground,
                                border: `1px solid ${chartTheme.tooltipBorder}`,
                                borderRadius: '20px',
                                color: chartTheme.tooltipText
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex flex-wrap justify-center gap-3 mt-4">
                          {pieData.map((entry, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                              <span className="theme-text-secondary text-[8px] font-black uppercase tracking-widest">{entry.name}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                  <div className="mt-8 sm:mt-12 pt-8 sm:pt-12 border-t border-zinc-100 grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-action/10 flex items-center justify-center text-emerald-action">
                      <Users className="w-6 h-6 sm:w-7 sm:h-7" />
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-zinc-600 leading-tight">
                      {volunteers.length > 0 
                        ? `${volunteers.length} ${t('community.active_warriors')}`
                        : t('community.be_first')}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-maya-blue/10 flex items-center justify-center text-maya-blue">
                      <Droplets className="w-6 h-6 sm:w-7 sm:h-7" />
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-zinc-600 leading-tight">
                      {crews.length > 0 
                        ? `${crews.length} ${crews.length > 1 ? t('community.scheduled_crews_plural') : t('community.scheduled_crews')}`
                        : t('community.no_squads')}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-soft-maya-blue/20 flex items-center justify-center text-stormy-teal">
                      <Cloud className="w-6 h-6 sm:w-7 sm:h-7" />
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-zinc-600 leading-tight">
                      {weatherData 
                        ? `${t('community.weather_current')}: ${weatherData.condition} · ${weatherData.temp}°C`
                        : t('community.weather_loading')}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'REPORTES' && (
            <motion.div
              key="reportes"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* CTA banner */}
              <div
                style={{ backgroundColor: '#1D9E75', borderRadius: 'var(--border-radius-lg, 1.5rem)', padding: '1.25rem 1.5rem' }}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <p className="text-white font-bold text-lg leading-snug">¿Ves algo en tu barrio?</p>
                  <p className="text-sm font-medium mt-0.5" style={{ color: 'rgba(255,255,255,0.85)' }}>Reportalo en segundos y ayudá a tu comunidad.</p>
                </div>
                <button
                  onClick={() => { resetForm(); setIsReportModalOpen(true); }}
                  className="shrink-0 self-start sm:self-auto"
                  style={{ backgroundColor: '#ffffff', color: '#1D9E75', borderRadius: '32px', padding: '10px 20px', fontSize: '14px', fontWeight: 700, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  + Reportar ahora
                </button>
              </div>

              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                  <h2 className="text-3xl sm:text-4xl font-display font-black text-stormy-teal uppercase tracking-tighter">
                    {reportFilter === 'mios' ? t('reports.title_mine') : t('reports.title_all')}
                  </h2>
                  <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] mt-1">
                    {reportFilter === 'mios' ? t('reports.desc_mine') : t('reports.desc_all')}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="bg-zinc-100 p-1 rounded-2xl flex">
                    <button 
                      onClick={() => setReportFilter('abiertos')}
                      className={cn(
                        "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                        reportFilter === 'abiertos' ? "bg-white text-stormy-teal shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                      )}
                    >
                      {t('reports.filter_open')}
                    </button>
                    <button 
                      onClick={() => setReportFilter('resueltos')}
                      className={cn(
                        "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                        reportFilter === 'resueltos' ? "bg-white text-stormy-teal shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                      )}
                    >
                      {t('reports.filter_resolved')}
                    </button>
                    <button 
                      onClick={() => setReportFilter('mios')}
                      className={cn(
                        "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                        reportFilter === 'mios' ? "bg-white text-stormy-teal shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                      )}
                    >
                      {t('reports.filter_mine')}
                    </button>
                  </div>
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input 
                      type="text" 
                      placeholder={t('reports.search_placeholder')}
                      value={reportSearchQuery}
                      onChange={(e) => setReportSearchQuery(e.target.value)}
                      className="theme-input w-full pl-11 pr-4 py-3 rounded-2xl border shadow-sm outline-none focus:ring-2 focus:ring-emerald-action transition-all font-medium text-sm"
                    />
                  </div>
                </div>
              </div>

              {visibleReports.length === 0 ? (
                <div className="bg-white p-12 sm:p-20 rounded-[2.5rem] sm:rounded-[3rem] border border-zinc-100 text-center space-y-6">
                  <div className="w-20 h-20 bg-brand-bg rounded-full flex items-center justify-center mx-auto">
                    <Info className="w-10 h-10 text-stormy-teal/20" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl sm:text-2xl font-display font-black text-stormy-teal uppercase tracking-tighter">
                      {t('dashboard.no_reports_found')}
                    </h3>
                    <p className="text-zinc-500 font-medium max-w-xs mx-auto text-sm sm:text-base">
                      {t('dashboard.no_reports_desc')}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                  <AnimatePresence>
                    {visibleReports.map((report) => (
                      <motion.div
                        key={report.id}
                        layout
                        initial={{ opacity: 0, y: 16, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -18, scale: 0.9 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                        className="relative group"
                      >
                        <ReportCard 
                          report={report} 
                          onClick={() => setSelectedReportForDetail(report)} 
                          isAdmin={isAdmin}
                          currentUserId={currentUserId}
                          onDeleteReport={handleDeleteReport}
                          onCancelReport={handleOwnerDeleteReport}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'COMUNIDAD' && (
            <motion.div 
              key="comunidad"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8 sm:space-y-12"
            >
              {/* 1. Volunteer Registration Block */}
              <section className="bg-white rounded-[2.5rem] sm:rounded-[3rem] p-8 sm:p-12 border border-zinc-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 sm:w-80 h-64 sm:h-80 bg-emerald-action/10 rounded-full -mr-32 sm:-mr-40 -mt-32 sm:-mt-40 blur-3xl" />
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 sm:gap-12">
                  <div className="bg-emerald-action/10 p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-inner shrink-0">
                    <Heart className="w-12 h-12 sm:w-16 sm:h-16 text-emerald-action" />
                  </div>
                  <div className="flex-1 text-center md:text-left space-y-3 sm:space-y-4">
                    <h2 className="text-3xl sm:text-4xl font-display font-black tracking-tight uppercase leading-tight text-stormy-teal">{t('community.volunteer_reg')}</h2>
                    <p className="text-zinc-700 text-base sm:text-xl font-medium max-w-2xl leading-relaxed">
                      {t('community.volunteer_desc')}
                    </p>
                  </div>
                  <div className="shrink-0 w-full md:w-auto">
                    {checkingVolunteer ? (
                      <div className="bg-zinc-50 px-8 py-4 rounded-2xl flex items-center justify-center gap-3 border border-zinc-100">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="font-black uppercase tracking-widest text-xs text-stormy-teal">{t('community.verifying')}</span>
                      </div>
                    ) : isVolunteer ? (
                      <div className="bg-zinc-50 border border-zinc-100 px-8 py-4 rounded-2xl flex items-center justify-center gap-3">
                        <CheckCircle2 className="w-6 h-6 text-emerald-action" />
                        <span className="font-black uppercase tracking-widest text-xs text-stormy-teal">{t('community.already_volunteer')}</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsVolunteerModalOpen(true)}
                        className="w-full md:w-auto bg-stormy-teal text-white px-10 py-5 rounded-2xl font-black text-lg sm:text-xl hover:bg-stormy-teal/90 transition-all shadow-lg shadow-stormy-teal/20 hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
                      >
                        {t('community.want_to_help')}
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </section>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-12">
                {/* 2. Main Comunidad (2/3 width on desktop) */}
                <div className="lg:col-span-2 space-y-8">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 px-2">
                    <div className="flex items-center gap-4">
                      <div className="bg-maya-blue p-3 rounded-2xl shadow-lg shadow-maya-blue/20">
                        <MessageSquare className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-display font-black text-stormy-teal uppercase tracking-tight">{t('community.community_label')}</h3>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => { resetForm(); setEditingPost(null); setPostType('doy'); setIsPostModalOpen(true); }}
                        className="flex-1 sm:flex-none px-6 py-3 bg-emerald-action/10 text-stormy-teal rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-action/20 transition-all"
                      >
                        {t('community.offer')}
                      </button>
                      <button 
                        onClick={() => { resetForm(); setEditingPost(null); setPostType('recibo'); setIsPostModalOpen(true); }}
                        className="flex-1 sm:flex-none px-6 py-3 bg-maya-blue/10 text-dark-teal rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-maya-blue/20 transition-all"
                      >
                        {t('community.need')}
                      </button>
                    </div>
                  </div>

                  {/* Banner explicativo del marketplace */}
                  <div className="bg-white border border-zinc-100
                                  rounded-[2rem] p-6 sm:p-8 mb-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-emerald-action/10 rounded-2xl shrink-0">
                        <Heart className="w-6 h-6 text-emerald-action" />
                      </div>
                      <div className="space-y-2">
                          <h3 className="font-black text-stormy-teal 
                                        uppercase tracking-tight text-sm sm:text-base">
                          {t('community.marketplace_title')}
                        </h3>
                        <p className="text-zinc-600 dark:text-zinc-400 text-xs sm:text-sm 
                                      font-medium leading-relaxed">
                          {t('community.marketplace_desc')}
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/40 
                                           text-emerald-700 dark:text-slate-100 
                                           rounded-full text-[10px] font-black uppercase tracking-widest">
                            {t('community.marketplace_offer_desc')}
                          </span>
                          <span className="px-3 py-1 bg-teal-100 dark:bg-teal-900/40 
                                           text-teal-700 dark:text-slate-100 
                                           rounded-full text-[10px] font-black uppercase tracking-widest">
                            {t('community.marketplace_need_desc')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 sm:gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                      <input 
                        type="text" 
                        placeholder={t('community.search_board')}
                        className="w-full pl-14 pr-6 py-4 bg-white border border-zinc-100 rounded-2xl focus:ring-4 focus:ring-stormy-teal/5 outline-none shadow-sm font-medium text-sm"
                        value={marketplaceSearchQuery}
                        onChange={(e) => setMarketplaceSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="relative">
                      <div 
                        role="button"
                        tabIndex={0}
                        onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                        onKeyDown={(e) => e.key === 'Enter' && setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                        className={cn(
                          "p-4 bg-white border border-zinc-100 rounded-2xl hover:bg-zinc-50 shadow-sm transition-all cursor-pointer",
                          marketplaceTypeFilter !== 'todos' && "border-emerald-action/30 bg-emerald-action/5"
                        )}
                      >
                        <Filter className={cn("w-5 h-5", marketplaceTypeFilter !== 'todos' ? "text-emerald-action" : "text-zinc-500")} />
                      </div>
                      {isFilterDropdownOpen && (
                        <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-zinc-100 py-2 z-50 overflow-hidden">
                          {(['todos', 'doy', 'recibo'] as const).map(type => (
                            <button
                              key={type}
                              onClick={(e) => {
                                e.stopPropagation();
                                setMarketplaceTypeFilter(type);
                                setIsFilterDropdownOpen(false);
                              }}
                              className={cn(
                                "w-full px-5 py-3 text-left text-xs font-black uppercase tracking-widest transition-colors",
                                marketplaceTypeFilter === type ? "bg-emerald-action text-white" : "text-zinc-500 hover:bg-zinc-50"
                              )}
                            >
                              {type === 'todos' ? t('community.status_all') : 
                               type === 'doy' ? t('community.offer') :
                               t('community.need')}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                    {postsLoading ? (
                      <>
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="bg-white rounded-[2rem] overflow-hidden border border-zinc-100 shadow-sm flex flex-col animate-pulse">
                            <div className="aspect-square bg-zinc-100" />
                            <div className="p-6 space-y-3">
                              <div className="h-4 w-16 bg-zinc-100 rounded-full" />
                              <div className="h-5 w-4/5 bg-zinc-100 rounded-lg" />
                              <div className="h-3 w-full bg-zinc-100 rounded" />
                              <div className="h-3 w-3/5 bg-zinc-100 rounded" />
                              <div className="mt-4 pt-4 border-t border-zinc-50 flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-zinc-100 shrink-0" />
                                <div className="space-y-1.5 flex-1">
                                  <div className="h-2.5 w-20 bg-zinc-100 rounded" />
                                  <div className="h-2.5 w-14 bg-zinc-100 rounded" />
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    ) : postsError ? (
                      <div className="col-span-full py-24 sm:py-32 text-center bg-white rounded-[2.5rem] sm:rounded-[3.5rem] border border-red-100">
                        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                          <AlertTriangle className="w-8 h-8 text-red-500" />
                        </div>
                        <p className="text-red-600 font-black uppercase tracking-widest text-xs">{t('common.error')}</p>
                        <p className="text-zinc-600 text-[11px] mt-2">{t('community.load_posts_error')}</p>
                      </div>
                    ) : activeMarketplacePosts.length === 0 ? (
                      <div className="col-span-full py-24 sm:py-32 text-center bg-white rounded-[2.5rem] sm:rounded-[3.5rem] border-4 border-dashed border-zinc-50">
                        <div className="w-20 h-20 bg-brand-bg rounded-full flex items-center justify-center mx-auto mb-6">
                          <MessageSquare className="w-10 h-10 text-stormy-teal/10" />
                        </div>
                        <p className="text-[#374151] font-black uppercase tracking-widest text-xs">{t('community.no_posts')}</p>
                        <p className="text-[#374151] text-[11px] mt-2">{t('community.no_posts_desc')}</p>
                      </div>
                    ) : filteredMarketplacePosts.length === 0 ? (
                      <div className="col-span-full py-24 sm:py-32 text-center bg-white rounded-[2.5rem] sm:rounded-[3.5rem] border border-zinc-100">
                        <p className="text-[#374151] font-black uppercase tracking-widest text-xs">{t('marketplace.no_posts')}</p>
                        <p className="text-[#374151] text-[11px] mt-2">{t('marketplace.no_posts_desc')}</p>
                      </div>
                    ) : (
                      <AnimatePresence>
                        {filteredMarketplacePosts.map(post => (
                          <motion.div
                            layoutId={post.id}
                            key={post.id}
                            layout
                            initial={{ opacity: 0, y: 16, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -18, scale: 0.9 }}
                            transition={{ duration: 0.22, ease: 'easeOut' }}
                            onClick={() => setIsDetailOpen(post)}
                            className="post-card bg-white rounded-[2rem] overflow-hidden border border-zinc-100 dark:border-slate-600 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all group shadow-sm flex flex-col"
                          >
                            <div className="aspect-square relative bg-zinc-50 overflow-hidden">
                              {(post.imageUrl || (post.images && post.images[0])) ? (
                                <img src={post.imageUrl || post.images?.[0]} alt={post.title} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" loading="lazy" decoding="async" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-zinc-200 dark:text-slate-700 bg-brand-bg">
                                  <Heart className="w-16 h-16 text-stormy-teal/10 dark:text-white/5" />
                                </div>
                              )}

                              {/* Botón ADMIN (eliminar físico, rojo) */}
                              {isAdmin && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showConfirm(
                                      t('common.confirm'),
                                      t('dashboard.post_delete_confirm'),
                                      () => handleDeletePost(post.id)
                                    );
                                  }}
                                  className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg z-10 transition-colors"
                                  title={t('community.delete_post_admin')}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}

                              {/* Botón USUARIO NORMAL (baja lógica, gris) */}
                              {!isAdmin &&
                               post.uid === user?.uid &&
                               post.status === 'activa' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showConfirm(
                                      t('common.confirm'),
                                      t('dashboard.post_cancel_confirm'),
                                      () => handleOwnerDeletePost(post.id)
                                    );
                                  }}
                                  className="absolute top-2 right-2 p-1.5 bg-zinc-400 hover:bg-zinc-500 text-white rounded-full shadow-lg z-10 transition-colors"
                                  title={t('community.withdraw_post')}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}

                              <div className="absolute top-4 left-4 flex gap-2">
                                <span className={cn(
                                  "px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg backdrop-blur-md",
                                  post.type === 'doy' ? "bg-emerald-action text-white" : "bg-maya-blue text-white"
                                )}>
                                  {post.type === 'doy' ? t('community.offer') : t('community.need')}
                                </span>
                              </div>
                            </div>
                            <div className="p-6">
                              <span className="post-card-tag text-[9px] font-black text-[#1F2937] dark:text-slate-100 bg-zinc-200 dark:bg-emerald-900/40 px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-block">#{t(`community.tag_${post.category || post.tag}`)}</span>
                              <h4 className="post-card-title font-display font-black text-[#1F2937] dark:text-white text-xl line-clamp-1 mb-2 tracking-tight uppercase">{post.title}</h4>
                              <p className="post-card-description text-[#1F2937] dark:text-slate-200 text-xs line-clamp-2 leading-relaxed font-medium">{post.description || post.content || t('community.no_description')}</p>
                              <div className="mt-4 pt-4 border-t border-zinc-50 dark:border-slate-700 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-brand-bg border border-zinc-100 dark:border-slate-600" />
                                  <div className="flex flex-col">
                                    <span className="post-card-metadata text-[9px] font-bold text-[#374151] dark:text-slate-300 uppercase tracking-widest">{post.userName || t('community.active_neighbor')}</span>
                                    <span className="post-card-metadata text-[9px] font-bold text-[#374151] dark:text-slate-300 uppercase tracking-widest">{formatMarketplaceDate(post.createdAt)}</span>
                                  </div>
                                </div>
                                <div className="post-card-details flex items-center gap-1 px-2 py-1 rounded-md text-[#126B69] font-black text-[9px] uppercase tracking-widest transition-all group-hover:translate-x-1 group-hover:bg-zinc-100">
                                  {t('marketplace.details')}
                                  <ChevronRight className="w-3 h-3" />
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    )}
                  </div>
                </div>

                {/* 3. Organizador de Cuadrillas (1/3 width on desktop) */}
                <aside className="space-y-8">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-4">
                      <div className="bg-stormy-teal p-3 rounded-2xl shadow-lg shadow-stormy-teal/20">
                        <Calendar className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="text-xl sm:text-2xl font-display font-black text-stormy-teal uppercase tracking-tight">{t('community.squads')}</h3>
                    </div>
                    <button 
                      onClick={() => setIsSquadModalOpen(true)}
                      className="p-3 bg-stormy-teal/10 text-stormy-teal rounded-2xl hover:bg-stormy-teal/20 transition-all"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    {crewEvents
                      .filter(event => {
                        const squadDateTime = new Date(`${event.date}T${event.time || '00:00'}`);
                        const now = new Date();
                        return squadDateTime >= now && event.status !== 'cancelada';
                      })
                      .length === 0 ? (
                      <div className="bg-white border-2 border-dashed border-zinc-50 rounded-[2rem] p-10 text-center">
                        <p className="text-[#374151] font-bold text-[10px] uppercase tracking-widest">{t('community.no_events')}</p>
                      </div>
                    ) : (
                      crewEvents
                        .filter(event => {
                          const squadDateTime = new Date(`${event.date}T${event.time || '00:00'}`);
                          const now = new Date();
                          return squadDateTime >= now && event.status !== 'cancelada';
                        })
                        .map(event => {
                        const isAttending = auth.currentUser && event.attendees.includes(auth.currentUser.uid);
                        return (
                          <motion.div 
                            key={event.id} 
                            whileHover={{ scale: 1.01 }}
                            onClick={() => setSelectedSquadForDetail(event)}
                            className="community-card bg-white rounded-[2rem] border border-zinc-100 dark:border-slate-600 shadow-sm overflow-hidden group hover:shadow-lg transition-all cursor-pointer"
                          >
                            <div className="p-6 space-y-5">
                              <div className="space-y-2">
                                <div className="flex justify-between items-start gap-4">
                                  <h4 className="community-card-title text-lg font-black text-[#1F2937] dark:text-white tracking-tight leading-tight group-hover:text-stormy-teal transition-colors uppercase">{event.title}</h4>
                                  <div className="flex items-center gap-1">
                                    {auth.currentUser?.uid === event.createdBy && (
                                      <div className="flex gap-1">
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); handleEditSquad(event); }}
                                          className="p-1.5 bg-zinc-100 text-zinc-600 dark:text-slate-300 rounded-lg hover:bg-stormy-teal/10 dark:hover:bg-stormy-teal/20 hover:text-stormy-teal dark:hover:text-white transition-all"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); handleCancelSquad(event.id); }}
                                          className="p-1.5 bg-zinc-100 text-red-600 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20 hover:text-red-600 transition-all"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    )}
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleViewAttendees(event); }}
                                      className="bg-stormy-teal/5 dark:bg-stormy-teal/20 px-2.5 py-1 rounded-full text-[8px] font-black text-stormy-teal dark:text-slate-100 uppercase tracking-widest shrink-0 hover:bg-stormy-teal/10 dark:hover:bg-stormy-teal/30 transition-all"
                                    >
                                      {event.attendees.length}/{event.maxParticipants}
                                    </button>
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-4 border-t border-zinc-50 dark:border-slate-700">
                                  <div className="community-card-metadata flex items-center gap-2 text-[#374151] dark:text-slate-300">
                                    <Calendar className="w-3.5 h-3.5 text-stormy-teal dark:text-slate-100" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">{format(new Date(event.date), "d MMM", { locale: language === 'es' ? es : enUS })}</span>
                                  </div>
                                  <div className="community-card-metadata flex items-center gap-2 text-[#374151] dark:text-slate-300">
                                    <Clock className="w-3.5 h-3.5 text-stormy-teal dark:text-slate-100" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">{event.time}</span>
                                  </div>
                                </div>
                              </div>
                              
                              <p className="community-card-description text-[#1F2937] dark:text-slate-200 text-xs line-clamp-2 font-medium leading-relaxed">{event.description}</p>
                              
                              <button 
                                onClick={() => toggleAttendance(event.id, !!isAttending, event.title)}
                                className={cn(
                                  "w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2",
                                  isAttending 
                                    ? "bg-zinc-100 text-zinc-400 dark:text-slate-500 cursor-default" 
                                    : "bg-emerald-action text-white hover:bg-emerald-action/90 shadow-lg shadow-emerald-action/20 active:scale-95"
                                )}
                              >
                                {isAttending ? (
                                  <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    {t('community.enrolled')}
                                  </>
                                ) : (
                                  <>
                                    <Users className="w-4 h-4" />
                                    {t('community.join_squad')}
                                  </>
                                )}
                              </button>
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </div>

                  <div className="bg-white rounded-[2.5rem] p-8 border border-zinc-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-100/40 rounded-full -mr-16 -mt-16 blur-2xl" />
                    <div className="relative z-10 space-y-4">
                      <div className="flex items-center gap-3">
                        <Info className="w-5 h-5 text-amber-400" />
                        <h5 className="font-black text-xs uppercase tracking-widest text-stormy-teal">{t('community.what_is_squad')}</h5>
                      </div>
                      <p className="text-xs text-zinc-700 leading-relaxed font-medium">
                        {t('community.squad_desc')}
                      </p>
                    </div>
                  </div>
                </aside>
              </div>
            </motion.div>
          )}

          {activeTab === 'MAPA' && (
            <motion.div 
              key="mapa"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full h-[calc(100svh-11rem)] min-h-[420px] sm:h-[700px] flex flex-col"
            >
              {(() => {
                const reportsForMap = reports
                  .map(r => {
                    const lat = r.location?.lat ?? (r as any).coords?.lat ?? null;
                    const lng = r.location?.lng ?? (r as any).coords?.lng ?? null;
                    return {
                      ...r,
                      location: { lat, lng }
                    };
                  })
                  .filter(r => 
                    r.location.lat !== null && 
                    r.location.lng !== null &&
                    !isNaN(Number(r.location.lat)) && 
                    !isNaN(Number(r.location.lng))
                  );

                return (
                  <ReportMap 
                    reports={reportsForMap as any} 
                    filter={reportFilter}
                    onFilterChange={setReportFilter}
                    currentUser={user}
                    reportsReady={reportsReady}
                    hasMyReports={hasMineReports}
                    onCreateReport={() => { resetForm(); setIsReportModalOpen(true); }}
                    onSelectReport={(report) => setSelectedReportForDetail(report)} 
                  />
                );
              })()}
            </motion.div>
          )}

          {activeTab === 'CHATBOT' && (
            <motion.div 
              key="chatbot"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex-1 flex flex-col min-h-0"
            >
              <RoccoChat missions={missions} onMissionClick={(m) => setSelectedMission(m)} />
            </motion.div>
          )}

          {activeTab === 'PERFIL' && (
            <motion.div 
              key="perfil"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <ProfileScreen 
                onLogout={handleLogout} 
                onViewMyReports={() => {
                  setReportFilter('mios');
                  setActiveTab('REPORTES');
                }} 
                missions={missions}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>

      {/* FAB: Reportar — always visible, hidden only in Crisis Mode (early return above) */}

      {/* Modals */}
      <AnimatePresence>
        {selectedMission && (
          <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              className="bg-white rounded-t-[2rem] sm:rounded-[3rem] shadow-2xl w-full sm:max-w-lg max-h-[90svh] overflow-y-auto flex flex-col border border-zinc-100 dark:border-slate-700"
            >
              <div className="p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div className={cn("p-4 rounded-2xl shadow-lg", selectedMission.color, getMissionIconTextClass(selectedMission.color))}>
                    <selectedMission.icon className="w-8 h-8" />
                  </div>
                  <button 
                    onClick={() => setSelectedMission(null)}
                    className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-zinc-400" />
                  </button>
                </div>

                <div className="space-y-2">
                  <h3 className="text-3xl font-display font-black text-zinc-900 uppercase tracking-tight">
                    {t(`mission.title_${selectedMission.id}`)}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="theme-badge-accent px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                      {selectedMission.reward} {t('mission.reward_label')}
                    </span>
                    <span className="theme-badge-muted px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                      {selectedMission.status === 'completed' ? t('common.completed') : t('common.in_progress')}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('common.description')}</p>
                    <p className="text-zinc-600 font-medium">
                      {t(`mission.desc_${selectedMission.id}`)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('common.objective')}</p>
                    <p className="text-zinc-600 font-medium">
                      {t(`mission.obj_${selectedMission.id}`)}
                    </p>
                  </div>
                  <div className="theme-soft-card p-6 rounded-3xl border space-y-2">
                    <div className="theme-soft-card-title flex items-center gap-2">
                      <Info className="w-4 h-4" />
                      <p className="text-[10px] font-black uppercase tracking-widest">{t('common.rocco_suggestion')}</p>
                    </div>
                    <p className="theme-soft-card-text font-bold text-sm">
                      {t(`mission.action_${selectedMission.id}`)}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => setSelectedMission(null)}
                    className="flex-1 py-3 rounded-2xl border border-zinc-200 text-zinc-500 font-black text-xs uppercase tracking-widest hover:bg-zinc-50 transition-all"
                  >
                    {t('common.close')}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedMission(null);
                      setActiveTab('PERFIL');
                    }}
                    className="flex-1 py-3 rounded-2xl bg-emerald-action text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all"
                  >
                    {t('common.view_in_profile')}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Modal isOpen={isFeedbackModalOpen} onClose={() => setIsFeedbackModalOpen(false)} title={t('feedback.title')}>
        <div className="space-y-6">
          <p className="text-zinc-600 dark:text-slate-300 leading-relaxed">
            {t('feedback.description')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleOpenFeedbackForm}
              className="btn-primary w-full sm:flex-1 text-center"
              aria-label={t('feedback.respond_form_new_tab')}
              title={t('feedback.respond_form_new_tab')}
            >
              {t('feedback.respond_form')}
            </button>
            <button
              onClick={() => setIsFeedbackModalOpen(false)}
              className="btn-secondary w-full sm:flex-1 text-center"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isVolunteerModalOpen} onClose={() => setIsVolunteerModalOpen(false)} title={t('community.volunteer_signup')}>
        <form onSubmit={handleRegisterVolunteer} className="space-y-8 p-4">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-900/30 mb-6">
            <p className="text-emerald-800 dark:text-slate-100 text-sm font-medium leading-relaxed">
              {t('community.volunteer_signup_desc')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-zinc-400 dark:text-slate-500 uppercase tracking-widest ml-2">{t('community.volunteer_name_label')}</label>
              <input
                required
                type="text"
                value={vName}
                onChange={(e) => setVName(e.target.value)}
                onBlur={(e) => validateField('vName', e.target.value)}
                placeholder={t('community.volunteer_name_placeholder')}
                className={cn(
                  "w-full p-5 bg-zinc-50 border border-zinc-200 dark:border-slate-700 rounded-[2rem] outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium text-zinc-900 dark:text-white",
                  fieldErrors.vName && "border-red-500 focus:ring-red-500"
                )}
              />
              {fieldErrors.vName && (
                <p className="text-red-500 text-[10px] font-bold mt-1 ml-4">{fieldErrors.vName}</p>
              )}
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-zinc-400 dark:text-slate-500 uppercase tracking-widest ml-2">{t('community.volunteer_contact_label')}</label>
              <input
                required
                type="text"
                value={vContact}
                onChange={(e) => setVContact(e.target.value)}
                onBlur={(e) => validateField('vContact', e.target.value)}
                placeholder={t('community.volunteer_contact_placeholder')}
                className={cn(
                  "w-full p-5 bg-zinc-50 border border-zinc-200 dark:border-slate-700 rounded-[2rem] outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium text-zinc-900 dark:text-white",
                  fieldErrors.vContact && "border-red-500 focus:ring-red-500"
                )}
              />
              {fieldErrors.vContact && (
                <p className="text-red-500 text-[10px] font-bold mt-1 ml-4">{fieldErrors.vContact}</p>
              )}
            </div>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-zinc-400 dark:text-slate-500 uppercase tracking-widest ml-2">{t('reports.zone')}</label>
            <input
              required
              type="text"
              value={vZone}
              onChange={(e) => setVZone(e.target.value)}
              onBlur={(e) => validateField('vZone', e.target.value)}
              aria-describedby={fieldErrors.vZone ? 'volunteer-zone-error' : undefined}
              placeholder={t('community.volunteer_zone')}
              className={cn(
                "w-full p-5 bg-zinc-50 border border-zinc-200 dark:border-slate-700 rounded-[2rem] outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium text-zinc-900 dark:text-white",
                fieldErrors.vZone && "border-red-500 focus:ring-red-500"
              )}
            />
            {fieldErrors.vZone && (
              <p id="volunteer-zone-error" className="text-red-500 text-[10px] font-bold mt-1 ml-4">{fieldErrors.vZone}</p>
            )}
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-zinc-400 dark:text-slate-500 uppercase tracking-widest ml-2">{t('community.volunteer_help_label')}</label>
            <textarea
              value={vHelpType}
              onChange={(e) => setVHelpType(e.target.value)}
              onBlur={(e) => validateField('vHelpType', e.target.value)}
              placeholder={t('community.volunteer_help_placeholder')}
              className={cn(
                "w-full p-5 bg-zinc-50 border border-zinc-200 dark:border-slate-700 rounded-[2rem] outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium min-h-[100px] text-zinc-900 dark:text-white",
                fieldErrors.vHelpType && "border-red-500 focus:ring-red-500"
              )}
            />
            <div className="flex justify-between mt-1 px-4">
              {fieldErrors.vHelpType ? (
                <p className="text-red-500 text-[10px] font-bold">{fieldErrors.vHelpType}</p>
              ) : <div />}
              <span className={cn(
                "text-[10px] font-bold",
                vHelpType.length < 10 || vHelpType.length > 500 ? "text-amber-500" : "text-zinc-400"
              )}>
                {vHelpType.length}/500
              </span>
            </div>
          </div>
          <button 
            type="submit"
            disabled={isSubmittingVolunteer}
            className="w-full py-6 bg-emerald-600 text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-emerald-100 dark:shadow-none hover:bg-emerald-700 transition-all disabled:bg-stormy-teal disabled:text-white disabled:opacity-100 disabled:cursor-not-allowed flex items-center justify-center gap-3 active:scale-95"
          >
            {isSubmittingVolunteer ? <Loader2 className="w-8 h-8 animate-spin" /> : (
              <>
                <Heart className="w-6 h-6" />
                {t('community.volunteer_confirm')}
              </>
            )}
          </button>
        </form>
      </Modal>

      <AnimatePresence>
        {isReportModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              className="w-full sm:max-w-xl max-h-[95svh] sm:max-h-[90vh] overflow-y-auto custom-scrollbar bg-white rounded-t-[2rem] sm:rounded-[3rem] shadow-2xl"
            >
              <ReportForm 
                onClose={() => setIsReportModalOpen(false)} 
                onSuccess={() => setIsReportModalOpen(false)} 
              />
            </motion.div>
          </div>
        )}

        {selectedReportForDetail && (
          <ReportDetailModal 
            report={selectedReportForDetail} 
            onClose={() => setSelectedReportForDetail(null)} 
            onOpenHistory={() => {
              const report = selectedReportForDetail;
              setSelectedReportForDetail(null);
              setSelectedReportForHistory(report);
            }}
          />
        )}

        {selectedReportForHistory && (
          <ReportTimeline 
            report={selectedReportForHistory} 
            onClose={() => setSelectedReportForHistory(null)} 
          />
        )}
      </AnimatePresence>

      <Modal isOpen={isPostModalOpen} onClose={() => { setIsPostModalOpen(false); resetForm(); }} title={postType === 'doy' ? t('community.post_type_offer') : t('community.post_type_need')}>
        {postCreationSuccess ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="py-10 sm:py-14 px-4 sm:px-6 flex flex-col items-center justify-center text-center space-y-5"
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 360, damping: 24, delay: 0.08 }}
              className="relative w-20 h-20 rounded-full flex items-center justify-center text-white shadow-xl shadow-emerald-action/20"
            >
              <div className="absolute inset-0 rounded-full bg-emerald-action/20 motion-safe:animate-ping" />
              <div className="absolute inset-1 rounded-full bg-emerald-action" />
              <CheckCircle2 className="relative w-10 h-10" />
            </motion.div>
            <div className="space-y-2">
              <h3 className="text-2xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tighter">
                {t('common.success')}
              </h3>
              <p className="text-zinc-600 dark:text-slate-400 font-medium">
                {t('community.post_create_success')}
              </p>
            </div>
          </motion.div>
        ) : (
        <div className="space-y-6 p-1 sm:p-2">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-500 dark:text-slate-400 uppercase tracking-widest">{t('community.post_photos_label')} ({t('community.optional_label')})</label>
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {selectedImages.map((img, i) => (
                <div key={i} className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden flex-shrink-0 relative">
                  <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                  <button onClick={() => setSelectedImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-black/50 p-1 rounded-full">
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
              {selectedImages.length < 1 && (
                <button onClick={() => fileInputRef.current?.click()} className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-4 border-dashed border-zinc-200 dark:border-slate-700 flex items-center justify-center text-zinc-400 dark:text-slate-500 hover:bg-zinc-50">
                  <Plus className="w-8 h-8" />
                </button>
              )}
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
          </div>
 
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 dark:text-slate-500 uppercase tracking-widest">{t('community.post_title_label')}</label>
            <input 
              type="text" 
              placeholder={t('community.post_title_placeholder')}
              className={cn(
                "w-full p-4 bg-zinc-50 border border-zinc-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 text-zinc-900 dark:text-white font-bold",
                fieldErrors.title && "border-red-500 focus:ring-red-500"
              )}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={(e) => validateField('title', e.target.value)}
            />
            {fieldErrors.title && (
              <p className="text-red-500 text-[10px] font-bold mt-1 ml-2">{fieldErrors.title}</p>
            )}
          </div>
 
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 dark:text-slate-500 uppercase tracking-widest">{t('community.post_tag_label')}</label>
            <div className="flex gap-2">
              {(['ropa', 'comida', 'otros'] as Tag[]).map(tagValue => (
                <button 
                  key={tagValue} 
                  onClick={() => setTag(tagValue)} 
                  className={cn(
                    "flex-1 py-3 rounded-xl text-xs font-bold capitalize transition-all", 
                    tag === tagValue ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-500 dark:text-slate-400"
                  )}
                >
                  {t(`community.tag_${tagValue}`)}
                </button>
              ))}
            </div>
          </div>
 
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 dark:text-slate-500 uppercase tracking-widest">{t('community.post_details_label')}</label>
            <textarea 
              placeholder={t('community.post_details_placeholder')}
              className={cn(
                "w-full p-4 bg-zinc-50 border border-zinc-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 min-h-[120px] text-zinc-900 dark:text-white font-medium",
                fieldErrors.description && "border-red-500 focus:ring-red-500"
              )}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={(e) => validateField('description', e.target.value)}
            />
            <div className="flex justify-between mt-1 px-2">
              {fieldErrors.description ? (
                <p className="text-red-500 text-[10px] font-bold">{fieldErrors.description}</p>
              ) : <div />}
              <span className={cn(
                "text-[10px] font-bold",
                  description.length < 10 || description.length > 500 ? "text-amber-600" : "text-zinc-500"
                )}>
                {description.length}/500
              </span>
            </div>
          </div>
 
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 dark:text-slate-500 uppercase tracking-widest">{t('community.post_contact_label')}</label>
            <input 
              type="text" 
              placeholder={t('community.post_contact_placeholder')}
              className={cn(
                "w-full p-4 bg-zinc-50 border border-zinc-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 text-zinc-900 dark:text-white font-bold",
                fieldErrors.contact && "border-red-500 focus:ring-red-500"
              )}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              onBlur={(e) => validateField('contact', e.target.value)}
            />
            {fieldErrors.contact && (
              <p className="text-red-500 text-[10px] font-bold mt-1 ml-2">{fieldErrors.contact}</p>
            )}
          </div>
 
          {error && <p className="text-sm text-red-500 font-bold">{error}</p>}
 
          <button 
            disabled={loading || !title || !description || !postType}
            onClick={handleCreatePost}
            className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black shadow-xl hover:bg-emerald-700 transition-all disabled:bg-stormy-teal disabled:text-white disabled:opacity-100 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading || imageUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : t('community.post_publish')}
          </button>
        </div>
        )}
      </Modal>

      {/* Detail View */}
      <AnimatePresence>
        {isDetailOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              layoutId={isDetailOpen.id}
              className="bg-white sm:rounded-[3rem] w-full max-w-2xl overflow-hidden flex flex-col h-full sm:h-auto sm:max-h-[90vh] shadow-2xl"
            >
              <div className="relative w-full bg-zinc-100 shrink-0" style={{ maxHeight: '40%' }}>
                {('images' in isDetailOpen && (isDetailOpen.imageUrl || (isDetailOpen.images && isDetailOpen.images[0]))) ? (
                  <img
                    src={isDetailOpen.imageUrl || isDetailOpen.images?.[0]}
                    alt={'title' in isDetailOpen ? isDetailOpen.title : ''}
                    className="w-full h-full object-cover max-h-56 sm:max-h-72"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-32 sm:h-48 flex items-center justify-center text-zinc-200 dark:text-slate-700">
                    <Heart className="w-16 h-16" />
                  </div>
                )}
                <button 
                  onClick={() => setIsDetailOpen(null)}
                  className="absolute top-4 right-4 p-2.5 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors backdrop-blur-md z-20"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 p-6 sm:p-10 overflow-y-auto min-h-0 custom-scrollbar">
                {'attendees' in isDetailOpen ? (
                  <div className="space-y-6 sm:space-y-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <h2 className="text-2xl sm:text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">{isDetailOpen.title}</h2>
                      <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest self-start">
                        {t('community.squad_event')}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div className="bg-zinc-50 p-5 sm:p-6 rounded-3xl flex items-center gap-4">
                        <Calendar className="w-7 h-7 sm:w-8 sm:h-8 text-amber-500" />
                        <div>
                          <p className="text-[10px] font-bold text-[#374151] uppercase tracking-widest mb-1">{t('community.date_label')}</p>
                          <p className="font-black text-zinc-800 dark:text-slate-200 text-sm sm:text-base">
                            {isDetailOpen.date ? format(new Date(isDetailOpen.date), language === 'es' ? "d 'de' MMMM" : "MMMM d", { locale: language === 'es' ? es : enUS }) : 'Próximamente'}
                          </p>
                        </div>
                      </div>
                      <div className="bg-zinc-50 p-5 sm:p-6 rounded-3xl flex items-center gap-4">
                        <MapPin className="w-7 h-7 sm:w-8 sm:h-8 text-amber-500" />
                        <div>
                          <p className="text-[10px] font-bold text-[#374151] uppercase tracking-widest mb-1">{t('community.location_label')}</p>
                          <p className="font-black text-zinc-800 dark:text-slate-200 text-sm sm:text-base truncate">{isDetailOpen.location}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-[#374151] uppercase tracking-widest">{t('community.description_label')}</p>
                      <p className="text-zinc-600 dark:text-slate-400 leading-relaxed text-base sm:text-lg font-medium">{isDetailOpen.description}</p>
                    </div>

                    <div className="bg-zinc-50 p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
                      <div className="text-center sm:text-left">
                        <p className="text-[10px] font-bold text-[#374151] uppercase tracking-widest mb-1">{t('community.participants_label')}</p>
                        <p className="text-2xl sm:text-3xl font-display font-black text-stormy-teal">{isDetailOpen.attendees.length} {t('community.neighbors_label')}</p>
                      </div>
                      <button
                        onClick={() => {
                          const isAttending = auth.currentUser && isDetailOpen.attendees.includes(auth.currentUser.uid);
                          toggleAttendance(isDetailOpen.id, !!isAttending, isDetailOpen.title);
                          setIsDetailOpen(null);
                        }}
                        className={cn(
                          "w-full sm:w-auto px-8 py-4 sm:py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg active:scale-95",
                          auth.currentUser && isDetailOpen.attendees.includes(auth.currentUser.uid)
                            ? "bg-emerald-500 text-white"
                            : "bg-white text-zinc-900"
                        )}
                      >
                        {auth.currentUser && isDetailOpen.attendees.includes(auth.currentUser.uid) ? t('community.im_attending') : t('community.join_button')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 sm:space-y-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <h2 className="text-2xl sm:text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">{isDetailOpen.title}</h2>
                      <div className="flex gap-2">
                        <span className="px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-[#126B69] dark:text-slate-100 text-[9px] font-bold uppercase tracking-widest">#{isDetailOpen.category || isDetailOpen.tag}</span>
                        <span className="px-3 py-1.5 rounded-full bg-zinc-100 text-[#374151] dark:text-slate-300 text-[9px] font-bold uppercase tracking-widest">{isDetailOpen.type === 'doy' ? t('community.offer') : t('community.need')}</span>
                      </div>
                    </div>

                    <p className="text-[#1F2937] dark:text-slate-200 leading-relaxed text-lg sm:text-xl font-medium">{isDetailOpen.description || isDetailOpen.content}</p>

                    {user?.uid === isDetailOpen.uid && (
                      <div className="space-y-4 pt-6 border-t border-zinc-100 dark:border-slate-700">
                        <p className="text-[10px] font-black text-[#374151] dark:text-slate-500 uppercase tracking-widest">{t('community.manage_status')}</p>
                            <button
                              onClick={() => {
                                const postToEdit = isDetailOpen as MarketplacePost;
                                setIsDetailOpen(null);
                                handleEditPost(postToEdit);
                              }}
                              className="w-full px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all bg-stormy-teal/10 text-stormy-teal hover:bg-stormy-teal/20"
                            >
                              {t('common.edit')}
                            </button>
                            <div className="flex flex-wrap gap-2">
                              {(['activa', 'resuelta', 'cerrada'] as const).map((status) => (
                                <button
                                  key={status}
                                  onClick={async () => {
                                    try {
                                      await updatePostStatus(isDetailOpen.id, status);
                                      setIsDetailOpen(null);
                                    } catch (err) {
                                      console.error("Error updating post status:", err);
                                    }
                                  }}
                                  className={cn(
                                    "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                                    isDetailOpen.status === status 
                                      ? "bg-stormy-teal text-white" 
                                      : "bg-zinc-100 text-zinc-500 dark:text-slate-400 hover:bg-zinc-200"
                                  )}
                                >
                                  {status === 'activa'
                                    ? t('community.status_available')
                                    : status === 'resuelta'
                                      ? t('community.status_delivered')
                                      : t('community.status_expired')}
                                </button>
                              ))}
                            </div>
                      </div>
                    )}

                    {isDetailOpen.contact && (
                          <div className="bg-emerald-600 p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] text-white flex items-center justify-between gap-4 shadow-xl shadow-emerald-100/10">
                            <div>
                              <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mb-1">{t('community.post_contact_label')}</p>
                              <p className="text-xl sm:text-2xl font-display font-black truncate max-w-[150px] sm:max-w-none">{isDetailOpen.contact}</p>
                            </div>
                            <a 
                              href={`https://wa.me/${isDetailOpen.contact.replace(/\D/g, '')}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="bg-white text-emerald-600 p-4 sm:p-5 rounded-2xl hover:bg-zinc-100 transition-all shadow-lg active:scale-95 shrink-0"
                            >
                              <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
                            </a>
                          </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
          )}
        </AnimatePresence>

    {/* Bottom Navigation - Mobile */}
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-zinc-100 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] flex items-center justify-around z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      {[
        { id: 'DASHBOARD', icon: LayoutDashboard },
        { id: 'REPORTES', icon: MapPin },
        { id: 'MAPA', icon: MapIcon },
        { id: 'COMUNIDAD', icon: Users },
        { id: 'CHATBOT', icon: Bot },
        { id: 'PERFIL', icon: User },
      ].map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveTab(item.id as Tab)}
          className={cn(
            "p-2.5 rounded-xl transition-all",
            activeTab === item.id ? "bg-stormy-teal text-white shadow-md" : "text-zinc-400"
          )}
        >
          <item.icon className="w-5 h-5" />
        </button>
      ))}
    </nav>
  </main>

  {/* Modals */}
      <Modal 
        isOpen={isAttendeesModalOpen} 
        onClose={() => setIsAttendeesModalOpen(false)}
        title={t('community.squad_attendees_title')}
      >
        <div className="space-y-6 p-1 sm:p-2">
          {selectedSquadForAttendees && (
            <div className="p-5 sm:p-6 bg-amber-50 dark:bg-amber-900/20 rounded-3xl border border-amber-100 dark:border-amber-900/30">
              <h4 className="text-lg font-black text-amber-900 dark:text-amber-400 uppercase tracking-tight">{selectedSquadForAttendees.title}</h4>
              <p className="text-xs font-medium text-amber-700 dark:text-amber-500 mt-1">{selectedSquadForAttendees.attendees.length} {t('community.people_joined')}</p>
            </div>
          )}
          
          <div className="space-y-4 max-h-[40vh] sm:max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {squadAttendeesProfiles.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              </div>
            ) : (
              squadAttendeesProfiles.map((profile, i) => (
                <div key={i} className="assistant-card flex items-center gap-4 p-4 bg-white rounded-2xl border border-zinc-100 dark:border-slate-700 shadow-sm">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 overflow-hidden flex items-center justify-center text-emerald-700 dark:text-slate-100 font-black text-lg">
                    {profile.photoURL ? (
                      <img src={profile.photoURL} alt={profile.alias || ''} className="w-full h-full object-cover" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                    ) : (
                      profile.alias?.charAt(0) || 'U'
                    )}
                  </div>
                  <div>
                    <h5 className="assistant-card-title font-black text-[#1F2937] dark:text-white uppercase tracking-tight">{profile.alias}</h5>
                    <p className="assistant-card-metadata text-[10px] font-bold text-[#374151] dark:text-slate-500 uppercase tracking-widest">{profile.role === 'admin' ? t('common.admin') : t('common.ecowarrior')}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <button 
            onClick={() => setIsAttendeesModalOpen(false)}
            className="w-full py-5 bg-stormy-teal text-white rounded-2xl font-black uppercase tracking-widest hover:bg-stormy-teal/90 transition-all"
          >
            {t('common.close')}
          </button>
        </div>
      </Modal>

      {/* Squad Detail Modal */}
      <Modal
        isOpen={!!selectedSquadForDetail}
        onClose={() => setSelectedSquadForDetail(null)}
        title={selectedSquadForDetail?.title || ''}
      >
        {selectedSquadForDetail && (
          <div className="space-y-6">
            <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100 dark:border-slate-800">
              <p className="text-zinc-600 dark:text-slate-300 font-medium leading-relaxed">
                {selectedSquadForDetail.description}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-white rounded-2xl border border-zinc-100 dark:border-slate-700 flex flex-col gap-1">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('community.date_label')}</span>
                <span className="font-bold text-zinc-800 dark:text-slate-100">{selectedSquadForDetail.date}</span>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-zinc-100 dark:border-slate-700 flex flex-col gap-1">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('community.squad_time_label')}</span>
                <span className="font-bold text-zinc-800 dark:text-slate-100">{selectedSquadForDetail.time}</span>
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-zinc-100 dark:border-slate-700 flex flex-col gap-1">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('community.location_label')}</span>
              <span className="font-bold text-zinc-800 dark:text-slate-100">{selectedSquadForDetail.location}</span>
            </div>

            <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-stormy-teal dark:text-emerald-200" />
                <span className="font-bold text-stormy-teal dark:text-emerald-200">
                  {selectedSquadForDetail.attendees.length} {selectedSquadForDetail.maxParticipants ? `/ ${selectedSquadForDetail.maxParticipants}` : ''} {t('community.squad_attendees')}
                </span>
              </div>
              <span className={cn(
                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                selectedSquadForDetail.status === 'próxima' ? "bg-amber-100 text-amber-800" : 
                selectedSquadForDetail.status === 'finalizada' ? "bg-zinc-100 text-zinc-700" : "bg-red-100 text-red-700"
              )}>
                {selectedSquadForDetail.status === 'próxima' ? t('community.squad_status_upcoming') :
                 selectedSquadForDetail.status === 'finalizada' ? t('community.squad_status_finished') :
                 t('community.squad_status_cancelled')}
              </span>
            </div>

            <button
              onClick={() => {
                toggleAttendance(selectedSquadForDetail.id, selectedSquadForDetail.attendees.includes(auth.currentUser?.uid || ''), selectedSquadForDetail.title);
                setSelectedSquadForDetail(null);
              }}
              className={cn(
                "w-full py-5 rounded-[2rem] font-black uppercase tracking-widest transition-all shadow-xl",
                selectedSquadForDetail.attendees.includes(auth.currentUser?.uid || '')
                  ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  : "bg-emerald-action text-white hover:bg-emerald-action/90 shadow-emerald-action/10"
              )}
            >
              {selectedSquadForDetail.attendees.includes(auth.currentUser?.uid || '') ? t('community.squad_leave') : t('community.squad_join')}
            </button>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!squadToCancel}
        onClose={() => setSquadToCancel(null)}
        title={t('community.cancel_squad_title')}
      >
        <div className="space-y-6">
          <p className="text-zinc-600 dark:text-slate-300 font-medium text-center">
            {t('community.cancel_squad_confirm')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => setSquadToCancel(null)}
              className="py-4 bg-zinc-100 text-zinc-600 dark:text-slate-300 rounded-2xl font-bold uppercase tracking-widest text-xs"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={confirmCancelSquad}
              disabled={loading}
              className="py-4 bg-red-500 text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-red-600 transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('common.confirm')}
            </button>
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={isSquadModalOpen} 
        onClose={() => { setIsSquadModalOpen(false); setEditingSquadId(null); }}
        title={editingSquadId ? t('community.squad_edit_title') : t('community.squad_create_title')}
      >
        <div className="space-y-6 p-1 sm:p-2">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{t('community.squad_title_label')}</label>
            <input 
              type="text" 
              value={sTitle}
              onChange={(e) => setSTitle(e.target.value)}
              onBlur={(e) => validateField('sTitle', e.target.value)}
              placeholder={t('community.squad_title_placeholder')}
              className={cn(
                "w-full p-4 bg-zinc-50 rounded-2xl border border-zinc-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-amber-500 transition-all font-bold text-zinc-900 dark:text-white",
                fieldErrors.sTitle && "border-red-500 focus:ring-red-500"
              )}
            />
            {fieldErrors.sTitle && (
              <p className="text-red-500 text-[10px] font-bold mt-1 ml-2">{fieldErrors.sTitle}</p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{t('community.description_label')}</label>
            <textarea 
              value={sDescription}
              onChange={(e) => setSDescription(e.target.value)}
              onBlur={(e) => validateField('sDescription', e.target.value)}
              placeholder={t('community.squad_desc_placeholder')}
              rows={3}
              className={cn(
                "w-full p-4 bg-zinc-50 rounded-2xl border border-zinc-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-amber-500 transition-all font-medium text-zinc-900 dark:text-white",
                fieldErrors.sDescription && "border-red-500 focus:ring-red-500"
              )}
            />
            <div className="flex justify-between mt-1 px-2">
              {fieldErrors.sDescription ? (
                <p className="text-red-500 text-[10px] font-bold">{fieldErrors.sDescription}</p>
              ) : <div />}
              <span className={cn(
                "text-[10px] font-bold",
                sDescription.length < 10 || sDescription.length > 500 ? "text-amber-500" : "text-zinc-400"
              )}>
                {sDescription.length}/500
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{t('community.date_label')}</label>
              <input 
                type="date" 
                value={sDate}
                onChange={(e) => setSDate(e.target.value)}
                className="w-full p-4 bg-zinc-50 rounded-2xl border border-zinc-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-amber-500 transition-all font-bold text-zinc-900 dark:text-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{t('community.squad_time_label')}</label>
              <input 
                type="time" 
                value={sTime}
                onChange={(e) => setSTime(e.target.value)}
                className="w-full p-4 bg-zinc-50 rounded-2xl border border-zinc-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-amber-500 transition-all font-bold text-zinc-900 dark:text-white"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{t('community.location_label')}</label>
            <input 
              type="text" 
              value={sLocation}
              onChange={(e) => setSLocation(e.target.value)}
              onBlur={(e) => validateField('sLocation', e.target.value)}
              aria-describedby={fieldErrors.sLocation ? 'squad-location-error' : undefined}
              placeholder={t('community.squad_location_placeholder')}
              className={cn(
                "w-full p-4 bg-zinc-50 rounded-2xl border border-zinc-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-amber-500 transition-all font-bold text-zinc-900 dark:text-white",
                fieldErrors.sLocation && "border-red-500 focus:ring-red-500"
              )}
            />
            {fieldErrors.sLocation && (
              <p id="squad-location-error" className="text-red-500 text-[10px] font-bold mt-1 ml-2">{fieldErrors.sLocation}</p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{t('community.squad_max_participants_label')}</label>
            <input 
              type="number" 
              value={sMaxParticipants}
              onChange={(e) => setSMaxParticipants(parseInt(e.target.value) || 0)}
              className="w-full p-4 bg-zinc-50 rounded-2xl border border-zinc-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-amber-500 transition-all font-bold text-zinc-900 dark:text-white"
            />
          </div>
          <button 
            onClick={handleCreateSquad}
            disabled={loading || !sTitle || !sDescription || !sDate || !sTime || !sLocation}
            className={cn(
              "w-full py-5 sm:py-6 text-white rounded-3xl font-black text-lg sm:text-xl transition-all active:scale-95 disabled:bg-zinc-500 disabled:text-zinc-100 disabled:opacity-100 disabled:cursor-not-allowed",
              editingSquadId
                ? "bg-stormy-teal shadow-xl shadow-stormy-teal/20 hover:bg-stormy-teal/90"
                : "bg-amber-500 shadow-xl shadow-amber-100 dark:shadow-none hover:bg-amber-600"
            )}
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : (editingSquadId ? t('community.squad_save_changes') : t('community.squad_create_btn'))}
          </button>
        </div>
      </Modal>
    </div>
  );
}
