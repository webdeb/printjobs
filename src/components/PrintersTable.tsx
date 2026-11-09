import React, { useState } from 'react';
import { 
  Printer, 
  Flame, 
  ThermometerSnowflake, 
  Camera, 
  Copy, 
  Check, 
  Wrench, 
  Wifi, 
  WifiOff, 
  LayoutList, 
  LayoutGrid, 
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import { Printer as PrinterType } from '../types/index.ts';
import { PrinterCard } from './PrinterCard.tsx';

interface PrintersTableProps {
  printers: PrinterType[];
  onOpenMaintenance: (printer: PrinterType) => void;
  onDeletePrinter: (printerId: string) => void;
  onOpenDetail: (printer: PrinterType) => void;
}

type FilterType = 'all' | 'free' | 'printing' | 'offline';
type ViewMode = 'table' | 'grid';

export const PrintersTable: React.FC<PrintersTableProps> = ({
  printers,
  onOpenMaintenance,
  onDeletePrinter,
  onOpenDetail,
}) => {
  const [filter, setFilter] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  const handleCopyCode = (e: React.MouseEvent, printer: PrinterType) => {
    e.stopPropagation();
    if (!printer.access_code) return;
    navigator.clipboard.writeText(printer.access_code);
    setCopiedCodeId(printer.id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  // Counts
  const freePrinters = printers.filter((p) => p.status === 'idle');
  const printingPrinters = printers.filter((p) => p.status === 'printing');
  const offlinePrinters = printers.filter((p) => p.status === 'offline');

  // Filtered list
  const filteredPrinters = printers.filter((printer) => {
    // 1. Status filter
    if (filter === 'free' && printer.status !== 'idle') return false;
    if (filter === 'printing' && printer.status !== 'printing') return false;
    if (filter === 'offline' && printer.status !== 'offline') return false;

    // 2. Search query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchName = printer.name.toLowerCase().includes(q);
      const matchModel = printer.model.toLowerCase().includes(q);
      const matchHost = printer.host.toLowerCase().includes(q);
      const matchCode = printer.access_code?.toLowerCase().includes(q);
      if (!matchName && !matchModel && !matchHost && !matchCode) return false;
    }

    return true;
  });

  return (
    <div className="space-y-4">
      {/* Controls & Filter Bar */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-md">
        
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-slate-800 text-slate-100 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Alle Drucker ({printers.length})
          </button>

          <button
            onClick={() => setFilter('free')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              filter === 'free'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm ring-1 ring-emerald-500/20 font-bold'
                : 'text-emerald-400/80 hover:text-emerald-300 hover:bg-emerald-500/10'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Nur freie Drucker ({freePrinters.length})</span>
          </button>

          <button
            onClick={() => setFilter('printing')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              filter === 'printing'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Druckt ({printingPrinters.length})
          </button>

          {offlinePrinters.length > 0 && (
            <button
              onClick={() => setFilter('offline')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                filter === 'offline'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Offline ({offlinePrinters.length})
            </button>
          )}
        </div>

        {/* Search & View Mode Switcher */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Drucker, Modell oder IP suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'table' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Listen- / Tabellenansicht"
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Kartenansicht"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>

      </div>

      {/* Render Table or Grid */}
      {filteredPrinters.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-2">
          <Filter className="h-8 w-8 text-slate-600 mx-auto" />
          <h4 className="font-bold text-slate-300">Keine Drucker gefunden</h4>
          <p className="text-xs text-slate-500">
            {filter === 'free' 
              ? 'Aktuell ist kein Drucker frei (alle drucken oder sind offline).' 
              : 'Kein Drucker entspricht dem aktuellen Suchfilter.'}
          </p>
          {filter !== 'all' && (
            <button
              onClick={() => { setFilter('all'); setSearchTerm(''); }}
              className="mt-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl"
            >
              Filter zurücksetzen
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-5">
          {filteredPrinters.map((printer) => (
            <PrinterCard
              key={printer.id}
              printer={printer}
              onOpenMaintenance={onOpenMaintenance}
              onDeletePrinter={onDeletePrinter}
              onOpenDetail={onOpenDetail}
            />
          ))}
        </div>
      ) : (
        /* Clean List / Table View */
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Drucker & Modell</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Access Code</th>
                  <th className="py-3 px-4">Netzwerk (Host)</th>
                  <th className="py-3 px-4">Nozzle</th>
                  <th className="py-3 px-4">Bett</th>
                  <th className="py-3 px-4">Aktueller Job / Fortschritt</th>
                  <th className="py-3 px-4 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {filteredPrinters.map((printer) => {
                  const tel = printer.telemetry;
                  const isPrinting = printer.status === 'printing' || (tel?.progress_percent && tel.progress_percent > 0);
                  const isOffline = printer.status === 'offline';
                  const isFree = printer.status === 'idle';

                  return (
                    <tr
                      key={printer.id}
                      onClick={() => onOpenDetail(printer)}
                      className={`hover:bg-slate-800/40 transition-colors cursor-pointer group ${
                        isFree ? 'bg-emerald-500/[0.01]' : ''
                      }`}
                    >
                      {/* Name & Model */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">
                            {printer.name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {printer.model}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          isPrinting
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : isOffline
                            ? 'bg-slate-800 text-slate-400 border border-slate-700'
                            : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${isPrinting ? 'bg-amber-400 animate-ping' : isOffline ? 'bg-slate-500' : 'bg-emerald-400'}`} />
                          {isPrinting ? 'Druckt' : isFree ? 'Frei' : printer.status}
                        </span>
                      </td>

                      {/* Access Code (Openly Visible) */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {printer.access_code ? (
                          <button
                            type="button"
                            onClick={(e) => handleCopyCode(e, printer)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono font-bold text-xs transition-colors cursor-pointer"
                            title="Access Code kopieren"
                          >
                            <span>{printer.access_code}</span>
                            {copiedCodeId === printer.id ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3 text-amber-400/70" />
                            )}
                          </button>
                        ) : (
                          <span className="text-slate-600 font-mono">—</span>
                        )}
                      </td>

                      {/* Host & Port */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                        <span className="flex items-center gap-1">
                          {isOffline ? <WifiOff className="h-3 w-3 text-slate-500" /> : <Wifi className="h-3 w-3 text-emerald-400" />}
                          {printer.host}:{printer.port}
                        </span>
                      </td>

                      {/* Nozzle Temp (1 decimal) */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-slate-200 font-mono">
                          <Flame className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                          <span className="font-bold">
                            {tel?.nozzle_temp !== undefined ? Number(tel.nozzle_temp).toFixed(1) : '0.0'}°C
                          </span>
                          {tel?.nozzle_target ? (
                            <span className="text-[10px] text-slate-500">
                              /{Number(tel.nozzle_target).toFixed(1)}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Bed Temp (1 decimal) */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-slate-200 font-mono">
                          <ThermometerSnowflake className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                          <span className="font-bold">
                            {tel?.bed_temp !== undefined ? Number(tel.bed_temp).toFixed(1) : '0.0'}°C
                          </span>
                          {tel?.bed_target ? (
                            <span className="text-[10px] text-slate-500">
                              /{Number(tel.bed_target).toFixed(1)}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Current Job or Free */}
                      <td className="py-3 px-4">
                        {isPrinting && tel ? (
                          <div className="space-y-1 min-w-[180px] max-w-[240px]">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-semibold text-slate-200 truncate" title={tel.subtask_name}>
                                {tel.subtask_name || 'Druckt'}
                              </span>
                              <span className="font-bold font-mono text-emerald-400">
                                {tel.progress_percent}%
                              </span>
                            </div>
                            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full"
                                style={{ width: `${Math.min(100, Math.max(3, tel.progress_percent))}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-400 text-xs">
                            <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                            <span className="text-slate-300 font-medium">Bereit / Frei</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => onOpenDetail(printer)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-semibold text-xs border border-emerald-500/30 transition-all cursor-pointer"
                            title="Kamerabild abfragen & Details öffnen"
                          >
                            <Camera className="h-3.5 w-3.5" />
                            <span>Kamera</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenMaintenance(printer)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                            title="Wartung"
                          >
                            <Wrench className="h-3.5 w-3.5 text-amber-400" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Drucker "${printer.name}" wirklich entfernen?`)) {
                                onDeletePrinter(printer.id);
                              }
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Drucker entfernen"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
