import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, LayersControl, LayerGroup } from 'react-leaflet';
import L from 'leaflet';
import { Search, MapPin, AlertTriangle, Info, CheckCircle2, Navigation, Activity, Droplets, Zap, Car, Upload, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useSettings } from '../contexts/SettingsContext';
import { motion } from 'motion/react';

import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

// Fix for Leaflet default icon bug in Vite/Webpack
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// --- Types ---

export type ReportStatus = 'Abierto (nuevo)' | 'Abierto (en seguimiento)' | 'Abierto (agravado)' | 'Resuelto';

export interface MapReport {
  id: string;
  type: string;
  title: string;
  urgency?: number | string;
  createdAt: any;
  currentStatus: ReportStatus;
  description: string;
  location: {
    lat: number;
    lng: number;
  };
  wasteType?: string;
  initialImageUrl?: string | null;
  category?: 'crisis';
  damageType?: string;
}

interface CollaborativeMapProps {
  reports: MapReport[];
  onUpdateReport: (id: string) => void;
}

// --- Helper Components ---

const SearchControl = ({ onSearch }: { onSearch: (coords: [number, number]) => void }) => {
  const { t } = useSettings();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchMarker, setSearchMarker] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const map = useMap();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        const newCoords: [number, number] = [parseFloat(lat), parseFloat(lon)];
        map.setView(newCoords, 14);
        setSearchMarker(newCoords);
        onSearch(newCoords);
      } else {
        setError("No se encontró la dirección");
      }
    } catch (error) {
      console.error("Error searching location:", error);
      setError("Error al buscar la ubicación");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="absolute top-4 left-4 z-[1000] w-[calc(100%-2rem)] sm:w-full sm:max-w-xs">
        <form onSubmit={handleSearch} className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            {loading ? (
              <Activity className="w-4 h-4 text-stormy-teal animate-spin" />
            ) : (
              <Search className="w-4 h-4 text-zinc-400 group-focus-within:text-stormy-teal transition-colors" />
            )}
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('map.search_placeholder')}
            className="w-full pl-11 pr-10 py-3 bg-white/90 backdrop-blur-md border border-zinc-200 dark:border-slate-700 rounded-2xl shadow-xl outline-none focus:ring-2 focus:ring-stormy-teal transition-all text-sm font-medium text-zinc-900 dark:text-white"
          />
          {query && (
            <button 
              type="button"
              onClick={() => { setQuery(''); setSearchMarker(null); setError(null); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>
        {error && (
          <motion.p 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 ml-4 text-xs font-bold text-red-500 bg-white/90 backdrop-blur-md px-3 py-1 rounded-lg shadow-sm border border-red-100 dark:border-red-900/30 w-fit"
          >
            {error}
          </motion.p>
        )}
      </div>
      {searchMarker && (
        <Marker position={searchMarker}>
          <Popup>
            <div className="p-2 font-bold text-zinc-900 dark:text-white">
              {t('map.search_result')}
            </div>
          </Popup>
        </Marker>
      )}
    </>
  );
};

const MapLegend = () => {
  const { t } = useSettings();
  return (
    <div className="absolute bottom-24 right-4 z-[1000] bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-zinc-200 dark:border-slate-700 space-y-3 hidden sm:block">
      <h4 className="text-[10px] font-black text-stormy-teal dark:text-maya-blue uppercase tracking-widest border-b border-zinc-100 dark:border-slate-800 pb-2">{t('map.legend_title')}</h4>
      <div className="space-y-2">
        {[
          { status: 'Abierto (nuevo)', color: 'bg-stormy-teal', label: t('reports.status_new') },
          { status: 'Abierto (en seguimiento)', color: 'bg-maya-blue', label: t('reports.status_followup') },
          { status: 'Abierto (agravado)', color: 'bg-red-500', label: t('reports.status_aggravated') },
          { status: 'Resuelto', color: 'bg-emerald-action', label: t('reports.status_resolved') },
        ].map((item) => (
          <div key={item.status} className="flex items-center gap-3">
            <div className={cn("w-3 h-3 rounded-full", item.color)} />
            <span className="text-[10px] font-bold text-zinc-600 dark:text-slate-400 uppercase tracking-tight">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Main Component ---

export const CollaborativeMap: React.FC<CollaborativeMapProps> = ({ reports, onUpdateReport }) => {
  const { t, language, privacyMode } = useSettings();
  const DEFAULT_CENTER: [number, number] = [-34.6037, -58.3816]; // Buenos Aires default
  const dateLocale = language === 'es' ? es : enUS;

  if (!reports || reports.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-zinc-100 rounded-[2rem] sm:rounded-[3rem] border-4 border-white shadow-2xl">
        <Activity className="w-12 h-12 text-stormy-teal animate-pulse mb-4" />
        <p className="text-sm font-black text-zinc-400 uppercase tracking-widest">{t('map.loading')}</p>
      </div>
    );
  }

  // Filter and validate reports to prevent NaN errors in Leaflet
  const validReports = useMemo(() => {
    return reports.filter(report => {
      const hasCoords = report.location && 
                        typeof report.location.lat === 'number' && 
                        typeof report.location.lng === 'number';
      
      const isValid = hasCoords && !isNaN(report.location.lat) && !isNaN(report.location.lng);
      
      if (!isValid) {
        console.warn(`[MAPA] Reporte descartado por coordenadas inválidas (ID: ${report.id}):`, report.location);
      }
      
      return isValid;
    });
  }, [reports]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Abierto (nuevo)': return '#126B69'; // Stormy Teal
      case 'Abierto (en seguimiento)': return '#7CBCE8'; // Maya Blue
      case 'Abierto (agravado)': return '#75B9B3'; // Soft teal
      case 'Resuelto': return '#6EB57D'; // Emerald Green
      case 'Cancelado' as any: return '#9DCAE9'; // Soft Maya Blue
      default: return '#7CBCE8';
    }
  };

  const getStatusBadge = (status: ReportStatus) => {
    switch (status) {
      case 'Abierto (nuevo)': return { className: 'bg-stormy-teal/10 text-stormy-teal', label: t('reports.status_new') };
      case 'Abierto (en seguimiento)': return { className: 'bg-maya-blue/10 text-maya-blue', label: t('reports.status_followup') };
      case 'Abierto (agravado)': return { className: 'bg-maya-blue/10 text-stormy-teal', label: t('reports.status_aggravated') };
      case 'Resuelto': return { className: 'bg-emerald-action/10 text-emerald-action', label: t('reports.status_resolved') };
      default: return { className: 'bg-maya-blue/10 text-stormy-teal', label: status };
    }
  };

  return (
    <div className="w-full h-full min-h-[300px] relative rounded-[2rem] sm:rounded-[3rem] overflow-hidden border-4 border-white shadow-2xl bg-zinc-100">
      <MapContainer 
        center={DEFAULT_CENTER} 
        zoom={13} 
        className="h-full w-full z-0" 
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <SearchControl onSearch={() => {}} />
        
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name={t('map.base_layer')}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          </LayersControl.BaseLayer>
          
          <LayersControl.Overlay checked name={t('map.citizen_reports')}>
            <LayerGroup>
              {validReports.map((report) => {
                const color = getStatusColor(report.currentStatus);
                const level = typeof report.urgency === 'number' ? report.urgency : (report.urgency === 'critica' ? 5 : 4);
                const radius = 5 + (level * 4); 

                // Stable "approximate" location for crisis reports (privacy)
                // Using charCodeAt to ensure we always get a valid number even if ID isn't hex
                const getStableOffset = (id: string, seed: number) => {
                  const charCodeSum = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                  return (((charCodeSum * seed) % 100) / 100 - 0.5) * 0.004;
                };

                const latOffset = (report.type === 'crisis' || privacyMode === 'approximate') ? getStableOffset(report.id, 7) : 0;
                const lngOffset = (report.type === 'crisis' || privacyMode === 'approximate') ? getStableOffset(report.id, 13) : 0;
                const displayPos: [number, number] = [report.location.lat + latOffset, report.location.lng + lngOffset];

                const badge = getStatusBadge(report.currentStatus as any);

                return (
                  <React.Fragment key={report.id}>
                    <Circle
                      center={displayPos}
                      radius={radius}
                      pathOptions={{ 
                        fillColor: color, 
                        color: color, 
                        fillOpacity: report.type === 'crisis' ? 0.8 : 0.4,
                        weight: report.type === 'crisis' ? 4 : 2,
                        dashArray: report.type === 'crisis' ? '5, 5' : undefined
                      }}
                    />
                    <Marker position={displayPos}>
                      <Popup className="custom-popup">
                        <div className={cn("w-64 p-1 space-y-4", report.type === 'crisis' ? "border-t-4 border-dark-teal" : "")}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {report.type === 'crisis' && <AlertTriangle className="w-3 h-3 text-dark-teal" />}
                              <span className={cn("px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest", badge.className)}>
                                {badge.label}
                              </span>
                            </div>
                            <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">
                              {report.createdAt?.toDate ? format(report.createdAt.toDate(), 'dd/MM/yy HH:mm', { locale: dateLocale }) : t('reports.recent')}
                            </span>
                          </div>
                          
                          <div className="space-y-1">
                            <h4 className="text-sm font-black text-stormy-teal uppercase tracking-tight leading-none">
                              {report.type === 'crisis' ? (report.damageType?.replace(/_/g, ' ') || t('map.emergency')) : (report.wasteType || report.title)}
                            </h4>
                            <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                              <MapPin className="w-3 h-3" />
                              {`${report.location.lat.toFixed(4)}, ${report.location.lng.toFixed(4)}`}
                            </div>
                          </div>

                          {report.type === 'crisis' && !report.initialImageUrl ? (
                              <div className="aspect-video rounded-xl overflow-hidden bg-dark-teal flex flex-col items-center justify-center gap-2 border-2 border-stormy-teal shadow-inner">
                                <AlertTriangle className="w-10 h-10 text-maya-blue animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-white">{t('map.alert_no_image')}</span>
                              </div>
                            ) : report.initialImageUrl && (
                            <div className="aspect-video rounded-xl overflow-hidden border border-zinc-100 relative group">
                              <img src={report.initialImageUrl} alt={t('reports.visual_evidence')} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              {report.type === 'crisis' && (
                                <>
                                  <div className="absolute inset-0 bg-dark-teal/30 pointer-events-none" />
                                  <div className="absolute top-2 left-2 px-2 py-1 bg-dark-teal text-white text-[8px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1 shadow-lg border border-stormy-teal">
                                    <AlertTriangle className="w-2 h-2" />
                                    {t('reports.mode_crisis')}
                                  </div>
                                </>
                              )}
                            </div>
                          )}

                          <p className="text-xs text-zinc-600 leading-relaxed italic">"{report.description}"</p>

                          <div className="pt-2 border-t border-zinc-100 flex gap-2">
                            <button 
                              onClick={() => onUpdateReport(report.id)}
                              className="flex-1 py-2 bg-stormy-teal text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-stormy-teal/90 transition-all flex items-center justify-center gap-2"
                            >
                              <Upload className="w-3 h-3" />
                              {t('map.update_report')}
                            </button>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  </React.Fragment>
                );
              })}
            </LayerGroup>
          </LayersControl.Overlay>

          <LayersControl.Overlay name={t('map.flood_layer')}>
            <LayerGroup>
              {/* Mock flood data */}
              <Circle center={[-34.58, -58.42]} radius={500} pathOptions={{ color: '#7CBCE8', fillColor: '#7CBCE8', fillOpacity: 0.2 }}>
                <Popup>{t('map.flood_risk')}</Popup>
              </Circle>
            </LayerGroup>
          </LayersControl.Overlay>

          <LayersControl.Overlay name={t('map.energy_layer')}>
            <LayerGroup>
              {/* Mock energy points */}
              <Marker position={[-34.61, -58.37]}>
                <Popup>{t('map.energy_point')}</Popup>
              </Marker>
            </LayerGroup>
          </LayersControl.Overlay>

          <LayersControl.Overlay name={t('map.road_layer')}>
            <LayerGroup>
              {/* Mock road risk */}
              <Circle center={[-34.62, -58.45]} radius={300} pathOptions={{ color: '#75B9B3', fillColor: '#75B9B3', fillOpacity: 0.2 }}>
                <Popup>{t('map.road_risk')}</Popup>
              </Circle>
            </LayerGroup>
          </LayersControl.Overlay>
        </LayersControl>
      </MapContainer>
      
      <MapLegend />
      
      {validReports.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center 
                        bg-white/80 dark:bg-dark-teal/80 z-[999] rounded-[2rem]">
          <div className="text-center space-y-2">
            <MapPin className="w-10 h-10 text-zinc-300 mx-auto" />
            <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">
              No hay reportes con ubicación válida
            </p>
          </div>
        </div>
      )}

      <div className="absolute bottom-8 left-8 z-[1000] flex gap-2 hidden sm:flex">
        <div className="bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-zinc-200 flex items-center gap-3">
          <div className="p-2 bg-stormy-teal/10 rounded-xl">
            <Activity className="w-4 h-4 text-stormy-teal" />
          </div>
          <div>
            <p className="text-[10px] font-black text-zinc-900 uppercase tracking-tight">{t('map.early_warning')}</p>
            <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">{t('map.real_time_monitoring')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
