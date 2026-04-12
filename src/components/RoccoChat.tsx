import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Mission } from '../constants/missions';
import { 
  Send, 
  Mic, 
  Bot, 
  User, 
  Sparkles, 
  ArrowRight, 
  RotateCcw,
  MessageSquare,
  Lightbulb,
  Target,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { cn } from '../lib/utils';

import { useSettings } from '../contexts/SettingsContext';
import { chatWithRocco } from '../services/geminiService';

// --- Types ---

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface EcoMission {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

// --- Constants ---

// --- Main Component ---

interface RoccoChatProps {
  missions?: Mission[];
  onMissionClick?: (mission: Mission) => void;
}

export const RoccoChat: React.FC<RoccoChatProps> = ({ missions: externalMissions, onMissionClick }) => {
  const { t, language, showAlert } = useSettings();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: t('rocco.welcome'),
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const displayMissions = useMemo(() => 
    (externalMissions || []).filter(m => m.status !== 'completed'),
    [externalMissions]
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (text: string = input) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const data = await chatWithRocco(
        [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
        t('rocco.system_instruction').replace('{lang}', language === 'es' ? 'Español' : 'English')
      );

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.text || t('rocco.error_processing'),
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error("Error calling Gemini API:", error);
      const isNetworkError = error.message?.includes('fetch') || 
                             error.message?.includes('network') ||
                             error.name === 'TypeError';
      const errorContent = isNetworkError 
        ? t('rocco.error_connection')  
        : t('rocco.error_processing');
      
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorContent,
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-slate-900 rounded-[2rem] sm:rounded-[3rem] overflow-hidden border-4 border-white dark:border-slate-800 shadow-2xl">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 border-b border-zinc-100 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-stormy-teal rounded-2xl flex items-center justify-center shadow-lg shadow-stormy-teal/20">
            <Bot className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-stormy-teal dark:text-maya-blue uppercase tracking-tight">Rocco</h2>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-emerald-action rounded-full animate-pulse" />
              <span className="text-[9px] sm:text-[10px] font-bold text-zinc-400 dark:text-slate-400 uppercase tracking-widest">{t('rocco.mentor_online')}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setMessages([messages[0]])}
            className="p-2 text-zinc-400 hover:text-stormy-teal hover:bg-stormy-teal/5 rounded-xl transition-all"
            title={t('rocco.reset_chat')}
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col xl:flex-row overflow-hidden min-h-0">
        {/* Chat Area */}
        <div className="flex-[3] flex flex-col min-w-0 h-full border-b xl:border-b-0 xl:border-r border-zinc-100 dark:border-slate-700 overflow-hidden relative">
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scroll-smooth"
          >
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={cn(
                    "flex gap-3 max-w-[95%] sm:max-w-[85%]",
                    msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm",
                    msg.role === 'user' ? "bg-stormy-teal" : "bg-emerald-action/10 dark:bg-emerald-action/20"
                  )}>
                    {msg.role === 'user' ? (
                      <User className="w-4 h-4 text-white" />
                    ) : (
                      <Bot className="w-4 h-4 text-emerald-action" />
                    )}
                  </div>
                  <div className={cn(
                    "p-4 rounded-2xl text-sm leading-relaxed shadow-sm prose prose-sm max-w-none",
                    msg.role === 'user' 
                      ? "bg-stormy-teal text-white rounded-tr-none prose-invert" 
                      : "bg-white dark:bg-slate-800 text-zinc-700 dark:text-slate-200 border border-zinc-100 dark:border-slate-700 rounded-tl-none prose-zinc dark:prose-invert"
                  )}>
                    <Markdown>{msg.content}</Markdown>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-emerald-action/10 rounded-lg flex items-center justify-center animate-pulse">
                  <Bot className="w-4 h-4 text-emerald-action" />
                </div>
                <div className="bg-white dark:bg-slate-800 border border-zinc-100 dark:border-slate-700 p-4 rounded-2xl rounded-tl-none flex gap-1">
                  <div className="w-1.5 h-1.5 bg-emerald-action rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-emerald-action rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-emerald-action rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="shrink-0 p-4 sm:p-6 bg-white dark:bg-slate-800 border-t border-zinc-100 dark:border-slate-700">
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2 mb-4 overflow-x-auto no-scrollbar pb-2">
                {[
                  t('rocco.suggested_1'),
                  t('rocco.suggested_2'),
                  t('rocco.suggested_3'),
                  t('rocco.suggested_4')
                ].map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(q)}
                    className="px-4 py-2 bg-zinc-50 dark:bg-slate-900 hover:bg-stormy-teal/5 text-zinc-600 dark:text-slate-400 hover:text-stormy-teal rounded-xl text-[10px] font-bold border border-zinc-100 dark:border-slate-700 hover:border-stormy-teal/20 transition-all flex items-center gap-2 uppercase tracking-widest whitespace-nowrap"
                  >
                    <Lightbulb className="w-3 h-3" />
                    {q}
                  </button>
                ))}
              </div>
            )}
            <div className="relative flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={t('rocco.placeholder')}
                  className="w-full pl-4 pr-12 py-4 bg-zinc-50 dark:bg-slate-900 border border-zinc-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-stormy-teal transition-all text-sm font-medium dark:text-white"
                />
                <button 
                  onClick={() => {
                    showAlert(t('common.info'), t('rocco.voice_soon'));
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-zinc-400 hover:text-stormy-teal transition-colors"
                  title={t('common.voice_input')}
                >
                  <Mic className="w-5 h-5" />
                </button>
              </div>
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="p-4 bg-stormy-teal text-white rounded-2xl shadow-lg shadow-stormy-teal/20 hover:bg-stormy-teal/90 disabled:opacity-50 disabled:shadow-none transition-all"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar - Missions & Info */}
        <div className="flex-1 bg-white dark:bg-slate-800/90 flex flex-col p-4 sm:p-6 space-y-6 lg:space-y-8 overflow-y-auto min-w-[280px] max-h-[30vh] xl:max-h-none shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-stormy-teal dark:text-maya-blue" />
              <h3 className="text-sm font-black text-stormy-teal dark:text-white uppercase tracking-tight">{t('rocco.missions_title')}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
              {displayMissions.length > 0 ? (
                displayMissions.slice(0, 3).map((m) => (
                  <div
                    key={m.id}
                    onClick={() => onMissionClick ? onMissionClick(m) : handleSend(
                      t('rocco.mission_help')
                        .replace('{title}', t(`mission.title_${m.id}`))
                        .replace('{description}', t(`mission.desc_${m.id}`))
                    )}
                    className="p-4 bg-zinc-50 dark:bg-slate-900 rounded-2xl border border-zinc-100 dark:border-slate-700 group hover:border-stormy-teal/20 dark:hover:border-maya-blue/20 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={cn("p-2 rounded-lg shadow-sm text-white", m.color)}>
                        <m.icon className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-black text-stormy-teal dark:text-maya-blue uppercase tracking-widest">{t(`mission.title_${m.id}`)}</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 dark:text-slate-300 font-medium leading-relaxed line-clamp-2">{t(`mission.desc_${m.id}`)}</p>
                    <div className="mt-3 flex items-center justify-end text-stormy-teal dark:text-maya-blue opacity-0 group-hover:opacity-100 transition-all">
                      <span className="text-[8px] font-black uppercase tracking-widest mr-1">{t('rocco.view_progress')}</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center space-y-3 bg-zinc-50 dark:bg-slate-900 rounded-3xl border border-dashed border-zinc-200 dark:border-slate-700">
                  <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto shadow-sm border dark:border-slate-700">
                    <Sparkles className="w-6 h-6 text-amber-500" />
                  </div>
                  <p className="text-[10px] font-black text-zinc-400 dark:text-slate-500 uppercase tracking-widest px-4">
                    {(externalMissions || []).length > 0 
                      ? t('rocco.all_completed')
                      : t('rocco.no_missions')}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="p-6 bg-stormy-teal rounded-[2rem] text-white relative overflow-hidden shrink-0">
            <Sparkles className="absolute -top-4 -right-4 w-24 h-24 text-white/10 rotate-12" />
            <div className="relative z-10">
              <h4 className="text-sm font-black uppercase tracking-tight mb-2">{t('rocco.tip_title')}</h4>
              <p className="text-xs font-medium leading-relaxed opacity-90">
                {t('rocco.tip_desc')}
              </p>
              {(() => {
                const TIP_TEXT = t('rocco.tip_desc');
                return (
                  <button 
                    onClick={() => handleSend(t('rocco.tip_help').replace('{tip}', TIP_TEXT))}
                    className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-white/20 hover:bg-white/30 px-3 py-2 rounded-xl transition-all"
                  >
                    {t('rocco.learn_more')}
                    <ArrowRight className="w-3 h-3" />
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
