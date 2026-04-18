import React, { useState, useEffect, useRef } from 'react';
import { Camera, MapPin, Loader2, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeReport } from '../services/geminiService';
import { createReport } from '../services/reportService';
import { ReportType, ReportLocation } from '../types';
import { cn } from '../lib/utils';
import { getCurrentLocation, geoErrorKey } from '../lib/geolocation';
import { SUCCESS_ANIMATION_DURATION_MS } from '../constants/feedback';

import { useSettings } from '../contexts/SettingsContext';

interface ReportFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const ReportForm: React.FC<ReportFormProps> = ({ onClose, onSuccess }) => {
  const { t, language } = useSettings();
  const [type, setType] = useState<ReportType>('ambiental');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [location, setLocation] = useState<ReportLocation | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const [analysis, setAnalysis] = useState<any>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [success, setSuccess] = useState(false);
  const successTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        window.clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  // Auto-detect location when the form opens (silently — no error banner on denial)
  useEffect(() => {
    setIsLocating(true);
    getCurrentLocation().then((result) => {
      if (result.coords) setLocation(result.coords);
      setIsLocating(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateField = (name: string, value: string) => {
    let error: string | null = null;
    
    if (name === 'title') {
      const trimmed = value.trim();
      if (trimmed.length < 5 || trimmed.length > 100) {
        error = t('validation.title_invalid');
      }
    } else if (name === 'description') {
      const trimmed = value.trim();
      if (trimmed.length < 10 || trimmed.length > 500) {
        error = t('validation.description_min');
      }
    }
    
    setFieldErrors(prev => ({ ...prev, [name]: error }));
    return error;
  };

  const handleGetLocation = async () => {
    setIsLocating(true);
    setError(null);
    const result = await getCurrentLocation();
    if (result.coords) {
      setLocation(result.coords);
    } else {
      setError(t(geoErrorKey(result.error)));
    }
    setIsLocating(false);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number' || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
      setError(t('reports.wait_location'));
      return;
    }

    const titleErr = validateField('title', title);
    const descErr = validateField('description', description);

    if (titleErr || descErr || !image) {
      setError(t('reports.fill_all_fields'));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const base64 = image.split(',')[1];
      const result = await analyzeReport(base64, description, `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`);
      
      if (!result.isValid && !result.serviceUnavailable) {
        setError(result.validationError || t('reports.analysis_error'));
        setLoading(false);
        return;
      }

      if (!result.descriptionMatches && !result.serviceUnavailable) {
        setError(t('reports.image_mismatch'));
        setLoading(false);
        return;
      }

      setAnalysis(result);
      setIsConfirming(true);
    } catch (err: any) {
      console.error("Error analyzing report:", err);
      setError(t('reports.analysis_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!analysis || !image || !location) return;
    
    // Strict coordinate validation
    if (typeof location.lat !== 'number' || typeof location.lng !== 'number' || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
      setError(t('reports.invalid_coords'));
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      await createReport(type, title, description, location, image, analysis);
      setSuccess(true);
      if (successTimeoutRef.current) {
        window.clearTimeout(successTimeoutRef.current);
      }
      successTimeoutRef.current = window.setTimeout(() => {
        successTimeoutRef.current = null;
        onSuccess();
      }, SUCCESS_ANIMATION_DURATION_MS);
    } catch (err: any) {
      console.error("Error creating report:", err);
      setError(t('reports.create_error'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
        className="bg-white sm:rounded-[3rem] shadow-2xl w-full max-w-[min(100vw,42rem)] p-6 sm:p-12 flex flex-col items-center justify-center text-center space-y-6"
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
            {t('reports.sent_success')}
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="bg-white sm:rounded-[3rem] shadow-2xl w-full max-w-[min(100vw,42rem)] overflow-hidden flex flex-col h-full sm:h-auto sm:max-h-[90vh]">
      <div className="flex items-center justify-between p-4 sm:p-8 border-b border-zinc-100 dark:border-slate-700 bg-emerald-action/10 dark:bg-emerald-900/20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 sm:p-3 bg-emerald-action rounded-2xl text-white">
            <Camera className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tighter">
              {isConfirming ? t('reports.confirm_report') : t('reports.new_report')}
            </h3>
            <p className="text-[10px] sm:text-xs font-bold text-emerald-action uppercase tracking-widest">{t('reports.traceability_system')}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
          <X className="w-6 h-6 text-zinc-500 dark:text-slate-400" />
        </button>
      </div>

      <div className="p-4 sm:p-8 overflow-y-auto space-y-6 sm:space-y-8 flex-1">
        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold animate-shake">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {!isConfirming ? (
          <form onSubmit={handleAnalyze} className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setType('ambiental')}
                className={cn(
                  "p-4 rounded-2xl font-black text-xs uppercase tracking-widest border-2 transition-all",
                  type === 'ambiental' ? "bg-emerald-action text-white border-emerald-action" : "bg-zinc-50 text-zinc-400 border-zinc-100"
                )}
              >
                {t('reports.environmental')}
              </button>
              <button
                type="button"
                onClick={() => setType('crisis')}
                className={cn(
                  "p-4 rounded-2xl font-black text-xs uppercase tracking-widest border-2 transition-all",
                  type === 'crisis' ? "bg-red-600 text-white border-red-600" : "bg-zinc-50 text-zinc-400 border-zinc-100"
                )}
              >
                {t('reports.crisis')}
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-slate-500 uppercase tracking-widest">{t('reports.title_label')}</label>
              <input
                required
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={(e) => validateField('title', e.target.value)}
                placeholder={t('reports.title_placeholder')}
                className={cn(
                  "w-full p-4 bg-zinc-50 rounded-2xl border border-zinc-200 dark:border-slate-700 font-bold outline-none focus:border-emerald-action transition-colors text-zinc-900 dark:text-white",
                  fieldErrors.title && "border-red-500 focus:border-red-500"
                )}
              />
              {fieldErrors.title && (
                <p className="text-red-500 text-[10px] font-bold mt-1 ml-2">{fieldErrors.title}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-zinc-400 dark:text-slate-500 uppercase tracking-widest">{t('reports.description_label')}</label>
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-widest",
                  description.length > 500 ? "text-red-500" : "text-zinc-400"
                )}>
                  {description.length}/500
                </span>
              </div>
              <textarea
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={(e) => validateField('description', e.target.value)}
                placeholder={t('reports.description_placeholder')}
                rows={4}
                className={cn(
                  "w-full p-4 bg-zinc-50 rounded-2xl border border-zinc-200 dark:border-slate-700 font-medium outline-none focus:border-emerald-action transition-colors resize-none text-zinc-900 dark:text-white",
                  fieldErrors.description && "border-red-500 focus:border-red-500"
                )}
              />
              {fieldErrors.description && (
                <p className="text-red-500 text-[10px] font-bold mt-1 ml-2">{fieldErrors.description}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-slate-500 uppercase tracking-widest">{t('reports.visual_evidence')}</label>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  id="report-image"
                />
                <label
                  htmlFor="report-image"
                  className="flex flex-col items-center justify-center p-8 bg-zinc-50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-slate-700 cursor-pointer hover:bg-zinc-100 transition-all aspect-video overflow-hidden group"
                >
                  {image ? (
                    <img src={image || undefined} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <>
                      <Camera className="w-12 h-12 mb-3 text-zinc-300 dark:text-slate-700 group-hover:text-emerald-action transition-colors" />
                      <p className="text-xs font-black text-zinc-400 dark:text-slate-500 uppercase tracking-widest">{t('reports.upload_photo')}</p>
                    </>
                  )}
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-slate-500 uppercase tracking-widest">{t('reports.location_label')}</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 p-4 bg-zinc-50 rounded-2xl border border-zinc-200 dark:border-slate-700 font-bold text-xs flex items-center justify-between min-h-[56px]">
                  {isLocating ? (
                    <div className="flex items-center gap-2 text-emerald-action">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t('reports.getting_gps')}</span>
                    </div>
                  ) : location ? (
                    <span className="text-zinc-600 dark:text-slate-300 truncate max-w-[300px]">{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</span>
                  ) : (
                    <span className="text-zinc-300 dark:text-slate-700 italic">{t('reports.location_not_detected')}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleGetLocation}
                  className="w-full sm:w-auto p-4 bg-emerald-action/10 text-emerald-action rounded-2xl hover:bg-emerald-action/20 transition-colors flex items-center justify-center"
                >
                  <MapPin className="w-6 h-6" />
                </button>
              </div>
            </div>

            <button
              disabled={loading}
              className="w-full py-5 sm:py-6 bg-emerald-action text-white rounded-3xl font-black text-base sm:text-lg uppercase tracking-tighter shadow-xl shadow-emerald-action/10 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>{t('reports.analyzing')}</span>
                </>
              ) : (
                <span>{t('reports.analyze_button')}</span>
              )}
            </button>
          </form>
        ) : (
          <div className="space-y-8 opacity-0 animate-[fadeIn_0.3s_ease-in_forwards]">
            <div className="bg-emerald-action/10 dark:bg-emerald-900/20 p-5 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-emerald-action/20">
              <h4 className="text-emerald-action font-black uppercase tracking-widest text-[10px] mb-4">{t('reports.ai_analysis')}</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-action font-bold text-sm">{t('reports.suggested_category')}:</span>
                  <span className="font-black text-zinc-900 dark:text-white uppercase tracking-tight">{analysis.categoria}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-emerald-action font-bold text-sm">{t('reports.urgency_level')}:</span>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                    analysis.nivelUrgencia >= 4 ? "bg-red-600 text-white" : "bg-emerald-action text-white"
                  )}>
                    {t('reports.urgency_value').replace('{level}', String(analysis.nivelUrgencia))}
                  </span>
                </div>
                <div className="pt-4 border-t border-emerald-action/10">
                  <p className="text-zinc-600 dark:text-slate-300 text-sm leading-relaxed italic">"{analysis.analisis}"</p>
                </div>
              </div>
            </div>

             <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => setIsConfirming(false)}
                className="flex-1 py-5 bg-zinc-100 text-zinc-500 dark:text-slate-400 rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-zinc-200 transition-colors"
              >
                {t('reports.edit_data')}
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex-[2] py-5 bg-emerald-action text-white rounded-3xl font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-action/10 hover:bg-emerald-action/90 transition-all flex items-center justify-center gap-3"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('reports.confirm_publish')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
