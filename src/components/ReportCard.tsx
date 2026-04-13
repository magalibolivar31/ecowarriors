import React from 'react';
import { MapPin, Clock, ChevronRight, AlertTriangle, CheckCircle2, Activity, Info, Trash2, X } from 'lucide-react';
import { Report, ReportStatus } from '../types';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { UserAlias } from './UserAlias';
import { useSettings } from '../contexts/SettingsContext';

interface ReportCardProps {
  report: Report;
  onClick: () => void;
  isAdmin?: boolean;
  currentUserId?: string;
  onDeleteReport?: (id: string, type: 'ambiental' | 'crisis') => void;
  onCancelReport?: (id: string, type: 'ambiental' | 'crisis') => void;
}

export const ReportCard: React.FC<ReportCardProps> = ({ 
  report, 
  onClick, 
  isAdmin, 
  currentUserId, 
  onDeleteReport, 
  onCancelReport 
}) => {
  const { t, language, showConfirm, privacyMode } = useSettings();
  
  const getStatusConfig = (status: ReportStatus) => {
    switch (status) {
      case 'Abierto (nuevo)': return { color: 'bg-soft-maya-blue/30 text-stormy-teal', icon: <Activity className="w-3 h-3" />, label: t('reports.status_new') };
      case 'Abierto (en seguimiento)': return { color: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300', icon: <Clock className="w-3 h-3" />, label: t('reports.status_followup') };
      case 'Abierto (agravado)': return { color: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300', icon: <AlertTriangle className="w-3 h-3" />, label: t('reports.status_aggravated') };
      case 'Resuelto': return { color: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300', icon: <CheckCircle2 className="w-3 h-3" />, label: t('reports.status_resolved') };
      case 'Cancelado': return { color: 'bg-zinc-100 text-zinc-700', icon: <X className="w-3 h-3" />, label: t('reports.status_cancelled') };
      default: return { color: 'bg-zinc-100 text-zinc-700', icon: <Info className="w-3 h-3" />, label: status };
    }
  };

  const statusConfig = getStatusConfig(report.currentStatus);
  const dateLocale = language === 'es' ? es : enUS;

  return (
    <div 
      onClick={onClick}
      className="group bg-white rounded-[2rem] border border-zinc-100 shadow-sm hover:shadow-md hover:border-emerald-action/30 transition-all cursor-pointer overflow-hidden flex flex-col h-full"
    >
      <div className="relative aspect-video overflow-hidden bg-zinc-100">
        {report.initialImageUrl ? (
          <img 
            src={report.initialImageUrl} 
            alt={report.title} 
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : report.type === 'crisis' ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-red-50 text-red-500 animate-pulse">
            <AlertTriangle className="w-12 h-12 mb-2" />
            <span className="text-[10px] font-black uppercase tracking-widest">{t('reports.crisis_alert')}</span>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-300 bg-brand-bg">
            <AlertTriangle className="w-8 h-8 mb-2 text-stormy-teal/20" />
            <span className="text-[10px] font-black uppercase tracking-widest text-stormy-teal/30">{t('reports.no_image')}</span>
          </div>
        )}

        {/* Botón ADMIN (esquina superior derecha, rojo) */}
        {isAdmin && onDeleteReport && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              showConfirm(
                t('common.confirm'),
                t('reports.delete_confirm'),
                () => onDeleteReport(report.id, report.type as any)
              );
            }}
            className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg z-10 transition-colors"
            title={t('reports.delete_admin')}
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}

        {/* Botón USUARIO NORMAL (esquina superior derecha, gris) */}
        {!isAdmin && 
         report.createdBy === currentUserId && 
         report.isActive && onCancelReport && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              showConfirm(
                t('common.confirm'),
                t('reports.cancel_confirm'),
                () => onCancelReport(report.id, report.type as any)
              );
            }}
            className="absolute top-2 right-2 p-1.5 bg-zinc-400 hover:bg-zinc-500 text-white rounded-full shadow-lg z-10 transition-colors"
            title={t('reports.cancel_mine')}
          >
            <X className="w-3 h-3" />
          </button>
        )}

        <div className="absolute top-3 left-3 flex flex-wrap gap-2">
          <span className={cn(
            "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg backdrop-blur-md",
            report.type === 'crisis' ? "bg-red-600 text-white" : "bg-stormy-teal text-white"
          )}>
            {report.type === 'crisis' ? t('reports.mode_crisis') : t('reports.mode_environmental')}
          </span>
          <span className={cn(
            "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm flex items-center gap-1.5 bg-white border border-zinc-100",
            statusConfig.color.replace('bg-', 'text-')
          )}>
            {statusConfig.icon}
            {statusConfig.label}
          </span>
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col">
        <div className="flex-1 space-y-3">
            <div className="hidden sm:flex items-center justify-between">
              <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                {report.createdAt?.seconds ? format(new Date(report.createdAt.seconds * 1000), "d MMM, yyyy", { locale: dateLocale }) : t('reports.recent')}
              </span>
              <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {report.createdAt?.seconds ? format(new Date(report.createdAt.seconds * 1000), "HH:mm", { locale: dateLocale }) : ''}
              </span>
            </div>

            <h4 className="text-lg font-display font-black text-stormy-teal uppercase tracking-tighter leading-tight group-hover:text-emerald-action transition-colors line-clamp-2">
              {report.title}
              {isAdmin && report.isActive === false && (
                <span className="ml-2 text-red-500 text-[10px] font-black tracking-widest">({t('reports.status_cancelled')})</span>
              )}
            </h4>

            {report.aiAnalysis && (
              <div className="flex items-center gap-1.5">
                <div className="px-2 py-0.5 bg-emerald-action/10 text-emerald-action rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                  <Activity className="w-2.5 h-2.5" />
                  {t('common.ai_verified')}
                </div>
                <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">
                  {report.aiAnalysis.categoria}
                </span>
              </div>
            )}

            <div className="flex items-start gap-2 text-zinc-500">
              <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-action" />
              <p className="text-[11px] font-medium line-clamp-2 leading-relaxed">
                {Number.isFinite(report.location?.lat) && Number.isFinite(report.location?.lng) 
                  ? (privacyMode === 'approximate' ? t('reports.approximate_location') : `${report.location.lat.toFixed(4)}, ${report.location.lng.toFixed(4)}`)
                  : t('reports.location_unavailable')}
              </p>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-zinc-50 flex items-center justify-between">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-stormy-teal/10 flex items-center justify-center text-[9px] font-black text-stormy-teal">
                <UserAlias uid={report.createdBy} fallback={report.createdByName} initialOnly />
              </div>
              <UserAlias 
                uid={report.createdBy} 
                fallback={report.createdByName} 
                className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest" 
              />
            </div>
            <div className="flex items-center gap-1 text-emerald-action font-black text-[9px] uppercase tracking-widest group-hover:translate-x-1 transition-transform">
              {t('reports.details')}
              <ChevronRight className="w-3 h-3" />
            </div>
          </div>
        </div>
      </div>
  );
};
