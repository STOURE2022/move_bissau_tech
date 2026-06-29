import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Plus, X, Phone, Check, AlertTriangle } from 'lucide-react';

/**
 * Gestion des contacts d'urgence.
 * Stockés dans localStorage. Partagés automatiquement lors d'un SOS.
 */
export default function EmergencyContacts() {
  const [contacts, setContacts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mb_emergency_contacts')) || []; }
    catch { return []; }
  });
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const save = (updated) => {
    setContacts(updated);
    localStorage.setItem('mb_emergency_contacts', JSON.stringify(updated));
  };

  const addContact = () => {
    if (!name.trim() || !phone.trim()) return;
    save([...contacts, { name: name.trim(), phone: phone.trim(), id: Date.now() }]);
    setName(''); setPhone(''); setAdding(false);
  };

  const removeContact = (id) => {
    save(contacts.filter(c => c.id !== id));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-soft overflow-hidden"
    >
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
            <Shield size={16} className="text-red-500" />
          </div>
          <div>
            <p className="font-semibold text-gray-800 text-sm">Contacts d'urgence</p>
            <p className="text-[10px] text-gray-400">Prévenus automatiquement en cas de SOS</p>
          </div>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center hover:bg-brand-100 transition"
          >
            <Plus size={16} className="text-brand-500" />
          </button>
        )}
      </div>

      {/* Liste des contacts */}
      <div className="px-4 pb-3">
        {contacts.length === 0 && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="w-full py-4 border-2 border-dashed border-gray-200 rounded-xl text-center hover:border-gray-300 transition"
          >
            <AlertTriangle size={20} className="mx-auto text-gray-300 mb-1" />
            <p className="text-xs text-gray-400">Ajoutez un contact d'urgence</p>
          </button>
        )}

        <AnimatePresence>
          {contacts.map(c => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0"
            >
              <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center">
                <Phone size={14} className="text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{c.name}</p>
                <p className="text-xs text-gray-400">{c.phone}</p>
              </div>
              <button
                onClick={() => removeContact(c.id)}
                className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center transition"
              >
                <X size={14} className="text-gray-400 hover:text-red-500" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Formulaire ajout */}
        <AnimatePresence>
          {adding && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden pt-2"
            >
              <div className="space-y-2">
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Nom du contact"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand-500"
                />
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="Numéro de téléphone"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={addContact}
                    disabled={!name.trim() || !phone.trim()}
                    className="flex-1 bg-brand-500 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1 disabled:opacity-40"
                  >
                    <Check size={14} /> Ajouter
                  </button>
                  <button
                    onClick={() => { setAdding(false); setName(''); setPhone(''); }}
                    className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
