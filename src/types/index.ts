export type PrinterStatus = 'idle' | 'printing' | 'paused' | 'offline' | 'error' | 'finishing';

export interface SpoolInfo {
  id: string;
  type: string; // e.g., 'PLA', 'PETG', 'ABS', 'TPU', 'PLA-CF'
  color_hex: string;
  brand?: string;
  name?: string;
  remaining_percent?: number;
}

export interface PrinterTelemetry {
  nozzle_temp: number;
  nozzle_target: number;
  bed_temp: number;
  bed_target: number;
  chamber_temp?: number;
  progress_percent: number;
  remaining_minutes: number;
  current_layer: number;
  total_layers: number;
  subtask_name: string;
  speed_level?: number;
  spools: SpoolInfo[];
  active_tray_id?: string;
}

export interface Printer {
  id: string; // Serial number or unique identifier
  name: string;
  model: string; // e.g., 'X1-Carbon', 'P1S', 'A1 Mini', 'MK4'
  make: string;  // e.g., 'Bambu Lab', 'Prusa', 'Creality'
  adapter_type: 'bambulab' | 'snapmaker' | 'prusalink' | 'klipper' | 'mock' | 'generic';
  host: string;
  port: number;
  access_code?: string;
  status: PrinterStatus;
  telemetry?: PrinterTelemetry;
  last_seen_at: string;
  created_at: string;
}

export type JobStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface PrintJob {
  id: number;
  printer_id: string;
  printer_name?: string;
  printer_model?: string;
  job_name: string;
  status: JobStatus;
  start_time: string;
  end_time?: string | null;
  duration_seconds: number;
  material_type: string;
  material_color_hex: string;
  material_used_grams: number;
  assigned_user_id: number | null;
  assigned_user_name?: string | null;
  assigned_user_email?: string | null;
  assigned_at?: string | null;
  cost_cents: number;
  is_paid: boolean;
  metadata?: string;
}

export interface User {
  id: number;
  external_id?: string;
  avatar_url?: string;
  name: string;
  email: string;
  member_number?: string;
  total_jobs?: number;
  total_grams?: number;
  unpaid_cents?: number;
  is_active: boolean;
  created_at: string;
}

export interface MaintenanceLog {
  id: number;
  printer_id: string;
  printer_name?: string;
  service_type: string;
  notes: string;
  performed_by: string;
  performed_at: string;
}

export interface DiscoveredPrinter {
  id: string;
  name: string;
  model: string;
  make: string;
  adapter_type: string;
  host: string;
  port: number;
  already_added: boolean;
}

export interface MakerspaceStats {
  total_jobs: number;
  total_grams: number;
  total_print_hours: number;
  active_printers: number;
  unpaid_balance_cents: number;
  materials_breakdown: { material: string; grams: number; percentage: number }[];
  monthly_breakdown: { month: string; jobs: number; grams: number; cost_cents: number }[];
  top_users: { user_id: number; user_name: string; grams: number; jobs: number; cost_cents: number }[];
}
