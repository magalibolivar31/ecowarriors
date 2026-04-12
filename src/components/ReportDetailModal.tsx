import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  MapPin, 
  Clock, 
  User, 
  AlertTriangle, 
  CheckCircle2, 
  Activity, 
  History,
  ChevronRight,
  Camera
} from 'lucide-react';
import { Report, ReportStatus, ReportUpdate } from '../types';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { UserAlias } from './UserAlias';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useState, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';

interface ReportDetailModalProps {
  report: Report;
  onClose: () => void;
  onOpenHistory: () => void;
}

export const ReportDetailModal: React.FC<ReportDetailModalProps> = ({ report, onClose, onOpenHistory }) => {
  const { t, language, privacyMode } = useSettings();
  const [verificationsCount, setVerificationsCount] = useState<number>(0);

  useEffect(() => {
    const fetchVerifications = async () => {
      try {
        const q = query(collection(db, 'reports', report.id, 'updates'));
        const snap = await getDocs(q);
        // We subtract 1 because the initial report creation also creates an update
        const count = Math.max(0, snap.size - 1);
        setVerificationsCount(count);
      } catch (error) {
        console.error("Error fetching verifications:", error);
      }
    };
    fetchVerifications();
  }, [report.id]);

  const getStatusConfig = (status: ReportStatus) => {
    switch (status) {
      case 'Abierto (nuevo)': return { color: 'bg-stormy-teal/10 dark:bg-stormy-teal/30 text-stormy-teal dark:text-maya-blue', icon: <Activity className="w-4 h-4" />, label: t('reports.status_new') };
      case 'Abierto (en seguimiento)': return { color: 'bg-maya-blue/10 dark:bg-maya-blue/30 text-maya-blue dark:text-maya-blue', icon: <Clock className="w-4 h-4" />, label: t('reports.status_followup') };
      case 'Abierto (agravado)': return { color: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300', icon: <AlertTriangle className="w-4 h-4" />, label: t('reports.status_aggravated') };
      case 'Resuelto': return { color: 'bg-emerald-action/10 dark:bg-emerald-action/30 text-emerald-action dark:text-emerald-action', icon: <CheckCircle2 className="w-4 h-4" />, label: t('reports.status_resolved') };
      default: return { color: 'bg-zinc-100 dark:bg-slate-700 text-zinc-700 dark:text-slate-300', icon: <Activity className="w-4 h-4" />, label: status };
    }
  };

  const getPriority = (status: ReportStatus) => {
    switch (status) {
      case 'Abierto (agravado)': return { label: t('reports.priority_high'), color: 'text-red-600 dark:text-red-400' };
      case 'Abierto (en seguimiento)': return { label: t('reports.priority_medium'), color: 'text-maya-blue dark:text-maya-blue' };
      case 'Abierto (nuevo)': return { label: t('reports.priority_low'), color: 'text-stormy-teal dark:text-emerald-action' };
      case 'Resuelto': return { label: t('reports.priority_low'), color: 'text-emerald-action dark:text-emerald-action' };
      default: return { label: t('reports.priority_low'), color: 'text-zinc-600 dark:text-slate-400' };
    }
  };

  const statusConfig = getStatusConfig(report.currentStatus);
  const priority = getPriority(report.currentStatus);
  const dateLocale = language === 'es' ? es : enUS;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white dark:bg-slate-800 rounded-[2rem] sm:rounded-[3rem] shadow-2xl w-full max-w-[min(100vw,42rem)] overflow-hidden flex flex-col max-h-[90vh] border border-zinc-100 dark:border-slate-700"
      >
        {/* Header */}
        <div className="relative h-48 sm:h-64 shrink-0">
          {report.initialImageUrl ? (
            <img 
              src={report.initialImageUrl} 
              alt={report.title} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : report.type === 'crisis' ? (
            <div className="w-full h-full bg-red-50 dark:bg-red-900/20 flex flex-col items-center justify-center text-red-500">
              <AlertTriangle className="w-16 sm:w-20 h-16 sm:h-20 mb-2 animate-pulse" />
              <span className="font-black uppercase tracking-widest text-[10px]">{t('reports.crisis_alert')}</span>
            </div>
          ) : (
            <div className="w-full h-full bg-zinc-100 dark:bg-slate-900 flex flex-col items-center justify-center text-zinc-300 dark:text-slate-700">
              <Camera className="w-12 sm:w-16 h-12 sm:h-16 mb-2" />
              <span className="font-black uppercase tracking-widest text-[10px]">{t('reports.no_evidence_image')}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <button 
            onClick={onClose}
            className="absolute top-4 sm:top-6 right-4 sm:right-6 p-2 sm:p-3 bg-white/20 backdrop-blur-md hover:bg-white/40 rounded-full text-white transition-all border border-white/20 shadow-lg"
          >
            <X className="w-5 sm:w-6 h-5 sm:h-6" />
          </button>
          
          <div className="absolute bottom-4 sm:bottom-6 left-6 sm:left-8 right-6 sm:right-8">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
              <span className={cn(
                "px-3 py-1 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-widest shadow-lg backdrop-blur-md",
                report.type === 'crisis' ? "bg-red-600 text-white" : "bg-stormy-teal text-white"
              )}>
                {report.type === 'crisis' ? t('reports.mode_crisis') : t('reports.mode_environmental')}
              </span>
              <span className={cn(
                "px-3 py-1 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-widest shadow-lg backdrop-blur-md flex items-center gap-1.5",
                statusConfig.color
              )}>
                {statusConfig.icon}
                {statusConfig.label}
              </span>
            </div>
            <h3 className="text-xl sm:text-3xl font-display font-black text-white uppercase tracking-tighter leading-none drop-shadow-md">
              {report.title}
            </h3>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-8 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <h4 className="text-[10px] font-black text-zinc-400 dark:text-slate-500 uppercase tracking-[0.2em]">{t('reports.description_label')}</h4>
                <p className="text-zinc-700 dark:text-slate-200 font-medium leading-relaxed text-sm sm:text-base">
                  {report.description}
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 text-zinc-500 dark:text-slate-400">
                  <div className="w-10 h-10 rounded-2xl bg-zinc-50 dark:bg-slate-900 flex items-center justify-center text-stormy-teal dark:text-maya-blue border border-zinc-100 dark:border-slate-700">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-zinc-400 dark:text-slate-500 uppercase tracking-widest">{t('reports.location_label')}</p>
                    <p className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">
                      {Number.isFinite(report.location?.lat) && Number.isFinite(report.location?.lng) ? (privacyMode === 'approximate' ? t('reports.approximate_location') : `${t('reports.manual_coords')}: ${report.location.lat.toFixed(6)}, ${report.location.lng.toFixed(6)}`) : t('reports.location_unavailable')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-zinc-500 dark:text-slate-400">
                  <div className="w-10 h-10 rounded-2xl bg-zinc-50 dark:bg-slate-900 flex items-center justify-center text-maya-blue dark:text-maya-blue border border-zinc-100 dark:border-slate-700">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-zinc-400 dark:text-slate-500 uppercase tracking-widest">{t('reports.reported_on')}</p>
                    <p className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">
                      {report.createdAt?.seconds ? format(new Date(report.createdAt.seconds * 1000), language === 'es' ? "d 'de' MMMM, yyyy • HH:mm" : "MMMM d, yyyy • HH:mm", { locale: dateLocale }) : t('reports.recent')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-zinc-500 dark:text-slate-400">
                  <div className="w-10 h-10 rounded-2xl bg-zinc-50 dark:bg-slate-900 flex items-center justify-center text-emerald-action dark:text-emerald-action border border-zinc-100 dark:border-slate-700">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-zinc-400 dark:text-slate-500 uppercase tracking-widest">{t('reports.by')}</p>
                    <p className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">
                      <UserAlias uid={report.createdBy} fallback={report.createdByName} />
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-zinc-50 dark:bg-slate-900 p-6 rounded-[2rem] sm:rounded-[2.5rem] border border-zinc-100 dark:border-slate-700 space-y-4">
                <div className="flex items-center gap-3">
                  <History className="w-5 h-5 text-zinc-400 dark:text-slate-500" />
                  <h4 className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-widest">{t('reports.system_status')}</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="text-zinc-400 dark:text-slate-500 uppercase tracking-widest">{t('reports.priority_label')}</span>
                    <span className={cn("uppercase tracking-widest", priority.color)}>{priority.label}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="text-zinc-400 dark:text-slate-500 uppercase tracking-widest">{t('reports.verifications_label')}</span>
                    <span className="text-zinc-900 dark:text-white uppercase tracking-widest">
                      {verificationsCount} {verificationsCount === 1 ? t('reports.neighbor') : t('reports.neighbors')}
                    </span>
                  </div>
                </div>
              </div>

              {report.aiAnalysis && (
                <div className="bg-emerald-action/5 dark:bg-emerald-900/10 p-6 rounded-[2rem] border border-emerald-action/10 space-y-4">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-emerald-action" />
                    <h4 className="text-[10px] font-black text-emerald-action uppercase tracking-widest">{t('reports.ai_analysis')}</h4>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className="text-zinc-400 dark:text-slate-500 uppercase tracking-widest">{t('reports.suggested_category')}</span>
                      <span className="text-zinc-900 dark:text-white uppercase tracking-widest">{report.aiAnalysis.categoria}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className="text-zinc-400 dark:text-slate-500 uppercase tracking-widest">{t('reports.urgency_level')}</span>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest",
                        report.aiAnalysis.nivelUrgencia >= 4 ? "bg-red-600 text-white" : "bg-emerald-action text-white"
                      )}>
                        {t('reports.urgency_value').replace('{level}', String(report.aiAnalysis.nivelUrgencia))}
                      </span>
                    </div>
                    <div className="pt-3 border-t border-emerald-action/10">
                      <p className="text-[11px] text-zinc-600 dark:text-slate-300 italic leading-relaxed">
                        {report.aiAnalysis.analisis}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <button 
                onClick={onOpenHistory}
                className="w-full py-4 sm:py-5 bg-stormy-teal text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-stormy-teal/90 transition-all flex items-center justify-center gap-3 shadow-xl shadow-stormy-teal/10 group"
              >
                {t('reports.view_history')}
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
