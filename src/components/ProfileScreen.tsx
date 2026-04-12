import React, { useState, useEffect } from 'react';
import { 
  User as UserIcon, 
  MapPin, 
  Heart, 
  Award, 
  Target, 
  TrendingUp, 
  ShieldCheck, 
  ChevronRight, 
  Bell, 
  Globe, 
  Lock, 
  LogOut,
  FileText,
  CheckCircle2,
  Zap,
  Trophy,
  Users,
  X,
  Info,
  Settings,
  Droplets,
  Camera,
  Edit2,
  Mail,
  Sun,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  doc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { cn, sanitizeText } from '../lib/utils';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { useSettings } from '../contexts/SettingsContext';
import { calculateMissions } from '../services/missionService';
import { getLevelProgress } from '../lib/levelUtils';
import { Mission } from '../constants/missions';
import { calculateAchievements, Achievement } from '../services/achievementService';
import { Report, Squad } from '../types';
import { updateUserProfile, uploadProfilePhoto } from '../services/userService';

interface ProfileScreenProps {
  onLogout: () => void;
  onViewMyReports: () => void;
  missions: Mission[];
}

interface UserProfile {
  uid: string;
  alias: string;
  email: string;
  photoURL?: string;
  zone: string;
  level: number;
  xp: number;
  badges: string[];
  commitment: string;
  role: string;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onLogout, onViewMyReports, missions }) => {
  const { t, language, setLanguage, notificationsEnabled, setNotificationsEnabled, privacyMode, setPrivacyMode, darkMode, setDarkMode, showAlert } = useSettings();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState({
    totalReports: 0,
    resolvedReports: 0,
    communityPoints: 0
  });
  const [recentReports, setRecentReports] = useState<Report[]>([]);
  const [userSquads, setUserSquads] = useState<Squad[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});

  const validateField = (name: string, value: string) => {
    let error: string | null = null;
    
    if (name === 'editName') {
      const trimmed = value.trim();
      if (trimmed.length < 2 || trimmed.length > 40) {
        error = t('validation.name_invalid');
      }
    }
    
    setFieldErrors(prev => ({ ...prev, [name]: error }));
    return error;
  };

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoFeedback, setPhotoFeedback] = useState<string | null>(null);
  const [showAllMissions, setShowAllMissions] = useState(false);

  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) return;

    setLoading(true);
    setError(null);

    // 1. Listen to User Profile
    const unsubProfile = onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        setProfile(data);
        setEditName(data.alias);
      } else {
        setError(t('common.profile_not_found'));
      }
      setLoading(false);
    }, (err) => {
      console.error("Error fetching profile:", err);
      setError(t('common.server_connection_error'));
      setLoading(false);
    });

    // 2. Fetch User Reports for Stats and Preview (One-time fetch)
    const fetchReports = async () => {
      try {
        const qReports = query(
          collection(db, 'reports'), 
          where('createdBy', '==', currentUser.uid),
          orderBy('createdAt', 'desc')
        );
        const querySnap = await getDocs(qReports);
        const reportsData = querySnap.docs.map(d => ({ id: d.id, ...d.data() } as Report));
        
        setStats({
          totalReports: reportsData.length,
          resolvedReports: reportsData.filter(r => r.currentStatus === 'Resuelto').length,
          communityPoints: 0
        });

        setRecentReports(reportsData.slice(0, 3));

        // Fetch user squads for achievements
        const qSquads = query(
          collection(db, 'squads'),
          where('attendees', 'array-contains', currentUser.uid)
        );
        const squadsSnap = await getDocs(qSquads);
        const squadsData = squadsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Squad));
        setUserSquads(squadsData);

        // Calculate real achievements
        const realAchievements = calculateAchievements(reportsData, squadsData);
        setAchievements(realAchievements);
      } catch (err) {
        console.error("Error fetching reports stats:", err);
      }
    };
    fetchReports();

    return () => {
      unsubProfile();
    };
  }, [currentUser]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    if (!file.type.startsWith('image/')) {
      showAlert(t('common.error'), t('common.invalid_image'));
      return;
    }

    setUploadingPhoto(true);
    setPhotoFeedback(null);
    try {
      const url = await uploadProfilePhoto(currentUser.uid, file);
      setPhotoFeedback(t('common.photo_updated'));
      setTimeout(() => setPhotoFeedback(null), 3000);
    } catch (err) {
      console.error("Error uploading photo:", err);
      showAlert(t('common.error'), t('common.upload_error'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!currentUser || !editName.trim()) return;
    const nameError = validateField('editName', editName);
    if (nameError) return;

    try {
      const sanitizedAlias = sanitizeText(editName);
      await updateUserProfile(currentUser.uid, {
        alias: sanitizedAlias
      });
      setIsEditModalOpen(false);
    } catch (err) {
      console.error("Error updating profile:", err);
    }
  };

  const censorEmail = (email: string) => {
    if (!email) return '';
    const parts = email.split('@');
    if (parts.length < 2) return email;
    const [user, domain] = parts;
    if (user.length <= 3) return email;
    return `${user.substring(0, 3)}********@${domain}`;
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Abierto (nuevo)': return t('reports.status_new');
      case 'Abierto (en seguimiento)': return t('reports.status_followup');
      case 'Abierto (agravado)': return t('reports.status_aggravated');
      case 'Resuelto': return t('reports.status_resolved');
      default: return status;
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-rose-500 font-bold">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-emerald-600 text-white rounded-full font-bold uppercase text-xs tracking-widest"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-4 border-stormy-teal border-t-transparent rounded-full"
        />
      </div>
    );
  }

  const { progress, nextLevelXP, xpRemaining } = getLevelProgress(profile.xp, profile.level);
  const dateLocale = language === 'es' ? es : enUS;
  
  const getRoleFriendlyName = (role: string) => {
    switch(role) {
      case 'admin': return t('dashboard.admin');
      case 'volunteer': return t('dashboard.guardian');
      case 'reporter': return t('dashboard.guardian');
      default: return t('dashboard.guardian');
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-24 sm:pb-20 space-y-8 sm:space-y-10 px-4 sm:px-0">
      {/* Hero Section: Identity Card */}
      <section className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-stormy-teal/10 to-transparent rounded-[2rem] sm:rounded-[3rem] -z-10" />
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] border border-zinc-100 dark:border-slate-800 shadow-xl shadow-stormy-teal/5 dark:shadow-none text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-32 bg-stormy-teal opacity-5" />
          
          <div className="relative z-10">
            <div className="relative w-24 h-24 sm:w-32 sm:h-32 mx-auto mb-6 group">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full h-full rounded-[2rem] sm:rounded-[2.5rem] border-4 sm:border-8 border-white overflow-hidden shadow-2xl bg-zinc-100 relative"
              >
                {uploadingPhoto ? (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-6 h-6 border-2 border-white border-t-transparent rounded-full"
                    />
                  </div>
                ) : (
                  <button 
                    onClick={() => document.getElementById('profile-photo-input')?.click()}
                    className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10"
                  >
                    <Camera className="w-8 h-8 text-white" />
                  </button>
                )}
                <img 
                  src={profile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.uid}`} 
                  className="w-full h-full object-cover" 
                  alt={profile.alias}
                  referrerPolicy="no-referrer"
                />
              </motion.div>
              <input 
                id="profile-photo-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>
            
            <div className="flex items-center justify-center gap-3">
              <h2 className="text-2xl sm:text-4xl font-display font-black text-stormy-teal tracking-tighter uppercase">{profile.alias}</h2>
              <button 
                onClick={() => setIsEditModalOpen(true)}
                className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400 hover:text-stormy-teal"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
            
            {photoFeedback && (
              <motion.p 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[10px] font-black text-emerald-action uppercase tracking-widest mt-2"
              >
                {photoFeedback}
              </motion.p>
            )}
            
            <div className="flex flex-col items-center gap-1 mt-1">
              <div className="flex items-center gap-1.5 text-zinc-500">
                <Mail className="w-3 h-3" />
                <span className="text-[10px] sm:text-xs font-medium">{censorEmail(profile?.email || '')}</span>
              </div>
              <div className="flex items-center justify-center gap-2 mt-1">
                <ShieldCheck className="w-4 h-4 text-emerald-action" />
                <span className="text-emerald-action font-black uppercase tracking-widest text-[9px] sm:text-[10px]">
                  {getRoleFriendlyName(profile.role)}
                </span>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-6 max-w-md mx-auto">
              <div className="bg-zinc-50 dark:bg-slate-800 p-3 sm:p-4 rounded-2xl sm:rounded-3xl flex flex-col items-center gap-1">
                <MapPin className="w-4 h-4 text-stormy-teal/40" />
                <span className="text-[9px] sm:text-[10px] font-black text-zinc-400 dark:text-slate-500 uppercase tracking-widest">{t('reports.zone')}</span>
                <span className="font-bold text-stormy-teal dark:text-maya-blue text-xs sm:text-base">{profile.zone}</span>
              </div>
              <div className="bg-zinc-50 dark:bg-slate-800 p-3 sm:p-4 rounded-2xl sm:rounded-3xl flex flex-col items-center gap-1">
                <Heart className="w-4 h-4 text-rose-500" />
                <span className="text-[9px] sm:text-[10px] font-black text-zinc-400 dark:text-slate-500 uppercase tracking-widest">{t('reports.commitment')}</span>
                <span className="font-bold text-stormy-teal dark:text-maya-blue text-xs sm:text-base line-clamp-1">{profile.commitment || t('reports.undefined')}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Metrics Section */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        {[
          { label: t('nav.reports'), value: stats.totalReports, icon: FileText, color: 'text-maya-blue', bg: 'bg-maya-blue/10 dark:bg-maya-blue/20' },
          { label: t('reports.resolved'), value: stats.resolvedReports, icon: CheckCircle2, color: 'text-emerald-action', bg: 'bg-emerald-action/10 dark:bg-emerald-action/20' },
          { label: t('common.xp_points'), value: profile.xp, icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10' },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white dark:bg-slate-800/90 p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-zinc-100 dark:border-slate-600 shadow-sm flex flex-col items-center gap-2 hover:shadow-md transition-all"
          >
            <div className={cn("p-4 rounded-2xl mb-2", stat.bg)}>
              <stat.icon className={cn("w-6 h-6", stat.color)} />
            </div>
            <span className="text-3xl sm:text-4xl font-black text-stormy-teal dark:text-white">{stat.value}</span>
            <span className="text-[10px] font-black text-zinc-400 dark:text-slate-400 uppercase tracking-widest">{stat.label}</span>
          </motion.div>
        ))}
      </section>

      {/* Progress Section */}
      <section className="bg-white dark:bg-slate-800/90 p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] border border-zinc-100 dark:border-slate-600 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-stormy-teal dark:text-maya-blue" />
            <h3 className="text-lg sm:text-xl font-display font-black text-stormy-teal dark:text-white uppercase tracking-tight">{t('profile.level')}</h3>
          </div>
          <span className="bg-stormy-teal dark:bg-stormy-teal/80 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
            {t('profile.level')} {profile.level}
          </span>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between text-[10px] font-black text-zinc-400 dark:text-slate-400 uppercase tracking-widest">
            <span>{profile.xp} XP</span>
            <span>{nextLevelXP} XP</span>
          </div>
          <div className="h-6 bg-zinc-100 dark:bg-slate-700 rounded-full overflow-hidden p-1">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-emerald-action rounded-full shadow-lg shadow-emerald-action/20 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
            </motion.div>
          </div>
          <p className="text-center text-[10px] sm:text-xs text-zinc-500 dark:text-slate-400 font-medium italic">
            {t('profile.xp_to_next').replace('{xp}', String(xpRemaining)).replace('{level}', String(profile.level + 1))}
          </p>
        </div>
      </section>

      {/* Achievements & Missions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Achievements */}
        <section className="bg-white dark:bg-slate-800/90 p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] border border-zinc-100 dark:border-slate-600 shadow-sm space-y-8">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-amber-500" />
            <h3 className="text-lg sm:text-xl font-display font-black text-stormy-teal dark:text-white uppercase tracking-tight">{t('profile.achievements')}</h3>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            {achievements.length > 0 ? (
              achievements.map((achievement, i) => (
                <div key={i} className="flex flex-col items-center gap-2 group">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 bg-zinc-50 dark:bg-slate-700 rounded-2xl flex items-center justify-center group-hover:bg-amber-50 dark:group-hover:bg-amber-500/20 transition-colors">
                    <Award className="w-7 h-7 sm:w-8 sm:h-8 text-amber-500" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold text-zinc-500 dark:text-slate-300 uppercase tracking-tighter text-center leading-tight">
                    {t(`achievement.title_${achievement.id}`)}
                  </span>
                </div>
              ))
            ) : (
              <div className="col-span-3 py-10 text-center space-y-2">
                <div className="w-16 h-16 bg-zinc-50 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto opacity-50">
                  <Award className="w-8 h-8 text-zinc-300 dark:text-slate-500" />
                </div>
                <p className="text-[10px] text-zinc-400 dark:text-slate-500 font-bold uppercase tracking-widest">{t('profile.no_achievements')}</p>
              </div>
            )}
          </div>
        </section>

        {/* Active Missions */}
        <section className="bg-white dark:bg-slate-800/90 p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] border border-zinc-100 dark:border-slate-600 shadow-sm space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Target className="w-6 h-6 text-rose-500" />
              <h3 className="text-lg sm:text-xl font-display font-black text-stormy-teal dark:text-white uppercase tracking-tight">{t('profile.missions')}</h3>
            </div>
            <span className="text-[9px] sm:text-[10px] font-black text-rose-500 uppercase tracking-widest animate-pulse">{t('common.in_progress')}</span>
          </div>

          <div className="space-y-4">
            {(() => {
              const displayedMissions = showAllMissions ? missions : missions.slice(0, 3);
              return (
                <>
                  {displayedMissions.map(mission => (
                    <button 
                      key={mission.id} 
                      onClick={() => setSelectedMission(mission)}
                      className="w-full p-4 sm:p-5 bg-zinc-50 dark:bg-slate-700/50 rounded-[1.5rem] sm:rounded-[2rem] border border-zinc-100 dark:border-slate-600 flex items-center gap-4 group hover:bg-white dark:hover:bg-slate-700 hover:shadow-lg transition-all text-left"
                    >
                      <div className={cn("p-3 rounded-2xl text-white shadow-lg relative shrink-0", mission.color)}>
                        <mission.icon className="w-5 h-5" />
                        {mission.status === 'completed' && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-action rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center">
                            <CheckCircle2 className="w-2 h-2 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-black text-xs sm:text-sm text-stormy-teal dark:text-maya-blue uppercase tracking-tight truncate mr-2">
                            {t(`mission.title_${mission.id}`)}
                          </h4>
                          <span className="text-[9px] sm:text-[10px] font-black text-emerald-action uppercase shrink-0">+{mission.reward} {t('mission.reward_label')}</span>
                        </div>
                        <div className="h-1.5 bg-zinc-200 dark:bg-slate-600 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${mission.progress}%` }}
                            className={cn("h-full rounded-full", mission.status === 'completed' ? 'bg-emerald-action' : 'bg-maya-blue')}
                          />
                        </div>
                      </div>
                    </button>
                  ))}

                  {missions.length > 3 && (
                    <button
                      onClick={() => setShowAllMissions(!showAllMissions)}
                      className="w-full mt-3 py-2.5 rounded-xl border border-dashed border-stormy-teal/30 dark:border-maya-blue/30
                                 text-stormy-teal dark:text-maya-blue font-black text-[10px] uppercase tracking-widest
                                 hover:border-stormy-teal dark:hover:border-maya-blue hover:bg-stormy-teal/5 dark:hover:bg-maya-blue/5 transition-all"
                    >
                      {showAllMissions 
                        ? t('profile.view_less') 
                        : t('profile.view_all_count').replace('{count}', String(missions.length))
                      }
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        </section>
      </div>

      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden border border-zinc-100 dark:border-slate-800"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">{t('common.edit_profile')}</h3>
                  <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-slate-800 rounded-full">
                    <X className="w-6 h-6 text-zinc-400 dark:text-slate-500" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 dark:text-slate-500 uppercase tracking-widest ml-2">{t('common.username_alias')}</label>
                    <input 
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={(e) => validateField('editName', e.target.value)}
                      className={cn(
                        "w-full p-5 bg-zinc-50 dark:bg-slate-800 border-2 border-zinc-100 dark:border-slate-700 rounded-3xl focus:border-emerald-500 outline-none font-bold text-zinc-900 dark:text-white",
                        fieldErrors.editName && "border-red-500 focus:border-red-500"
                      )}
                      placeholder={t('common.new_alias_placeholder')}
                    />
                    {fieldErrors.editName && (
                      <p className="text-red-500 text-[10px] font-bold mt-1 ml-4">{fieldErrors.editName}</p>
                    )}
                  </div>
                </div>

                <button 
                  onClick={handleUpdateProfile}
                  disabled={!editName.trim() || editName === profile?.alias || !!fieldErrors.editName}
                  className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50 transition-all"
                >
                  {t('common.save_changes')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedMission && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-zinc-100 dark:border-slate-800"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div className={cn("p-4 rounded-2xl text-white shadow-lg", selectedMission.color)}>
                    <selectedMission.icon className="w-8 h-8" />
                  </div>
                  <button 
                    onClick={() => setSelectedMission(null)}
                    className="p-2 hover:bg-zinc-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-zinc-400 dark:text-slate-500" />
                  </button>
                </div>

                <div className="space-y-2">
                  <h3 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                    {t(`mission.title_${selectedMission.id}`)}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest">
                      {selectedMission.reward} {t('mission.reward_label')}
                    </span>
                    <span className="px-3 py-1 bg-zinc-100 dark:bg-slate-800 text-zinc-500 dark:text-slate-400 rounded-full text-[10px] font-black uppercase tracking-widest">
                      {selectedMission.status === 'in-progress' ? t('mission.status_in_progress') : t('mission.status_available')}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-zinc-400 dark:text-slate-500 uppercase tracking-widest">{t('mission.description')}</p>
                    <p className="text-zinc-600 dark:text-slate-300 font-medium">
                      {t(`mission.desc_${selectedMission.id}`)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-zinc-400 dark:text-slate-500 uppercase tracking-widest">{t('mission.objective')}</p>
                    <p className="text-zinc-600 dark:text-slate-300 font-medium">
                      {t(`mission.obj_${selectedMission.id}`)}
                    </p>
                  </div>
                  <div className="p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-3xl border border-emerald-100 dark:border-emerald-900/30 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                      <Info className="w-4 h-4" />
                      <p className="text-[10px] font-black uppercase tracking-widest">{t('mission.suggested_action')}</p>
                    </div>
                    <p className="text-emerald-800 dark:text-emerald-200 font-bold text-sm">
                      {t(`mission.action_${selectedMission.id}`)}
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedMission(null)}
                  className="w-full py-5 bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all"
                >
                  {t('mission.close')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Privacy Modal */}
      <AnimatePresence>
        {isPrivacyModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-zinc-100 dark:border-slate-800"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-500 shadow-lg">
                      <Lock className="w-8 h-8" />
                    </div>
                    <h3 className="text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                      {t('profile.privacy_modal_title')}
                    </h3>
                  </div>
                  <button 
                    onClick={() => setIsPrivacyModalOpen(false)}
                    className="p-2 hover:bg-zinc-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-zinc-400 dark:text-slate-500" />
                  </button>
                </div>

                <p className="text-zinc-500 dark:text-slate-400 font-medium leading-relaxed">
                  {t('profile.privacy_modal_desc')}
                </p>

                <div className="space-y-4">
                  <button 
                    onClick={() => {
                      setPrivacyMode('active');
                      setIsPrivacyModalOpen(false);
                    }}
                    className={cn(
                      "w-full p-6 rounded-[2.5rem] border-2 text-left transition-all group",
                      privacyMode === 'active' 
                        ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20" 
                        : "border-zinc-100 dark:border-slate-700 hover:border-zinc-200 dark:hover:border-slate-600"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-black uppercase tracking-tight text-zinc-900 dark:text-white text-lg">
                        {t('profile.privacy_exact')}
                      </span>
                      {privacyMode === 'active' && (
                        <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-slate-400 font-medium leading-relaxed">
                      {t('profile.privacy_exact_desc')}
                    </p>
                  </button>

                  <button 
                    onClick={() => {
                      setPrivacyMode('approximate');
                      setIsPrivacyModalOpen(false);
                    }}
                    className={cn(
                      "w-full p-6 rounded-[2.5rem] border-2 text-left transition-all group",
                      privacyMode === 'approximate' 
                        ? "border-amber-500 bg-amber-50/50 dark:bg-amber-900/20" 
                        : "border-zinc-100 dark:border-slate-700 hover:border-zinc-200 dark:hover:border-slate-600"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-black uppercase tracking-tight text-zinc-900 dark:text-white text-lg">
                        {t('profile.privacy_approximate')}
                      </span>
                      {privacyMode === 'approximate' && (
                        <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-slate-400 font-medium leading-relaxed">
                      {t('profile.privacy_approximate_desc')}
                    </p>
                  </button>
                </div>

                <button 
                  onClick={() => setIsPrivacyModalOpen(false)}
                  className="w-full py-5 bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all"
                >
                  {t('mission.close')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* My Reports Access */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-4">
          <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('profile.recent_reports')}</h3>
          <button 
            onClick={onViewMyReports}
            className="text-[10px] font-black text-stormy-teal uppercase tracking-widest hover:underline"
          >
            {t('profile.view_all')}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {recentReports.length > 0 ? (
            recentReports.map(report => (
              <div key={report.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl sm:rounded-3xl border border-zinc-100 dark:border-slate-700 shadow-sm flex flex-col gap-3">
                <div className="aspect-square rounded-2xl bg-zinc-100 dark:bg-slate-900 overflow-hidden">
                  {report.initialImageUrl ? (
                    <img src={report.initialImageUrl} referrerPolicy="no-referrer" className="w-full h-full object-cover" alt={report.type} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-300 dark:text-slate-600">
                      <FileText className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-black text-zinc-400 dark:text-slate-500 uppercase tracking-widest">{report.type}</span>
                    <span className={cn(
                      "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                      report.currentStatus === 'Resuelto' ? "bg-emerald-action/10 text-emerald-action" : "bg-maya-blue/10 text-maya-blue"
                    )}>
                      {getStatusLabel(report.currentStatus)}
                    </span>
                  </div>
                  <p className="text-[10px] font-bold text-zinc-500 dark:text-slate-400 mt-1">
                    {report.createdAt?.toDate ? format(report.createdAt.toDate(), 'd MMM', { locale: dateLocale }) : t('reports.recent')}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-3 py-10 bg-zinc-50 dark:bg-slate-900/50 rounded-[2.5rem] border border-dashed border-zinc-200 dark:border-slate-700 text-center">
              <p className="text-[10px] text-zinc-400 dark:text-slate-500 font-bold uppercase tracking-widest">{t('reports.empty_mine')}</p>
            </div>
          )}
        </div>

        <button 
          onClick={onViewMyReports}
          className="w-full p-6 sm:p-8 bg-stormy-teal text-white rounded-[2rem] sm:rounded-[2.5rem] flex items-center justify-between group hover:scale-[1.01] active:scale-95 transition-all shadow-xl shadow-stormy-teal/10"
        >
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="p-3 sm:p-4 bg-white/10 rounded-2xl">
              <FileText className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <div className="text-left">
              <h3 className="text-xl sm:text-2xl font-display font-black uppercase tracking-tighter">{t('profile.manage_reports')}</h3>
              <p className="text-white/60 text-[10px] sm:text-sm font-medium">{t('profile.manage_reports_desc')}</p>
            </div>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/10 rounded-full flex items-center justify-center group-hover:translate-x-2 transition-transform shrink-0">
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </button>
      </section>

      {/* Settings Section */}
      <section className="bg-zinc-50 dark:bg-slate-900 p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] border border-zinc-100 dark:border-slate-800 space-y-4">
        <h3 className="text-[10px] font-black text-zinc-400 dark:text-slate-500 uppercase tracking-widest ml-4 mb-6">{t('profile.settings')}</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="flex items-center justify-between p-5 bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-slate-900 group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors text-amber-500">
                {darkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </div>
              <div className="text-left">
                <span className="block font-bold text-zinc-700 dark:text-slate-200 text-sm sm:text-base">{t('profile.dark_mode')}</span>
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-slate-500">
                  {darkMode ? t('profile.active') : t('profile.inactive')}
                </span>
              </div>
            </div>
            <div className={cn("w-10 h-6 rounded-full p-1 transition-colors", darkMode ? "bg-emerald-action" : "bg-zinc-200 dark:bg-slate-700")}>
              <div className={cn("w-4 h-4 bg-white rounded-full transition-transform", darkMode ? "translate-x-4" : "translate-x-0")} />
            </div>
          </button>

          <button 
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            className="flex items-center justify-between p-5 bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className={cn("p-3 rounded-2xl bg-zinc-50 dark:bg-slate-900 group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors", notificationsEnabled ? "text-emerald-action" : "text-rose-500")}>
                <Bell className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="block font-bold text-zinc-700 dark:text-slate-200 text-sm sm:text-base">{t('profile.notifications')}</span>
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-slate-500">
                  {notificationsEnabled ? t('profile.active') : t('profile.inactive')}
                </span>
              </div>
            </div>
            <div className={cn("w-10 h-6 rounded-full p-1 transition-colors", notificationsEnabled ? "bg-emerald-action" : "bg-zinc-200 dark:bg-slate-700")}>
              <div className={cn("w-4 h-4 bg-white rounded-full transition-transform", notificationsEnabled ? "translate-x-4" : "translate-x-0")} />
            </div>
          </button>

          <button 
            onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
            className="flex items-center justify-between p-5 bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-slate-900 group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors text-maya-blue">
                <Globe className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="block font-bold text-zinc-700 dark:text-slate-200 text-sm sm:text-base">{t('profile.language')}</span>
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-slate-500">
                  {language === 'es' ? 'Español' : 'English'}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-300 dark:text-slate-600" />
          </button>

          <button 
            onClick={() => setIsPrivacyModalOpen(true)}
            className="flex items-center justify-between p-5 bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-slate-900 group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors text-amber-500">
                <Lock className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="block font-bold text-zinc-700 dark:text-slate-200 text-sm sm:text-base">{t('profile.privacy')}</span>
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-slate-500">
                  {privacyMode === 'active' ? t('profile.privacy_exact') : t('profile.privacy_approximate')}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-300 dark:text-slate-600" />
          </button>
          
          <button 
            onClick={onLogout}
            className="flex items-center justify-between p-5 bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:border-rose-100 dark:hover:border-rose-900/30 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-slate-900 group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors text-rose-500">
                <LogOut className="w-5 h-5" />
              </div>
              <span className="font-bold text-zinc-700 dark:text-slate-200 text-sm sm:text-base">{t('profile.logout')}</span>
            </div>
          </button>
        </div>
      </section>
    </div>
  );
};
