import React, { useState } from 'react';
import { Plus, X, Layers } from 'lucide-react';
import { Printer, User } from '../types/index.ts';

interface AddJobModalProps {
  printers: Printer[];
  users: User[];
  onClose: () => void;
  onCreateJob: (jobData: any) => Promise<any>;
}

export const AddJobModal: React.FC<AddJobModalProps> = ({
  printers,
  users,
  onClose,
  onCreateJob,
}) => {
  const [printerId, setPrinterId] = useState(printers[0]?.id || '');
  const [jobName, setJobName] = useState('');
  const [materialType, setMaterialType] = useState('PLA');
  const [materialColorHex, setMaterialColorHex] = useState('#10B981');
  const [grams, setGrams] = useState(65);
  const [durationMins, setDurationMins] = useState(90);
  const [assignedUserId, setAssignedUserId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!printerId || !jobName) return;

    setIsSubmitting(true);
    try {
      await onCreateJob({
        printer_id: printerId,
        job_name: jobName,
        material_type: materialType,
        material_color_hex: materialColorHex,
        material_used_grams: Number(grams),
        duration_seconds: Number(durationMins) * 60,
        assigned_user_id: assignedUserId ? Number(assignedUserId) : null,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6">
        
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Layers className="h-5 w-5 text-emerald-400" />
            Druckauftrag manuell erfassen
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Drucker *
            </label>
            <select
              required
              value={printerId}
              onChange={(e) => setPrinterId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
            >
              {printers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.model})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Dateiname / Modellname *
            </label>
            <input
              type="text"
              required
              placeholder="z.B. Gehaeuse_Boden_v2.3mf"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Material *
              </label>
              <select
                value={materialType}
                onChange={(e) => setMaterialType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="PLA">PLA</option>
                <option value="PLA Matte">PLA Matte</option>
                <option value="PLA-CF">PLA-CF (Carbon)</option>
                <option value="PETG">PETG</option>
                <option value="ABS">ABS</option>
                <option value="TPU">TPU (Flexibel)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Farbe
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={materialColorHex}
                  onChange={(e) => setMaterialColorHex(e.target.value)}
                  className="h-8 w-10 bg-transparent cursor-pointer rounded border border-slate-700"
                />
                <span className="text-xs font-mono text-slate-400">{materialColorHex}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Verbrauch (Gramm) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={grams}
                onChange={(e) => setGrams(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Druckdauer (Minuten)
              </label>
              <input
                type="number"
                value={durationMins}
                onChange={(e) => setDurationMins(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Mitglied direkt zuweisen (optional)
            </label>
            <select
              value={assignedUserId}
              onChange={(e) => setAssignedUserId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
            >
              <option value="">-- Nicht zugewiesen (Offen) --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-sm"
            >
              Auftrag anlegen
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
