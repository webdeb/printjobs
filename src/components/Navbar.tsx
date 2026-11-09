import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { 
  Printer as PrinterIcon, 
  Layers, 
  BarChart3, 
  Wrench, 
  Plus, 
  Coins,
  Cpu
} from 'lucide-react';
import { Printer, PrintJob } from '../types/index.ts';

interface NavbarProps {
  printers: Printer[];
  jobs: PrintJob[];
  connected: boolean;
  onOpenAddPrinter: () => void;
  onOpenAddJob: () => void;
  unpaidTotalCents: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  printers,
  jobs,
  connected,
  onOpenAddPrinter,
  onOpenAddJob,
  unpaidTotalCents,
}) => {
  const printingCount = printers.filter((p) => p.status === 'printing').length;
  const idleCount = printers.filter((p) => p.status === 'idle').length;
  const unassignedJobsCount = jobs.filter((j) => j.assigned_user_id === null).length;

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
      isActive
        ? 'bg-emerald-500/15 text-emerald-400 shadow-sm border border-emerald-500/30'
        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
    }`;

  return (
    <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Title */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
              <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <PrinterIcon className="h-5 w-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  PrintJobs
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Makerspace
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                  {connected ? 'Live Sync' : 'Getrennt'}
                </span>
              </div>
            </div>
          </Link>

          {/* Navigation Tabs with React Router NavLink */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
            <NavLink to="/" end className={navLinkClass}>
              <Cpu className="h-4 w-4" />
              Drucker
            </NavLink>

            <NavLink to="/jobs" className={navLinkClass}>
              <Layers className="h-4 w-4" />
              Druckaufträge
            </NavLink>

            <NavLink to="/materialkasse" className={navLinkClass}>
              <Coins className="h-4 w-4" />
              Materialkasse
            </NavLink>

            <NavLink to="/stats" className={navLinkClass}>
              <BarChart3 className="h-4 w-4" />
              Statistiken
            </NavLink>

            <NavLink to="/maintenance" className={navLinkClass}>
              <Wrench className="h-4 w-4" />
              Wartung
            </NavLink>
          </nav>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenAddPrinter}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs tracking-wide transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Drucker hinzufügen</span>
              <span className="sm:hidden">Drucker</span>
            </button>

            <button
              onClick={onOpenAddJob}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-all border border-slate-700 active:scale-95 cursor-pointer"
              title="Manuellen Auftrag erfassen"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Auftrag</span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
