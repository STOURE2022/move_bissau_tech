import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Edit3, Check, Trophy } from 'lucide-react';

/**
 * Barre d'objectif journalier avec gamification.
 * Le chauffeur définit son objectif et voit sa progression en temps réel.
 */
export default function DailyProgress({
  todayEarnings,
  dailyGoal,
  goalProgress,
  goalReached,
  onGoalChange,
  onDismissGoalReached,
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(dailyGoal));

  const saveGoal = () => {
    const val = parseInt(editValue);
    if (val && val >= 1000) {
      onGoalChange(val);
      setEditing(false);
    }
  };

  // Couleur de la barre selon le pourcentage
  const barColor = goalProgress >= 100
    ? 'bg-gradient-to-r from-yellow-400 to-yellow-500'
    : goalProgress >= 70
      ? 'bg-gradient-to-r from-green-400 to-green-500'
      : goalProgress >= 40
        ? 'bg-gradient-to-r from-blue-400 to-brand-500'
        : 'bg-gradient-to-r from-gray-400 to-blue-400';

  return (
    <div className="bg-white rounded-2xl shadow-soft p-4">
      {/* Header objectif */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-yellow-50 rounded-lg flex items-center justify-center">
            <Target size={16} className="text-yellow-600" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Objectif du jour</p>
            {editing ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  className="w-20 text-sm font-bold border-b-2 border-brand-500 outline-none bg-transparent"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && saveGoal()}
                />
                <span className="text-xs text-gray-400">F</span>
                <button onClick={saveGoal} className="ml-1 text-brand-500">
                  <Check size={16} />
                </button>
              </div>
            ) : (
              <p className="text-sm font-bold text-gray-800">
                {dailyGoal.toLocaleString()} F CFA
              </p>
            )}
          </div>
        </div>

        {!editing && (
          <button
            onClick={() => { setEditValue(String(dailyGoal)); setEditing(true); }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
          >
            <Edit3 size={14} />
          </button>
        )}
      </div>

      {/* Barre de progression */}
      <div className="relative mb-2">
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${barColor}`}
            initial={{ width: '0%' }}
            animate={{ width: `${goalProgress}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
        {/* Marqueur de position */}
        {goalProgress > 5 && goalProgress < 95 && (
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full shadow-md border-2 border-brand-500 flex items-center justify-center"
            style={{ left: `calc(${goalProgress}% - 10px)` }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            <span className="text-[8px] font-bold text-brand-600">{goalProgress}%</span>
          </motion.div>
        )}
      </div>

      {/* Montants */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">
          <span className="font-bold text-gray-800">{todayEarnings.toLocaleString()}</span> F gagnés
        </span>
        <span className="text-gray-400">
          {goalProgress >= 100
            ? '🎉 Objectif atteint !'
            : `Reste ${(dailyGoal - todayEarnings).toLocaleString()} F`
          }
        </span>
      </div>

      {/* Célébration quand objectif atteint */}
      <AnimatePresence>
        {goalReached && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="mt-3 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-3 flex items-center gap-3"
          >
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ duration: 0.5, repeat: 2 }}
            >
              <Trophy size={24} className="text-yellow-500" />
            </motion.div>
            <div className="flex-1">
              <p className="font-bold text-yellow-800 text-sm">Bravo !</p>
              <p className="text-xs text-yellow-600">Vous avez atteint votre objectif du jour</p>
            </div>
            <button
              onClick={onDismissGoalReached}
              className="text-yellow-400 hover:text-yellow-600 text-xs"
            >
              OK
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
