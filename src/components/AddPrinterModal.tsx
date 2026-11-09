import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  X, 
  Radio, 
  RefreshCw, 
  Check, 
  Wifi, 
  Cpu, 
  ShieldCheck, 
  Sliders
} from 'lucide-react';
import { DiscoveredPrinter, Printer } from '../types/index.ts';

interface AddPrinterModalProps {
  discoveredPrinters: DiscoveredPrinter[];
  onClose: () => void;
  onRefreshDiscovered: () => void;
  onAddPrinter: (data: Partial<Printer>) => Promise<any>;
}

export const AddPrinterModal: React.FC<AddPrinterModalProps> = ({
  discoveredPrinters,
  onClose,
  onRefreshDiscovered,
  onAddPrinter,
}) => {
  const [activeTab, setActiveTab] = useState<'discovered' | 'manual'>('discovered');
  const [selectedDiscovered, setSelectedDiscovered] = useState<DiscoveredPrinter | null>(null);
  const [accessCode, setAccessCode] = useState('');
  
  // Manual Form fields
  const [adapterType, setAdapterType] = useState<'bambulab' | 'snapmaker' | 'prusalink' | 'klipper' | 'generic'>('bambulab');
  const [name, setName] = useState('');
  const [model, setModel] = useState('X1-Carbon');
  const [make, setMake] = useState('Bambu Lab');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(8883);
  const [manualAccessCode, setManualAccessCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    onRefreshDiscovered();
  }, [onRefreshDiscovered]);

  // Adapter defaults
  const handleAdapterChange = (type: 'bambulab' | 'snapmaker' | 'prusalink' | 'klipper' | 'generic') => {
    setAdapterType(type);
    if (type === 'bambulab') {
      setMake('Bambu Lab');
      setModel('X1-Carbon');
      setPort(8883);
    } else if (type === 'snapmaker') {
      setMake('Snapmaker');
      setModel('Snapmaker U1');
      setPort(7125);
    } else if (type === 'prusalink') {
      setMake('Prusa');
      setModel('MK4');
      setPort(80);
    } else if (type === 'klipper') {
      setMake('Voron / Klipper');
      setModel('Voron 2.4');
      setPort(7125);
    } else {
      setMake('Generic');
      setModel('3D Printer');
      setPort(80);
    }
  };

  const handleAddDiscovered = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDiscovered) return;

    setIsSubmitting(true);
    try {
      await onAddPrinter({
        id: selectedDiscovered.id,
        name: selectedDiscovered.name,
        model: selectedDiscovered.model,
        make: selectedDiscovered.make,
        adapter_type: selectedDiscovered.adapter_type as any,
        host: selectedDiscovered.host,
        port: selectedDiscovered.port,
        access_code: accessCode,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !host) return;

    setIsSubmitting(true);
    try {
      const generatedId = `printer-${Date.now().toString(36)}`;
      await onAddPrinter({
        id: generatedId,
        name,
        model,
        make,
        adapter_type: adapterType as any,
        host,
        port: Number(port),
        access_code: manualAccessCode,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                Drucker hinzufügen
              </h3>
              <p className="text-xs text-slate-400">
                Bambu Lab Auto-Erkennung oder manuelle Netzwerk-Konfiguration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-800 px-5 pt-3 gap-4 bg-slate-950/40">
          <button
            onClick={() => {
              setActiveTab('discovered');
              setSelectedDiscovered(null);
            }}
            className={`pb-3 text-xs font-semibold tracking-wide border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'discovered'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="h-4 w-4" />
            Im Netzwerk gefunden ({discoveredPrinters.length})
          </button>

          <button
            onClick={() => setActiveTab('manual')}
            className={`pb-3 text-xs font-semibold tracking-wide border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'manual'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="h-4 w-4" />
            Manuelle Eingabe (IP / Adapter)
          </button>
        </div>

        {/* Tab 1: Discovered Printers */}
        {activeTab === 'discovered' && (
          <div className="p-5 space-y-4">
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Bambu Lab Drucker senden SSDP UDP-Broadcasts auf Port 1990/2021.
              </span>
              <button
                onClick={onRefreshDiscovered}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Neu scannen
              </button>
            </div>

            {/* List of discovered devices */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {discoveredPrinters.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800/80 text-xs text-slate-500">
                  <Radio className="h-6 w-6 mx-auto mb-2 text-slate-600 animate-pulse" />
                  Keine neuen Drucker im lokalen Subnetz entdeckt.
                  <div className="mt-1 text-[11px] text-slate-600">
                    Stelle sicher, dass LAN-Modus am Drucker aktiv ist oder trage die IP manuell ein.
                  </div>
                </div>
              ) : (
                discoveredPrinters.map((p) => {
                  const isSelected = selectedDiscovered?.id === p.id;

                  return (
                    <div
                      key={p.id}
                      onClick={() => !p.already_added && setSelectedDiscovered(p)}
                      className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                        p.already_added
                          ? 'bg-slate-950/30 border-slate-800/40 opacity-60 cursor-not-allowed'
                          : isSelected
                          ? 'bg-emerald-500/10 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/20 cursor-pointer'
                          : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <Wifi className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-xs text-slate-100 flex items-center gap-2">
                            {p.name}
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                              {p.model}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {p.host}:{p.port} • SN: {p.id}
                          </div>
                        </div>
                      </div>

                      <div>
                        {p.already_added ? (
                          <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                            <Check className="h-3 w-3" /> Bereits aktiv
                          </span>
                        ) : isSelected ? (
                          <span className="text-xs font-bold text-emerald-400">
                            Ausgewählt
                          </span>
                        ) : (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors">
                            Hinzufügen
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* If a discovered printer is selected, prompt for access code */}
            {selectedDiscovered && (
              <form onSubmit={handleAddDiscovered} className="p-4 rounded-xl bg-slate-950/90 border border-emerald-500/30 space-y-3 animate-in fade-in">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                  <ShieldCheck className="h-4 w-4" />
                  Access Code für {selectedDiscovered.name} eingeben
                </div>
                <p className="text-[11px] text-slate-400">
                  Den 8-stelligen LAN-Access-Code findest du im Drucker-Display unter <strong>Einstellungen &gt; LAN-Modus</strong>.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    required
                    placeholder="Access Code (z.B. 12345678)"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono tracking-widest"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition-all shadow-sm"
                  >
                    Drucker verbinden
                  </button>
                </div>
              </form>
            )}

          </div>
        )}

        {/* Tab 2: Manual Configuration */}
        {activeTab === 'manual' && (
          <form onSubmit={handleAddManual} className="p-5 space-y-4">
            
            {/* Adapter Type Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Hersteller / Adapter-Typ
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {[
                  { id: 'bambulab', label: 'Bambu Lab', desc: 'MQTT / LAN' },
                  { id: 'snapmaker', label: 'Snapmaker', desc: 'Snapmaker U1 (7125)' },
                  { id: 'prusalink', label: 'Prusa', desc: 'PrusaLink' },
                  { id: 'klipper', label: 'Klipper', desc: 'Moonraker' },
                  { id: 'generic', label: 'Generisch', desc: 'Manuell' },
                ].map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => handleAdapterChange(a.id as any)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      adapterType === a.id
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 ring-1 ring-emerald-500/20'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-xs font-bold">{a.label}</div>
                    <div className="text-[10px] text-slate-500">{a.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Drucker Name im Makerspace *
                </label>
                <input
                  type="text"
                  required
                  placeholder="z.B. Bambu X1C #2 (Werkstatt)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Modell *
                </label>
                <input
                  type="text"
                  required
                  placeholder="z.B. X1-Carbon, P1S, MK4"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  IP-Adresse oder Hostname *
                </label>
                <input
                  type="text"
                  required
                  placeholder="192.168.1.150"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Port
                </label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Access Code / LAN Passwort / API-Key
              </label>
              <input
                type="password"
                placeholder={adapterType === 'bambulab' ? '8-stelliger Bambu LAN Code' : 'API-Schlüssel falls benötigt'}
                value={manualAccessCode}
                onChange={(e) => setManualAccessCode(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-sm"
              >
                Drucker speichern
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
