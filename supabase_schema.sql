-- =============================================================================
-- SUPABASE POSTGRESQL SCHEMA — HỆ THỐNG QUẢN LÝ & TÍNH LƯƠNG PHÒNG KTCN
-- Công ty Cổ phần Gạch Men Phương Nam
-- Hướng dẫn: Copy toàn bộ nội dung file này -> Dán vào Supabase SQL Editor -> Bấm RUN
-- =============================================================================

create extension if not exists pgcrypto;

-- 1. BẢNG DANH SÁCH NHÂN SỰ & ĐỊNH MỨC HỆ SỐ (ktcn_employees)
create table if not exists public.ktcn_employees (
  id uuid primary key default gen_random_uuid(),
  msnv text not null unique,
  full_name text not null,
  role text not null,
  department text not null check (department in ('VP', 'DC')),
  team text not null check (team in ('BAN_LANH_DAO', 'TO_CO_LY', 'TO_QC_KCS', 'THONG_KE')),
  base_salary_2020 numeric not null default 0,
  hs_cv numeric not null default 0,
  hs_tn numeric not null default 0,
  sort_order integer not null default 1,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ktcn_employees_msnv on public.ktcn_employees(msnv);
create index if not exists idx_ktcn_employees_team on public.ktcn_employees(team);

-- 2. BẢNG BẢO MẬT MÃ PIN 4 SỐ & PHÂN QUYỀN 4 CẤP (ktcn_security_pins)
create table if not exists public.ktcn_security_pins (
  msnv text primary key,
  access_level text not null check (access_level in ('ADMIN', 'LEADER', 'TEAM_LEAD', 'STAFF')),
  is_enabled boolean not null default false,
  pin_hash text not null,
  pin_admin_view text not null,
  updated_at timestamptz not null default now()
);

-- 3. BẢNG KỲ LƯƠNG HÀNG THÁNG & QUỸ KHOÁN (ktcn_payroll_periods)
create table if not exists public.ktcn_payroll_periods (
  period_key text primary key, -- VD: '2026-10'
  month integer not null check (month between 1 and 12),
  year integer not null check (year >= 2020),
  title text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'LOCKED')),
  calc_mode text not null default 'MERGED' check (calc_mode in ('MERGED', 'SEPARATED')),
  standard_days integer not null default 27 check (standard_days in (27, 26)),
  clusters_json jsonb not null default '[]'::jsonb,
  maintenance_fund numeric not null default 0,
  deductions_json jsonb not null default '[]'::jsonb,
  summary_snapshot_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_ktcn_payroll_periods_year_month on public.ktcn_payroll_periods(year desc, month desc);

-- 4. BẢNG CHI TIẾT CÔNG & LƯƠNG TỪNG NHÂN SỰ THEO KỲ (ktcn_payroll_entries)
create table if not exists public.ktcn_payroll_entries (
  id uuid primary key default gen_random_uuid(),
  period_key text not null references public.ktcn_payroll_periods(period_key) on delete cascade,
  msnv text not null,
  full_name_snapshot text not null,
  role_snapshot text not null,
  team_snapshot text not null,
  hs_cv_snapshot numeric not null default 0,
  hs_tn_snapshot numeric not null default 0,
  cong_khoan numeric not null default 0,
  cong_bd numeric not null default 0,
  tru_thuong_ca_nhan numeric not null default 0,
  luong_khoan numeric not null default 0,
  luong_bd numeric not null default 0,
  tien_thuong numeric not null default 0,
  tong_luong numeric not null default 0,
  updated_at timestamptz not null default now(),
  constraint uq_ktcn_payroll_entries_period_msnv unique (period_key, msnv)
);

create index if not exists idx_ktcn_payroll_entries_period on public.ktcn_payroll_entries(period_key);
create index if not exists idx_ktcn_payroll_entries_msnv on public.ktcn_payroll_entries(msnv);

-- 5. BẢNG QUYẾT ĐỊNH GIAO KHOÁN CỦA CÔNG TY (ktcn_decisions)
create table if not exists public.ktcn_decisions (
  id text primary key,
  decision_number text not null,
  effective_from text not null, -- YYYY-MM
  title text not null,
  notes text not null default '',
  file_url text,
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- CẤU HÌNH ROW LEVEL SECURITY (RLS) & QUYỀN TRUY CẬP CHO SUPABASE CLIENT
-- =============================================================================
alter table public.ktcn_employees enable row level security;
alter table public.ktcn_security_pins enable row level security;
alter table public.ktcn_payroll_periods enable row level security;
alter table public.ktcn_payroll_entries enable row level security;
alter table public.ktcn_decisions enable row level security;

drop policy if exists "Allow anon & authenticated full access on ktcn_employees" on public.ktcn_employees;
create policy "Allow anon & authenticated full access on ktcn_employees"
  on public.ktcn_employees for all to anon, authenticated using (true) with check (true);

drop policy if exists "Allow anon & authenticated full access on ktcn_security_pins" on public.ktcn_security_pins;
create policy "Allow anon & authenticated full access on ktcn_security_pins"
  on public.ktcn_security_pins for all to anon, authenticated using (true) with check (true);

drop policy if exists "Allow anon & authenticated full access on ktcn_payroll_periods" on public.ktcn_payroll_periods;
create policy "Allow anon & authenticated full access on ktcn_payroll_periods"
  on public.ktcn_payroll_periods for all to anon, authenticated using (true) with check (true);

drop policy if exists "Allow anon & authenticated full access on ktcn_payroll_entries" on public.ktcn_payroll_entries;
create policy "Allow anon & authenticated full access on ktcn_payroll_entries"
  on public.ktcn_payroll_entries for all to anon, authenticated using (true) with check (true);

drop policy if exists "Allow anon & authenticated full access on ktcn_decisions" on public.ktcn_decisions;
create policy "Allow anon & authenticated full access on ktcn_decisions"
  on public.ktcn_decisions for all to anon, authenticated using (true) with check (true);
