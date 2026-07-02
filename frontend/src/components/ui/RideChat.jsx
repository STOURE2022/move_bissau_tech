import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, X } from 'lucide-react';
import api from '../../api/client';
import { useTranslation } from '../../i18n/useTranslation';

// Clés des messages prédéfinis — synchronisées avec le backend
// (apps/rides/chat_messages.py) et l'app Flutter
const QUICK_KEYS = [
  'chat_where_are_you',
  'chat_im_coming',
  'chat_im_here',
  'chat_at_pickup',
  'chat_wait_2min',
  'chat_traffic',
  'chat_call_me',
  'chat_ok',
];

/**
 * Chat passager ↔ chauffeur pendant une course.
 * Bouton avec badge non-lus + panneau bas. Les messages prédéfinis sont
 * affichés dans la langue de l'utilisateur (clé), le texte libre tel quel.
 */
export default function RideChat({ rideId, role }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState(() => new Date().toISOString());
  const listRef = useRef(null);
  const openRef = useRef(false);
  openRef.current = open;

  const renderText = (m) =>
    m.message_key ? t(`chat.${m.message_key}`, m.text) : m.text;

  const load = useCallback(async () => {
    try {
      const data = await api.get(`/rides/${rideId}/messages`);
      if (Array.isArray(data)) {
        setMessages(data);
        // Panneau ouvert : tout est vu
        if (openRef.current && data.length > 0) {
          setLastSeenAt(data[data.length - 1].created_at);
        }
      }
    } catch {}
  }, [rideId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [load]);

  // Défiler en bas à l'ouverture et à chaque nouveau message
  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    if (open && messages.length > 0) {
      setLastSeenAt(messages[messages.length - 1].created_at);
    }
  }, [open, messages.length]);

  const unread = messages.filter(
    m => m.sender_role !== role && m.created_at > lastSeenAt
  ).length;

  const send = async ({ key, text }) => {
    if (sending) return;
    setSending(true);
    try {
      const msg = await api.post(`/rides/${rideId}/messages`, {
        message_key: key || '',
        text: text || '',
      });
      setMessages(prev => [...prev, msg]);
      setInput('');
    } catch {}
    setSending(false);
  };

  return (
    <>
      {/* Bouton d'ouverture avec badge */}
      <button
        onClick={() => setOpen(true)}
        className="relative w-full flex items-center justify-center gap-2 py-2.5 bg-gray-50 border border-gray-200
                   rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
      >
        <MessageCircle size={16} className="text-brand-600" />
        {t('chat.title', 'Messages')}
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-red-500 text-white
                           text-[11px] font-bold rounded-full flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>

      {/* Panneau de chat */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-black/40 z-[2000]"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed left-0 right-0 bottom-0 z-[2001] bg-white rounded-t-3xl shadow-elevated
                         flex flex-col max-h-[75dvh]"
            >
              {/* En-tête */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b">
                <p className="font-bold text-gray-800">
                  💬 {role === 'passenger' ? t('chat.withDriver', 'Chauffeur') : t('chat.withPassenger', 'Passager')}
                </p>
                <button onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-gray-100">
                  <X size={18} className="text-gray-500" />
                </button>
              </div>

              {/* Messages */}
              <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-[180px]">
                {messages.length === 0 && (
                  <p className="text-center text-xs text-gray-400 py-8">
                    {t('chat.empty', 'Envoyez un message rapide ci-dessous')}
                  </p>
                )}
                {messages.map(m => {
                  const mine = m.sender_role === role;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm ${
                        mine
                          ? 'bg-brand-500 text-white rounded-br-md'
                          : 'bg-gray-100 text-gray-800 rounded-bl-md'
                      }`}>
                        {renderText(m)}
                        <p className={`text-[10px] mt-0.5 ${mine ? 'text-white/70' : 'text-gray-400'}`}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Messages rapides */}
              <div className="px-4 py-2 flex gap-2 overflow-x-auto border-t">
                {QUICK_KEYS.map(key => (
                  <button
                    key={key}
                    onClick={() => send({ key })}
                    disabled={sending}
                    className="flex-shrink-0 px-3 py-1.5 bg-brand-50 text-brand-700 text-xs font-medium
                               rounded-full hover:bg-brand-100 transition disabled:opacity-50"
                  >
                    {t(`chat.${key}`)}
                  </button>
                ))}
              </div>

              {/* Saisie libre */}
              <div className="px-4 pb-6 pt-2 flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && input.trim() && send({ text: input.trim() })}
                  placeholder={t('chat.placeholder', 'Écrire un message…')}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                />
                <button
                  onClick={() => input.trim() && send({ text: input.trim() })}
                  disabled={sending || !input.trim()}
                  className="w-11 h-11 bg-brand-500 text-white rounded-xl flex items-center justify-center
                             hover:bg-brand-600 transition disabled:opacity-40"
                >
                  <Send size={17} />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
