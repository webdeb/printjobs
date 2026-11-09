import { useState, useEffect, useCallback } from 'react';
import { Printer, PrintJob, User, MakerspaceStats, MaintenanceLog, DiscoveredPrinter } from '../types/index.ts';

export function usePrinterData() {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<MakerspaceStats | null>(null);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [discoveredPrinters, setDiscoveredPrinters] = useState<DiscoveredPrinter[]>([]);
  const [connected, setConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch all initial data
  const fetchData = useCallback(async () => {
    try {
      const [printersRes, jobsRes, usersRes, statsRes, maintRes, pricesRes] = await Promise.all([
        fetch('/api/printers').then((r) => r.json()),
        fetch('/api/jobs').then((r) => r.json()),
        fetch('/api/users').then((r) => r.json()),
        fetch('/api/stats').then((r) => r.json()),
        fetch('/api/maintenance').then((r) => r.json()),
        fetch('/api/settings/prices').then((r) => r.json()).catch(() => ({})),
      ]);

      if (Array.isArray(printersRes)) setPrinters(printersRes);
      if (Array.isArray(jobsRes)) setJobs(jobsRes);
      if (Array.isArray(usersRes)) setUsers(usersRes);
      if (statsRes && !statsRes.error) setStats(statsRes);
      if (Array.isArray(maintRes)) setMaintenanceLogs(maintRes);
      if (pricesRes && typeof pricesRes === 'object' && !pricesRes.error) setPrices(pricesRes);
    } catch (err) {
      console.error('[usePrinterData] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDiscovered = useCallback(async () => {
    try {
      const res = await fetch('/api/printers/discovered');
      const data = await res.json();
      if (Array.isArray(data)) setDiscoveredPrinters(data);
    } catch (err) {
      console.error('[usePrinterData] Fetch discovered error:', err);
    }
  }, []);

  // SSE stream for real-time events
  useEffect(() => {
    fetchData();

    const eventSource = new EventSource('/api/events');

    eventSource.onopen = () => {
      setConnected(true);
    };

    eventSource.addEventListener('telemetry', (e: MessageEvent) => {
      try {
        const { printerId, telemetry, status } = JSON.parse(e.data);
        setPrinters((prev) =>
          prev.map((p) =>
            p.id === printerId
              ? { ...p, telemetry, status: status || p.status, last_seen_at: new Date().toISOString() }
              : p
          )
        );
      } catch {}
    });

    eventSource.addEventListener('job_progress', (e: MessageEvent) => {
      try {
        const { jobId, durationSeconds, materialUsedGrams, costCents, metadata } = JSON.parse(e.data);
        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  duration_seconds: durationSeconds,
                  material_used_grams: materialUsedGrams !== undefined ? materialUsedGrams : j.material_used_grams,
                  cost_cents: costCents !== undefined ? costCents : j.cost_cents,
                  metadata: metadata ? JSON.stringify(metadata) : j.metadata,
                }
              : j
          )
        );
      } catch {}
    });

    eventSource.addEventListener('job_updated', (e: MessageEvent) => {
      try {
        const { jobId, materialType, materialUsedGrams, costCents } = JSON.parse(e.data);
        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  material_type: materialType !== undefined ? materialType : j.material_type,
                  material_used_grams: materialUsedGrams !== undefined ? materialUsedGrams : j.material_used_grams,
                  cost_cents: costCents !== undefined ? costCents : j.cost_cents,
                }
              : j
          )
        );
        fetch('/api/users').then((r) => r.json()).then((d) => Array.isArray(d) && setUsers(d));
        fetch('/api/stats').then((r) => r.json()).then((d) => d && !d.error && setStats(d));
      } catch {}
    });

    eventSource.addEventListener('job_started', () => {
      fetchData();
    });

    eventSource.addEventListener('job_finished', () => {
      fetchData();
    });

    eventSource.addEventListener('job_created', () => {
      fetchData();
    });

    eventSource.addEventListener('job_deleted', (e: MessageEvent) => {
      try {
        const { jobId } = JSON.parse(e.data);
        setJobs((prev) => prev.filter((j) => j.id !== jobId));
      } catch {
        fetchData();
      }
    });

    eventSource.addEventListener('prices_updated', (e: MessageEvent) => {
      try {
        const updated = JSON.parse(e.data);
        setPrices(updated);
      } catch {}
    });

    eventSource.addEventListener('job_assigned', (e: MessageEvent) => {
      try {
        const { jobId, assignedUserId, assignedUserName } = JSON.parse(e.data);
        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  assigned_user_id: assignedUserId,
                  assigned_user_name: assignedUserName,
                  assigned_at: assignedUserId ? new Date().toISOString() : null,
                }
              : j
          )
        );
        // Refresh users & stats to reflect updated balance
        fetch('/api/users').then((r) => r.json()).then((d) => Array.isArray(d) && setUsers(d));
        fetch('/api/stats').then((r) => r.json()).then((d) => d && !d.error && setStats(d));
      } catch {}
    });

    eventSource.addEventListener('job_paid_updated', (e: MessageEvent) => {
      try {
        const { jobId, is_paid } = JSON.parse(e.data);
        setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, is_paid } : j)));
        fetch('/api/users').then((r) => r.json()).then((d) => Array.isArray(d) && setUsers(d));
        fetch('/api/stats').then((r) => r.json()).then((d) => d && !d.error && setStats(d));
      } catch {}
    });

    eventSource.addEventListener('printer_added', () => {
      fetchData();
    });

    eventSource.addEventListener('printer_deleted', () => {
      fetchData();
    });

    eventSource.addEventListener('user_created', () => {
      fetch('/api/users').then((r) => r.json()).then((d) => Array.isArray(d) && setUsers(d));
    });

    eventSource.addEventListener('user_settled', () => {
      fetchData();
    });

    eventSource.addEventListener('maintenance_added', (e: MessageEvent) => {
      try {
        const entry = JSON.parse(e.data);
        setMaintenanceLogs((prev) => [entry, ...prev]);
      } catch {}
    });

    eventSource.onerror = () => {
      setConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, [fetchData]);

  // Actions
  const assignJob = async (jobId: number, userId: number | null) => {
    const res = await fetch(`/api/jobs/${jobId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    return res.json();
  };

  const toggleJobPaid = async (jobId: number, isPaid?: boolean) => {
    const res = await fetch(`/api/jobs/${jobId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_paid: isPaid }),
    });
    return res.json();
  };

  const settleUser = async (userId: number) => {
    const res = await fetch(`/api/users/${userId}/settle`, { method: 'POST' });
    const data = await res.json();
    fetchData();
    return data;
  };

  const createUser = async (name: string, email: string, member_number?: string) => {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, member_number }),
    });
    const data = await res.json();
    fetchData();
    return data;
  };

  const syncMete = async () => {
    const res = await fetch('/api/users/sync-mete', { method: 'POST' });
    const data = await res.json();
    fetchData();
    return data;
  };

  const addMaintenanceLog = async (printerId: string, serviceType: string, notes: string, performedBy: string) => {
    const res = await fetch('/api/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        printer_id: printerId,
        service_type: serviceType,
        notes,
        performed_by: performedBy,
      }),
    });
    const data = await res.json();
    fetchData();
    return data;
  };

  const addPrinter = async (printerData: Partial<Printer>) => {
    const res = await fetch('/api/printers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(printerData),
    });
    const data = await res.json();
    fetchData();
    return data;
  };

  const deletePrinter = async (printerId: string) => {
    const res = await fetch(`/api/printers/${printerId}`, { method: 'DELETE' });
    const data = await res.json();
    fetchData();
    return data;
  };

  const createManualJob = async (jobData: any) => {
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jobData),
    });
    const data = await res.json();
    fetchData();
    return data;
  };

  const deleteJob = async (jobId: number) => {
    const res = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
    const data = await res.json();
    fetchData();
    return data;
  };

  const updatePrices = async (newPrices: Record<string, number>) => {
    const res = await fetch('/api/settings/prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPrices),
    });
    const data = await res.json();
    if (data.prices) setPrices(data.prices);
    fetchData();
    return data;
  };

  const updateJobDetails = async (jobId: number, data: { material_type?: string; material_used_grams?: number; cost_cents?: number; total_grams?: number }) => {
    const res = await fetch(`/api/jobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    fetchData();
    return result;
  };

  return {
    printers,
    jobs,
    users,
    stats,
    maintenanceLogs,
    discoveredPrinters,
    prices,
    connected,
    loading,
    refresh: fetchData,
    fetchDiscovered,
    assignJob,
    toggleJobPaid,
    settleUser,
    createUser,
    syncMete,
    addMaintenanceLog,
    addPrinter,
    deletePrinter,
    createManualJob,
    deleteJob,
    updatePrices,
    updateJobDetails,
  };
}
