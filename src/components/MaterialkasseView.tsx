import React, { useState, useEffect } from 'react';
import { 
  Coins, 
  UserPlus, 
  CheckCircle2, 
  AlertCircle, 
  Check, 
  Search, 
  Layers, 
  Scale, 
  Calendar,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  Tag,
  Save,
  Trash2,
  X,
  Plus,
  Info
} from 'lucide-react';
import { User, PrintJob } from '../types/index.ts';

interface MaterialkasseViewProps {
  users: User[];
  jobs: PrintJob[];
  prices?: Record<string, number>;
  onUpdatePrices?: (prices: Record<string, number>) => Promise<any>;
  onSettleUser: (userId: number) => Promise<any>;
  onCreateUser: (name: string, email: string, memberNumber?: string) => Promise<any>;
  onSyncMete?: () => Promise<any>;
}

export const MaterialkasseView: React.FC<MaterialkasseViewProps> = ({
  users,
  jobs,
  prices = {},
  onUpdatePrices,
  onSettleUser,
  onCreateUser,
  onSyncMete,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [localPrices, setLocalPrices] = useState<Record<string, number>>(prices);
  const [isSavingPrices, setIsSavingPrices] = useState(false);
  const [pricingSuccess, setPricingSuccess] = useState(false);
  const [newMaterialName, setNewMaterialName] = useState('');
  const [newMaterialPrice, setNewMaterialPrice] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [memberNum, setMemberNum] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncingMete, setIsSyncingMete] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  useEffect(() => {
    if (prices && Object.keys(prices).length > 0) {
      setLocalPrices(prices);
    }
  }, [prices]);

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.member_number && u.member_number.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalOutstandingCents = users.reduce((acc, u) => acc + (u.unpaid_cents || 0), 0);
  const totalGramsAll = users.reduce((acc, u) => acc + (u.total_grams || 0), 0);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;
    setIsSubmitting(true);
    try {
      await onCreateUser(name, email, memberNum);
      setName('');
      setEmail('');
      setMemberNum('');
      setShowCreateModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSettle = async (user: User) => {
    if (confirm(`Alle offenen Beträge für ${user.name} (${((user.unpaid_cents || 0) / 100).toFixed(2)} €) als bezahlt in der Materialkasse verbuchen?`)) {
      await onSettleUser(user.id);
    }
  };

  const handleSyncMete = async () => {
    if (!onSyncMete) return;
    setIsSyncingMete(true);
    setSyncNotice(null);
    try {
      const res = await onSyncMete();
      setSyncNotice(`Erfolgreich: ${res.total} Mitglieder aus MeTe geladen (${res.added} neu, ${res.updated} aktualisiert)`);
      setTimeout(() => setSyncNotice(null), 6000);
    } catch (err: any) {
      setSyncNotice('Verbindung zu MeTe fehlgeschlagen. Bitte Netzwerk & METE_URL prüfen.');
    } finally {
      setIsSyncingMete(false);
    }
  };

  const handlePriceChange = (material: string, val: string) => {
    const num = parseFloat(val);
    setLocalPrices(prev => ({
      ...prev,
      [material]: isNaN(num) ? 0 : num,
    }));
  };

  const handleAddMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMaterialName.trim()) return;
    const priceNum = parseFloat(newMaterialPrice) || 2.50;
    setLocalPrices(prev => ({
      ...prev,
      [newMaterialName.trim()]: priceNum,
    }));
    setNewMaterialName('');
    setNewMaterialPrice('');
  };

  const handleRemoveMaterial = (material: string) => {
    setLocalPrices(prev => {
      const copy = { ...prev };
      delete copy[material];
      return copy;
    });
  };

  const handleResetDefaultPrices = () => {
    setLocalPrices({
      'PLA': 2.50,
      'PLA Matte': 2.50,
      'PLA-CF': 4.00,
      'PETG': 2.80,
      'ABS': 3.00,
      'TPU': 3.50,
      'Standard': 2.50,
    });
  };

  const handleSavePrices = async () => {
    if (!onUpdatePrices) return;
    setIsSavingPrices(true);
    try {
      await onUpdatePrices(localPrices);
      setPricingSuccess(true);
      setTimeout(() => {
        setPricingSuccess(false);
        setShowPricingModal(false);
      }, 1000);
    } catch {
      alert('Fehler beim Speichern der Preise');
    } finally {
      setIsSavingPrices(false);
    }
  };

  // Jobs for selected user
  const userJobs = selectedUser
    ? jobs.filter((j) => j.assigned_user_id === selectedUser.id)
    : [];

  return (
    <div className="space-y-6">
      
      {/* Top Banner Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Coins className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                Offene Materialkasse
              </div>
              <div className="text-2xl font-bold font-mono text-slate-100 mt-0.5">
                {(totalOutstandingCents / 100).toFixed(2)} €
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Scale className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                Verbrauchtes Material
              </div>
              <div className="text-2xl font-bold font-mono text-slate-100 mt-0.5">
                {(totalGramsAll / 1000).toFixed(2)} kg
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 shadow-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                Makerspace Mitglieder
              </div>
              <div className="text-2xl font-bold font-mono text-slate-100 mt-0.5">
                {users.length}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-sm cursor-pointer"
              title="Neues Mitglied hinzufügen"
            >
              <Plus className="h-4 w-4" />
              <span>Mitglied hinzufügen</span>
            </button>
          </div>
        </div>

      </div>

      {/* Filament Pricing Bar (Overview) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
            <Tag className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200">Aktuelle Filament-Preise</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium">Basis: 100g</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {Object.entries(localPrices).map(([mat, pr]) => (
                <div 
                  key={mat}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono shadow-inner"
                >
                  <span className="font-semibold text-slate-200">{mat}:</span>
                  <span className="text-emerald-400 font-bold">{Number(pr).toFixed(2)} €</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowPricingModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 font-semibold text-xs border border-amber-500/30 transition-all shadow-sm shrink-0 cursor-pointer self-end md:self-center"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Tarife anpassen
        </button>
      </div>

      {syncNotice && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between animate-in fade-in">
          <span>{syncNotice}</span>
          <button onClick={() => setSyncNotice(null)} className="text-emerald-400 hover:text-white font-bold">×</button>
        </div>
      )}

      {/* Main Grid: Member List and Member Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Members List */}
        <div className={`space-y-3 ${selectedUser ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
            <div className="relative flex-1 mr-4">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Mitglied suchen (Name, MeTe ID, E-Mail)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <span className="text-xs text-slate-400 font-medium">
              {filteredUsers.length} Mitglieder
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[700px] overflow-y-auto pr-1">
            {filteredUsers.map((user) => {
              const hasDebt = (user.unpaid_cents || 0) > 0;
              const isSelected = selectedUser?.id === user.id;

              return (
                <div
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                    isSelected
                      ? 'bg-slate-850 border-emerald-500/50 shadow-lg ring-1 ring-emerald-500/30'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.name}
                        className="h-10 w-10 rounded-full border border-slate-700 object-cover bg-slate-800 shrink-0"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : null}
                    {(!user.avatar_url) && (
                      <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-slate-800 to-slate-700 border border-slate-600 flex items-center justify-center font-bold text-sm text-slate-100 uppercase shrink-0">
                        {user.name.slice(0, 2)}
                      </div>
                    )}
                    <div className="truncate">
                      <div className="font-bold text-slate-100 flex items-center gap-2 truncate">
                        <span className="truncate">{user.name}</span>
                        {user.member_number && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 bg-emerald-950/80 text-emerald-400 border border-emerald-800/40 rounded shrink-0">
                            {user.member_number}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 truncate">
                        {user.email}
                      </div>
                    </div>
                  </div>

                  {/* Debt / Settled status */}
                  <div className="shrink-0 flex items-center gap-2">
                    {hasDebt ? (
                      <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                        <Coins className="h-3 w-3" />
                        {((user.unpaid_cents || 0) / 100).toFixed(2)} €
                      </span>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <Check className="h-3 w-3" /> Ausgeglichen
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Member Detail Drawer */}
        {selectedUser && (
          <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h4 className="font-bold text-lg text-slate-100">
                  {selectedUser.name}
                </h4>
                <div className="text-xs text-slate-400">
                  Druckhistorie & Abrechnung
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded-lg"
              >
                Schließen
              </button>
            </div>

            {/* Balances */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400 font-medium">Offener Kassenstand</div>
                <div className="text-xl font-bold font-mono text-amber-400 mt-0.5">
                  {((selectedUser.unpaid_cents || 0) / 100).toFixed(2)} €
                </div>
              </div>
              {(selectedUser.unpaid_cents || 0) > 0 && (
                <button
                  onClick={() => handleSettle(selectedUser)}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition-all shadow-sm"
                >
                  Jetzt abrechnen
                </button>
              )}
            </div>

            {/* List of user prints */}
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
                Zugeordnete Drucke ({userJobs.length})
              </div>
              <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
                {userJobs.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500">
                    Noch keine Drucke für dieses Mitglied erfasst.
                  </div>
                ) : (
                  userJobs.map((j) => (
                    <div
                      key={j.id}
                      className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-200 truncate max-w-[180px]">
                          {j.job_name}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                          <span>{j.material_used_grams.toFixed(1)}g {j.material_type}</span>
                          <span>•</span>
                          <span>{new Date(j.start_time).toLocaleDateString('de-DE')}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-slate-100">
                          {((j.cost_cents || 0) / 100).toFixed(2)} €
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.2 rounded-full ${
                          j.is_paid
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-amber-500/10 text-amber-300'
                        }`}>
                          {j.is_paid ? 'Bezahlt' : 'Offen'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6">
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-4">
              <UserPlus className="h-5 w-5 text-emerald-400" />
              Neues Makerspace Mitglied
            </h3>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="z.B. Lisa Schmidt"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  E-Mail Adresse *
                </label>
                <input
                  type="email"
                  required
                  placeholder="lisa@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mitgliedsnummer / ID
                </label>
                <input
                  type="text"
                  placeholder="MS-110"
                  value={memberNum}
                  onChange={(e) => setMemberNum(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all"
                >
                  Mitglied anlegen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filament Pricing Modal */}
      {showPricingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <SlidersHorizontal className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">
                    Filament-Preise & Tarife
                  </h3>
                  <p className="text-xs text-slate-400">
                    Verwalte die Abrechnungstarife pro 100 Gramm für die Materialkasse
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPricingModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* Informational note */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                <Info className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300 leading-relaxed">
                  <span className="font-semibold text-slate-100">Automatische Kostenkalkulation:</span> Sobald ein Druckauftrag auf einem Bambu Lab oder Snapmaker Drucker fertiggestellt wird, berechnet das System die Kosten anhand des gemessenen Filamentgewichts und diesem Tarif (in Cent gerundet).
                </div>
              </div>

              {/* Material prices grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Materialien & Preise
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Basis: Preis pro 100 Gramm (€)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(localPrices).map(([mat, price]) => {
                    const pricePer100g = Number(price) || 0;
                    const pricePerKg = (pricePer100g * 10).toFixed(2);
                    const isProtected = mat === 'PLA' || mat === 'Standard';

                    return (
                      <div 
                        key={mat}
                        className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between space-y-2 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-200">
                            {mat}
                          </span>
                          {!isProtected && (
                            <button
                              type="button"
                              onClick={() => handleRemoveMaterial(mat)}
                              className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                              title="Material entfernen"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={pricePer100g}
                              onChange={(e) => handlePriceChange(mat, e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-mono text-emerald-400 focus:outline-none focus:border-emerald-500 pr-8"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                              €
                            </span>
                          </div>
                          <span className="text-xs text-slate-400 whitespace-nowrap">
                            / 100g
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500 font-mono flex items-center justify-between pt-1 border-t border-slate-900">
                          <span>~{pricePerKg} €/kg</span>
                          <span>{(pricePer100g / 100).toFixed(3)} €/g</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add New Custom Material */}
              <form onSubmit={handleAddMaterial} className="p-4 rounded-xl bg-slate-950/50 border border-dashed border-slate-800 space-y-3">
                <span className="text-xs font-semibold text-slate-300 block">
                  Weiteren Material-Typ hinzufügen
                </span>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="z.B. TPU 95A, Resin, Glow PLA"
                    value={newMaterialName}
                    onChange={(e) => setNewMaterialName(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <div className="relative w-32">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="2.50"
                      value={newMaterialPrice}
                      onChange={(e) => setNewMaterialPrice(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500 pr-7"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                      €
                    </span>
                  </div>
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition-colors flex items-center justify-center gap-1 shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Hinzufügen
                  </button>
                </div>
              </form>

            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetDefaultPrices}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                Standardwerte wiederherstellen
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPricingModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                >
                  Abbrechen
                </button>

                <button
                  type="button"
                  onClick={handleSavePrices}
                  disabled={isSavingPrices}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {pricingSuccess ? (
                    <>
                      <Check className="h-4 w-4" />
                      Gespeichert!
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      {isSavingPrices ? 'Speichern...' : 'Preise speichern'}
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
