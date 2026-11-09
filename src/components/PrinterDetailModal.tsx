import React, { useState } from 'react';
import { 
  X, 
  Camera, 
  RefreshCw, 
  Flame, 
  ThermometerSnowflake, 
  Disc, 
  Layers, 
  Clock, 
  Copy, 
  Check, 
  Wrench, 
  Wifi, 
  WifiOff, 
  Sparkles,
  Info,
  ShieldCheck
} from 'lucide-react';
import { Printer } from '../types/index.ts';

interface PrinterDetailModalProps {
  printer: Printer;
  onClose: () => void;
  onOpenMaintenance: (printer: Printer) => void;
}

export const PrinterDetailModal: React.FC<PrinterDetailModalProps> = ({
  printer,
  onClose,
  onOpenMaintenance,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [camRefreshKey, setCamRefreshKey] = useState(Date.now());
  const [camLoading, setCamLoading] = useState(true);
  const [camError, setCamError] = useState(false);

  const tel = printer.telemetry;
  const isPrinting = printer.status === 'printing' || (tel?.progress_percent && tel.progress_percent > 0);
  const isOffline = printer.status === 'offline';

  const handleCopyCode = () => {
    if (!printer.access_code) return;
    navigator.clipboard.writeText(printer.access_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleRefreshCamera = () => {
    setCamLoading(true);
    setCamError(false);
    setCamRefreshKey(Date.now());
  };

  // Format remaining time
  const formatTime = (minutes?: number) => {
    if (!minutes || minutes <= 0) return '0 min';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m} min`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl border ${
              isPrinting 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                : isOffline 
                ? 'bg-slate-800 border-slate-700 text-slate-500'
                : 'bg-sky-500/10 border-sky-500/30 text-sky-400'
            }`}>
              <Camera className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-slate-100">{printer.name}</h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                  {printer.make} {printer.model}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isPrinting
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : isOffline
                    ? 'bg-slate-800 text-slate-400 border border-slate-700'
                    : 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isPrinting ? 'bg-emerald-400 animate-ping' : isOffline ? 'bg-slate-500' : 'bg-sky-400'}`} />
                  {printer.status === 'printing' ? 'Druckt' : printer.status === 'idle' ? 'Bereit / Frei' : printer.status}
                </span>
              </div>
              <div className="text-xs text-slate-400 font-mono flex items-center gap-3 mt-1">
                <span className="flex items-center gap-1">
                  {isOffline ? <WifiOff className="h-3 w-3 text-slate-500" /> : <Wifi className="h-3 w-3 text-emerald-400" />}
                  {printer.host}:{printer.port}
                </span>
                <span>•</span>
                <span className="text-slate-400">ID: {printer.id}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          
          {/* Access Code Banner (Openly visible as requested) */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-amber-300/80 font-medium">Access Code (Geräte-Code für Bambu Studio / Handy)</div>
                <div className="text-lg font-mono font-black text-amber-300 tracking-wider">
                  {printer.access_code || 'Kein Code hinterlegt'}
                </div>
              </div>
            </div>

            {printer.access_code && (
              <button
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition-all cursor-pointer"
                title="Code in Zwischenablage kopieren"
              >
                {copiedCode ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Kopiert!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Code kopieren</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Camera Feed Preview */}
          <div className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden shadow-inner">
            <div className="p-3 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-bold text-slate-200">Druckbett Kamera-Vorschau</span>
                <span className="text-[10px] text-slate-400">Prüfen ob das Druckbett frei ist</span>
              </div>
              <button
                onClick={handleRefreshCamera}
                disabled={camLoading}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
              >
                <RefreshCw className={`h-3 w-3 ${camLoading ? 'animate-spin text-emerald-400' : ''}`} />
                <span>Aktualisieren</span>
              </button>
            </div>

            <div className="relative min-h-[260px] bg-slate-950 flex items-center justify-center overflow-hidden">
              <img
                src={`/api/printers/${encodeURIComponent(printer.id)}/camera?t=${camRefreshKey}`}
                alt={`Kamera ${printer.name}`}
                className={`w-full max-h-[380px] object-contain transition-opacity duration-300 ${
                  camLoading || camError ? 'hidden' : 'block'
                }`}
                onLoad={() => {
                  setCamLoading(false);
                  setCamError(false);
                }}
                onError={() => {
                  setCamLoading(false);
                  setCamError(true);
                }}
              />

              {camLoading && (
                <div className="flex flex-col items-center gap-2 py-12 text-slate-400">
                  <RefreshCw className="h-8 w-8 animate-spin text-emerald-400" />
                  <span className="text-xs font-medium">Kamerabild wird abgefragt...</span>
                </div>
              )}

              {camError && !camLoading && (
                <div className="p-6 text-center max-w-lg space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
                    <Camera className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-200">
                      Kamera-Status: {printer.name} ({printer.model})
                    </h4>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      {printer.model?.toLowerCase().includes('x1') || printer.model?.toLowerCase().includes('p001')
                        ? 'Der RTSP-Stream (Port 322) der X1-Serie ist aktuell nicht erreichbar. Prüfe, ob der Drucker eingeschaltet ist und "LAN Mode Liveview" aktiv ist.'
                        : 'Die Modelle P1P, P1S und A1 Mini besitzen einen ESP32-Chip mit dem proprietären ThroughTek (TUTK) P2P-Protokoll auf Port 6000 anstelle eines offenen RTSP-Servers (Port 322 der X1-Serie).'}
                    </p>
                  </div>

                  {/* Bed Status Estimation */}
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-left space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-400" /> Druckbett & Sensor-Status
                    </div>
                    <div className="text-xs flex items-center justify-between">
                      <span className="text-slate-400">Status:</span>
                      <span className={`font-semibold ${printer.status === 'idle' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {printer.status === 'idle' ? 'Bereit / Frei (Kein aktiver Druck)' : 'Druck läuft aktiv'}
                      </span>
                    </div>
                    <div className="text-xs flex items-center justify-between">
                      <span className="text-slate-400">Betttemperatur:</span>
                      <span className="font-mono text-slate-200">
                        {tel?.bed_temp !== undefined ? `${Number(tel.bed_temp).toFixed(1)} °C` : '0.0 °C'}
                        {tel?.bed_temp && tel.bed_temp < 35 ? ' (abgekühlt)' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Quick Tip for live video */}
                  <div className="text-[11px] text-slate-400 bg-emerald-500/5 border border-emerald-500/20 p-2.5 rounded-xl text-left">
                    <span className="font-bold text-emerald-300">Live-Video ansehen:</span> Mit dem Access Code <span className="font-mono font-bold text-amber-300 select-all">{printer.access_code}</span> kannst du den Live-Stream jederzeit direkt in Bambu Studio / Bambu Handy im lokalen Netzwerk öffnen.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Telemetry Sensor Readouts (formatted to 1 decimal place) */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Sensoren & Temperaturen (1 Nachkommastelle)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              
              {/* Nozzle Temp */}
              <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 flex flex-col">
                <span className="text-[11px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-medium">
                  <Flame className="h-4 w-4 text-amber-400" /> Nozzle Temp
                </span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="font-mono font-bold text-xl text-slate-100">
                    {tel?.nozzle_temp !== undefined ? Number(tel.nozzle_temp).toFixed(1) : '0.0'} °C
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    / {tel?.nozzle_target !== undefined ? Number(tel.nozzle_target).toFixed(1) : '0.0'} °C
                  </span>
                </div>
              </div>

              {/* Bed Temp */}
              <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 flex flex-col">
                <span className="text-[11px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-medium">
                  <ThermometerSnowflake className="h-4 w-4 text-sky-400" /> Bett Temp
                </span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="font-mono font-bold text-xl text-slate-100">
                    {tel?.bed_temp !== undefined ? Number(tel.bed_temp).toFixed(1) : '0.0'} °C
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    / {tel?.bed_target !== undefined ? Number(tel.bed_target).toFixed(1) : '0.0'} °C
                  </span>
                </div>
              </div>

              {/* Chamber Temp */}
              <div className="col-span-2 sm:col-span-1 bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 flex flex-col">
                <span className="text-[11px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-medium">
                  <Disc className="h-4 w-4 text-emerald-400" /> Kammer
                </span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="font-mono font-bold text-xl text-slate-100">
                    {tel?.chamber_temp !== undefined && tel.chamber_temp > 0
                      ? `${Number(tel.chamber_temp).toFixed(1)} °C`
                      : '—'}
                  </span>
                </div>
              </div>

            </div>
          </div>

          {/* Current Job Status (if printing) */}
          {isPrinting && tel && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/20 shadow-inner">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-slate-200 truncate max-w-[280px]">
                  {tel.subtask_name || 'Aktiver Druckauftrag'}
                </span>
                <span className="font-bold font-mono text-emerald-400 text-sm">
                  {tel.progress_percent}%
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden p-0.5">
                <div 
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(2, tel.progress_percent))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 mt-2 font-mono">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatTime(tel.remaining_minutes)} verbleibend
                </span>
                <span className="flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5" />
                  Layer {tel.current_layer} / {tel.total_layers}
                </span>
              </div>
            </div>
          )}

          {/* AMS Spools */}
          {tel?.spools && tel.spools.length > 0 && (
            <div>
              <div className="text-xs uppercase font-bold text-slate-400 tracking-wider mb-2 flex items-center justify-between">
                <span>Filament / AMS Slots</span>
                <span className="text-slate-500 font-normal">{tel.spools.length} Spulen geladen</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {tel.spools.map((spool, i) => (
                  <div 
                    key={spool.id || i}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-2 flex items-center gap-2.5"
                  >
                    <div 
                      className="h-4 w-4 rounded-full border border-white/20 shrink-0 shadow-sm"
                      style={{ backgroundColor: spool.color_hex }}
                    />
                    <div className="truncate">
                      <div className="text-xs font-semibold text-slate-200 truncate">
                        {spool.type}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {spool.remaining_percent !== undefined ? `${spool.remaining_percent}%` : 'bereit'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            onClick={() => {
              onClose();
              onOpenMaintenance(printer);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 font-semibold text-xs border border-amber-500/30 transition-all cursor-pointer"
          >
            <Wrench className="h-4 w-4" />
            Wartung öffnen
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
