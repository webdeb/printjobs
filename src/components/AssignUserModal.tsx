import React, { useState } from 'react';
import { X, Search, UserCheck, UserX, UserPlus, Coins, Check } from 'lucide-react';
import { PrintJob, User } from '../types/index.ts';

interface AssignUserModalProps {
  job: PrintJob;
  users: User[];
  onClose: () => void;
  onAssign: (jobId: number, userId: number | null) => Promise<any>;
  onCreateUser: (name: string, email: string, memberNumber?: string) => Promise<any>;
}

export const AssignUserModal: React.FC<AssignUserModalProps> = ({
  job,
  users,
  onClose,
  onAssign,
  onCreateUser,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddUser, setShowAddUser] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newMemberNum, setNewMemberNum] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.member_number && u.member_number.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSelectUser = async (userId: number | null) => {
    setSaving(true);
    try {
      await onAssign(job.id, userId);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAndAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail) return;

    setSaving(true);
    try {
      const created = await onCreateUser(newName, newEmail, newMemberNum);
      if (created?.id) {
        await onAssign(job.id, created.id);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-emerald-400" />
              Auftrag Mitglied zuweisen
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-sm">
              <span className="font-semibold text-slate-200">{job.job_name}</span> • {job.material_used_grams}g ({((job.cost_cents || 0) / 100).toFixed(2)} €)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          
          {/* Quick toggle between select and create */}
          <div className="flex items-center justify-between">
            <div className="relative flex-1 mr-3">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Mitglied suchen (Name, E-Mail)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <button
              onClick={() => setShowAddUser(!showAddUser)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors shrink-0"
            >
              <UserPlus className="h-4 w-4 text-emerald-400" />
              {showAddUser ? 'Liste' : 'Neu'}
            </button>
          </div>

          {/* New User Inline Form */}
          {showAddUser && (
            <form onSubmit={handleCreateAndAssign} className="p-4 bg-slate-950/80 border border-emerald-500/20 rounded-xl space-y-3">
              <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <UserPlus className="h-3.5 w-3.5" />
                Neues Mitglied anlegen & direkt zuweisen
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Vollständiger Name *"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <input
                  type="email"
                  placeholder="E-Mail Adresse *"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <input
                  type="text"
                  placeholder="Mitgliedsnummer (optional z.B. MS-109)"
                  value={newMemberNum}
                  onChange={(e) => setNewMemberNum(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 w-2/3"
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg transition-colors"
                >
                  Speichern
                </button>
              </div>
            </form>
          )}

          {/* User List */}
          <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
            {job.assigned_user_id !== null && (
              <button
                disabled={saving}
                onClick={() => handleSelectUser(null)}
                className="w-full text-left p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 flex items-center justify-between transition-colors mb-2"
              >
                <div className="flex items-center gap-2 text-xs font-medium text-rose-300">
                  <UserX className="h-4 w-4" />
                  Zuweisung aufheben (Auftrag wieder als offen markieren)
                </div>
              </button>
            )}

            {filteredUsers.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Kein Mitglied gefunden
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isCurrent = job.assigned_user_id === user.id;
                return (
                  <button
                    key={user.id}
                    disabled={saving}
                    onClick={() => handleSelectUser(user.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                      isCurrent
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.name}
                          className="h-8 w-8 rounded-full border border-slate-700 object-cover bg-slate-800"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : null}
                      {!user.avatar_url && (
                        <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-slate-200 uppercase">
                          {user.name.slice(0, 2)}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-sm flex items-center gap-2">
                          {user.name}
                          {user.member_number && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-emerald-950/80 text-emerald-400 border border-emerald-800/40 rounded">
                              {user.member_number}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400">
                          {user.email}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {user.unpaid_cents !== undefined && user.unpaid_cents > 0 && (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                          <Coins className="h-3 w-3" />
                          {(user.unpaid_cents / 100).toFixed(2)} € offen
                        </span>
                      )}
                      {isCurrent ? (
                        <div className="p-1 rounded-full bg-emerald-500 text-slate-950">
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">
                          Wählen
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
