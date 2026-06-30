import { motion } from 'framer-motion';
import { useTranslation } from '../../i18n/useTranslation';

/**
 * Graphique en barres des 7 derniers jours.
 * SVG pur — pas de librairie externe.
 */
export default function WeeklyChart({ data, maxValue, weeklyTotal, weeklyRides }) {
  const { t } = useTranslation();
  const barWidth = 28;
  const gap = 8;
  const chartHeight = 120;
  const chartWidth = data.length * (barWidth + gap);

  return (
    <div className="bg-white rounded-2xl shadow-soft p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-gray-800">{t('driver.thisWeek', 'Cette semaine')}</p>
          <p className="text-xs text-gray-400">{weeklyRides} {t('driver.ridesCount', 'course')}{weeklyRides > 1 ? 's' : ''}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-extrabold text-brand-600">{weeklyTotal.toLocaleString()} F</p>
          <p className="text-[10px] text-gray-400">{t('driver.weekTotal', 'Total semaine')}</p>
        </div>
      </div>

      {/* Graphique SVG */}
      <div className="flex justify-center overflow-hidden">
        <svg
          width={chartWidth}
          height={chartHeight + 24}
          viewBox={`0 0 ${chartWidth} ${chartHeight + 24}`}
        >
          {data.map((day, i) => {
            const barHeight = maxValue > 0 ? (day.earnings / maxValue) * (chartHeight - 10) : 0;
            const x = i * (barWidth + gap);
            const y = chartHeight - barHeight;

            return (
              <g key={day.date}>
                {/* Fond de la barre (gris) */}
                <rect
                  x={x}
                  y={10}
                  width={barWidth}
                  height={chartHeight - 10}
                  rx={6}
                  fill="#f3f4f6"
                />

                {/* Barre de données */}
                <motion.rect
                  x={x}
                  width={barWidth}
                  rx={6}
                  fill={day.isToday ? '#1B8A4E' : '#86EFAC'}
                  initial={{ y: chartHeight, height: 0 }}
                  animate={{ y, height: Math.max(barHeight, 0) }}
                  transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
                />

                {/* Valeur au-dessus de la barre */}
                {day.earnings > 0 && (
                  <motion.text
                    x={x + barWidth / 2}
                    y={y - 4}
                    textAnchor="middle"
                    fill="#6b7280"
                    fontSize="8"
                    fontWeight="600"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 + i * 0.08 }}
                  >
                    {day.earnings >= 1000 ? `${(day.earnings / 1000).toFixed(0)}k` : day.earnings}
                  </motion.text>
                )}

                {/* Label du jour */}
                <text
                  x={x + barWidth / 2}
                  y={chartHeight + 16}
                  textAnchor="middle"
                  fill={day.isToday ? '#1B8A4E' : '#9ca3af'}
                  fontSize="9"
                  fontWeight={day.isToday ? '700' : '500'}
                >
                  {day.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Légende */}
      <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-brand-500" /> {t('driver.today', "Aujourd'hui")}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-green-300" /> {t('driver.previousDays', 'Jours précédents')}
        </span>
      </div>
    </div>
  );
}
