import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Clock, 
  User, 
  MessageSquare, 
  Image as ImageIcon, 
  ChevronRight, 
  Plus, 
  X,
  AlertTriangle,
  CheckCircle2,
  History,
  Trash2,
  MapPin,
  Camera,
  Loader2,
  Activity,
  Info
} from 'lucide-react';
import { subscribeToReportUpdates, addReportUpdate } from '../services/reportService';
import { notifyReportStatusChanged } from '../services/notificationService';
import { Report, ReportUpdate, ReportStatus } from '../types';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { auth } from '../firebase';
import { UserAlias } from './UserAlias';
import { useSettings } from '../contexts/SettingsContext';

interface ReportTimelineProps {
  report: Report;
  onClose: () => void;
}

export const ReportTimeline: React.FC<ReportTimelineProps> = ({ report, onClose }) => {
  const { t, language } = useSettings();
  const [updates, setUpdates] = useState<ReportUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  
  // Update form state
  const [newStatus, setNewStatus] = useState<ReportStatus>(report.currentStatus);
  const [newDescription, setNewDescription] = useState('');
  const [newImage, setNewImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});

  const validateField = (name: string, value: string) => {
    let error: string | null = null;
    
    if (name === 'description') {
      const trimmed = value.trim();
      if (trimmed.length < 10 || trimmed.length > 500) {
        error = t('validation.description_min');
      }
    }
    
    setFieldErrors(prev => ({ ...prev, [name]: error }));
    return error;
  };

  useEffect(() => {
    const unsubscribe = subscribeToReportUpdates(report.id, (data) => {
      setUpdates(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [report.id]);

  const handleAddUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const descErr = validateField('description', newDescription);
    if (!auth.currentUser || descErr) return;

    setSubmitting(true);
    setError(null);
    try {
      await addReportUpdate(report.id, newDescription, newStatus, newImage);
      notifyReportStatusChanged(report.title, newStatus);
      setIsUpdateModalOpen(false);
      setNewDescription('');
      setNewImage(null);
    } catch (err: any) {
      console.error("Error in handleAddUpdate:", err);
      setError(err.message || t('reports.update_error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickAction = (status: ReportStatus) => {
    setNewStatus(status);
    setIsUpdateModalOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const statusConfig = (status: ReportStatus) => {
    switch (status) {
      case 'Abierto (nuevo)': return { color: 'bg-blue-100 text-stormy-teal', label: t('reports.status_new') };
      case 'Abierto (en seguimiento)': return { color: 'bg-orange-100 text-orange-700', label: t('reports.status_followup') };
      case 'Abierto (agravado)': return { color: 'bg-red-100 text-red-700', label: t('reports.status_aggravated') };
      case 'Resuelto': return { color: 'bg-emerald-100 text-emerald-700', label: t('reports.status_resolved') };
      default: return { color: 'bg-zinc-100 text-zinc-700', label: status };
    }
  };

  const dateLocale = language === 'es' ? es : enUS;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-[3rem] shadow-2xl w-full max-w-[min(100vw,42rem)] overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b border-zinc-100 shrink-0 bg-zinc-50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center text-white shadow-lg">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-display font-black text-zinc-900 uppercase tracking-tighter leading-none">{t('reports.timeline_title')}</h3>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">
                {t('common.report')}: {report.title} • {Number.isFinite(report.location?.lat) && Number.isFinite(report.location?.lng) ? `${report.location.lat.toFixed(6)}, ${report.location.lng.toFixed(6)}` : t('reports.no_coords')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-zinc-200 rounded-full transition-colors bg-white border border-zinc-100 shadow-sm">
            <X className="w-6 h-6 text-zinc-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-10">
          {/* Actions */}
          {auth.currentUser && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button 
                onClick={() => handleQuickAction('Abierto (en seguimiento)')}
                className="flex items-center justify-center gap-3 py-4 bg-soft-maya-blue/20 text-stormy-teal rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-soft-maya-blue/30 transition-all border border-zinc-100 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                {t('reports.add_update')}
              </button>
              <button 
                onClick={() => handleQuickAction('Resuelto')}
                className="flex items-center justify-center gap-3 py-4 bg-emerald-50 text-emerald-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-100 transition-all border border-emerald-100 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                {t('reports.mark_resolved')}
              </button>
              <button 
                onClick={() => handleQuickAction('Abierto (agravado)')}
                className="flex items-center justify-center gap-3 py-4 bg-red-50 text-red-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-100 transition-all border border-red-100 shadow-sm"
              >
                <AlertTriangle className="w-4 h-4" />
                {t('reports.report_aggravation')}
              </button>
            </div>
          )}

          {/* Timeline */}
          <div className="relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-100">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
              </div>
            ) : (
              <div className="space-y-12">
                {updates.map((update, idx) => (
                  <motion.div 
                    key={update.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="relative pl-12"
                  >
                    <div className={cn(
                      "absolute left-0 top-1 w-10 h-10 rounded-full border-4 border-white shadow-md flex items-center justify-center z-10",
                      idx === updates.length - 1 ? "bg-emerald-500 text-white" : "bg-zinc-100 text-zinc-400"
                    )}>
                      {idx === updates.length - 1 ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                    </div>
                    
                    <div className="bg-white p-6 rounded-[2.5rem] border border-zinc-100 shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest",
                          statusConfig(update.newStatus).color
                        )}>
                          {statusConfig(update.newStatus).label}
                        </span>
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                          {update.createdAt?.seconds ? format(new Date(update.createdAt.seconds * 1000), "d MMM, HH:mm", { locale: dateLocale }) : t('reports.recent_update')}
                        </span>
                      </div>
                      
                      <p className="text-zinc-700 text-sm font-medium leading-relaxed">
                        {update.description}
                      </p>

                      {update.imageUrl && (
                        <div className="rounded-2xl overflow-hidden border border-zinc-100 aspect-video shadow-inner">
                          <img src={update.imageUrl || undefined} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      )}

                      <div className="flex items-center gap-3 pt-4 border-t border-zinc-50">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-black text-emerald-600 border border-emerald-200">
                          <UserAlias uid={update.createdBy} fallback={update.createdByName} initialOnly />
                        </div>
                        <UserAlias 
                          uid={update.createdBy} 
                          fallback={update.createdByName} 
                          className="text-[10px] font-black text-zinc-500 uppercase tracking-widest" 
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}

                {/* Initial State Node */}
                <div className="relative pl-12">
                  <div className="absolute left-0 top-1 w-10 h-10 rounded-full bg-zinc-900 text-white border-4 border-white shadow-md flex items-center justify-center z-10">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div className="bg-zinc-900 p-6 rounded-[2.5rem] text-white space-y-4 shadow-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{t('reports.initial_report')}</span>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                        {report.createdAt?.seconds ? format(new Date(report.createdAt.seconds * 1000), "d MMM, HH:mm", { locale: dateLocale }) : t('reports.start_node')}
                      </span>
                    </div>
                    <p className="text-zinc-300 text-sm font-medium italic leading-relaxed">
                      {report.description}
                    </p>
                    {report.initialImageUrl && (
                      <div className="rounded-2xl overflow-hidden border border-white/10 aspect-video shadow-inner">
                        <img src={report.initialImageUrl || undefined} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Update Modal (AddUpdateForm) */}
        <AnimatePresence>
          {isUpdateModalOpen && (
            <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-[3rem] shadow-2xl w-full max-w-[min(100vw,42rem)] overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh]"
              >
                <div className="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-3xl font-display font-black text-zinc-900 uppercase tracking-tighter leading-none">{t('reports.update_title')}</h3>
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-2">{t('reports.new_status_label')}: <span className="text-emerald-600">{statusConfig(newStatus).label}</span></p>
                    </div>
                    <button onClick={() => setIsUpdateModalOpen(false)} className="p-3 hover:bg-zinc-100 rounded-full transition-colors border border-zinc-100">
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  {error && (
                    <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold flex items-center gap-3 border border-red-100">
                      <AlertTriangle className="w-5 h-5" />
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleAddUpdate} className="space-y-8">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">{t('reports.change_desc_label')}</label>
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-widest",
                          newDescription.length > 500 ? "text-red-500" : "text-zinc-400"
                        )}>
                          {newDescription.length}/500
                        </span>
                      </div>
                      <textarea 
                        required
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        onBlur={(e) => validateField('description', e.target.value)}
                        placeholder={t('reports.change_desc_placeholder')}
                        rows={4}
                        className={cn(
                          "w-full p-6 bg-zinc-50 rounded-[2rem] border border-zinc-200 font-medium outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all resize-none",
                          fieldErrors.description && "border-red-500 focus:ring-red-500"
                        )}
                      />
                      {fieldErrors.description && (
                        <p className="text-red-500 text-[10px] font-bold mt-1 ml-4">{fieldErrors.description}</p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">{t('reports.new_evidence_label')}</label>
                      <div className="relative">
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleImageChange}
                          className="hidden" 
                          id="update-image-timeline"
                        />
                        <label 
                          htmlFor="update-image-timeline"
                          className="flex flex-col items-center justify-center p-8 bg-zinc-50 rounded-[2rem] border-4 border-dashed border-zinc-200 cursor-pointer hover:bg-zinc-100 transition-all aspect-video overflow-hidden group"
                        >
                          {newImage ? (
                            <img src={newImage || undefined} className="absolute inset-0 w-full h-full object-cover" />
                          ) : (
                            <>
                              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-zinc-300 shadow-sm group-hover:scale-110 transition-transform mb-4">
                                <Camera className="w-8 h-8" />
                              </div>
                              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('reports.upload_evidence_placeholder')}</p>
                            </>
                          )}
                        </label>
                      </div>
                    </div>

                    <button 
                      disabled={submitting}
                      className="w-full py-6 bg-emerald-600 text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-emerald-100 hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-3 active:scale-95"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-6 h-6 animate-spin" />
                          <span>{t('reports.saving')}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-6 h-6" />
                          <span>{t('reports.confirm_btn')}</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
