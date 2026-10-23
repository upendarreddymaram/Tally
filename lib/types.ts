export type Role = 'owner' | 'admin' | 'approver' | 'worker';

export interface Company {
  id: string;
  name: string;
  currency: string;
  fy_start: string;
  timezone: string;
  receipt_required_above: number;
  auto_approve_up_to: number;
  admin_approval_above: number;
  default_monthly_limit: number;
  signoff_above: number;
  alert_below_pct: number;
  flag_duplicates: boolean;
  workers_see_balance: boolean;
  workers_phone_signin: boolean;
  session_timeout: string;
  notify_new_claim: string;
  notify_low_balance: string;
  notify_signoff: string;
  notify_weekly: string;
}

export interface Profile {
  id: string;
  company_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  bank_details: string | null;
  active: boolean;
  last_seen_at: string | null;
}

export interface Project {
  id: string;
  company_id: string;
  code: string;
  name: string;
  starts_on: string | null;
  ends_on: string | null;
  lead_id: string | null;
  status: 'active' | 'completed';
  budget: number;
  receipt_required_above: number | null;
  auto_approve_up_to: number | null;
  admin_approval_above: number | null;
  alert_below_pct: number | null;
  workers_see_balance: boolean | null;
  created_at: string;
}

export interface ProjectStats {
  project_id: string;
  budget: number;
  spent: number;
  held: number;
  pending_count: number;
  approved_count: number;
  daily_burn: number;
}
