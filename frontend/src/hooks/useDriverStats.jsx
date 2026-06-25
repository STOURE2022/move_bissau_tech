import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/client';

/**
 * Hook centralisé pour les statistiques chauffeur.
 * - Gains du jour (temps réel)
 * - Objectif journalier (localStorage)
 * - Timer temps en ligne
 * - Résumé semaine
 */
export function useDriverStats(isOnline = false) {
  // === Historique & gains ===
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);

  // === Timer en ligne ===
  const [onlineSeconds, setOnlineSeconds] = useState(0);
  const timerRef = useRef(null);

  // === Objectif journalier ===
  const [dailyGoal, setDailyGoalState] = useState(() => {
    return parseInt(localStorage.getItem('mb_daily_goal') || '10000');
  });
  const [goalReached, setGoalReached] = useState(false);

  // Charger l'historique
  const loadRides = useCallback(async () => {
    try {
      const data = await api.get('/rides/history');
      setRides(data || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadRides(); }, [loadRides]);

  // === Timer en ligne ===
  useEffect(() => {
    if (isOnline) {
      setOnlineSeconds(0);
      timerRef.current = setInterval(() => {
        setOnlineSeconds(s => s + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isOnline]);

  // Formater le timer
  const formatTimer = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  };

  // === Gains du jour ===
  const today = new Date().toISOString().slice(0, 10);
  const todayRides = rides.filter(r => {
    const rideDate = r.created_at?.slice(0, 10);
    return rideDate === today && (r.status === 'paid' || r.status === 'completed');
  });

  const todayEarnings = todayRides.reduce((sum, r) => sum + (r.agreed_price || 0), 0);
  const todayCommission = todayRides.reduce((sum, r) => sum + (r.commission_amount || 0), 0);
  const todayNet = todayEarnings - todayCommission;
  const todayCount = todayRides.length;

  // === Objectif journalier ===
  const goalProgress = dailyGoal > 0 ? Math.min(100, Math.round((todayEarnings / dailyGoal) * 100)) : 0;

  useEffect(() => {
    if (goalProgress >= 100 && !goalReached && todayEarnings > 0) {
      setGoalReached(true);
    }
  }, [goalProgress, goalReached, todayEarnings]);

  const setDailyGoal = (amount) => {
    setDailyGoalState(amount);
    localStorage.setItem('mb_daily_goal', String(amount));
    setGoalReached(false);
  };

  // === Résumé semaine ===
  const getWeeklyData = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayLabel = d.toLocaleDateString('fr', { weekday: 'short' }).slice(0, 3);

      const dayRides = rides.filter(r => {
        const rideDate = r.created_at?.slice(0, 10);
        return rideDate === dateStr && (r.status === 'paid' || r.status === 'completed');
      });

      const earnings = dayRides.reduce((sum, r) => sum + (r.agreed_price || 0), 0);

      days.push({
        date: dateStr,
        label: i === 0 ? "Auj." : dayLabel,
        earnings,
        rides: dayRides.length,
        isToday: i === 0,
      });
    }
    return days;
  };

  const weeklyData = getWeeklyData();
  const weeklyTotal = weeklyData.reduce((sum, d) => sum + d.earnings, 0);
  const weeklyRides = weeklyData.reduce((sum, d) => sum + d.rides, 0);
  const weeklyMax = Math.max(...weeklyData.map(d => d.earnings), 1);

  return {
    // Chargement
    loading,
    refresh: loadRides,

    // Gains du jour
    todayEarnings,
    todayNet,
    todayCommission,
    todayCount,

    // Objectif
    dailyGoal,
    setDailyGoal,
    goalProgress,
    goalReached,
    setGoalReached,

    // Timer
    onlineSeconds,
    onlineTimer: formatTimer(onlineSeconds),

    // Semaine
    weeklyData,
    weeklyTotal,
    weeklyRides,
    weeklyMax,
  };
}
