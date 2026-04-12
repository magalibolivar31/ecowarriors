import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  X, 
  CheckCircle2, 
  Phone, 
  MapPin, 
  Backpack, 
  Activity, 
  AlertTriangle, 
  Droplets, 
  Flame, 
  Zap, 
  Info,
  ChevronRight,
  ChevronDown,
  Clock,
  Send,
  Home,
  Users,
  Camera,
  Image as ImageIcon,
  Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, sanitizeText } from '../lib/utils';
import { auth } from '../firebase';
import { createReport } from '../services/reportService';
import { ReportType, ReportLocation, UserSettings } from '../types';
import { Loader2 } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

interface CrisisModeProps {
  onClose: () => void;
  userSettings: UserSettings | null;
  onUpdateSettings: (settings: Partial<UserSettings>) => Promise<void>;
}

export const CrisisMode: React.FC<CrisisModeProps> = ({ onClose, userSettings, onUpdateSettings }) => {
  const { t, showAlert } = useSettings();

  const MOCHILA_ITEMS = [
    { category: t('crisis.backpack_cat_food'), items: [t('crisis.backpack_item_water'), t('crisis.backpack_item_food'), t('crisis.backpack_item_opener'), t('crisis.backpack_item_utensils')] },
    { category: t('crisis.backpack_cat_docs'), items: [t('crisis.backpack_item_id'), t('crisis.backpack_item_titles'), t('crisis.backpack_item_insurance'), t('crisis.backpack_item_cash')] },
    { category: t('crisis.backpack_cat_health'), items: [t('crisis.backpack_item_firstaid'), t('crisis.backpack_item_meds'), t('crisis.backpack_item_alcohol'), t('crisis.backpack_item_soap')] },
    { category: t('crisis.backpack_cat_tools'), items: [t('crisis.backpack_item_blanket'), t('crisis.backpack_item_clothes'), t('crisis.backpack_item_flashlight'), t('crisis.backpack_item_radio'), t('crisis.backpack_item_whistle')] }
  ];

  const SERVICE_GUIDES = [
    { 
      title: t('crisis.electricity_guide'), 
      icon: <Zap className="w-6 h-6 text-yellow-500" />, 
      steps: [t('crisis.elec_step1'), t('crisis.elec_step2'), t('crisis.elec_step3')],
      warning: t('crisis.elec_warning')
    },
    { 
      title: t('crisis.gas_guide'), 
      icon: <Flame className="w-6 h-6 text-orange-500" />, 
      steps: [t('crisis.gas_step1'), t('crisis.gas_step2'), t('crisis.gas_step3')],
      warning: t('crisis.gas_warning')
    },
    { 
      title: t('crisis.water_guide'), 
      icon: <Droplets className="w-6 h-6 text-blue-500" />, 
      steps: [t('crisis.water_step1'), t('crisis.water_step2'), t('crisis.water_step3')],
      warning: t('crisis.water_warning')
    }
  ];

  const [activeSection, setActiveSection] = useState<'main' | 'backpack' | 'report' | 'meeting' | 'guide' | 'onboarding'>('main');
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [signalSent, setSignalSent] = useState(false);
  const [damageType, setDamageType] = useState('');
  const [zone, setZone] = useState('');
  const [urgency, setUrgency] = useState('alta');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remindersEnabled, setRemindersEnabled] = useState(() => {
    return userSettings?.crisisRemindersEnabled ?? localStorage.getItem('crisis_reminders') === 'true';
  });
  
  // Backpack state
  const [checkedItems, setCheckedItems] = useState<string[]>(() => {
    const saved = localStorage.getItem('crisis_backpack');
    return saved ? JSON.parse(saved) : [];
  });

  // Meeting point state
  const [meetingPoint, setMeetingPoint] = useState(() => {
    return userSettings?.meetingPoint || { place: t('crisis.default_meeting_place') };
  });
  const [contacts, setContacts] = useState(() => {
    return userSettings?.trustedContacts || [
      { name: t('crisis.default_contact_1_name'), phone: '11 2345 6789' },
      { name: t('crisis.default_contact_2_name'), phone: '11 9876 5432' }
    ];
  });

  const [isEditingMeeting, setIsEditingMeeting] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [editingContactIndex, setEditingContactIndex] = useState<number | null>(null);
  const [emergencyDialing, setEmergencyDialing] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});

  const validateField = (name: string, value: string) => {
    let error: string | null = null;
    
    if (name === 'contact_phone') {
      const phoneRegex = /^[0-9+\s-]+$/;
      const digitsOnly = value.replace(/[^0-9]/g, '');
      if (!phoneRegex.test(value) || digitsOnly.length < 7 || digitsOnly.length > 15) {
        error = t('validation.phone_invalid');
      }
    } else if (name === 'contact_name') {
      const trimmed = value.trim();
      if (trimmed.length < 2 || trimmed.length > 40) {
        error = t('validation.name_invalid');
      }
    } else if (name === 'description') {
      const trimmed = value.trim();
      if (trimmed.length > 0 && (trimmed.length < 10 || trimmed.length > 500)) {
        error = t('validation.description_min');
      }
    } else if (name === 'lat') {
      const val = parseFloat(value);
      if (isNaN(val) || val < -90 || val > 90) error = t('validation.coordinate_invalid');
    } else if (name === 'lng') {
      const val = parseFloat(value);
      if (isNaN(val) || val < -180 || val > 180) error = t('validation.coordinate_invalid');
    }
    
    setFieldErrors(prev => ({ ...prev, [name]: error }));
    return error;
  };

  const isMobileDevice = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  const handleEmergencyCall = () => {
    if (isMobileDevice()) {
      window.location.href = "tel:911";
    } else {
      // Desktop fallback: show a visual "dialing" state or message
      setEmergencyDialing(true);
      setTimeout(() => setEmergencyDialing(false), 5000);
    }
  };
  const [newContact, setNewContact] = useState({ name: '', phone: '' });
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isManualLocation, setIsManualLocation] = useState(false);
  const [manualCoords, setManualCoords] = useState({ lat: '', lng: '' });

  // Guide step state
  const [activeGuideIndex, setActiveGuideIndex] = useState<number | null>(null);
  const [guideStep, setGuideStep] = useState(0);

  const translateDamageType = (value: string, t: (key: string) => string) => {
    switch (value) {
      case 'voladura_techo': return t('crisis.roof_damage');
      case 'colapso_vivienda': return t('crisis.house_collapse');
      case 'inundacion_grave': return t('crisis.severe_flood');
      case 'otro': return t('crisis.other_damage');
      default: return value;
    }
  };

  useEffect(() => {
    if (userSettings && !userSettings.onboardingCompleted) {
      setActiveSection('onboarding');
    }
  }, [userSettings]);

  useEffect(() => {
    localStorage.setItem('crisis_reminders', remindersEnabled.toString());
    if (remindersEnabled) {
      console.log(t('crisis.system_reminders_on'));
    } else {
      console.log(t('crisis.system_reminders_off'));
    }
  }, [remindersEnabled]);

  useEffect(() => {
    localStorage.setItem('crisis_backpack', JSON.stringify(checkedItems));
  }, [checkedItems]);

  useEffect(() => {
    if (userSettings) {
      onUpdateSettings({ meetingPoint });
    }
  }, [meetingPoint]);

  useEffect(() => {
    if (userSettings) {
      onUpdateSettings({ trustedContacts: contacts });
    }
  }, [contacts]);

  const handleSafeStatus = () => {
    if (contacts.length === 0) {
      showAlert(t('common.warning'), t('crisis.no_contact_warning'));
      setActiveSection('meeting');
      return;
    }

    setSignalSent(true);

    const sendSignal = (locationLink?: string) => {
      const baseMessage = locationLink 
        ? `${t('crisis.safe_message')} ${locationLink}`
        : t('crisis.safe_message_no_gps');
      
      if (navigator.onLine) {
        const firstContact = contacts[0];
        const cleanPhone = firstContact.phone.replace(/\D/g, '');
        const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(baseMessage)}`;
        window.open(whatsappUrl, '_blank');
        
        setTimeout(() => {
          showAlert(t('common.success'), t('crisis.signal_sent_success'));
        }, 1000);
      } else {
        localStorage.setItem('pending_safe_signal', JSON.stringify({ message: baseMessage, contacts, timestamp: Date.now() }));
        showAlert(t('common.warning'), t('crisis.offline_warning'));
      }
    };

    if (!navigator.geolocation) {
      sendSignal();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        sendSignal(`https://www.google.com/maps?q=${latitude},${longitude}`);
      },
      (error) => {
        console.error("Error obtaining location:", error);
        sendSignal();
      },
      { timeout: 5000 }
    );

    // Cooldown: 5 minutes (300000ms)
    setTimeout(() => setSignalSent(false), 300000);
  };

  const toggleItem = (item: string) => {
    setCheckedItems(prev => 
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  };

  const handleAddContact = () => {
    const nameError = validateField('contact_name', newContact.name);
    const phoneError = validateField('contact_phone', newContact.phone);
    if (nameError || phoneError) return;

    const sanitizedContact = {
      name: sanitizeText(newContact.name),
      phone: sanitizeText(newContact.phone)
    };

    if (editingContactIndex !== null) {
      const updatedContacts = [...contacts];
      updatedContacts[editingContactIndex] = sanitizedContact;
      setContacts(updatedContacts);
      setEditingContactIndex(null);
    } else {
      setContacts([...contacts, sanitizedContact]);
    }
    setNewContact({ name: '', phone: '' });
    setIsAddingContact(false);
  };

  const handleEditContact = (index: number) => {
    setNewContact(contacts[index]);
    setEditingContactIndex(index);
    setIsAddingContact(true);
    setFieldErrors(prev => ({ ...prev, contact_name: null, contact_phone: null }));
  };

  const handleGetLocation = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setLocationError(t('crisis.browser_no_gps'));
        resolve(null);
        return;
      }

      setIsLocating(true);
      setLocationError(null);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setCurrentCoords(coords);
          setIsLocating(false);
          resolve(coords);
        },
        (error) => {
          console.error("Error getting location:", error);
          setLocationError(t('crisis.location_error_perms'));
          setIsLocating(false);
          resolve(null);
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    });
  };

  useEffect(() => {
    if (activeSection === 'report' && !currentCoords) {
      handleGetLocation();
    }
  }, [activeSection]);

  const handleSubmitDamageReport = async (e: React.FormEvent) => {
    e.preventDefault();
    const descriptionError = validateField('description', description);
    if (descriptionError) return;
    
    let finalCoords = currentCoords;

    if (isManualLocation) {
      const latError = validateField('lat', manualCoords.lat);
      const lngError = validateField('lng', manualCoords.lng);
      if (latError || lngError) {
        setLocationError(t('validation.coordinate_invalid'));
        return;
      }

      const lat = parseFloat(manualCoords.lat);
      const lng = parseFloat(manualCoords.lng);
      
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setLocationError(t('crisis.wait_location_error'));
        return;
      }
      
      finalCoords = { lat, lng };
    } else if (!finalCoords) {
      // If not manual and no coords yet, try to get them now
      finalCoords = await handleGetLocation();
    }

    if (!finalCoords || !Number.isFinite(finalCoords.lat) || !Number.isFinite(finalCoords.lng)) {
      setLocationError(t('crisis.wait_location_error'));
      return;
    }

    setIsSubmitting(true);
    setLocationError(null);

    const locationData: ReportLocation = {
      lat: finalCoords.lat,
      lng: finalCoords.lng
    };

    const sanitizedDamageType = translateDamageType(damageType, t) || t('crisis.default_report_title');
    const sanitizedZone = sanitizeText(zone) || t('crisis.zone_not_specified');
    const sanitizedDescriptionInput = sanitizeText(description);

    const reportTitle = sanitizeText(sanitizedDamageType);
    const reportDescription = sanitizedDescriptionInput || t('crisis.default_report_desc')
      .replace('{type}', sanitizedDamageType)
      .replace('{zone}', sanitizedZone);

    if (navigator.onLine && auth.currentUser) {
      try {
        await createReport(
          'crisis',
          reportTitle,
          reportDescription,
          locationData,
          selectedImage
        );

        showAlert(t('common.success'), t('crisis.report_success'));
        setActiveSection('main');
        // Reset form
        setDamageType('');
        setZone('');
        setDescription('');
        setSelectedImage(null);
        setCurrentCoords(null);
        setManualCoords({ lat: '', lng: '' });
        setIsManualLocation(false);
      } catch (error) {
        console.error("Error creating crisis report:", error);
        // Error is already handled by createReport -> handleFirestoreError
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Offline storage - maintaining structure
      const pending = JSON.parse(localStorage.getItem('pending_damage_reports') || '[]');
      const offlineReport = {
        type: 'crisis' as ReportType,
        title: reportTitle,
        description: reportDescription,
        location: locationData,
        imageBase64: selectedImage,
        createdAt: new Date().toISOString()
      };
      localStorage.setItem('pending_damage_reports', JSON.stringify([...pending, offlineReport]));
      showAlert(t('common.success'), t('crisis.offline_report_success'));
      setIsSubmitting(false);
      setActiveSection('main');
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen bg-red-600 text-white flex flex-col font-sans select-none">
      {/* Header */}
      <header className="p-4 bg-red-700 flex items-center justify-between border-b border-red-500/30 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 animate-pulse text-yellow-400" />
          <h1 className="text-xl font-display font-black uppercase tracking-tighter">{t('crisis.title')}</h1>
        </div>
        <button 
          onClick={onClose}
          className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4 max-w-xl mx-auto w-full pb-24">
        
        {activeSection === 'onboarding' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="h-full flex flex-col items-center justify-center text-center space-y-8 py-12"
          >
            {onboardingStep === 0 && (
              <>
                <div className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center border-4 border-yellow-400">
                  <ShieldAlert className="w-16 h-16 text-yellow-400" />
                </div>
                <div className="space-y-4">
                  <h2 className="text-4xl font-display font-black leading-none">{t('crisis.onboarding_title')}</h2>
                  <p className="text-lg font-bold opacity-80">{t('crisis.onboarding_desc')}</p>
                </div>
                <button 
                  onClick={() => setOnboardingStep(1)}
                  className="w-full py-6 bg-yellow-400 text-red-900 rounded-3xl font-black text-xl shadow-xl active:scale-95 transition-all"
                >
                  {t('crisis.save_continue')}
                </button>
              </>
            )}

            {onboardingStep === 1 && (
              <>
                <div className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center border-4 border-yellow-400">
                  <Users className="w-16 h-16 text-yellow-400" />
                </div>
                <div className="space-y-4">
                  <h2 className="text-4xl font-display font-black leading-none">{t('crisis.onboarding_contacts_title')}</h2>
                  <p className="text-lg font-bold opacity-80">{t('crisis.onboarding_contacts_desc')}</p>
                </div>
                <div className="w-full space-y-4">
                  <div className="space-y-2 text-left">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-70">{t('crisis.contact_name_label')}</label>
                    <input 
                      type="text" 
                      value={newContact.name}
                      onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                      onBlur={(e) => validateField('contact_name', e.target.value)}
                      placeholder={t('crisis.contact_name_placeholder')}
                      className={cn(
                        "w-full p-4 bg-white/10 rounded-2xl border border-white/20 font-bold outline-none focus:border-yellow-400",
                        fieldErrors.contact_name && "border-red-400"
                      )}
                    />
                    {fieldErrors.contact_name && (
                      <p className="text-red-300 text-[10px] font-bold uppercase tracking-widest mt-1">{fieldErrors.contact_name}</p>
                    )}
                  </div>
                  <div className="space-y-2 text-left">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-70">{t('crisis.contact_phone_label')}</label>
                    <input 
                      type="tel" 
                      value={newContact.phone}
                      onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                      onBlur={(e) => validateField('contact_phone', e.target.value)}
                      placeholder={t('crisis.contact_phone_placeholder')}
                      className={cn(
                        "w-full p-4 bg-white/10 rounded-2xl border border-white/20 font-bold outline-none focus:border-yellow-400",
                        fieldErrors.contact_phone && "border-red-400"
                      )}
                    />
                    {fieldErrors.contact_phone && (
                      <p className="text-red-300 text-[10px] font-bold uppercase tracking-widest mt-1">{fieldErrors.contact_phone}</p>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => {
                    const nameErr = validateField('contact_name', newContact.name);
                    const phoneErr = validateField('contact_phone', newContact.phone);
                    if (!nameErr && !phoneErr) {
                      setContacts([newContact]);
                      setOnboardingStep(2);
                    }
                  }}
                  disabled={!newContact.name || !newContact.phone || !!fieldErrors.contact_name || !!fieldErrors.contact_phone}
                  className="w-full py-6 bg-yellow-400 text-red-900 rounded-3xl font-black text-xl shadow-xl active:scale-95 transition-all disabled:opacity-50"
                >
                  {t('crisis.save_continue')}
                </button>
              </>
            )}

            {onboardingStep === 2 && (
              <>
                <div className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center border-4 border-yellow-400">
                  <CheckCircle2 className="w-16 h-16 text-yellow-400" />
                </div>
                <div className="space-y-4">
                  <h2 className="text-4xl font-display font-black leading-none">{t('crisis.ready_title')}</h2>
                  <p className="text-lg font-bold opacity-80">{t('crisis.ready_desc')}</p>
                </div>
                <button 
                  onClick={async () => {
                    await onUpdateSettings({ onboardingCompleted: true });
                    setActiveSection('main');
                  }}
                  className="w-full py-6 bg-white text-red-600 rounded-3xl font-black text-xl shadow-xl active:scale-95 transition-all"
                >
                  {t('crisis.start')}
                </button>
              </>
            )}
          </motion.div>
        )}

        {activeSection === 'main' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Main Action: Estoy a Salvo */}
            <div className="bg-white text-red-600 p-6 rounded-[2.5rem] shadow-2xl border-4 border-yellow-400">
              <h2 className="text-2xl font-display font-black mb-1 text-center uppercase">{t('crisis.im_safe_title')}</h2>
              <p className="text-red-500 mb-6 font-bold text-center text-sm">{t('crisis.im_safe_desc')}</p>
              <div className="space-y-3">
                <button 
                  onClick={handleSafeStatus}
                  disabled={signalSent}
                  className={`w-full py-8 rounded-3xl font-black text-2xl shadow-xl active:scale-95 transition-all flex flex-col items-center justify-center gap-2 ${
                    signalSent ? 'bg-emerald-500 text-white' : 'bg-red-600 text-white'
                  }`}
                >
                  {signalSent ? (
                    <>
                      <CheckCircle2 className="w-12 h-12" />
                      <span>{t('crisis.sent')}</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-12 h-12" />
                      <span>{t('crisis.im_ok')}</span>
                    </>
                  )}
                </button>
                <button 
                  onClick={() => setActiveSection('meeting')}
                  className="w-full py-3 bg-red-50 text-red-600 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 border border-red-100"
                >
                  <Edit2 className="w-4 h-4" />
                  {t('crisis.edit_contact')}
                </button>
              </div>
            </div>

            {/* Grid of secondary actions */}
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setActiveSection('backpack')}
                className="bg-red-700/60 p-6 rounded-[2rem] flex flex-col items-center gap-3 border border-red-400/30 active:bg-red-800"
              >
                <Backpack className="w-10 h-10 text-yellow-400" />
                <span className="font-black text-sm uppercase tracking-wider">{t('crisis.backpack')}</span>
              </button>
              <button 
                onClick={() => setActiveSection('report')}
                className="bg-red-700/60 p-6 rounded-[2rem] flex flex-col items-center gap-3 border border-red-400/30 active:bg-red-800"
              >
                <AlertTriangle className="w-10 h-10 text-yellow-400" />
                <span className="font-black text-sm uppercase tracking-wider">{t('crisis.report_damage')}</span>
              </button>
              <button 
                onClick={() => setActiveSection('meeting')}
                className="bg-red-700/60 p-6 rounded-[2rem] flex flex-col items-center gap-3 border border-red-400/30 active:bg-red-800"
              >
                <MapPin className="w-10 h-10 text-yellow-400" />
                <span className="font-black text-sm uppercase tracking-wider">{t('crisis.meeting_point')}</span>
              </button>
              <button 
                onClick={() => setActiveSection('guide')}
                className="bg-red-700/60 p-6 rounded-[2rem] flex flex-col items-center gap-3 border border-red-400/30 active:bg-red-800"
              >
                <Zap className="w-10 h-10 text-yellow-400" />
                <span className="font-black text-sm uppercase tracking-wider">{t('crisis.guide')}</span>
              </button>
            </div>

            {/* Reminders Toggle */}
            <div className="bg-red-800/40 p-5 rounded-3xl border border-red-400/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="w-6 h-6 text-yellow-400" />
                <div>
                  <p className="font-bold text-sm">{t('crisis.preventive_reminders')}</p>
                  <p className="text-[10px] opacity-70">{t('crisis.reminders_desc')}</p>
                </div>
              </div>
              <button 
                onClick={() => setRemindersEnabled(!remindersEnabled)}
                className={`w-12 h-6 rounded-full relative transition-colors ${remindersEnabled ? 'bg-emerald-500' : 'bg-red-900'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${remindersEnabled ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            {/* Emergency Numbers */}
            <div className="bg-yellow-400 text-red-900 p-5 rounded-3xl flex items-center justify-between shadow-lg relative overflow-hidden">
              {emergencyDialing && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 bg-red-600 text-white flex items-center justify-center gap-3 z-10"
                >
                  <Phone className="w-6 h-6 animate-bounce" />
                  <span className="font-black uppercase tracking-widest text-sm">{t('crisis.calling_911')}</span>
                </motion.div>
              )}
              <div className="flex items-center gap-4">
                <Phone className="w-8 h-8" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">{t('crisis.emergency_label')}</p>
                  <p className="text-3xl font-display font-black leading-none">911</p>
                </div>
              </div>
              <button 
                onClick={handleEmergencyCall}
                className="bg-red-600 text-white px-6 py-3 rounded-2xl font-black text-sm active:scale-95 transition-transform"
              >
                {emergencyDialing ? t('common.loading') : t('crisis.emergency_call')}
              </button>
            </div>
            {!isMobileDevice() && !emergencyDialing && (
              <p className="text-[10px] text-center font-bold opacity-60 uppercase tracking-widest">
                {t('crisis.desktop_call_hint') || 'Función de llamada directa disponible solo en móviles'}
              </p>
            )}
          </motion.div>
        )}

        {activeSection === 'backpack' && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <button onClick={() => setActiveSection('main')} className="flex items-center gap-2 font-bold text-yellow-400">
              <X className="w-5 h-5" /> {t('crisis.back')}
            </button>
            <h2 className="text-3xl font-display font-black uppercase">{t('crisis.backpack')}</h2>
            <div className="space-y-6">
              {MOCHILA_ITEMS.map((cat, i) => (
                <div key={i} className="space-y-3">
                  <h3 className="font-black text-yellow-400 uppercase tracking-widest text-xs">{cat.category}</h3>
                  <div className="grid gap-2">
                    {cat.items.map((item, j) => (
                      <label key={j} className="flex items-center gap-4 p-4 bg-white/10 rounded-2xl border border-white/5 active:bg-white/20 transition-colors cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={checkedItems.includes(item)}
                          onChange={() => toggleItem(item)}
                          className="w-6 h-6 rounded-lg border-red-400 text-red-600 focus:ring-red-500 bg-white/20" 
                        />
                        <span className={`font-bold text-sm ${checkedItems.includes(item) ? 'line-through opacity-50' : ''}`}>{item}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeSection === 'report' && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <button onClick={() => setActiveSection('main')} className="flex items-center gap-2 font-bold text-yellow-400">
              <X className="w-5 h-5" /> {t('crisis.back')}
            </button>
            <div className="bg-yellow-400 text-red-900 p-4 rounded-2xl flex items-start gap-3">
              <Info className="w-6 h-6 shrink-0 mt-1" />
              <p className="text-xs font-bold">{t('crisis.report_help_text')}</p>
            </div>
            <h2 className="text-3xl font-display font-black uppercase">{t('crisis.report_damage')}</h2>
            <form onSubmit={handleSubmitDamageReport} className="space-y-6">
              {locationError && (
                <div className="p-4 bg-white text-red-600 rounded-2xl font-bold text-sm flex items-center gap-3 border-l-8 border-yellow-400">
                  <AlertTriangle className="w-6 h-6 flex-shrink-0" />
                  <p>{locationError}</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest opacity-70">{t('crisis.visual_evidence')}</label>
                <div className="relative">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageChange}
                    className="hidden" 
                    id="crisis-image"
                  />
                  <label 
                    htmlFor="crisis-image"
                    className="flex flex-col items-center justify-center p-8 bg-white/10 rounded-3xl border-2 border-dashed border-white/30 cursor-pointer hover:bg-white/20 transition-all overflow-hidden aspect-video"
                  >
                    {selectedImage ? (
                      <img src={selectedImage || undefined} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <>
                        <Camera className="w-10 h-10 mb-2 text-yellow-400" />
                        <p className="text-xs font-black uppercase tracking-widest">{t('crisis.upload_damage_photo')}</p>
                      </>
                    )}
                  </label>
                  {selectedImage && (
                    <button 
                      type="button"
                      onClick={() => setSelectedImage(null)}
                      className="absolute top-4 right-4 p-2 bg-red-600 rounded-xl shadow-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest opacity-70">{t('crisis.damage_type')}</label>
                <select 
                  required
                  value={damageType}
                  onChange={(e) => setDamageType(e.target.value)}
                  className="w-full p-4 bg-white text-zinc-900 rounded-2xl border border-white/20 font-bold outline-none focus:border-yellow-400"
                >
                  <option value="" className="bg-white text-zinc-900">{t('crisis.select_damage')}</option>
                  <option value="voladura_techo" className="bg-white text-zinc-900">{t('crisis.roof_damage')}</option>
                  <option value="colapso_vivienda" className="bg-white text-zinc-900">{t('crisis.house_collapse')}</option>
                  <option value="inundacion_grave" className="bg-white text-zinc-900">{t('crisis.severe_flood')}</option>
                  <option value="otro" className="bg-white text-zinc-900">{t('crisis.other_damage')}</option>
                </select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-widest opacity-70">
                    {isManualLocation ? t('crisis.manual_coords') : t('crisis.gps_location')}
                  </label>
                  <button 
                    type="button"
                    onClick={() => setIsManualLocation(!isManualLocation)}
                    className="text-[10px] font-black text-yellow-400 uppercase tracking-widest hover:underline"
                  >
                    {isManualLocation ? t('crisis.use_gps') : t('crisis.enter_manually')}
                  </button>
                </div>

                {!isManualLocation ? (
                  <div className="flex gap-2">
                    <div className="flex-1 p-4 bg-white/10 rounded-2xl border border-white/20 font-mono text-sm flex items-center justify-between">
                      {isLocating ? (
                        <div className="flex items-center gap-2 text-yellow-400">
                          <Activity className="w-4 h-4 animate-spin" />
                          <span>{t('crisis.getting_gps')}</span>
                        </div>
                      ) : currentCoords ? (
                        <div className="flex items-center gap-2 text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{currentCoords.lat.toFixed(6)}, {currentCoords.lng.toFixed(6)}</span>
                        </div>
                      ) : (
                        <span className="text-white/30 italic">{t('reports.location_not_detected')}</span>
                      )}
                    </div>
                    <button 
                      type="button"
                      onClick={handleGetLocation}
                      className="p-4 bg-white/10 rounded-2xl border border-white/20 hover:bg-white/20 transition-colors"
                    >
                      <MapPin className="w-5 h-5 text-yellow-400" />
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <input 
                        type="number"
                        step="any"
                        placeholder={t('crisis.latitude_placeholder')}
                        value={manualCoords.lat}
                        onChange={(e) => setManualCoords(prev => ({ ...prev, lat: e.target.value }))}
                        onBlur={(e) => validateField('lat', e.target.value)}
                        className={cn(
                          "w-full p-4 bg-white/10 rounded-2xl border border-white/20 font-mono text-sm outline-none focus:border-yellow-400 placeholder:text-white/30",
                          fieldErrors.lat && "border-red-400"
                        )}
                      />
                      {fieldErrors.lat && <p className="text-[8px] text-red-300 font-bold uppercase">{fieldErrors.lat}</p>}
                    </div>
                    <div className="space-y-1">
                      <input 
                        type="number"
                        step="any"
                        placeholder={t('crisis.longitude_placeholder')}
                        value={manualCoords.lng}
                        onChange={(e) => setManualCoords(prev => ({ ...prev, lng: e.target.value }))}
                        onBlur={(e) => validateField('lng', e.target.value)}
                        className={cn(
                          "w-full p-4 bg-white/10 rounded-2xl border border-white/20 font-mono text-sm outline-none focus:border-yellow-400 placeholder:text-white/30",
                          fieldErrors.lng && "border-red-400"
                        )}
                      />
                      {fieldErrors.lng && <p className="text-[8px] text-red-300 font-bold uppercase">{fieldErrors.lng}</p>}
                    </div>
                  </div>
                )}

                {((!currentCoords && !isLocating && !isManualLocation) || (isManualLocation && (!manualCoords.lat || !manualCoords.lng))) && (
                  <p className="text-[10px] text-red-300 font-bold uppercase tracking-widest mt-1">
                    {t('crisis.coords_required')}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest opacity-70">{t('reports.urgency_level')}</label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    type="button"
                    onClick={() => setUrgency('alta')}
                    className={`p-4 rounded-2xl font-black border-2 transition-all ${urgency === 'alta' ? 'bg-yellow-400 text-red-900 border-yellow-400' : 'bg-white/5 border-white/10'}`}
                  >
                    {t('crisis.urgency_high')}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setUrgency('critica')}
                    className={`p-4 rounded-2xl font-black border-2 transition-all ${urgency === 'critica' ? 'bg-white text-red-600 border-white' : 'bg-white/5 border-white/10'}`}
                  >
                    {t('crisis.urgency_critical')}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black uppercase tracking-widest opacity-70">{t('reports.description_label')} ({t('reports.optional')})</label>
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-widest",
                    description.length > 500 ? "text-red-400" : "text-white/40"
                  )}>
                    {description.length}/500
                  </span>
                </div>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={(e) => validateField('description', e.target.value)}
                  rows={3}
                  className={cn(
                    "w-full p-4 bg-white/10 rounded-2xl border border-white/20 font-bold outline-none focus:border-yellow-400 placeholder:text-white/30",
                    fieldErrors.description && "border-red-400"
                  )}
                />
                {fieldErrors.description && (
                  <p className="text-red-300 text-[10px] font-bold uppercase tracking-widest mt-1">{fieldErrors.description}</p>
                )}
              </div>
              <button 
                disabled={isSubmitting || (isLocating && !isManualLocation) || !!fieldErrors.description || (isManualLocation && (!!fieldErrors.lat || !!fieldErrors.lng))}
                className="w-full py-6 bg-yellow-400 text-red-900 rounded-3xl font-black text-xl shadow-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>{t('crisis.sending')}</span>
                  </>
                ) : isLocating && !isManualLocation ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>{t('crisis.getting_gps')}</span>
                  </>
                ) : (
                  t('crisis.send_report')
                )}
              </button>
            </form>
          </motion.div>
        )}

        {activeSection === 'meeting' && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <button onClick={() => setActiveSection('main')} className="flex items-center gap-2 font-bold text-yellow-400">
              <X className="w-5 h-5" /> {t('crisis.back')}
            </button>
            <h2 className="text-3xl font-display font-black uppercase">{t('crisis.meeting_point')}</h2>
            
            <div className="space-y-4">
              <div className="bg-white/10 p-6 rounded-3xl border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Home className="w-6 h-6 text-yellow-400" />
                    <h3 className="font-black text-sm uppercase tracking-widest">{t('crisis.safe_place_defined')}</h3>
                  </div>
                  {isEditingMeeting && (
                    <button onClick={() => setIsEditingMeeting(false)} className="text-xs font-black text-yellow-400">{t('crisis.done')}</button>
                  )}
                </div>
                
                {isEditingMeeting ? (
                  <div className="space-y-3">
                    <input 
                      type="text" 
                      value={meetingPoint.place}
                      onChange={(e) => setMeetingPoint({ ...meetingPoint, place: e.target.value })}
                      placeholder={t('crisis.place_name_placeholder')}
                      className="w-full p-3 bg-red-900/40 rounded-xl border border-red-400/30 font-bold outline-none"
                    />
                  </div>
                ) : (
                  <div className="p-4 bg-red-900/40 rounded-2xl border border-red-400/30">
                    <p className="text-lg font-black">{meetingPoint.place}</p>
                  </div>
                )}
                
                {!isEditingMeeting && (
                  <button 
                    onClick={() => setIsEditingMeeting(true)}
                    className="w-full py-3 bg-white/10 rounded-xl font-bold text-xs"
                  >
                    {t('crisis.change_place')}
                  </button>
                )}
              </div>

              <div className="bg-white/10 p-6 rounded-3xl border border-white/10 space-y-4">
                <div className="flex items-center gap-3">
                  <Users className="w-6 h-6 text-yellow-400" />
                  <h3 className="font-black text-sm uppercase tracking-widest">{t('crisis.emergency_contacts')}</h3>
                </div>
                <div className="space-y-2">
                  {contacts.map((contact: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-red-900/40 rounded-2xl border border-red-400/30">
                      <div>
                        <p className="font-black">{contact.name}</p>
                        <p className="text-xs opacity-70 font-bold">{contact.phone}</p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleEditContact(i)}
                          className="px-4 py-3 bg-white/10 rounded-xl text-yellow-400 flex items-center gap-2 hover:bg-white/20 transition-all border border-yellow-400/30"
                        >
                          <Edit2 className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase tracking-widest">{t('crisis.edit')}</span>
                        </button>
                        <button 
                          onClick={() => setContacts(contacts.filter((_: any, idx: number) => idx !== i))}
                          className="p-3 bg-red-500/20 rounded-xl text-red-200 hover:bg-red-500/30 transition-all border border-red-500/30"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <a href={`tel:${contact.phone.replace(/\s/g, '')}`} className="p-3 bg-emerald-500 rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-900/20">
                          <Phone className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>

                {isAddingContact ? (
                  <div className="p-4 bg-red-900/40 rounded-2xl border border-red-400/30 space-y-3">
                    <input 
                      type="text" 
                      placeholder={t('crisis.name_placeholder')}
                      value={newContact.name}
                      onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                      onBlur={(e) => validateField('contact_name', e.target.value)}
                      className={cn(
                        "w-full p-3 bg-red-800/40 rounded-xl border border-red-400/30 font-bold outline-none",
                        fieldErrors.contact_name && "border-red-300"
                      )}
                    />
                    {fieldErrors.contact_name && (
                      <p className="text-red-300 text-[10px] font-bold uppercase tracking-widest">{fieldErrors.contact_name}</p>
                    )}
                    <input 
                      type="tel" 
                      placeholder={t('crisis.phone_placeholder')}
                      value={newContact.phone}
                      onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                      onBlur={(e) => validateField('contact_phone', e.target.value)}
                      className={cn(
                        "w-full p-3 bg-red-800/40 rounded-xl border border-red-400/30 font-bold outline-none",
                        fieldErrors.contact_phone && "border-red-300"
                      )}
                    />
                    {fieldErrors.contact_phone && (
                      <p className="text-red-300 text-[10px] font-bold uppercase tracking-widest">{fieldErrors.contact_phone}</p>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => {
                        setIsAddingContact(false);
                        setEditingContactIndex(null);
                        setNewContact({ name: '', phone: '' });
                        setFieldErrors(prev => ({ ...prev, contact_name: null, contact_phone: null }));
                      }} className="flex-1 py-3 bg-white/10 rounded-xl font-bold text-xs">{t('crisis.cancel')}</button>
                      <button
                        onClick={handleAddContact}
                        disabled={!newContact.name || !newContact.phone || !!fieldErrors.contact_name || !!fieldErrors.contact_phone}
                        className="flex-1 py-3 bg-yellow-400 text-red-900 rounded-xl font-bold text-xs disabled:opacity-50"
                      >
                        {editingContactIndex !== null ? t('crisis.update') : t('crisis.save')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => {
                      setFieldErrors(prev => ({ ...prev, contact_name: null, contact_phone: null }));
                      setIsAddingContact(true);
                    }}
                    className="w-full py-3 bg-white/10 rounded-xl font-bold text-xs"
                  >
                    {t('crisis.add_contact')}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeSection === 'guide' && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <button onClick={() => setActiveSection('main')} className="flex items-center gap-2 font-bold text-yellow-400">
              <X className="w-5 h-5" /> {t('crisis.back')}
            </button>
            <h2 className="text-3xl font-display font-black uppercase">{t('crisis.cut_guide')}</h2>
            <p className="text-sm font-bold opacity-80">{t('crisis.cut_guide_desc')}</p>
            
            <div className="space-y-6">
              {activeGuideIndex === null ? (
                SERVICE_GUIDES.map((guide, i) => (
                  <button 
                    key={i} 
                    onClick={() => { setActiveGuideIndex(i); setGuideStep(0); }}
                    className="w-full bg-white p-6 rounded-[2.5rem] text-zinc-900 shadow-xl border-l-[12px] border-red-600 flex items-center justify-between group active:scale-95 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-zinc-100 rounded-2xl group-hover:bg-red-50 transition-colors">
                        {guide.icon}
                      </div>
                      <h3 className="text-xl font-display font-black uppercase tracking-tighter">{guide.title}</h3>
                    </div>
                    <ChevronRight className="w-6 h-6 text-zinc-300 group-hover:text-red-600 transition-colors" />
                  </button>
                ))
              ) : (
                <div className="bg-white p-8 rounded-[3rem] text-zinc-900 shadow-2xl space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-4 bg-red-50 rounded-2xl text-red-600">
                        {SERVICE_GUIDES[activeGuideIndex].icon}
                      </div>
                      <h3 className="text-2xl font-display font-black uppercase tracking-tighter">
                        {SERVICE_GUIDES[activeGuideIndex].title}
                      </h3>
                    </div>
                    <button onClick={() => setActiveGuideIndex(null)} className="p-2 bg-zinc-100 rounded-full">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="relative h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <motion.div 
                      className="absolute top-0 left-0 h-full bg-red-600"
                      initial={{ width: 0 }}
                      animate={{ width: `${((guideStep + 1) / SERVICE_GUIDES[activeGuideIndex].steps.length) * 100}%` }}
                    />
                  </div>

                  <div className="min-h-[120px] flex flex-col justify-center text-center space-y-4">
                    <span className="text-[10px] font-black text-red-600 uppercase tracking-[0.3em]">
                      {t('crisis.step_x_of_y').replace('{step}', (guideStep + 1).toString()).replace('{total}', SERVICE_GUIDES[activeGuideIndex].steps.length.toString())}
                    </span>
                    <p className="text-xl font-bold leading-tight">
                      {SERVICE_GUIDES[activeGuideIndex].steps[guideStep]}
                    </p>
                  </div>

                  <div className="bg-red-50 p-6 rounded-3xl border border-red-100 flex items-start gap-4">
                    <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
                    <p className="text-xs font-black text-red-600 uppercase tracking-tight leading-relaxed">
                      {SERVICE_GUIDES[activeGuideIndex].warning}
                    </p>
                  </div>

                  <div className="flex gap-4">
                    <button 
                      disabled={guideStep === 0}
                      onClick={() => setGuideStep(prev => prev - 1)}
                      className="flex-1 py-5 bg-zinc-100 text-zinc-600 rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-30"
                    >
                      {t('crisis.previous')}
                    </button>
                    <button 
                      onClick={() => {
                        if (guideStep < SERVICE_GUIDES[activeGuideIndex].steps.length - 1) {
                          setGuideStep(prev => prev + 1);
                        } else {
                          setActiveGuideIndex(null);
                        }
                      }}
                      className="flex-2 py-5 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-100"
                    >
                      {guideStep < SERVICE_GUIDES[activeGuideIndex].steps.length - 1 ? t('crisis.next') : t('crisis.finish')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

      </main>

      {/* Bottom Status Bar */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-red-800 border-t border-red-500/30 flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest">{t('crisis.signal_active')}</span>
        </div>
        <div className="text-[10px] font-black uppercase tracking-widest opacity-60">
          {t('crisis.version')}
        </div>
      </footer>
    </div>
  );
};
