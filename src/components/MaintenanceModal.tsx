import React, { useState } from 'react';
import { Wrench, X, Plus, Calendar, User, FileText, CheckCircle2 } from 'lucide-react';
import { MaintenanceLog, Printer } from '../types/index.ts';

interface MaintenanceModalProps {
  printer: Printer | null;
  printers: Printer[];
  logs: MaintenanceLog[];
  onClose: () => void;
  onAddLog: (printerId: string, serviceType: string, notes: string, performedBy: string) => Promise<any>;
}

export const MaintenanceModal: React.FC<MaintenanceModalProps> = ({
  printer,
  printers,
  logs,
  onClose,
  onAddLog,
}) => {
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>(printer?.id || (printers[0]?.id || ''));
  const [serviceType, setServiceType] = useState('Düse tauschen / reinigen');
  const [notes, setNotes] = useState('');
  const [performedBy, setPerformedBy] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const filteredLogs = logs.filter((l) => (selectedPrinterId ? l.printer_id === selectedPrinterId : true));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPrinterId || !serviceType || !notes) return;

    setIsSubmitting(true);
    try {
      await onAddLog(selectedPrinterId, serviceType, notes, performedBy || 'Makerspace Mitglied');
      setNotes('');
      setShowAddForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentPrinter = printers.find((p) => p.id === selectedPrinterId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                Wartungsbuch & Service-Historie
              </h3>
              <p className="text-xs text-slate-400">
                Dokumentation von Düsenwechseln, Schmierung, Riemenspannung und Reparaturen
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

        {/* Content area */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          
          {/* Printer Selector & Add Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 font-semibold">Drucker:</label>
              <select
                value={selectedPrinterId}
                onChange={(e) => setSelectedPrinterId(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-slate-700"
              >
                {printers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.model})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-sm self-start sm:self-auto"
            >
              <Plus className="h-4 w-4" />
              {showAddForm ? 'Formular schließen' : 'Wartungseintrag erfassen'}
            </button>
          </div>

          {/* New Maintenance Form */}
          {showAddForm && (
            <form onSubmit={handleSubmit} className="p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/30 space-y-3">
              <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5" />
                Neuen Service-Eintrag für {currentPrinter?.name} anlegen
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Art der Wartung *
                  </label>
                  <select
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Düse tauschen / reinigen">Düse tauschen / reinigen</option>
                    <option value="Carbon-Stangen reinigen & schmieren">Carbon-Stangen reinigen & schmieren</option>
                    <option value="Z-Achsen Spindeln schmieren">Z-Achsen Spindeln schmieren</option>
                    <option value="Riemen nachspannen">Riemen nachspannen</option>
                    <option value="Druckbett nivellieren / PEI reinigen">Druckbett nivellieren / PEI reinigen</option>
                    <option value="Extruder / PTFE-Schlauch prüfen">Extruder / PTFE-Schlauch prüfen</option>
                    <option value="Firmware Update">Firmware Update</option>
                    <option value="Allgemeine Inspektion">Allgemeine Inspektion</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Durchgeführt von
                  </label>
                  <input
                    type="text"
                    placeholder="Name des Mitglieds"
                    value={performedBy}
                    onChange={(e) => setPerformedBy(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Beschreibung / Notizen *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Details zur Wartung (z.B. neue 0.4mm gehärtete Düse verbaut, Bett mit Isopropanol abgewischt)..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all"
                >
                  Eintrag speichern
                </button>
              </div>
            </form>
          )}

          {/* Timeline of Logs */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Historie ({filteredLogs.length} Einträge)
            </h4>

            {filteredLogs.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 bg-slate-950/40 rounded-2xl border border-slate-800/60">
                Noch keine Wartungseinträge für diesen Drucker vorhanden.
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/80 hover:border-slate-700 transition-colors space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Wrench className="h-3.5 w-3.5" />
                      </span>
                      <span className="font-bold text-slate-200 text-sm">
                        {log.service_type}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(log.performed_at).toLocaleDateString('de-DE', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed pl-7">
                    {log.notes}
                  </p>

                  <div className="pl-7 pt-1 flex items-center gap-2 text-[11px] text-slate-500">
                    <User className="h-3 w-3" />
                    <span>Durchgeführt von: <strong className="text-slate-400 font-medium">{log.performed_by}</strong></span>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
