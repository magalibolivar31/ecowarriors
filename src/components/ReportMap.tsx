import React, { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Search, MapPin, AlertTriangle, Activity, Clock, CheckCircle2, Info, User, X } from 'lucide-react';
import { Report, ReportStatus } from '../types';
import { cn } from '../lib/utils';
import { UserAlias } from './UserAlias';
import { useSettings } from '../contexts/SettingsContext';
import { motion } from 'motion/react';

// Fix for Leaflet default icon bug
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface ReportMapProps {
  reports: Report[];
  onSelectReport: (report: Report) => void;
  filter: 'abiertos' | 'resueltos' | 'mios';
  onFilterChange: (filter: 'abiertos' | 'resueltos' | 'mios') => void;
  currentUser?: { uid: string } | null;
}

const SearchControl = () => {
  const { t } = useSettings();
  const [query, setQuery] = useState('');
  const [searchMarker, setSearchMarker] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const map = useMap();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setError(null);
    try {
      // Check if query is coordinates (e.g., "-34.6037, -58.3816")
      const coordRegex = /^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/;
      const match = query.trim().match(coordRegex);

      if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[3]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          map.setView([lat, lng], 16);
          setSearchMarker([lat, lng]);
          return;
        }
      }

      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        const newPos: [number, number] = [parseFloat(lat), parseFloat(lon)];
        map.setView(newPos, 14);
        setSearchMarker(newPos);
      } else {
        setError("No se encontró la dirección");
      }
    } catch (error) {
      console.error("Error searching location:", error);
      setError("Error al buscar la ubicación");
    }
  };

  return (
    <>
      <div className="absolute top-4 left-4 z-[1000] w-[calc(100%-2rem)] sm:w-full sm:max-w-xs">
        <form onSubmit={handleSearch} className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-zinc-400 group-focus-within:text-stormy-teal transition-colors" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('map.search_placeholder')}
            className="w-full pl-11 pr-10 py-3 bg-white/90 backdrop-blur-md border border-zinc-200 rounded-2xl shadow-xl outline-none focus:ring-2 focus:ring-stormy-teal transition-all text-sm font-medium"
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
            className="mt-2 ml-4 text-xs font-bold text-red-500 bg-white/90 backdrop-blur-md px-3 py-1 rounded-lg shadow-sm border border-red-100 w-fit"
          >
            {error}
          </motion.p>
        )}
      </div>
      {searchMarker && (
        <Marker position={searchMarker}>
          <Popup>
            <div className="p-2 font-bold text-zinc-900">
              {t('map.search_result')}
            </div>
          </Popup>
        </Marker>
      )}
    </>
  );
};


export const ReportMap: React.FC<ReportMapProps> = ({ reports, onSelectReport, filter, onFilterChange, currentUser }) => {
  const { t, privacyMode } = useSettings();
  const DEFAULT_CENTER: [number, number] = [-34.6037, -58.3816]; // Buenos Aires default

  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      // Basic validation - allow 0 as a valid coordinate
      const lat = r?.location?.lat;
      const lng = r?.location?.lng;
      if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return false;
      
      if (filter === 'abiertos') {
        // Solo activos y con estado abierto
        if (r.isActive === false) return false;
        return r.currentStatus && r.currentStatus.startsWith('Abierto');
      }

      if (filter === 'resueltos') {
        // Mostrar resueltos/cancelados aunque isActive=false
        return (
          r.currentStatus === 'Resuelto' ||
          r.currentStatus === 'Cancelado' ||
          r.currentStatus === 'Cargado por error'
        );
      }

      if (filter === 'mios') {
        // Mis reportes: todos (activos e inactivos) creados por el usuario actual
        return r.createdBy === currentUser?.uid;
      }

      // Fallback: solo activos
      if (r.isActive === false) return false;
      return true;
    });
  }, [reports, filter, currentUser]);

  if (!reports) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-zinc-100 rounded-[3rem] border-4 border-white shadow-2xl">
        <Activity className="w-12 h-12 text-emerald-600 animate-pulse mb-4" />
        <p className="text-sm font-black text-zinc-400 uppercase tracking-widest">{t('map.loading')}</p>
      </div>
    );
  }

  const getStatusColor = (status: ReportStatus) => {
    switch (status) {
      case 'Abierto (nuevo)': return '#126B69'; // Stormy Teal
      case 'Abierto (en seguimiento)': return '#3b82f6'; // Maya Blue
      case 'Abierto (agravado)': return '#dc2626'; // Red
      case 'Resuelto': return '#6EB57D'; // Emerald Green
      default: return '#71717a';
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
        
        <SearchControl />

        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
          <div className="bg-white/90 backdrop-blur-md p-1 rounded-2xl flex shadow-xl border border-zinc-200">
            <button 
              onClick={() => onFilterChange('abiertos')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all",
                filter === 'abiertos' ? "bg-stormy-teal text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              )}
            >
              {t('reports.filter_open')}
            </button>
            <button 
              onClick={() => onFilterChange('resueltos')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all",
                filter === 'resueltos' ? "bg-stormy-teal text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              )}
            >
              {t('reports.filter_resolved')}
            </button>
            <button 
              onClick={() => onFilterChange('mios')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all",
                filter === 'mios' ? "bg-stormy-teal text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              )}
            >
              {t('reports.filter_mine')}
            </button>
          </div>
        </div>
        
        {filteredReports.map((report) => {
            const color = getStatusColor(report.currentStatus);
            
            // Stable "approximate" location for privacy
            const getStableOffset = (id: string, seed: number) => {
              const charCodeSum = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
              return (((charCodeSum * seed) % 100) / 100 - 0.5) * 0.004;
            };

            const latOffset = privacyMode === 'approximate' ? getStableOffset(report.id, 7) : 0;
            const lngOffset = privacyMode === 'approximate' ? getStableOffset(report.id, 13) : 0;
            const pos: [number, number] = [report.location.lat + latOffset, report.location.lng + lngOffset];

          return (
            <React.Fragment key={report.id}>
              <Circle
                center={pos}
                radius={50}
                pathOptions={{ 
                  fillColor: color, 
                  color: color, 
                  fillOpacity: 0.4,
                  weight: 2
                }}
              />
              <Marker position={pos}>
                <Popup className="custom-popup">
                  <div className="w-64 p-1 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest",
                        report.type === 'crisis' ? "bg-red-100 text-red-600" : "bg-emerald-action/10 text-emerald-action"
                      )}>
                        {report.type === 'crisis' ? t('reports.crisis') : t('reports.environmental')}
                      </span>
                      <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">
                        {report.currentStatus === 'Abierto (nuevo)' ? t('reports.status_new') :
                         report.currentStatus === 'Abierto (en seguimiento)' ? t('reports.status_followup') :
                         report.currentStatus === 'Abierto (agravado)' ? t('reports.status_aggravated') :
                         report.currentStatus === 'Resuelto' ? t('reports.status_resolved') :
                         report.currentStatus}
                      </span>
                    </div>
                    
                    <div className="space-y-1">
                      <h4 className="text-sm font-black text-stormy-teal uppercase tracking-tight leading-none">
                        {report.title}
                      </h4>
                      <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                        <MapPin className="w-3 h-3 text-stormy-teal" />
                        {Number.isFinite(report.location?.lat) && Number.isFinite(report.location?.lng) ? `${report.location.lat.toFixed(4)}, ${report.location.lng.toFixed(4)}` : t('reports.location_not_detected')}
                      </div>
                      <div className="flex items-center gap-1 text-[8px] font-bold text-zinc-400 uppercase tracking-widest">
                        <User className="w-2.5 h-2.5 text-stormy-teal" />
                        {t('common.by')}: <UserAlias uid={report.createdBy} fallback={report.createdByName} />
                      </div>
                    </div>

                    <div className="aspect-video rounded-xl overflow-hidden border border-zinc-100 bg-zinc-50">
                      {report.initialImageUrl ? (
                        <img src={report.initialImageUrl} alt={t('reports.visual_evidence')} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-zinc-300">
                          <AlertTriangle className="w-6 h-6 mb-1" />
                          <span className="text-[8px] font-black uppercase tracking-widest">{t('reports.no_image')}</span>
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={() => onSelectReport(report)}
                      className="w-full py-3 bg-stormy-teal text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-stormy-teal/90 transition-all shadow-lg shadow-stormy-teal/20"
                    >
                      {t('community.details')}
                    </button>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapContainer>
      
      {filteredReports.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center 
                        bg-white/80 dark:bg-zinc-900/80 z-[999] rounded-[2rem]">
          <div className="text-center space-y-2">
            <MapPin className="w-10 h-10 text-zinc-300 mx-auto" />
            <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">
              {t('map.no_reports_found') || 'No se encontraron reportes'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
