import React, { useState } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { usePrinterData } from './hooks/usePrinterData.ts';
import { Navbar } from './components/Navbar.tsx';
import { PrinterCard } from './components/PrinterCard.tsx';
import { PrintersTable } from './components/PrintersTable.tsx';
import { PrinterDetailModal } from './components/PrinterDetailModal.tsx';
import { PrintJobsTable } from './components/PrintJobsTable.tsx';
import { MaterialkasseView } from './components/MaterialkasseView.tsx';
import { StatsView } from './components/StatsView.tsx';
import { MaintenanceModal } from './components/MaintenanceModal.tsx';
import { AddPrinterModal } from './components/AddPrinterModal.tsx';
import { AddJobModal } from './components/AddJobModal.tsx';
import { AssignUserModal } from './components/AssignUserModal.tsx';
import { Printer, PrintJob } from './types/index.ts';
import { Plus, Radio, ShieldAlert, Wrench } from 'lucide-react';

export function App() {
  const {
    printers,
    jobs,
    users,
    stats,
    maintenanceLogs,
    discoveredPrinters,
    connected,
    loading,
    fetchDiscovered,
    assignJob,
    toggleJobPaid,
    settleUser,
    createUser,
    syncMete,
    prices,
    updatePrices,
    deleteJob,
    updateJobDetails,
    addMaintenanceLog,
    addPrinter,
    deletePrinter,
    createManualJob,
  } = usePrinterData();

  const location = useLocation();

  // Modal states
  const [showAddPrinterModal, setShowAddPrinterModal] = useState(false);
  const [showAddJobModal, setShowAddJobModal] = useState(false);
  const [maintenancePrinter, setMaintenancePrinter] = useState<Printer | null>(null);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [assigningJob, setAssigningJob] = useState<PrintJob | null>(null);
  const [detailPrinter, setDetailPrinter] = useState<Printer | null>(null);

  const unpaidTotalCents = stats?.unpaid_balance_cents || 0;
  const unassignedJobs = jobs.filter((j) => j.assigned_user_id === null);

  // Keep detailPrinter in sync with live websocket updates
  const activeDetailPrinter = detailPrinter 
    ? (printers.find(p => p.id === detailPrinter.id) || detailPrinter)
    : null;

  const handleOpenMaintenance = (printer: Printer) => {
    setMaintenancePrinter(printer);
    setShowMaintenanceModal(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      
      {/* Top Navbar */}
      <Navbar
        printers={printers}
        jobs={jobs}
        connected={connected}
        onOpenAddPrinter={() => setShowAddPrinterModal(true)}
        onOpenAddJob={() => setShowAddJobModal(true)}
        unpaidTotalCents={unpaidTotalCents}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        
        {/* Unassigned Prints Alert Banner (if on a different page) */}
        {unassignedJobs.length > 0 && location.pathname !== '/jobs' && (
          <Link 
            to="/jobs"
            className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between cursor-pointer hover:bg-amber-500/15 transition-all shadow-md group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <span className="font-bold text-sm text-slate-100">
                  {unassignedJobs.length} Druckauftrag/Aufträge noch keinem Mitglied zugewiesen!
                </span>
                <p className="text-xs text-slate-400">
                  Weise diese Aufträge zu, damit Materialverbrauch und Kassenbeitrag verrechnet werden.
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-amber-300 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
              Jetzt zuweisen &rarr;
            </span>
          </Link>
        )}

        {/* Declarative React Router Routes */}
        <Routes>
          {/* 1. Printers View */}
          <Route
            path="/"
            element={
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-slate-100 tracking-tight">
                      Drucker im Makerspace
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Live Telemetrie, Düsen- & Betttemperaturen, Access Codes und Druckbett-Kamerabilder
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowAddPrinterModal(true)}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-sm cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      Drucker einbinden
                    </button>
                  </div>
                </div>

                {printers.length === 0 ? (
                  <div className="p-16 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3">
                    <Radio className="h-10 w-10 text-slate-600 mx-auto animate-pulse" />
                    <h3 className="font-bold text-slate-200">Noch keine Drucker eingerichtet</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Klicke auf &quot;Drucker einbinden&quot;, um Bambu Lab Drucker automatisch im lokalen Netzwerk zu erkennen oder per IP & Access Code einzubinden.
                    </p>
                    <button
                      onClick={() => setShowAddPrinterModal(true)}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md cursor-pointer"
                    >
                      Jetzt Drucker provisionieren
                    </button>
                  </div>
                ) : (
                  <PrintersTable
                    printers={printers}
                    onOpenMaintenance={handleOpenMaintenance}
                    onDeletePrinter={deletePrinter}
                    onOpenDetail={(p) => setDetailPrinter(p)}
                  />
                )}
              </div>
            }
          />
          <Route path="/printers" element={<Navigate to="/" replace />} />

          {/* 2. Print Jobs View */}
          <Route
            path="/jobs"
            element={
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-slate-100 tracking-tight">
                      Druckaufträge & Historie
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Zentrale Übersicht aller Drucke, Filamentverbrauch und Mitgliederzuordnung
                    </p>
                  </div>

                  <button
                    onClick={() => setShowAddJobModal(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-sm cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    Manueller Auftrag
                  </button>
                </div>

                <PrintJobsTable
                  jobs={jobs}
                  printers={printers}
                  users={users}
                  prices={prices}
                  onOpenAssignModal={(job) => setAssigningJob(job)}
                  onTogglePaid={toggleJobPaid}
                  onDeleteJob={deleteJob}
                  onUpdateJobDetails={updateJobDetails}
                />
              </div>
            }
          />

          {/* 3. Materialkasse & Mitglieder */}
          <Route
            path="/materialkasse"
            element={
              <MaterialkasseView
                users={users}
                jobs={jobs}
                prices={prices}
                onUpdatePrices={updatePrices}
                onSettleUser={settleUser}
                onCreateUser={createUser}
                onSyncMete={syncMete}
              />
            }
          />

          {/* 4. Statistics */}
          <Route
            path="/stats"
            element={<StatsView stats={stats} />}
          />

          {/* 5. Maintenance View */}
          <Route
            path="/maintenance"
            element={
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-slate-100 tracking-tight">
                      Wartung & Instandhaltung
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Dokumentation und Historie aller Service-Einsätze an den Druckern
                    </p>
                  </div>

                  {printers.length > 0 && (
                    <button
                      onClick={() => {
                        setMaintenancePrinter(printers[0] || null);
                        setShowMaintenanceModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-sm cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      Service eintragen
                    </button>
                  )}
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="space-y-3">
                    {maintenanceLogs.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-500">
                        Noch keine Wartungseinträge vorhanden.
                      </div>
                    ) : (
                      maintenanceLogs.map((log) => (
                        <div
                          key={log.id}
                          className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 mr-2">
                                {log.printer_name || log.printer_id}
                              </span>
                              <span className="font-bold text-slate-100 text-sm">
                                {log.service_type}
                              </span>
                            </div>
                            <span className="text-xs text-slate-400 font-mono">
                              {new Date(log.performed_at).toLocaleDateString('de-DE')}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {log.notes}
                          </p>
                          <div className="text-[11px] text-slate-500">
                            Durchgeführt von: <strong className="text-slate-400 font-medium">{log.performed_by}</strong>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

      </main>

      {/* Modals */}
      {showAddPrinterModal && (
        <AddPrinterModal
          discoveredPrinters={discoveredPrinters}
          onClose={() => setShowAddPrinterModal(false)}
          onRefreshDiscovered={fetchDiscovered}
          onAddPrinter={addPrinter}
        />
      )}

      {showAddJobModal && (
        <AddJobModal
          printers={printers}
          users={users}
          onClose={() => setShowAddJobModal(false)}
          onCreateJob={createManualJob}
        />
      )}

      {showMaintenanceModal && (
        <MaintenanceModal
          printer={maintenancePrinter}
          printers={printers}
          logs={maintenanceLogs}
          onClose={() => {
            setShowMaintenanceModal(false);
            setMaintenancePrinter(null);
          }}
          onAddLog={addMaintenanceLog}
        />
      )}

      {assigningJob && (
        <AssignUserModal
          job={assigningJob}
          users={users}
          onClose={() => setAssigningJob(null)}
          onAssign={assignJob}
          onCreateUser={createUser}
        />
      )}

      {activeDetailPrinter && (
        <PrinterDetailModal
          printer={activeDetailPrinter}
          onClose={() => setDetailPrinter(null)}
          onOpenMaintenance={handleOpenMaintenance}
        />
      )}

    </div>
  );
}
