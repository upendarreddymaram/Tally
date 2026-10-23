-- Tally: project budgets, funding with proof, expense claims and approvals.
-- Run this once in the Supabase SQL editor (or `supabase db push`).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.member_role as enum ('owner', 'admin', 'approver', 'worker');
create type public.project_status as enum ('active', 'completed');
create type public.fund_method as enum ('bank_transfer', 'cheque', 'cash', 'card_topup');
create type public.pay_method as enum ('project_card', 'cash_float', 'own_money', 'bank_transfer');
create type public.expense_status as enum ('pending', 'info_requested', 'approved', 'part_approved', 'rejected');
create type public.change_kind as enum ('opening', 'fund', 'increase', 'decrease', 'move', 'set');
create type public.change_status as enum ('pending', 'applied', 'declined');
create type public.audit_kind as enum ('money', 'decide', 'edit', 'login', 'alert', 'people');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'AED',
  fy_start text not null default '1 January',
  timezone text not null default 'Asia/Dubai',
  receipt_required_above numeric(14,2) not null default 100,
  auto_approve_up_to numeric(14,2) not null default 1000,
  admin_approval_above numeric(14,2) not null default 1000,
  default_monthly_limit numeric(14,2) not null default 3000,
  signoff_above numeric(14,2) not null default 5000,
  alert_below_pct numeric(5,2) not null default 15,
  flag_duplicates boolean not null default true,
  workers_see_balance boolean not null default true,
  workers_phone_signin boolean not null default true,
  session_timeout text not null default '30 days of inactivity',
  notify_new_claim text not null default 'Push + daily email digest',
  notify_low_balance text not null default 'Push + email immediately',
  notify_signoff text not null default 'Push + email immediately',
  notify_weekly text not null default 'Monday 8:00 by email',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  role public.member_role not null default 'worker',
  bank_details text,
  active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.profiles (company_id);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  starts_on date,
  ends_on date,
  lead_id uuid references public.profiles(id),
  status public.project_status not null default 'active',
  budget numeric(14,2) not null default 0,
  -- Per-project rule overrides; null means "use the company default".
  receipt_required_above numeric(14,2),
  auto_approve_up_to numeric(14,2),
  admin_approval_above numeric(14,2),
  alert_below_pct numeric(5,2),
  workers_see_balance boolean,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (company_id, code)
);
create index on public.projects (company_id);

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  monthly_limit numeric(14,2) not null default 3000,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index on public.project_members (user_id);

create sequence public.funding_seq;
create table public.funding (
  id uuid primary key default gen_random_uuid(),
  ref text not null default ('FND-' || lpad(nextval('public.funding_seq')::text, 4, '0')),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  method public.fund_method not null,
  reference text,
  received_on date not null default current_date,
  proof_path text not null,
  proof_name text,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index on public.funding (project_id);

create table public.budget_changes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  target_project_id uuid references public.projects(id) on delete cascade,
  kind public.change_kind not null,
  amount numeric(14,2) not null,
  budget_before numeric(14,2) not null,
  budget_after numeric(14,2) not null,
  target_before numeric(14,2),
  target_after numeric(14,2),
  reason text,
  reference text,
  note text,
  funding_id uuid references public.funding(id),
  status public.change_status not null default 'applied',
  requested_by uuid references public.profiles(id),
  signed_off_by uuid references public.profiles(id),
  decided_at timestamptz,
  decline_note text,
  created_at timestamptz not null default now()
);
create index on public.budget_changes (project_id);
create index on public.budget_changes (company_id, status);

create table public.reimbursement_batches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  reference text,
  proof_path text,
  total numeric(14,2) not null,
  people int not null,
  claims int not null,
  paid_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create sequence public.expense_seq;
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  ref text not null default ('EXP-' || lpad(nextval('public.expense_seq')::text, 4, '0')),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id),
  title text not null,
  category_id uuid references public.categories(id),
  vendor text,
  amount numeric(14,2) not null check (amount > 0),
  paid_at timestamptz not null default now(),
  pay_method public.pay_method not null,
  card_last4 text,
  note text,
  status public.expense_status not null default 'pending',
  flags text[] not null default '{}',
  approved_amount numeric(14,2),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  decision_reason text,
  decision_note text,
  auto_approved boolean not null default false,
  reimbursed_at timestamptz,
  batch_id uuid references public.reimbursement_batches(id),
  created_at timestamptz not null default now()
);
create index on public.expenses (company_id, status);
create index on public.expenses (project_id);
create index on public.expenses (submitted_by);

create table public.expense_files (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  path text not null,
  name text not null,
  size int,
  created_at timestamptz not null default now()
);
create index on public.expense_files (expense_id);

create table public.audit_log (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  kind public.audit_kind not null,
  text text not null,
  ref text,
  source text not null default 'Web',
  created_at timestamptz not null default now()
);
create index on public.audit_log (company_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Session helpers (security definer so policies can call them without recursion)
-- ---------------------------------------------------------------------------
create or replace function public.my_company_id() returns uuid
language sql stable security definer set search_path = public as $$
  select company_id from public.profiles where id = auth.uid() and active
$$;

create or replace function public.my_role() returns public.member_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('owner', 'admin'), false)
$$;

create or replace function public.can_approve() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('owner', 'admin', 'approver'), false)
$$;

create or replace function public.is_member(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_members where project_id = p and user_id = auth.uid())
      or exists (select 1 from public.projects where id = p and lead_id = auth.uid())
$$;

create or replace function public.log_event(p_company uuid, p_kind public.audit_kind, p_text text, p_ref text default null, p_source text default 'Web')
returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (company_id, actor_id, kind, text, ref, source)
  values (p_company, auth.uid(), p_kind, p_text, p_ref, p_source)
$$;

create or replace function public.fmt_money(n numeric) returns text
language sql immutable as $$
  select to_char(n, 'FM999,999,999,990.00')
$$;

-- ---------------------------------------------------------------------------
-- Derived numbers per project
-- ---------------------------------------------------------------------------
create or replace view public.project_stats with (security_invoker = true) as
select
  p.id as project_id,
  p.company_id,
  p.budget,
  coalesce(sum(e.approved_amount) filter (where e.status in ('approved', 'part_approved')), 0)::numeric(14,2) as spent,
  coalesce(sum(e.amount) filter (where e.status in ('pending', 'info_requested')), 0)::numeric(14,2) as held,
  count(e.id) filter (where e.status in ('pending', 'info_requested'))::int as pending_count,
  count(e.id) filter (where e.status in ('approved', 'part_approved'))::int as approved_count,
  coalesce(sum(e.approved_amount) filter (
    where e.status in ('approved', 'part_approved') and e.decided_at >= now() - interval '14 days'
  ), 0)::numeric(14,2) / 14.0 as daily_burn
from public.projects p
left join public.expenses e on e.project_id = p.id
group by p.id;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.funding enable row level security;
alter table public.budget_changes enable row level security;
alter table public.reimbursement_batches enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_files enable row level security;
alter table public.audit_log enable row level security;

create policy "company: members read" on public.companies for select using (id = public.my_company_id());
create policy "company: admins update" on public.companies for update using (id = public.my_company_id() and public.is_admin());

create policy "profiles: same company read" on public.profiles for select using (company_id = public.my_company_id() or id = auth.uid());
create policy "profiles: admins write" on public.profiles for update using (company_id = public.my_company_id() and public.is_admin());
create policy "profiles: self update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and company_id = public.my_company_id() and role = public.my_role());

create policy "categories: read" on public.categories for select using (company_id = public.my_company_id());
create policy "categories: admins write" on public.categories for all using (company_id = public.my_company_id() and public.is_admin()) with check (company_id = public.my_company_id() and public.is_admin());

create policy "projects: read" on public.projects for select using (
  company_id = public.my_company_id() and (public.can_approve() or public.is_member(id))
);
create policy "projects: admins update" on public.projects for update using (company_id = public.my_company_id() and public.is_admin());

create policy "members: read" on public.project_members for select using (
  exists (select 1 from public.projects p where p.id = project_id and p.company_id = public.my_company_id())
  and (public.can_approve() or user_id = auth.uid() or public.is_member(project_id))
);
create policy "members: admins write" on public.project_members for all using (
  public.is_admin() and exists (select 1 from public.projects p where p.id = project_id and p.company_id = public.my_company_id())
) with check (
  public.is_admin() and exists (select 1 from public.projects p where p.id = project_id and p.company_id = public.my_company_id())
);

create policy "funding: read" on public.funding for select using (company_id = public.my_company_id() and public.can_approve());
create policy "changes: read" on public.budget_changes for select using (company_id = public.my_company_id() and public.can_approve());
create policy "batches: read" on public.reimbursement_batches for select using (company_id = public.my_company_id() and public.is_admin());

create policy "expenses: read" on public.expenses for select using (
  company_id = public.my_company_id() and (public.can_approve() or submitted_by = auth.uid())
);
create policy "files: read" on public.expense_files for select using (
  company_id = public.my_company_id()
  and (public.can_approve() or exists (select 1 from public.expenses e where e.id = expense_id and e.submitted_by = auth.uid()))
);

create policy "audit: admins read" on public.audit_log for select using (company_id = public.my_company_id() and public.is_admin());
-- No insert/update/delete policies on audit_log: rows only arrive via log_event(), and nothing can be removed.

-- ---------------------------------------------------------------------------
-- Storage: private bucket, one folder per company
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('proofs', 'proofs', false)
on conflict (id) do nothing;

create policy "proofs: company upload" on storage.objects for insert to authenticated
with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = public.my_company_id()::text);
create policy "proofs: company read" on storage.objects for select to authenticated
using (bucket_id = 'proofs' and (storage.foldername(name))[1] = public.my_company_id()::text);

-- ---------------------------------------------------------------------------
-- Actions (all money movement goes through these so it is atomic and logged)
-- ---------------------------------------------------------------------------

-- First sign-in: create a workspace and make the caller its owner.
create or replace function public.create_company(p_company text, p_full_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_company uuid;
  v_email text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from profiles where id = auth.uid()) then raise exception 'You already belong to a workspace'; end if;
  select email into v_email from auth.users where id = auth.uid();

  insert into companies (name) values (p_company) returning id into v_company;
  insert into profiles (id, company_id, full_name, email, role, last_seen_at)
  values (auth.uid(), v_company, p_full_name, v_email, 'owner', now());
  insert into categories (company_id, name)
  select v_company, unnest(array['Materials', 'Subcontract', 'Transport', 'Fuel', 'Tools', 'Meals', 'Other']);
  perform log_event(v_company, 'people', p_full_name || ' created the workspace ' || p_company);
  return v_company;
end $$;

-- Record a sign-in in the audit log.
create or replace function public.record_sign_in(p_source text default 'Web')
returns void language plpgsql security definer set search_path = public as $$
declare v_company uuid;
begin
  v_company := my_company_id();
  if v_company is null then return; end if;
  update profiles set last_seen_at = now() where id = auth.uid();
  perform log_event(v_company, 'login', 'Signed in', null, p_source);
end $$;

-- Set up a project with its opening budget (proof required) and the people who can spend.
-- p_members: [{"user_id": "...", "monthly_limit": 3000}, ...]
create or replace function public.create_project(
  p_name text, p_code text, p_starts date, p_ends date, p_lead uuid,
  p_amount numeric, p_method public.fund_method, p_reference text, p_proof_path text, p_proof_name text,
  p_members jsonb,
  p_receipt_above numeric, p_auto_up_to numeric, p_admin_above numeric, p_alert_pct numeric, p_workers_see boolean
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := my_company_id();
  v_project uuid;
  v_fund uuid;
  m jsonb;
begin
  if not is_admin() then raise exception 'Only admins can create projects'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Opening budget must be more than zero'; end if;
  if coalesce(p_proof_path, '') = '' then raise exception 'Proof is required for the opening budget'; end if;

  insert into projects (company_id, code, name, starts_on, ends_on, lead_id, budget, receipt_required_above,
    auto_approve_up_to, admin_approval_above, alert_below_pct, workers_see_balance, created_by)
  values (v_company, p_code, p_name, p_starts, p_ends, p_lead, p_amount, p_receipt_above,
    p_auto_up_to, p_admin_above, p_alert_pct, p_workers_see, auth.uid())
  returning id into v_project;

  insert into funding (company_id, project_id, amount, method, reference, proof_path, proof_name, note, created_by)
  values (v_company, v_project, p_amount, p_method, p_reference, p_proof_path, p_proof_name, 'Opening budget', auth.uid())
  returning id into v_fund;

  insert into budget_changes (company_id, project_id, kind, amount, budget_before, budget_after, reason, reference, funding_id, requested_by, status, decided_at)
  values (v_company, v_project, 'opening', p_amount, 0, p_amount, 'Opening budget', p_reference, v_fund, auth.uid(), 'applied', now());

  for m in select * from jsonb_array_elements(coalesce(p_members, '[]'::jsonb)) loop
    insert into project_members (project_id, user_id, monthly_limit)
    select v_project, (m->>'user_id')::uuid, coalesce((m->>'monthly_limit')::numeric, c.default_monthly_limit)
    from companies c where c.id = v_company
    on conflict do nothing;
  end loop;

  perform log_event(v_company, 'money', 'Created project ' || p_name || ' with opening budget ' || fmt_money(p_amount), p_code);
  return v_project;
end $$;

-- Add money to a project. Proof is mandatory.
create or replace function public.add_funds(
  p_project uuid, p_amount numeric, p_method public.fund_method, p_reference text,
  p_received date, p_proof_path text, p_proof_name text, p_note text
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := my_company_id();
  v_p projects%rowtype;
  v_fund funding%rowtype;
begin
  if not is_admin() then raise exception 'Only admins can add funds'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be more than zero'; end if;
  if coalesce(p_proof_path, '') = '' then raise exception 'Proof is required'; end if;
  select * into v_p from projects where id = p_project and company_id = v_company for update;
  if not found then raise exception 'Project not found'; end if;

  insert into funding (company_id, project_id, amount, method, reference, received_on, proof_path, proof_name, note, created_by)
  values (v_company, p_project, p_amount, p_method, p_reference, coalesce(p_received, current_date), p_proof_path, p_proof_name, p_note, auth.uid())
  returning * into v_fund;

  insert into budget_changes (company_id, project_id, kind, amount, budget_before, budget_after, reason, reference, funding_id, requested_by, status, decided_at)
  values (v_company, p_project, 'fund', p_amount, v_p.budget, v_p.budget + p_amount, 'Funds added', p_reference, v_fund.id, auth.uid(), 'applied', now());

  update projects set budget = budget + p_amount where id = p_project;
  perform log_event(v_company, 'money', 'Added ' || fmt_money(p_amount) || ' to ' || v_p.name || ' · proof ' || coalesce(p_proof_name, 'attached'), v_fund.ref);
  return v_fund.ref;
end $$;

-- Apply a budget change row (internal).
create or replace function public._apply_change(p_change uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  c budget_changes%rowtype;
  v_floor numeric;
  v_budget numeric;
  v_after numeric;
  v_target numeric;
begin
  select * into c from budget_changes where id = p_change for update;
  select budget into v_budget from projects where id = c.project_id for update;
  -- Recompute against the budget as it is now (it may have moved while a change waited for sign-off).
  v_after := case c.kind when 'set' then c.budget_after when 'increase' then v_budget + c.amount else v_budget - c.amount end;
  select spent + held into v_floor from project_stats where project_id = c.project_id;
  if v_after < v_floor then
    raise exception 'That would leave % but % is already spent or held. The lowest you can go is %.',
      fmt_money(v_after), fmt_money(v_floor), fmt_money(v_floor);
  end if;
  update projects set budget = v_after where id = c.project_id;
  if c.kind = 'move' then
    update projects set budget = budget + c.amount where id = c.target_project_id
    returning budget into v_target;
  end if;
  update budget_changes set status = 'applied', decided_at = now(), budget_before = v_budget, budget_after = v_after,
    target_before = case when c.kind = 'move' then v_target - c.amount end, target_after = v_target
  where id = p_change;
end $$;

-- Increase / decrease / move / set. Reductions above the sign-off threshold wait for a second admin.
create or replace function public.request_budget_change(
  p_project uuid, p_kind public.change_kind, p_amount numeric, p_target uuid,
  p_reason text, p_reference text, p_note text
) returns public.change_status language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := my_company_id();
  v_p projects%rowtype;
  v_t projects%rowtype;
  v_after numeric;
  v_floor numeric;
  v_signoff numeric;
  v_change uuid;
  v_status change_status;
  v_desc text;
begin
  if not is_admin() then raise exception 'Only admins can change budgets'; end if;
  if p_kind not in ('increase', 'decrease', 'move', 'set') then raise exception 'Unsupported change'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Enter an amount'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'Say what changed — the team sees this'; end if;
  select * into v_p from projects where id = p_project and company_id = v_company for update;
  if not found then raise exception 'Project not found'; end if;

  v_after := case p_kind
    when 'increase' then v_p.budget + p_amount
    when 'decrease' then v_p.budget - p_amount
    when 'move' then v_p.budget - p_amount
    when 'set' then p_amount end;

  select spent + held into v_floor from project_stats where project_id = p_project;
  if v_after < v_floor then
    raise exception 'That would leave % but % is already spent or held for pending claims. The lowest you can go is %.',
      fmt_money(v_after), fmt_money(v_floor), fmt_money(v_floor);
  end if;

  if p_kind = 'move' then
    select * into v_t from projects where id = p_target and company_id = v_company;
    if not found or v_t.id = v_p.id then raise exception 'Pick another project to move the money to'; end if;
  end if;

  select signoff_above into v_signoff from companies where id = v_company;
  v_status := case when v_after < v_p.budget and (v_p.budget - v_after) > v_signoff then 'pending' else 'applied' end;

  insert into budget_changes (company_id, project_id, target_project_id, kind, amount, budget_before, budget_after,
    target_before, target_after, reason, reference, note, requested_by, status)
  values (v_company, p_project, case when p_kind = 'move' then p_target end, p_kind,
    case when p_kind = 'set' then abs(v_p.budget - p_amount) else p_amount end,
    v_p.budget, v_after,
    case when p_kind = 'move' then v_t.budget end, case when p_kind = 'move' then v_t.budget + p_amount end,
    p_reason, p_reference, p_note, auth.uid(), 'pending')
  returning id into v_change;

  v_desc := case p_kind
    when 'move' then 'Moved ' || fmt_money(p_amount) || ' from ' || v_p.name || ' to ' || v_t.name
    else initcap(p_kind::text) || ' on ' || v_p.name || ': ' || fmt_money(v_p.budget) || ' → ' || fmt_money(v_after) end;

  if v_status = 'applied' then
    perform _apply_change(v_change);
    perform log_event(v_company, 'edit', v_desc || ' · reason: ' || coalesce(p_reason, '—'), p_reference);
  else
    perform log_event(v_company, 'edit', 'Requested ' || lower(left(v_desc, 1)) || substr(v_desc, 2) || ' · awaiting a second admin', p_reference);
  end if;
  return v_status;
end $$;

create or replace function public.decide_budget_change(p_change uuid, p_approve boolean, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := my_company_id();
  c budget_changes%rowtype;
  v_name text;
begin
  if not is_admin() then raise exception 'Only admins can sign off'; end if;
  select * into c from budget_changes where id = p_change and company_id = v_company and status = 'pending' for update;
  if not found then raise exception 'Change not found or already decided'; end if;
  if c.requested_by = auth.uid() then raise exception 'A different admin has to sign this off'; end if;
  select name into v_name from projects where id = c.project_id;

  if p_approve then
    update budget_changes set signed_off_by = auth.uid() where id = p_change;
    perform _apply_change(p_change);
    perform log_event(v_company, 'edit', 'Signed off ' || c.kind::text || ' on ' || v_name || ': ' || fmt_money(c.budget_before) || ' → ' || fmt_money(c.budget_after), c.reference);
  else
    if coalesce(trim(p_note), '') = '' then raise exception 'A note is required to decline'; end if;
    update budget_changes set status = 'declined', signed_off_by = auth.uid(), decided_at = now(), decline_note = p_note where id = p_change;
    perform log_event(v_company, 'edit', 'Declined ' || c.kind::text || ' on ' || v_name || ' · ' || p_note, c.reference);
  end if;
end $$;

-- Worker submits a claim. Flags and auto-approval are worked out here.
-- p_files: [{"path": "...", "name": "...", "size": 123}, ...]
create or replace function public.submit_expense(
  p_project uuid, p_title text, p_category uuid, p_vendor text, p_amount numeric, p_paid_at timestamptz,
  p_method public.pay_method, p_card_last4 text, p_note text, p_files jsonb
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := my_company_id();
  v_c companies%rowtype;
  v_p projects%rowtype;
  v_receipt_above numeric;
  v_auto numeric;
  v_admin_above numeric;
  v_limit numeric;
  v_month numeric;
  v_flags text[] := '{}';
  v_has_files boolean := jsonb_array_length(coalesce(p_files, '[]'::jsonb)) > 0;
  v_e expenses%rowtype;
  v_avail numeric;
  f jsonb;
  v_name text;
begin
  if v_company is null then raise exception 'Not signed in'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be more than zero'; end if;
  select * into v_p from projects where id = p_project and company_id = v_company and status = 'active';
  if not found then raise exception 'Project not found'; end if;
  if not (is_member(p_project) or can_approve()) then raise exception 'You are not on this project'; end if;
  select * into v_c from companies where id = v_company;

  v_receipt_above := coalesce(v_p.receipt_required_above, v_c.receipt_required_above);
  v_auto := coalesce(v_p.auto_approve_up_to, v_c.auto_approve_up_to);
  v_admin_above := coalesce(v_p.admin_approval_above, v_c.admin_approval_above);

  if not v_has_files and p_amount > v_receipt_above then v_flags := array_append(v_flags, 'No receipt'); end if;
  if p_amount > v_admin_above then v_flags := array_append(v_flags, 'Over ' || to_char(v_admin_above, 'FM999,999,990')); end if;
  if v_c.flag_duplicates and exists (
    select 1 from expenses
    where company_id = v_company and amount = p_amount and status <> 'rejected'
      and coalesce(lower(vendor), lower(title)) = coalesce(lower(nullif(p_vendor, '')), lower(p_title))
      and paid_at > coalesce(p_paid_at, now()) - interval '30 days'
  ) then v_flags := array_append(v_flags, 'Possible duplicate'); end if;

  select monthly_limit into v_limit from project_members where project_id = p_project and user_id = auth.uid();
  if v_limit is not null then
    select coalesce(sum(coalesce(approved_amount, amount)), 0) into v_month from expenses
    where project_id = p_project and submitted_by = auth.uid() and status <> 'rejected'
      and date_trunc('month', paid_at) = date_trunc('month', coalesce(p_paid_at, now()));
    if v_month + p_amount > v_limit then v_flags := array_append(v_flags, 'Over monthly limit'); end if;
  end if;

  select budget - spent - held into v_avail from project_stats where project_id = p_project;
  if p_amount > v_avail then v_flags := array_append(v_flags, 'Over budget'); end if;

  insert into expenses (company_id, project_id, submitted_by, title, category_id, vendor, amount, paid_at, pay_method, card_last4, note, flags)
  values (v_company, p_project, auth.uid(), p_title, p_category, nullif(p_vendor, ''), p_amount, coalesce(p_paid_at, now()), p_method, nullif(p_card_last4, ''), p_note, v_flags)
  returning * into v_e;

  for f in select * from jsonb_array_elements(coalesce(p_files, '[]'::jsonb)) loop
    insert into expense_files (expense_id, company_id, path, name, size)
    values (v_e.id, v_company, f->>'path', f->>'name', (f->>'size')::int);
  end loop;

  select full_name into v_name from profiles where id = auth.uid();
  perform log_event(v_company, 'decide', 'Submitted ' || p_title || ' · ' || fmt_money(p_amount)
    || case when v_has_files then ' · ' || jsonb_array_length(p_files) || ' file(s)' else ' · no proof attached' end, v_e.ref, 'App');

  if v_has_files and array_length(v_flags, 1) is null and v_auto > 0 and p_amount <= v_auto then
    update expenses set status = 'approved', approved_amount = amount, decided_at = now(), auto_approved = true where id = v_e.id;
    insert into audit_log (company_id, actor_id, kind, text, ref, source)
    values (v_company, null, 'decide', 'Auto-approved ' || p_title || ' · ' || fmt_money(p_amount) || ' · receipt attached, under ' || to_char(v_auto, 'FM999,999,990'), v_e.ref, 'System');
  elsif array_length(v_flags, 1) is not null then
    insert into audit_log (company_id, actor_id, kind, text, ref, source)
    values (v_company, null, 'alert', 'Automatic check: ' || v_e.ref || ' — ' || array_to_string(v_flags, ', '), v_e.ref, 'System');
  end if;
  return v_e.ref;
end $$;

-- Worker answers a question: adds files / a note, claim goes back to pending.
create or replace function public.reply_expense(p_expense uuid, p_note text, p_files jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_e expenses%rowtype;
  f jsonb;
begin
  select * into v_e from expenses where id = p_expense and submitted_by = auth.uid() and status = 'info_requested' for update;
  if not found then raise exception 'Nothing to reply to'; end if;
  for f in select * from jsonb_array_elements(coalesce(p_files, '[]'::jsonb)) loop
    insert into expense_files (expense_id, company_id, path, name, size)
    values (v_e.id, v_e.company_id, f->>'path', f->>'name', (f->>'size')::int);
  end loop;
  update expenses set status = 'pending',
    note = coalesce(note, '') || case when coalesce(p_note, '') <> '' then E'\nReply: ' || p_note else '' end,
    flags = case when jsonb_array_length(coalesce(p_files, '[]'::jsonb)) > 0 then array_remove(flags, 'No receipt') else flags end
  where id = p_expense;
  perform log_event(v_e.company_id, 'decide', 'Replied on ' || v_e.title, v_e.ref, 'App');
end $$;

-- Approver decision: approve, partial, info, reject.
create or replace function public.decide_expense(p_expense uuid, p_decision text, p_amount numeric, p_reason text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := my_company_id();
  v_e expenses%rowtype;
  v_who text;
  v_admin_above numeric;
begin
  if not can_approve() then raise exception 'You cannot approve claims'; end if;
  select * into v_e from expenses where id = p_expense and company_id = v_company for update;
  if not found then raise exception 'Claim not found'; end if;
  if v_e.status not in ('pending', 'info_requested') then raise exception 'This claim was already decided'; end if;
  if p_decision in ('approve', 'partial') then
    if v_e.submitted_by = auth.uid() and my_role() <> 'owner' then
      raise exception 'You can''t approve your own claim — another approver has to';
    end if;
    select coalesce(p.admin_approval_above, c.admin_approval_above) into v_admin_above
    from projects p join companies c on c.id = p.company_id where p.id = v_e.project_id;
    if not is_admin() and coalesce(p_amount, v_e.amount) > v_admin_above then
      raise exception 'Claims over % need an admin', to_char(v_admin_above, 'FM999,999,990');
    end if;
  end if;
  select full_name into v_who from profiles where id = v_e.submitted_by;

  if p_decision = 'approve' then
    update expenses set status = 'approved', approved_amount = amount, decided_by = auth.uid(), decided_at = now(), decision_note = p_note where id = p_expense;
    perform log_event(v_company, 'decide', 'Approved ' || v_e.title || ' · ' || fmt_money(v_e.amount), v_e.ref);
  elsif p_decision = 'partial' then
    if p_amount is null or p_amount <= 0 or p_amount >= v_e.amount then raise exception 'Part-approval must be between 0 and the claimed amount'; end if;
    update expenses set status = 'part_approved', approved_amount = p_amount, decided_by = auth.uid(), decided_at = now(),
      decision_reason = p_reason, decision_note = p_note where id = p_expense;
    perform log_event(v_company, 'decide', 'Part-approved ' || v_e.title || ' · ' || fmt_money(p_amount) || ' of ' || fmt_money(v_e.amount) || ' · ' || coalesce(p_reason, ''), v_e.ref);
  elsif p_decision = 'info' then
    if coalesce(trim(p_note), '') = '' then raise exception 'Say what you need'; end if;
    update expenses set status = 'info_requested', decision_note = p_note where id = p_expense;
    perform log_event(v_company, 'decide', 'Asked ' || v_who || ' about ' || v_e.title || ': ' || p_note, v_e.ref);
  elsif p_decision = 'reject' then
    if coalesce(trim(p_note), '') = '' then raise exception 'A reason is required to reject'; end if;
    update expenses set status = 'rejected', approved_amount = 0, decided_by = auth.uid(), decided_at = now(), decision_note = p_note where id = p_expense;
    perform log_event(v_company, 'decide', 'Rejected ' || v_e.title || ' · ' || fmt_money(v_e.amount) || ' · ' || p_note, v_e.ref);
  else
    raise exception 'Unknown decision';
  end if;
end $$;

-- Approve every pending claim that has no flags and at least one file.
create or replace function public.approve_clean_claims()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := my_company_id();
  r record;
  n int := 0;
begin
  if not can_approve() then raise exception 'You cannot approve claims'; end if;
  for r in
    select e.id from expenses e
    where e.company_id = v_company and e.status = 'pending' and coalesce(array_length(e.flags, 1), 0) = 0
      and exists (select 1 from expense_files f where f.expense_id = e.id)
      and (e.submitted_by <> auth.uid() or my_role() = 'owner')
    for update
  loop
    perform decide_expense(r.id, 'approve', null, null, 'Bulk-approved: passed every check');
    n := n + 1;
  end loop;
  return n;
end $$;

-- Pay back own-money claims. p_people null = everyone owed.
create or replace function public.pay_reimbursements(p_people uuid[], p_reference text, p_proof_path text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := my_company_id();
  v_batch uuid;
  v_total numeric;
  v_people int;
  v_claims int;
begin
  if not is_admin() then raise exception 'Only admins can pay reimbursements'; end if;
  select coalesce(sum(approved_amount), 0), count(distinct submitted_by), count(*) into v_total, v_people, v_claims
  from expenses
  where company_id = v_company and pay_method = 'own_money' and status in ('approved', 'part_approved')
    and reimbursed_at is null and (p_people is null or submitted_by = any(p_people));
  if v_claims = 0 then raise exception 'Nothing is owed'; end if;

  insert into reimbursement_batches (company_id, title, reference, proof_path, total, people, claims, paid_by)
  values (v_company, 'Batch ' || to_char(now(), 'YYYY-MM-DD'), p_reference, p_proof_path, v_total, v_people, v_claims, auth.uid())
  returning id into v_batch;

  update expenses set reimbursed_at = now(), batch_id = v_batch
  where company_id = v_company and pay_method = 'own_money' and status in ('approved', 'part_approved')
    and reimbursed_at is null and (p_people is null or submitted_by = any(p_people));

  perform log_event(v_company, 'money', 'Paid reimbursements ' || fmt_money(v_total) || ' · ' || v_people || ' people · ' || v_claims || ' claims'
    || case when coalesce(p_reference, '') <> '' then ' · ' || p_reference else '' end);
  return v_batch;
end $$;

create or replace function public.record_settings_change()
returns void language plpgsql security definer set search_path = public as $$
begin
  if is_admin() then perform log_event(my_company_id(), 'edit', 'Updated company settings'); end if;
end $$;

-- Balances for the projects a worker is on (only where the project lets workers see them).
create or replace function public.my_project_balances()
returns table (project_id uuid, name text, code text, budget numeric, spent numeric, held numeric, monthly_limit numeric, used_this_month numeric)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.code,
    case when coalesce(p.workers_see_balance, c.workers_see_balance) then s.budget end,
    case when coalesce(p.workers_see_balance, c.workers_see_balance) then s.spent end,
    case when coalesce(p.workers_see_balance, c.workers_see_balance) then s.held end,
    m.monthly_limit,
    (select coalesce(sum(coalesce(e.approved_amount, e.amount)), 0) from expenses e
      where e.project_id = p.id and e.submitted_by = auth.uid() and e.status <> 'rejected'
        and date_trunc('month', e.paid_at) = date_trunc('month', now()))
  from projects p
  join companies c on c.id = p.company_id
  join project_stats s on s.project_id = p.id
  left join project_members m on m.project_id = p.id and m.user_id = auth.uid()
  where p.company_id = my_company_id() and p.status = 'active' and is_member(p.id)
  order by p.name
$$;

-- Lock down direct execution of the internal helper.
revoke execute on function public._apply_change(uuid) from public, anon, authenticated;
revoke execute on function public.log_event(uuid, public.audit_kind, text, text, text) from public, anon, authenticated;
