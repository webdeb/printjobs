import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  UserCheck, 
  UserPlus, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  PlayCircle, 
  Coins, 
  Trash2, 
  Printer as PrinterIcon,
  Check,
  X,
  XCircle,
  Pencil,
  SlidersHorizontal,
  Calculator,
  Scale
} from 'lucide-react';
import { PrintJob, Printer, User } from '../types/index.ts';

interface PrintJobsTableProps {
  jobs: PrintJob[];
  printers: Printer[];
  users: User[];
  prices?: Record<string, number>;
  onOpenAssignModal: (job: PrintJob) => void;
  onTogglePaid: (jobId: number, isPaid?: boolean) => void;
  onDeleteJob: (jobId: number) => void;
  onUpdateJobDetails?: (jobId: number, data: { material_type?: string; material_used_grams?: number; cost_cents?: number; total_grams?: number }) => Promise<any>;
}

export const PrintJobsTable: React.FC<PrintJobsTableProps> = ({
  jobs,
  printers,
  users,
  prices = {},
  onOpenAssignModal,
  onTogglePaid,
  onDeleteJob,
  onUpdateJobDetails,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [printerFilter, setPrinterFilter] = useState('all');
  const [assignmentFilter, setAssignmentFilter] = useState('all'); // all | assigned | unassigned
  const [paymentFilter, setPaymentFilter] = useState('all'); // all | paid | unpaid

  // Edit Job State
  const [editingJob, setEditingJob] = useState<PrintJob | null>(null);
  const [editMaterial, setEditMaterial] = useState('PLA');
  const [editGrams, setEditGrams] = useState('40.0');
  const [editCostEur, setEditCostEur] = useState('1.00');
  const [baseTotalGrams, setBaseTotalGrams] = useState(40.0);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const getPricePer100g = (material: string): number => {
    if (!prices || Object.keys(prices).length === 0) return 2.50;
    const clean = material.trim().toUpperCase();
    if (clean.includes('CF') || clean.includes('CARBON')) return prices['PLA-CF'] || 4.00;
    if (clean.includes('PETG')) return prices['PETG'] || 2.80;
    if (clean.includes('TPU') || clean.includes('FLEX')) return prices['TPU'] || 3.50;
    if (clean.includes('ABS') || clean.includes('ASA')) return prices['ABS'] || 3.00;
    if (clean.includes('MATTE')) return prices['PLA Matte'] || prices['PLA'] || 2.50;
    if (clean.includes('PLA')) return prices['PLA'] || 2.50;
    return prices['Standard'] || 2.50;
  };

  const handleOpenEdit = (job: PrintJob) => {
    setEditingJob(job);
    const mat = job.material_type || 'PLA';
    setEditMaterial(mat);

    let meta: any = {};
    try {
      if (job.metadata) meta = JSON.parse(job.metadata);
    } catch {}

    const totalG = meta.totalGrams || (job.material_used_grams > 0 ? job.material_used_grams : 40.0);
    setBaseTotalGrams(totalG);

    const currentG = job.material_used_grams > 0 ? job.material_used_grams : totalG;
    setEditGrams(currentG.toFixed(1));

    const rate = getPricePer100g(mat);
    const cost = job.cost_cents > 0 ? (job.cost_cents / 100).toFixed(2) : ((currentG / 100) * rate).toFixed(2);
    setEditCostEur(cost);
  };

  const handleTotalGramsChange = (newTotalStr: string) => {
    const totalG = parseFloat(newTotalStr) || 0;
    setBaseTotalGrams(totalG);
    if (editingJob && editingJob.status === 'running') {
      let meta: any = {};
      try {
        if (editingJob.metadata) meta = JSON.parse(editingJob.metadata);
      } catch {}
      const pct = meta.progressPercent || 0;
      if (pct > 0 && totalG > 0) {
        const newUsed = Math.max(0.5, Math.round((totalG * (pct / 100)) * 10) / 10);
        setEditGrams(newUsed.toFixed(1));
        const rate = getPricePer100g(editMaterial);
        setEditCostEur(((newUsed / 100) * rate).toFixed(2));
      }
    }
  };

  const handleGramsChange = (newGramsStr: string) => {
    setEditGrams(newGramsStr);
    const g = parseFloat(newGramsStr);
    if (!isNaN(g) && g >= 0) {
      const rate = getPricePer100g(editMaterial);
      setEditCostEur(((g / 100) * rate).toFixed(2));
    }
  };

  const handleMaterialChange = (newMat: string) => {
    setEditMaterial(newMat);
    const g = parseFloat(editGrams);
    if (!isNaN(g) && g >= 0) {
      const rate = getPricePer100g(newMat);
      setEditCostEur(((g / 100) * rate).toFixed(2));
    }
  };

  const applyPercentPreset = (percent: number) => {
    const g = Math.max(1, Math.round((baseTotalGrams * (percent / 100)) * 10) / 10);
    setEditGrams(g.toFixed(1));
    const rate = getPricePer100g(editMaterial);
    setEditCostEur(((g / 100) * rate).toFixed(2));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJob || !onUpdateJobDetails) return;
    const g = parseFloat(editGrams) || 0;
    const c = Math.round((parseFloat(editCostEur) || 0) * 100);
    setIsSavingEdit(true);
    try {
      await onUpdateJobDetails(editingJob.id, {
        material_type: editMaterial,
        material_used_grams: g,
        cost_cents: c,
        total_grams: baseTotalGrams > 0 ? baseTotalGrams : undefined,
      });
      setEditingJob(null);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Filter logic
  const filteredJobs = jobs.filter((j) => {
    if (statusFilter !== 'all' && j.status !== statusFilter) return false;
    if (printerFilter !== 'all' && j.printer_id !== printerFilter) return false;
    if (assignmentFilter === 'assigned' && !j.assigned_user_id) return false;
    if (assignmentFilter === 'unassigned' && j.assigned_user_id) return false;
    if (paymentFilter === 'paid' && !j.is_paid) return false;
    if (paymentFilter === 'unpaid' && j.is_paid) return false;

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const matchName = j.job_name.toLowerCase().includes(s);
      const matchPrinter = (j.printer_name || '').toLowerCase().includes(s);
      const matchUser = (j.assigned_user_name || '').toLowerCase().includes(s);
      const matchMaterial = (j.material_type || '').toLowerCase().includes(s);
      if (!matchName && !matchPrinter && !matchUser && !matchMaterial) return false;
    }

    return true;
  });

  const formatDuration = (seconds: number) => {
    if (!seconds) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-4">
      
      {/* Controls / Filter Bar */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row gap-3 items-center justify-between">
        
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Druckauftrag, Datei, Mitglied suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        {/* Filter Pills / Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-slate-700"
          >
            <option value="all">Alle Status</option>
            <option value="running">Laufend</option>
            <option value="completed">Abgeschlossen</option>
            <option value="cancelled">Abgebrochen</option>
            <option value="failed">Fehlgeschlagen</option>
          </select>

          {/* Printer Filter */}
          <select
            value={printerFilter}
            onChange={(e) => setPrinterFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-slate-700"
          >
            <option value="all">Alle Drucker</option>
            {printers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* User Assignment Filter */}
          <select
            value={assignmentFilter}
            onChange={(e) => setAssignmentFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-slate-700"
          >
            <option value="all">Alle Zuweisungen</option>
            <option value="unassigned">⚠️ Nicht zugewiesen (Offen)</option>
            <option value="assigned">Zugewiesen</option>
          </select>

          {/* Payment Filter */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-slate-700"
          >
            <option value="all">Alle Zahlungen</option>
            <option value="unpaid">Offen (Nicht bezahlt)</option>
            <option value="paid">Bezahlt</option>
          </select>
        </div>

      </div>

      {/* Table Container */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/60 text-slate-400 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-800/80">
              <tr>
                <th className="py-3.5 px-4">Status & Zeit</th>
                <th className="py-3.5 px-4">Auftrag / Datei</th>
                <th className="py-3.5 px-4">Drucker</th>
                <th className="py-3.5 px-4">Material</th>
                <th className="py-3.5 px-4">Verbrauch & Kosten</th>
                <th className="py-3.5 px-4">Mitglied / Zuweisung</th>
                <th className="py-3.5 px-4">Kasse</th>
                <th className="py-3.5 px-4 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    Keine Druckaufträge gefunden.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => {
                  const isCompleted = job.status === 'completed';
                  const isRunning = job.status === 'running';
                  const isCancelled = job.status === 'cancelled';
                  const isFailed = job.status === 'failed';
                  const isAssigned = Boolean(job.assigned_user_id);

                  return (
                    <tr 
                      key={job.id} 
                      className="hover:bg-slate-850/40 transition-colors"
                    >
                      {/* Status & Date */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {isRunning ? (
                            <PlayCircle className="h-4 w-4 text-emerald-400 animate-spin" />
                          ) : isCompleted ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          ) : isCancelled ? (
                            <XCircle className="h-4 w-4 text-amber-400" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-rose-400" />
                          )}
                          <div>
                            <div className={`font-medium capitalize text-xs ${isRunning ? 'text-emerald-300' : isCompleted ? 'text-slate-200' : isCancelled ? 'text-amber-300' : 'text-rose-400'}`}>
                              {isRunning ? 'Druckt...' : isCompleted ? 'Fertig' : isCancelled ? 'Abgebrochen' : 'Fehler'}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {formatDate(job.start_time)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Job name / File */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-100 max-w-[220px] truncate" title={job.job_name}>
                          {job.job_name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3 text-slate-500" />
                          {formatDuration(job.duration_seconds)}
                        </div>
                      </td>

                      {/* Printer */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs text-slate-200">
                          <PrinterIcon className="h-3.5 w-3.5 text-slate-400" />
                          <span className="font-medium">{job.printer_name || job.printer_id}</span>
                        </div>
                        {job.printer_model && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            {job.printer_model}
                          </div>
                        )}
                      </td>

                      {/* Material & Color */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div 
                            className="h-3 w-3 rounded-full border border-white/20 shrink-0 shadow-sm"
                            style={{ backgroundColor: job.material_color_hex }}
                          />
                          <span className="font-semibold text-xs text-slate-200">
                            {job.material_type}
                          </span>
                        </div>
                      </td>

                      {/* Usage & Cost */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {(() => {
                          let meta: any = {};
                          try {
                            if (job.metadata) meta = JSON.parse(job.metadata);
                          } catch {}

                          const totalG = meta.totalGrams || (job.material_used_grams > 0 ? job.material_used_grams : 40.0);
                          const progress = meta.progressPercent !== undefined ? meta.progressPercent : (isRunning ? 25 : 100);
                          const displayGrams = job.material_used_grams > 0 
                            ? job.material_used_grams 
                            : (isRunning ? Math.max(0.5, Math.round((totalG * Math.max(progress, 5) / 100) * 10) / 10) : totalG);

                          return (
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-100 text-xs font-mono">
                                    {displayGrams.toFixed(1)} g
                                  </span>
                                  {isRunning && (
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      / ~{totalG.toFixed(0)}g
                                    </span>
                                  )}
                                  {isFailed && (
                                    <span className="text-[10px] text-rose-400 font-medium">
                                      (Abbruch)
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[11px] text-emerald-400 font-mono font-bold">
                                    {((job.cost_cents || 0) / 100).toFixed(2)} €
                                  </span>
                                  {isRunning && progress !== undefined && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-300 font-mono font-bold">
                                      {progress}%
                                    </span>
                                  )}
                                </div>
                              </div>

                              {onUpdateJobDetails && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(job)}
                                  className="p-1 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-slate-800 transition-colors cursor-pointer"
                                  title="Verbrauch oder Kosten anpassen"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Member Assignment */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isAssigned ? (
                          <button
                            onClick={() => onOpenAssignModal(job)}
                            className="group flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-all text-left"
                            title="Zuweisung ändern"
                          >
                            <div className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center font-bold text-[10px] uppercase">
                              {(job.assigned_user_name || 'U').slice(0, 2)}
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-slate-200 group-hover:text-emerald-300 transition-colors">
                                {job.assigned_user_name}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                Klicken zum Ändern
                              </div>
                            </div>
                          </button>
                        ) : (
                          <button
                            onClick={() => onOpenAssignModal(job)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-all shadow-sm"
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            Mitglied zuweisen
                          </button>
                        )}
                      </td>

                      {/* Cash Box / Paid toggle */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <button
                          onClick={() => onTogglePaid(job.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                            job.is_paid
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25'
                          }`}
                          title={job.is_paid ? 'Klicken um als unbezahlt zu markieren' : 'Klicken um als bezahlt zu markieren'}
                        >
                          {job.is_paid ? (
                            <>
                              <Check className="h-3 w-3 stroke-[3]" />
                              Bezahlt
                            </>
                          ) : (
                            <>
                              <Coins className="h-3 w-3" />
                              Offen
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {onUpdateJobDetails && (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(job)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition-colors"
                              title="Material, Verbrauch & Kosten anpassen"
                            >
                              <SlidersHorizontal className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (confirm(`Auftrag "${job.job_name}" löschen?`)) {
                                onDeleteJob(job.id);
                              }
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Löschen"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Job Modal */}
      {editingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <SlidersHorizontal className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    Verbrauch & Kosten anpassen
                  </h3>
                  <p className="text-xs text-slate-400 truncate max-w-xs">
                    {editingJob.job_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingJob(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Filament / Material
                </label>
                <select
                  value={editMaterial}
                  onChange={(e) => handleMaterialChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  {Object.keys(prices).length > 0 ? (
                    Object.keys(prices).map((m) => (
                      <option key={m} value={m}>
                        {m} ({prices[m]?.toFixed(2)} € / 100g)
                      </option>
                    ))
                  ) : (
                    ['PLA', 'PLA Matte', 'PLA-CF', 'PETG', 'ABS', 'TPU', 'Standard'].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))
                  )}
                </select>
              </div>

              {/* Slicer Total Weight (Modell + Stützen) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Slicer-Gesamtgewicht (Modell + Supports / Infill)
                  </label>
                  <span className="text-[11px] text-emerald-400 font-mono">
                    aus Slicer (100% = {baseTotalGrams.toFixed(1)} g)
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={baseTotalGrams || ''}
                    onChange={(e) => handleTotalGramsChange(e.target.value)}
                    placeholder="z. B. 180"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-slate-100 focus:outline-none focus:border-emerald-500 pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                    g
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Tipp: Der Drucker selbst meldet nur Schichten/Prozent. Trage hier das vom Slicer kalkulierte Gewicht (inkl. Stützen) ein.
                </p>
              </div>

              {/* Current or Final Consumed Grams */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    {editingJob.status === 'running' ? 'Aktuell verbrauchtes Material (Gramm) *' : 'Abzurechnendes Material (Gramm) *'}
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {editingJob.status === 'running' ? 'Berechnet aus Fortschritt' : 'Endgewicht'}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editGrams}
                    onChange={(e) => handleGramsChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-slate-100 focus:outline-none focus:border-emerald-500 pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                    g
                  </span>
                </div>
              </div>

              {/* Presets (100%, 70% Abbruch, 50%, 25%) */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1.5">
                  Schnell-Vorgaben (berechnet aus {baseTotalGrams.toFixed(0)}g Gesamtgewicht):
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: `100% (${baseTotalGrams.toFixed(0)}g)`, pct: 100 },
                    { label: `70% (${(baseTotalGrams * 0.7).toFixed(0)}g)`, pct: 70 },
                    { label: `50% (${(baseTotalGrams * 0.5).toFixed(0)}g)`, pct: 50 },
                    { label: `25% (${(baseTotalGrams * 0.25).toFixed(0)}g)`, pct: 25 },
                  ].map((p) => (
                    <button
                      key={p.pct}
                      type="button"
                      onClick={() => applyPercentPreset(p.pct)}
                      className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 hover:text-emerald-300 transition-colors text-center cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Calculated or Custom Cost in € */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Materialkosten für Kasse (€) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editCostEur}
                    onChange={(e) => setEditCostEur(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-emerald-400 font-bold focus:outline-none focus:border-emerald-500 pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                    €
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Aktiver Tarif: {(getPricePer100g(editMaterial)).toFixed(2)} € / 100g. Betrag kann frei überschrieben werden.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingJob(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all disabled:opacity-50"
                >
                  {isSavingEdit ? 'Speichern...' : 'Kosten speichern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
