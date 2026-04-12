import React, { useState } from 'react';
import { 
  ChevronRight, 
  CheckCircle2, 
  Droplets, 
  Wind, 
  MapPin, 
  Users, 
  ShieldAlert, 
  Info, 
  ArrowRight,
  Heart,
  Activity,
  BookOpen,
  PhoneCall,
  ShieldCheck,
  Languages,
  Sun,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { AuthScreen } from './AuthScreen';
import { useSettings } from '../contexts/SettingsContext';

const TEAM_MEMBERS = [
  { 
    name: 'Martina Wolf', 
    age: 18,
    role: 'landing.team_role_vision', 
    image: 'https://firebasestorage.googleapis.com/v0/b/gemini-drive-1aff6.firebasestorage.app/o/landing%2FWhatsApp%20Image%202026-04-02%20at%2012.12.55.jpeg?alt=media&token=fca48509-3baf-43d6-997f-6cceb8b5323e',
    bio: 'landing.team_bio_vision'
  },
  { 
    name: 'Brunella Pérez Fogonza', 
    age: 16,
    role: 'landing.team_role_leadership', 
    image: 'https://firebasestorage.googleapis.com/v0/b/gemini-drive-1aff6.firebasestorage.app/o/landing%2FWhatsApp%20Image%202026-04-03%20at%2020.51.31.jpeg?alt=media&token=343ca82e-b42d-4548-bbf8-56ba06ca939f',
    bio: 'landing.team_bio_leadership'
  },
  { 
    name: 'Agustina Basualdo', 
    age: 16,
    role: 'landing.team_role_community', 
    image: 'https://firebasestorage.googleapis.com/v0/b/gemini-drive-1aff6.firebasestorage.app/o/landing%2FWhatsApp%20Image%202026-04-07%20at%2018.56.36.jpeg?alt=media&token=23939339-3c46-40b5-b172-b3118d0898f5',
    bio: 'landing.team_bio_community'
  },
  { 
    name: 'Sarah Marquett', 
    age: 16,
    role: 'landing.team_role_edu', 
    image: 'https://firebasestorage.googleapis.com/v0/b/gemini-drive-1aff6.firebasestorage.app/o/landing%2FWhatsApp%20Image%202026-04-06%20at%2007.22.07.jpeg?alt=media&token=6f17e8ed-ad6b-41c3-96f9-53abb411e010',
    bio: 'landing.team_bio_edu'
  },
  { 
    name: 'Delfina Tiberi', 
    age: 15,
    role: 'landing.team_role_analysis', 
    image: 'https://firebasestorage.googleapis.com/v0/b/gemini-drive-1aff6.firebasestorage.app/o/landing%2FWhatsApp%20Image%202026-04-05%20at%2018.31.11.jpeg?alt=media&token=2143b1b3-48f0-4178-adaf-f5f5ef048141',
    bio: 'landing.team_bio_analysis'
  },
];

const ODS_ITEMS = [
  { 
    id: 3, 
    title: 'landing.ods_3_title', 
    icon: Heart, 
    color: 'text-red-500', 
    bg: 'bg-red-50',
    desc: 'landing.ods_3_desc'
  },
  { 
    id: 6, 
    title: 'landing.ods_6_title', 
    icon: Droplets, 
    color: 'text-blue-500', 
    bg: 'bg-blue-50',
    desc: 'landing.ods_6_desc'
  },
  { 
    id: 11, 
    title: 'landing.ods_11_title', 
    icon: MapPin, 
    color: 'text-emerald-500', 
    bg: 'bg-emerald-50',
    desc: 'landing.ods_11_desc'
  },
  { 
    id: 13, 
    title: 'landing.ods_13_title', 
    icon: Wind, 
    color: 'text-sky-500', 
    bg: 'bg-sky-50',
    desc: 'landing.ods_13_desc'
  },
];

export const OnboardingLanding: React.FC = () => {
  const { t, language, setLanguage, darkMode, setDarkMode } = useSettings();
  const [securityChecked, setSecurityChecked] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');

  const handleOpenAuth = (mode: 'login' | 'signup') => {
    setAuthMode(mode);
    setShowAuth(true);
  };

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      <AnimatePresence>
        {showAuth && (
          <AuthScreen 
            onClose={() => setShowAuth(false)} 
            initialMode={authMode} 
          />
        )}
      </AnimatePresence>

      {/* Sticky Header */}
      <header className="fixed top-0 left-0 right-0 z-[100] bg-white/80 backdrop-blur-xl border-b border-zinc-100 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-stormy-teal rounded-2xl flex items-center justify-center text-white shadow-lg shadow-stormy-teal/10">
              <Heart className="w-6 h-6 fill-current" />
            </div>
            <span className="font-display font-black tracking-tighter text-2xl hidden sm:block text-zinc-900">ECOWARRIORS</span>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2.5 bg-zinc-100 rounded-xl text-zinc-500 hover:text-stormy-teal transition-all"
              title={darkMode ? t('landing.light_mode') : t('landing.dark_mode')}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className="flex items-center bg-zinc-100 rounded-xl p-1 mr-2">
              <button 
                onClick={() => setLanguage('es')}
                className={cn(
                  "px-3 py-1.5 text-[10px] font-black rounded-lg transition-all",
                  language === 'es' ? "bg-white text-stormy-teal shadow-sm" : "text-zinc-400 hover:text-zinc-600"
                )}
              >
                ES
              </button>
              <button 
                onClick={() => setLanguage('en')}
                className={cn(
                  "px-3 py-1.5 text-[10px] font-black rounded-lg transition-all",
                  language === 'en' ? "bg-white text-stormy-teal shadow-sm" : "text-zinc-400 hover:text-zinc-600"
                )}
              >
                EN
              </button>
            </div>
            <button 
              onClick={() => handleOpenAuth('login')}
              className="px-5 py-2.5 text-sm font-bold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-white dark:bg-stormy-teal dark:hover:bg-emerald-action dark:shadow-lg dark:shadow-stormy-teal/20 rounded-2xl transition-all focus:outline-none focus:ring-2 focus:ring-emerald-action/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('landing.login')}
            </button>
            <button 
              onClick={() => handleOpenAuth('signup')}
              className="px-6 py-2.5 bg-emerald-action text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-emerald-action/10 hover:scale-105 active:scale-95 transition-all"
            >
              {t('landing.signup')}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-32 pb-12 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150%] h-full bg-gradient-to-b from-stormy-teal/10 to-transparent rounded-full blur-3xl opacity-50" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-10 text-center max-w-4xl mx-auto space-y-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-stormy-teal/10 text-stormy-teal text-xs font-bold uppercase tracking-widest mb-4">
            <Activity className="w-4 h-4" />
            {t('landing.hero_badge')}
          </div>
          
          <h1 className="text-5xl md:text-7xl font-display font-black tracking-tighter text-zinc-900 leading-[0.9] uppercase">
            {t('landing.hero_title_1')} <span className="text-emerald-action">{t('landing.hero_title_2')}</span>, <br />
            <span className="relative">
              {t('landing.hero_title_3')}
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ delay: 1, duration: 1 }}
                className="absolute -bottom-2 left-0 h-3 bg-maya-blue/30 -z-10"
              />
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-zinc-500 font-medium max-w-2xl mx-auto">
            {t('landing.hero_subtitle')}
          </p>

          {/* Team Composition */}
          <div className="pt-12 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 max-w-5xl mx-auto">
            {TEAM_MEMBERS.map((member, idx) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 0.2 + idx * 0.1 }}
                className={cn(
                  "relative aspect-[4/5] rounded-3xl overflow-hidden shadow-xl border-4 border-white",
                  idx % 2 === 0 ? "md:translate-y-4" : "md:-translate-y-4"
                )}
              >
                {member.image ? (
                  <img 
                    src={member.image} 
                    alt={member.name} 
                    className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-stormy-teal to-emerald-600 flex items-center justify-center text-white font-black text-2xl">
                    {member.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity flex flex-col justify-end p-4 text-left">
                  <p className="text-white font-black text-sm uppercase leading-none">{member.name}</p>
                  <p className="text-white/80 text-[10px] font-bold uppercase tracking-tighter">{t(member.role)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div 
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-zinc-300"
        >
          <ChevronRight className="w-8 h-8 rotate-90" />
        </motion.div>
      </section>

      {/* Quiénes Somos */}
      <section className="py-24 px-6 bg-zinc-50">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-display font-black tracking-tighter uppercase">{t('landing.about_title')}</h2>
            <p className="text-zinc-500 max-w-xl mx-auto font-medium">
              {t('landing.about_subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-8">
            {TEAM_MEMBERS.map((member, idx) => (
              <motion.div 
                key={member.name}
                whileHover={{ y: -10 }}
                className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-zinc-100 space-y-4"
              >
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-stormy-teal/10">
                  {member.image ? (
                    <img src={member.image} alt={member.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-stormy-teal to-emerald-600 flex items-center justify-center text-white font-black text-lg">
                      {member.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-black text-lg uppercase tracking-tight">{member.name}</h3>
                  <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mb-1">{member.age} {t('landing.years_old')}</p>
                  <p className="text-stormy-teal text-xs font-bold uppercase tracking-widest mb-2">{t(member.role)}</p>
                  <p className="text-zinc-500 text-sm leading-relaxed">{t(member.bio)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Tu Impacto (ODS) */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="space-y-4">
              <h2 className="text-4xl font-display font-black tracking-tighter uppercase">{t('landing.impact_title')}</h2>
              <p className="text-zinc-500 max-w-xl font-medium">
                {t('landing.impact_subtitle')}
              </p>
            </div>
            <div className="flex gap-2">
              <div className="w-12 h-1 bg-stormy-teal rounded-full" />
              <div className="w-4 h-1 bg-zinc-200 rounded-full" />
              <div className="w-4 h-1 bg-zinc-200 rounded-full" />
            </div>
          </div>

          <div className="flex overflow-x-auto no-scrollbar gap-6 pb-8 -mx-6 px-6">
            {ODS_ITEMS.map((ods) => (
              <motion.div 
                key={ods.id}
                className={cn(
                  "shrink-0 w-64 p-8 rounded-[3rem] space-y-6 transition-all duration-500 !bg-opacity-100",
                  ods.bg
                )}
                style={{ backgroundColor: ods.bg.includes('red') ? '#fef2f2' : ods.bg.includes('blue') ? '#eff6ff' : ods.bg.includes('emerald') ? '#ecfdf5' : '#f0f9ff' }}
              >
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg bg-white", ods.color)}>
                  <ods.icon className="w-8 h-8" />
                </div>
                <div className="space-y-2 !text-zinc-900">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">{t('landing.ods_label')} {ods.id}</p>
                  <h3 className="text-xl font-black uppercase tracking-tight leading-tight">{t(ods.title)}</h3>
                  <p className="text-xs font-medium opacity-70 leading-relaxed">{t(ods.desc)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Educación Hídrica */}
      <section className="py-24 px-6 bg-stormy-teal text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-action/10 rounded-full -mr-48 -mt-48 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-maya-blue/10 rounded-full -ml-48 -mb-48 blur-3xl" />

        <div className="max-w-4xl mx-auto text-center space-y-12 relative z-10">
          <div className="w-20 h-20 bg-white/10 backdrop-blur-xl rounded-3xl flex items-center justify-center mx-auto border border-white/20">
            <BookOpen className="w-10 h-10 text-emerald-action" />
          </div>
          
          <div className="space-y-6">
            <h2 className="text-4xl md:text-5xl font-display font-black tracking-tighter uppercase leading-none">
              {t('landing.edu_title')}
            </h2>
            <p className="text-xl text-emerald-action/80 font-medium leading-relaxed">
              {t('landing.edu_desc')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8">
            {[
              { label: t('landing.stat_obstruction'), value: '70%', desc: t('landing.stat_obstruction_desc') },
              { label: t('landing.stat_prevention'), value: '24h', desc: t('landing.stat_prevention_desc') },
              { label: t('landing.stat_impact'), value: '10x', desc: t('landing.stat_impact_desc') },
            ].map((stat) => (
              <div key={stat.label} className="p-6 bg-white/5 rounded-3xl border border-white/10">
                <p className="text-3xl font-black text-emerald-action">{stat.value}</p>
                <p className="text-xs font-bold uppercase tracking-widest mt-1">{stat.label}</p>
                <p className="text-[10px] text-emerald-action/60 mt-2">{stat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Seguridad */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto bg-zinc-50 p-10 md:p-16 rounded-[4rem] border border-zinc-200 space-y-10">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-stormy-teal rounded-3xl flex items-center justify-center text-white shadow-lg shadow-stormy-teal/10 shrink-0">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-3xl font-display font-black tracking-tighter uppercase">{t('landing.security_title')}</h2>
              <p className="text-zinc-500 font-medium">{t('landing.security_subtitle')}</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-stormy-teal/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-stormy-teal" />
              </div>
              <p className="text-zinc-600 font-medium">{t('landing.security_rule_1')}</p>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-stormy-teal/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-stormy-teal" />
              </div>
              <p className="text-zinc-600 font-medium">{t('landing.security_rule_2')}</p>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-stormy-teal/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-stormy-teal" />
              </div>
              <p className="text-zinc-600 font-medium">{t('landing.security_rule_3')}</p>
            </div>
          </div>

          <button 
            onClick={() => setSecurityChecked(!securityChecked)}
            className={cn(
              "w-full p-6 rounded-3xl border-2 transition-all flex items-center justify-between group",
              securityChecked 
                ? "bg-stormy-teal/5 border-stormy-teal" 
                : "bg-white border-zinc-200 hover:border-zinc-300"
            )}
          >
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all",
                securityChecked ? "bg-stormy-teal border-stormy-teal" : "border-zinc-300"
              )}>
                {securityChecked && <CheckCircle2 className="w-4 h-4 text-white" />}
              </div>
              <span className="font-bold text-zinc-700">{t('landing.security_accept')}</span>
            </div>
          </button>
        </div>
      </section>

      {/* Directorio Útil */}
      <section className="py-24 px-6 bg-zinc-50">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-4xl font-display font-black tracking-tighter uppercase">{t('landing.directory_title')}</h2>
              <p className="text-zinc-500 font-medium">
                {t('landing.directory_subtitle')}
              </p>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              {[
                { label: t('landing.directory_emergencies'), number: '911', icon: PhoneCall },
                { label: t('landing.directory_civil_defense'), number: '103', icon: ShieldAlert },
                { label: t('landing.directory_firefighters'), number: '100', icon: Activity },
              ].map((item) => (
                <div key={item.label} className="bg-white p-4 rounded-2xl border border-zinc-100 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-400">
                      <item.icon className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-zinc-700">{item.label}</span>
                  </div>
                  <span className="text-xl font-black text-stormy-teal">{item.number}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-stormy-teal p-12 rounded-[4rem] text-white space-y-8 shadow-2xl shadow-stormy-teal/10">
            <h3 className="text-3xl font-display font-black tracking-tighter uppercase leading-tight">
              {t('landing.ready_title')}
            </h3>
            <p className="text-emerald-action/80 font-medium">
              {t('landing.ready_desc')}
            </p>
            <button 
              disabled={!securityChecked}
              onClick={() => handleOpenAuth('signup')}
              className={cn(
                "w-full py-6 rounded-3xl font-black text-xl flex items-center justify-center gap-4 transition-all shadow-xl",
                securityChecked 
                  ? "bg-white text-stormy-teal hover:scale-105 active:scale-95" 
                  : "bg-stormy-teal/50 text-white/40 cursor-not-allowed opacity-50"
              )}
            >
              {t('landing.start_now')}
              <ArrowRight className="w-6 h-6" />
            </button>
            {!securityChecked && (
              <p className="text-center text-[10px] font-bold uppercase tracking-widest text-emerald-action/60">
                {t('landing.security_warning')}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-zinc-100 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-8 h-8 bg-stormy-teal rounded-xl flex items-center justify-center text-white">
            <Heart className="w-4 h-4 fill-current" />
          </div>
          <span className="font-display font-black tracking-tighter text-xl">ECOWARRIORS</span>
        </div>
        <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest">
          {t('landing.footer_copy')}
        </p>
      </footer>
    </div>
  );
};
