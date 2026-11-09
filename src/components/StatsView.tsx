import React from 'react';
import { 
  BarChart3, 
  Scale, 
  Clock, 
  Layers, 
  Coins, 
  Trophy, 
  Calendar,
  Sparkles
} from 'lucide-react';
import { MakerspaceStats } from '../types/index.ts';

interface StatsViewProps {
  stats: MakerspaceStats | null;
}

export const StatsView: React.FC<StatsViewProps> = ({ stats }) => {
  if (!stats) {
    return (
      <div className="p-12 text-center text-slate-500">
        Statistiken werden geladen...
      </div>
    );
  }

  const materialColors: Record<string, string> = {
    'PLA': 'from-emerald-500 to-teal-400',
    'PLA Matte': 'from-amber-500 to-orange-400',
    'PLA-CF': 'from-slate-600 to-slate-400',
    'PETG': 'from-blue-500 to-cyan-400',
    'ABS': 'from-rose-500 to-pink-400',
    'TPU': 'from-purple-500 to-indigo-400',
  };

  return (
    <div className="space-y-6">
      
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Gesamtaufträge
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Layers className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 font-mono font-extrabold text-3xl text-slate-100">
            {stats.total_jobs}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Über alle Drucker erfasst
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Materialverbrauch
            </span>
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400">
              <Scale className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 font-mono font-extrabold text-3xl text-slate-100">
            {(stats.total_grams / 1000).toFixed(2)} <span className="text-xl font-normal text-slate-400">kg</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {stats.total_grams.toFixed(0)} g Gesamttonnage
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Druckstunden
            </span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 font-mono font-extrabold text-3xl text-slate-100">
            {stats.total_print_hours.toFixed(1)} <span className="text-xl font-normal text-slate-400">h</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Aktive Druckzeit
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Offene Kasse
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Coins className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 font-mono font-extrabold text-3xl text-amber-300">
            {((stats.unpaid_balance_cents || 0) / 100).toFixed(2)} €
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Noch einzuzahlen
          </div>
        </div>

      </div>

      {/* Two Column Grid: Materials Breakdown & Top Users */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Material Type Breakdown */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-emerald-400" />
              Filament-Verbrauch nach Materialtyp
            </h3>
            <span className="text-xs text-slate-400">
              Basis: {stats.total_grams.toFixed(0)} g
            </span>
          </div>

          <div className="space-y-4 pt-2">
            {stats.materials_breakdown.map((m) => {
              const gradient = materialColors[m.material] || 'from-emerald-500 to-teal-400';

              return (
                <div key={m.material} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">
                      {m.material}
                    </span>
                    <span className="font-mono text-slate-400">
                      {m.grams.toFixed(1)} g ({m.percentage}%)
                    </span>
                  </div>
                  <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-500`}
                      style={{ width: `${Math.max(3, m.percentage)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>
              Wird zur Nachbestellung von Bambu Lab Filament-Spulen und Makerspace-Materialkalkulation herangezogen.
            </span>
          </div>
        </div>

        {/* Top Members Leaderboard */}
        <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-400" />
              Top Drucker-Mitglieder
            </h3>
            <span className="text-xs text-slate-400">Rangliste</span>
          </div>

          <div className="space-y-2.5 pt-1">
            {stats.top_users.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Noch keine Zuweisungen erfasst.
              </div>
            ) : (
              stats.top_users.map((user, idx) => (
                <div
                  key={user.user_id}
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs ${
                      idx === 0
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : idx === 1
                        ? 'bg-slate-300/20 text-slate-300 border border-slate-300/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      #{idx + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-200 text-xs">
                        {user.user_name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {user.jobs} Aufträge
                      </div>
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <div className="font-bold text-xs text-slate-100">
                      {user.grams.toFixed(1)} g
                    </div>
                    <div className="text-[10px] text-emerald-400">
                      {((user.cost_cents || 0) / 100).toFixed(2)} €
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Monthly History */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-sky-400" />
            Monatliche Auswertung & Materialkasse
          </h3>
          <span className="text-xs text-slate-400">Historie</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Monat</th>
                <th className="py-2.5 px-3">Aufträge</th>
                <th className="py-2.5 px-3">Verbrauch</th>
                <th className="py-2.5 px-3">Umsatz Materialkasse</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {stats.monthly_breakdown.map((m) => (
                <tr key={m.month} className="hover:bg-slate-850/40 transition-colors">
                  <td className="py-3 px-3 font-semibold text-slate-200 font-sans">
                    {m.month}
                  </td>
                  <td className="py-3 px-3 text-slate-300">
                    {m.jobs}
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-100">
                    {m.grams.toFixed(1)} g
                  </td>
                  <td className="py-3 px-3 font-bold text-emerald-400">
                    {((m.cost_cents || 0) / 100).toFixed(2)} €
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
