import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Lock, 
  User, 
  MapPin, 
  Heart, 
  ArrowRight, 
  Loader2, 
  AlertCircle,
  ChevronLeft,
  CheckCircle2,
  Globe,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  updateProfile,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
  ActionCodeSettings
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, cleanFirestoreData } from '../firebase';
import { cn } from '../lib/utils';
import { useSettings } from '../contexts/SettingsContext';

interface AuthScreenProps {
  onClose: () => void;
  initialMode?: 'login' | 'signup';
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onClose, initialMode = 'signup' }) => {
  const { t } = useSettings();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot-password'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [isGoogleOnly, setIsGoogleOnly] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    setError(null);
    setSuccessMessage(null);
    setIsGoogleOnly(false);
    setFieldErrors({});
  }, [mode]);

  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [alias, setAlias] = useState('');
  const [zone, setZone] = useState('');
  const [commitment, setCommitment] = useState('');

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validateField = (name: string, value: string) => {
    let error: string | null = null;
    
    if (name === 'email') {
      if (!value.trim()) error = t('auth.error_email_required');
      else if (!validateEmail(value.trim())) error = t('auth.error_invalid_email_format');
    } else if (name === 'password') {
      if (mode === 'signup') {
        if (value.length < 6) error = t('auth.error_password_min');
      } else {
        if (!value.trim()) error = t('auth.error_password_required');
      }
    } else if (name === 'confirmPassword') {
      if (value !== password) error = t('auth.error_password_mismatch');
    } else if (name === 'alias' || name === 'zone') {
      const trimmed = value.trim();
      if (trimmed.length < 2 || trimmed.length > 40) {
        error = t('validation.name_invalid');
      }
    } else if (name === 'commitment') {
      const trimmed = value.trim();
      if (trimmed.length > 0 && (trimmed.length < 10 || trimmed.length > 500)) {
        error = t('validation.description_min');
      }
    }
    
    setFieldErrors(prev => ({ ...prev, [name]: error }));
    return error;
  };

  const validateForm = () => {
    const errors: Record<string, string | null> = {};
    let hasErrors = false;

    if (mode === 'forgot-password') {
      const emailErr = validateField('email', email);
      if (emailErr) hasErrors = true;
    } else if (mode === 'signup') {
      if (validateField('alias', alias)) hasErrors = true;
      if (validateField('email', email)) hasErrors = true;
      if (validateField('password', password)) hasErrors = true;
      if (validateField('confirmPassword', confirmPassword)) hasErrors = true;
      if (validateField('zone', zone)) hasErrors = true;
      if (validateField('commitment', commitment)) hasErrors = true;
    } else {
      if (validateField('email', email)) hasErrors = true;
      if (validateField('password', password)) hasErrors = true;
    }

    return hasErrors ? t('reports.fill_all_fields') : null;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const trimmedEmail = email.trim();
      if (mode === 'forgot-password') {
        setIsGoogleOnly(false);
        try {
          await sendPasswordResetEmail(auth, trimmedEmail);
          setSuccessMessage(`${t('auth.success_reset_sent')} (${trimmedEmail})`);
        } catch (err: any) {
          console.error("Reset password error:", err);
          if (err.code === 'auth/user-not-found') {
            setError(t('auth.error_user_not_found'));
          } else if (err.code === 'auth/invalid-email') {
            setError(t('auth.error_invalid_email_format'));
          } else if (err.code === 'auth/account-exists-with-different-credential') {
            setIsGoogleOnly(true);
            return;
          } else {
            setError(t('auth.error_reset_failed'));
          }
          setLoading(false);
          return;
        }
        
        // Countdown 60 segundos
        setCountdown(60);
        const timer = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) { clearInterval(timer); return 0; }
            return prev - 1;
          });
        }, 1000);
        return;
      }

      if (mode === 'signup') {
        const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        const user = userCredential.user;

        await updateProfile(user, { displayName: alias });

        // Create Firestore profile
        await setDoc(doc(db, 'users', user.uid), cleanFirestoreData({
          uid: user.uid,
          displayName: alias,
          alias,
          email: trimmedEmail,
          zone,
          commitment,
          role: 'citizen',
          level: 1,
          xp: 0,
          badges: [],
          onboardingCompleted: true,
          createdAt: serverTimestamp()
        }), { merge: true });
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
        const user = userCredential.user;

        // Ensure profile exists on login
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) {
          await setDoc(userDocRef, cleanFirestoreData({
            uid: user.uid,
            displayName: user.displayName || '',
            alias: user.displayName || 'EcoWarrior',
            email: user.email,
            photoURL: user.photoURL || null,
            role: 'citizen',
            level: 1,
            xp: 0,
            createdAt: serverTimestamp()
          }), { merge: true });
        }
      }
      onClose();
    } catch (err: any) {
      console.error("Auth error:", err);
      let message = t('auth.error_unexpected');
      
      if (mode === 'forgot-password' && err.code === 'auth/user-not-found') {
        message = t('auth.error_user_not_found');
      }
      if (mode === 'forgot-password' && err.code === 'auth/invalid-email') {
        message = t('auth.error_invalid_email_format');
      }

      if (err.code === 'auth/email-already-in-use') message = t('auth.error_email_in_use');
      if (err.code === 'auth/invalid-email') message = t('auth.error_invalid_email');
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        message = t('auth.error_invalid_credentials');
      }
      if (err.code === 'auth/too-many-requests') message = t('auth.error_too_many_requests');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // For Google sign up, we might need to ask for zone later if it's a new user
      // But for now, let's ensure a profile exists
      await setDoc(doc(db, 'users', user.uid), cleanFirestoreData({
        uid: user.uid,
        displayName: user.displayName || '',
        alias: user.displayName || 'EcoWarrior',
        email: user.email,
        photoURL: user.photoURL || null,
        role: 'citizen',
        level: 1,
        xp: 0,
        badges: [],
        onboardingCompleted: true,
        createdAt: serverTimestamp()
      }), { merge: true });

      onClose();
    } catch (err: any) {
      console.error("Google Auth error:", err);
      let message = "";
      switch (err.code) {
        case 'auth/unauthorized-domain':
          message = t('auth.error_google_unauthorized');
          break;
        case 'auth/popup-blocked':
          message = t('auth.error_google_popup_blocked');
          break;
        case 'auth/popup-closed-by-user':
          message = t('auth.error_google_popup_closed');
          break;
        case 'auth/cancelled-popup-request':
          message = t('auth.error_google_cancelled');
          break;
        default:
          message = `${err.code}: ${t('auth.error_unexpected')}`;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-stretch sm:items-center justify-center p-0 sm:p-4 bg-white sm:bg-black/60 sm:backdrop-blur-xl overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-[min(100vw,42rem)] sm:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col relative min-h-[100svh] sm:min-h-0 sm:max-h-[90vh] border border-zinc-100 dark:border-slate-800"
      >
        {/* Header */}
        <div className="p-4 sm:p-8 border-b border-zinc-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white z-10">
          <button 
            onClick={mode === 'forgot-password' ? () => setMode('login') : onClose}
            className="p-3 hover:bg-zinc-100 rounded-2xl transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-zinc-500 dark:text-slate-400" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-stormy-teal rounded-xl flex items-center justify-center text-white">
              <Heart className="w-4 h-4 fill-current" />
            </div>
            <span className="font-display font-black tracking-tighter text-xl uppercase text-zinc-900 dark:text-white">EcoWarriors</span>
          </div>
          <div className="w-12" /> {/* Spacer */}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-12 space-y-8 sm:space-y-10">
          <div className="text-center space-y-3 sm:space-y-4">
            <h2 className="text-3xl sm:text-5xl font-display font-black tracking-tighter uppercase leading-none text-zinc-900 dark:text-white">
              {mode === 'signup' ? t('auth.signup_title') : mode === 'forgot-password' ? t('auth.forgot_title') : t('auth.login_title')}
            </h2>
            <p className="text-zinc-500 dark:text-slate-400 font-medium">
              {mode === 'signup' 
                ? t('auth.signup_subtitle') 
                : mode === 'forgot-password'
                ? t('auth.forgot_subtitle')
                : t('auth.login_subtitle')}
            </p>
          {mode === 'forgot-password' && isGoogleOnly && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-[2rem] border-2 border-amber-100 dark:border-amber-900/30 text-amber-800 dark:text-amber-400 text-sm font-medium mt-4 flex items-start gap-4 shadow-xl shadow-amber-500/5"
            >
              <div className="p-3 bg-white rounded-2xl shadow-sm shrink-0">
                <Globe className="w-6 h-6 text-amber-500" />
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500">{t('auth.google_account_detected')}</span>
                  <p className="font-bold leading-relaxed">{t('auth.google_reset_hint')}</p>
                </div>
                <button 
                  onClick={handleGoogleSignIn}
                  className="w-full px-6 py-4 bg-white border-2 border-amber-200 dark:border-amber-900/50 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-all flex items-center justify-center gap-3 shadow-sm"
                >
                  <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" width="20" height="20" loading="lazy" decoding="async" />
                  {t('auth.login_google')}
                </button>
              </div>
            </motion.div>
          )}
          </div>

          <form onSubmit={handleAuth} className="space-y-6" autoComplete="off">
            <div suppressHydrationWarning={true} className="space-y-6">
              <AnimatePresence mode="wait">
              {mode === 'signup' ? (
                <motion.div 
                  key="signup-fields"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 dark:text-slate-500 uppercase tracking-widest ml-4">{t('auth.alias_label')}</label>
                    <div className="relative">
                      <User className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 dark:text-slate-500" />
                      <input 
                        type="text"
                        placeholder={t('auth.alias_placeholder')}
                        value={alias}
                        onChange={(e) => setAlias(e.target.value)}
                        onBlur={(e) => validateField('alias', e.target.value)}
                        className={cn(
                          "theme-input w-full pl-14 pr-5 sm:pr-6 py-4 sm:py-5 border-2 border-transparent focus:border-emerald-action rounded-3xl outline-none transition-all font-bold",
                          fieldErrors.alias && "border-red-500 focus:border-red-500"
                        )}
                      />
                      {fieldErrors.alias && (
                        <p className="text-red-500 text-[10px] font-bold mt-1 ml-4">{fieldErrors.alias}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-400 dark:text-slate-500 uppercase tracking-widest ml-4">{t('auth.zone_label')}</label>
                      <div className="relative">
                        <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 dark:text-slate-500" />
                        <input 
                          type="text"
                          placeholder={t('auth.zone_placeholder')}
                          value={zone}
                          onChange={(e) => setZone(e.target.value)}
                          onBlur={(e) => validateField('zone', e.target.value)}
                          className={cn(
                            "theme-input w-full pl-14 pr-5 sm:pr-6 py-4 sm:py-5 border-2 border-transparent focus:border-emerald-action rounded-3xl outline-none transition-all font-bold",
                            fieldErrors.zone && "border-red-500 focus:border-red-500"
                          )}
                        />
                        {fieldErrors.zone && (
                          <p className="text-red-500 text-[10px] font-bold mt-1 ml-4">{fieldErrors.zone}</p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-400 dark:text-slate-500 uppercase tracking-widest ml-4">{t('auth.commitment_label')}</label>
                      <div className="relative">
                        <CheckCircle2 className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 dark:text-slate-500" />
                        <input 
                          type="text"
                          placeholder={t('auth.commitment_placeholder')}
                          value={commitment}
                          onChange={(e) => setCommitment(e.target.value)}
                          onBlur={(e) => validateField('commitment', e.target.value)}
                          className={cn(
                            "theme-input w-full pl-14 pr-5 sm:pr-6 py-4 sm:py-5 border-2 border-transparent focus:border-emerald-action rounded-3xl outline-none transition-all font-bold",
                            fieldErrors.commitment && "border-red-500 focus:border-red-500"
                          )}
                        />
                        {fieldErrors.commitment && (
                          <p className="text-red-500 text-[10px] font-bold mt-1 ml-4">{fieldErrors.commitment}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-slate-500 uppercase tracking-widest ml-4">{t('auth.email_label')}</label>
              <div className="relative">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 dark:text-slate-500" />
                <input 
                  type="email"
                  placeholder={t('auth.email_placeholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={(e) => validateField('email', e.target.value)}
                  className={cn(
                    "theme-input w-full pl-14 pr-5 sm:pr-6 py-4 sm:py-5 border-2 border-transparent focus:border-emerald-action rounded-3xl outline-none transition-all font-bold",
                    fieldErrors.email && "border-red-500 focus:border-red-500"
                  )}
                  suppressHydrationWarning
                />
                {fieldErrors.email && (
                  <p className="text-red-500 text-[10px] font-bold mt-1 ml-4">{fieldErrors.email}</p>
                )}
              </div>
            </div>

            {mode !== 'forgot-password' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 dark:text-slate-500 uppercase tracking-widest ml-4">{t('auth.password_label')}</label>
                  <div className="relative">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 dark:text-slate-500" />
                    <input 
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onBlur={(e) => validateField('password', e.target.value)}
                      className={cn(
                        "theme-input w-full pl-14 pr-5 sm:pr-6 py-4 sm:py-5 border-2 border-transparent focus:border-emerald-action rounded-3xl outline-none transition-all font-bold",
                        fieldErrors.password && "border-red-500 focus:border-red-500"
                      )}
                      suppressHydrationWarning
                      autoComplete={mode === 'signup' ? "new-password" : "current-password"}
                    />
                    {fieldErrors.password && (
                      <p className="text-red-500 text-[10px] font-bold mt-1 ml-4">{fieldErrors.password}</p>
                    )}
                  </div>
                </div>
                {mode === 'signup' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 dark:text-slate-500 uppercase tracking-widest ml-4">{t('auth.confirm_password_label')}</label>
                    <div className="relative">
                      <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 dark:text-slate-500" />
                      <input 
                        type="password"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onBlur={(e) => validateField('confirmPassword', e.target.value)}
                        className={cn(
                          "theme-input w-full pl-14 pr-5 sm:pr-6 py-4 sm:py-5 border-2 border-transparent focus:border-emerald-action rounded-3xl outline-none transition-all font-bold",
                          fieldErrors.confirmPassword && "border-red-500 focus:border-red-500"
                        )}
                        suppressHydrationWarning
                        autoComplete="new-password"
                      />
                      {fieldErrors.confirmPassword && (
                        <p className="text-red-500 text-[10px] font-bold mt-1 ml-4">{fieldErrors.confirmPassword}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            </div>

            {mode === 'login' && (
              <div className="text-right">
                <button 
                  type="button"
                  onClick={() => setMode('forgot-password')}
                  className="text-xs font-bold text-stormy-teal hover:underline"
                >
                  {t('auth.forgot_password_link')}
                </button>
              </div>
            )}

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold border border-red-100"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </motion.div>
            )}

            {successMessage && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-4 bg-emerald-50 text-emerald-600 rounded-2xl text-sm font-bold border border-emerald-100"
              >
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                {successMessage}
              </motion.div>
            )}

            <button 
              type="submit"
              disabled={loading || countdown > 0}
              className="w-full py-4 sm:py-6 bg-emerald-action text-white rounded-[2rem] font-black text-sm sm:text-lg uppercase tracking-widest shadow-xl shadow-emerald-action/10 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 sm:gap-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  {countdown > 0 
                    ? `${t('auth.resend_in')} ${countdown}s` 
                    : (mode === 'forgot-password' ? t('auth.send_link') : (mode === 'signup' ? t('auth.create_account') : t('auth.login_button')))}
                  <ArrowRight className="w-6 h-6" />
                </>
              )}
            </button>
          </form>

          {mode !== 'forgot-password' && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-100 dark:border-slate-800" />
                </div>
                <div className="relative flex justify-center text-xs uppercase tracking-widest font-black text-zinc-400 dark:text-slate-500">
                  <span className="bg-white px-6">{t('auth.or_continue')}</span>
                </div>
              </div>

              <button 
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-5 bg-white border-2 border-zinc-100 dark:border-slate-800 text-zinc-700 dark:text-white rounded-[2rem] font-black text-sm uppercase tracking-widest hover:bg-zinc-50 transition-all flex items-center justify-center gap-4"
              >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" width="20" height="20" loading="lazy" decoding="async" />
                {t('auth.google_continue')}
              </button>
            </>
          )}

          <div className="text-center">
            <button 
              onClick={() => {
                if (mode === 'forgot-password') {
                  setMode('login');
                } else {
                  setMode(mode === 'signup' ? 'login' : 'signup');
                }
              }}
              className="text-sm font-bold text-zinc-500 hover:text-emerald-action transition-colors"
            >
              {mode === 'signup' 
                ? t('auth.have_account') 
                : mode === 'forgot-password'
                ? t('auth.back_to_login')
                : t('auth.no_account')}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
