import React, { useState } from 'react';
import { 
  Flame, 
  Layers, 
  Clock, 
  Wrench, 
  Trash2, 
  Disc, 
  Sparkles,
  ThermometerSnowflake, 
  Wifi, 
  WifiOff,
  Camera,
  Copy,
  Check
} from 'lucide-react';
import { Printer } from '../types/index.ts';

interface PrinterCardProps {
  printer: Printer;
  onOpenMaintenance: (printer: Printer) => void;
  onDeletePrinter: (printerId: string) => void;
  onOpenDetail?: (printer: Printer) => void;
}

export const PrinterCard: React.FC<PrinterCardProps> = ({
  printer,
  onOpenMaintenance,
  onDeletePrinter,
  onOpenDetail,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const tel = printer.telemetry;
  const isPrinting = printer.status === 'printing' || (tel?.progress_percent && tel.progress_percent > 0);
  const isOffline = printer.status === 'offline';

  const handleCopyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!printer.access_code) return;
    navigator.clipboard.writeText(printer.access_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Format remaining time
  const formatTime = (minutes?: number) => {
    if (!minutes || minutes <= 0) return '0 min';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m} min`;
  };

  return (
    <div 
      onClick={() => onOpenDetail && onOpenDetail(printer)}
      className={`relative rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col justify-between cursor-pointer ${
        isPrinting
          ? 'bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 border-emerald-500/40 shadow-xl shadow-emerald-500/5 hover:border-emerald-500/60'
          : isOffline
          ? 'bg-slate-900/40 border-slate-800/60 opacity-75'
          : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
      }`}
    >
      
      {/* Top Header bar */}
      <div className="p-5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                {printer.make} {printer.model}
              </span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wider ${
                printer.adapter_type === 'bambulab'
                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/40'
                  : 'bg-purple-950/80 text-purple-400 border border-purple-800/40'
              }`}>
                {printer.adapter_type}
              </span>
            </div>
            <h3 className="font-bold text-lg text-slate-100 tracking-tight leading-tight">
              {printer.name}
            </h3>
            
            <div className="flex items-center flex-wrap gap-2 text-xs text-slate-400 font-mono mt-1">
              <span className="flex items-center gap-1">
                {isOffline ? <WifiOff className="h-3 w-3 text-slate-500" /> : <Wifi className="h-3 w-3 text-emerald-400" />}
                {printer.host}:{printer.port}
              </span>

              {/* Openly visible Access Code */}
              {printer.access_code && (
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[11px] font-mono font-bold hover:bg-amber-500/20 transition-all cursor-pointer"
                  title="Klicken zum Kopieren des Access Codes"
                >
                  <span>Code: {printer.access_code}</span>
                  {copiedCode ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 text-amber-400/80" />}
                </button>
              )}
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex flex-col items-end gap-1">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide capitalize ${
              isPrinting
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm animate-glow'
                : isOffline
                ? 'bg-slate-800 text-slate-400 border border-slate-700'
                : 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
            }`}>
              <span className={`h-2 w-2 rounded-full ${isPrinting ? 'bg-emerald-400 animate-ping' : isOffline ? 'bg-slate-500' : 'bg-sky-400'}`} />
              {printer.status === 'printing' ? 'Druckt' : printer.status === 'idle' ? 'Bereit' : printer.status}
            </span>
          </div>
        </div>

        {/* Current Job & Progress bar */}
        {isPrinting && tel ? (
          <div className="mt-4 p-3.5 rounded-xl bg-slate-950/80 border border-emerald-500/20 shadow-inner">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-medium text-slate-200 truncate max-w-[200px]" title={tel.subtask_name}>
                {tel.subtask_name || 'Unbenannter Druck'}
              </span>
              <span className="font-bold font-mono text-emerald-400 text-sm">
                {tel.progress_percent}%
              </span>
            </div>

            {/* Progress track */}
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden p-0.5">
              <div 
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500 relative overflow-hidden"
                style={{ width: `${Math.min(100, Math.max(2, tel.progress_percent))}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 font-mono">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-slate-400" />
                {formatTime(tel.remaining_minutes)} verbleibend
              </span>
              <span className="flex items-center gap-1">
                <Layers className="h-3 w-3 text-slate-400" />
                Layer {tel.current_layer} / {tel.total_layers}
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-4 p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 text-center py-5">
            <Sparkles className="h-5 w-5 text-slate-600 mx-auto mb-1" />
            <span className="text-xs text-slate-400 font-medium">
              Kein aktiver Auftrag • Bereit für Druck
            </span>
          </div>
        )}

        {/* Telemetry Sensor Gauges (Formatted to 1 decimal place) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3.5">
          {/* Nozzle Temp */}
          <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/80 flex flex-col">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1 font-medium">
              <Flame className="h-3 w-3 text-amber-400" /> Nozzle
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-mono font-bold text-sm text-slate-100">
                {tel?.nozzle_temp !== undefined ? Number(tel.nozzle_temp).toFixed(1) : '0.0'}°C
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                / {tel?.nozzle_target !== undefined ? Number(tel.nozzle_target).toFixed(1) : '0.0'}°C
              </span>
            </div>
          </div>

          {/* Bed Temp */}
          <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/80 flex flex-col">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1 font-medium">
              <ThermometerSnowflake className="h-3 w-3 text-sky-400" /> Bett
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-mono font-bold text-sm text-slate-100">
                {tel?.bed_temp !== undefined ? Number(tel.bed_temp).toFixed(1) : '0.0'}°C
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                / {tel?.bed_target !== undefined ? Number(tel.bed_target).toFixed(1) : '0.0'}°C
              </span>
            </div>
          </div>

          {/* Chamber / Speed */}
          <div className="col-span-2 sm:col-span-1 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/80 flex flex-col">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1 font-medium">
              <Disc className="h-3 w-3 text-emerald-400" /> Kammer
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-mono font-bold text-sm text-slate-100">
                {tel?.chamber_temp !== undefined && tel.chamber_temp > 0
                  ? `${Number(tel.chamber_temp).toFixed(1)}°C`
                  : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* AMS / Filament Trays Visualization */}
        {tel?.spools && tel.spools.length > 0 && (
          <div className="mt-3.5 pt-3 border-t border-slate-800/60">
            <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider mb-2 flex items-center justify-between">
              <span>Filament / AMS Slots</span>
              <span className="text-slate-400 font-normal">{tel.spools.length} Spulen</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {tel.spools.map((spool, i) => (
                <div 
                  key={spool.id || i}
                  className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-1.5 flex items-center gap-2 hover:border-slate-700 transition-colors"
                  title={`${spool.brand || ''} ${spool.name || spool.type} (${spool.remaining_percent || 100}%)`}
                >
                  <div 
                    className="h-3.5 w-3.5 rounded-full border border-white/20 shrink-0 shadow-sm"
                    style={{ backgroundColor: spool.color_hex }}
                  />
                  <div className="truncate">
                    <div className="text-[11px] font-semibold text-slate-200 truncate leading-tight">
                      {spool.type}
                    </div>
                    {spool.remaining_percent !== undefined && (
                      <div className="text-[9px] text-slate-400 font-mono">
                        {spool.remaining_percent}%
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Card Footer Actions */}
      <div className="p-3 bg-slate-950/40 border-t border-slate-800/80 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenDetail) onOpenDetail(printer);
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-medium transition-colors cursor-pointer"
            title="Kamera & Detailansicht öffnen"
          >
            <Camera className="h-3.5 w-3.5" />
            <span>Kamera & Details</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenMaintenance(printer);
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-slate-300 hover:text-white font-medium transition-colors cursor-pointer"
          >
            <Wrench className="h-3.5 w-3.5 text-amber-400" />
            <span>Wartung</span>
          </button>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Drucker "${printer.name}" wirklich entfernen?`)) {
              onDeletePrinter(printer.id);
            }
          }}
          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
          title="Drucker entfernen"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

    </div>
  );
};
