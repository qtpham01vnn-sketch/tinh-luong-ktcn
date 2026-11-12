import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  AppState,
  AttendanceRecord,
  AuthAccount,
  CalculationMode,
  DeductionEntry,
  Department,
  EmployeeMaster,
  InputMode,
  PayrollPeriod,
  PeriodStatus,
  PolicyDecision,
  ProductionCluster,
  SignatureConfig,
  TeamGroup,
  UserRole,
} from '../types/payroll';
import { calculatePayroll } from '../utils/payrollCalc';
import {
  buildDefaultAuthAccounts,
  inferDefaultRoleAndTeam,
  normalizeMsnv4,
} from '../utils/rbacAuth';

const envMeta = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const rawUrl = (
  envMeta.VITE_SUPABASE_URL ||
  'https://lskrcerzxltlrcewigrw.supabase.co'
).trim();
const rawAnonKey = (
  envMeta.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxza3JjZXJ6eGx0bHJjZXdpZ3J3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MjMwMzAsImV4cCI6MjA5MTQ5OTAzMH0.60K5fWetNDQkMl8G32Sy6E9-EkhpDHfzIhfmfOLcZOI'
).trim();

export const isSupabaseConfigured: boolean =
  rawUrl.startsWith('http') &&
  !rawUrl.includes('your-project-ref') &&
  rawAnonKey.length > 20 &&
  !rawAnonKey.includes('your-supabase-anon-public-key');

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(rawUrl, rawAnonKey, {
      auth: { persistSession: false },
    })
  : null;

// ============================================================================
// Chuyển đổi Enum giữa App (TypeScript) và PostgreSQL Schema (Supabase)
// ============================================================================

function toDbDepartment(dept: Department): 'VP' | 'DC' {
  return dept === 'van_phong' ? 'VP' : 'DC';
}

function fromDbDepartment(dbDept: string, msnv: string): Department {
  if (dbDept === 'VP') return 'van_phong';
  if (dbDept === 'DC') return 'day_chuyen';
  const norm = normalizeMsnv4(msnv);
  const vpSet = new Set(['0266', '1439', '0812', '0582', '0821', '0884', '0280', '1300']);
  return vpSet.has(norm) ? 'van_phong' : 'day_chuyen';
}

function toDbTeam(team?: TeamGroup): 'BAN_LANH_DAO' | 'TO_CO_LY' | 'TO_QC_KCS' | 'THONG_KE' {
  switch (team) {
    case 'ban_lanh_dao':
      return 'BAN_LANH_DAO';
    case 'to_co_ly':
      return 'TO_CO_LY';
    case 'thong_ke':
      return 'THONG_KE';
    case 'to_qc_kcs':
    default:
      return 'TO_QC_KCS';
  }
}

function fromDbTeam(dbTeam: string, msnv: string, position: string): TeamGroup {
  switch (dbTeam) {
    case 'BAN_LANH_DAO':
      return 'ban_lanh_dao';
    case 'TO_CO_LY':
      return 'to_co_ly';
    case 'TO_QC_KCS':
      return 'to_qc_kcs';
    case 'THONG_KE':
      return 'thong_ke';
    default:
      return inferDefaultRoleAndTeam(msnv, position).team;
  }
}

function toDbAccessLevel(role: UserRole): 'ADMIN' | 'LEADER' | 'TEAM_LEAD' | 'STAFF' {
  switch (role) {
    case 'admin':
      return 'ADMIN';
    case 'truong_phong':
      return 'LEADER';
    case 'to_quan_ly':
      return 'TEAM_LEAD';
    case 'nhan_vien':
    default:
      return 'STAFF';
  }
}

function fromDbAccessLevel(level: string, msnv: string, position: string): UserRole {
  switch (level) {
    case 'ADMIN':
      return 'admin';
    case 'LEADER':
      return 'truong_phong';
    case 'TEAM_LEAD':
      return 'to_quan_ly';
    case 'STAFF':
      return 'nhan_vien';
    default:
      return inferDefaultRoleAndTeam(msnv, position).role;
  }
}

function toDbCalcMode(mode: CalculationMode): 'MERGED' | 'SEPARATED' {
  return mode === 'B' ? 'SEPARATED' : 'MERGED';
}

function fromDbCalcMode(dbMode: string): CalculationMode {
  return dbMode === 'SEPARATED' ? 'B' : 'A';
}

// ============================================================================
// Đọc toàn bộ dữ liệu từ Supabase Cloud (5 bảng) về AppState
// ============================================================================

export interface CloudFetchResult {
  ok: boolean;
  isEmpty: boolean;
  state?: AppState;
  error?: string;
}

export async function fetchCloudAppState(fallbackState: AppState): Promise<CloudFetchResult> {
  if (!supabase) {
    return { ok: false, isEmpty: false, error: 'Chưa cấu hình biến môi trường Supabase.' };
  }

  try {
    const [empRes, pinRes, periodRes, entryRes, decRes] = await Promise.all([
      supabase.from('ktcn_employees').select('*').order('sort_order', { ascending: true }),
      supabase.from('ktcn_security_pins').select('*'),
      supabase.from('ktcn_payroll_periods').select('*').order('period_key', { ascending: true }),
      supabase.from('ktcn_payroll_entries').select('*'),
      supabase.from('ktcn_decisions').select('*').order('created_at', { ascending: false }),
    ]);

    const firstError =
      empRes.error || pinRes.error || periodRes.error || entryRes.error || decRes.error;
    if (firstError) {
      return { ok: false, isEmpty: false, error: firstError.message };
    }

    const dbEmployees = empRes.data ?? [];
    const dbPins = pinRes.data ?? [];
    const dbPeriods = periodRes.data ?? [];
    const dbEntries = entryRes.data ?? [];
    const dbDecisions = decRes.data ?? [];

    // Nếu bảng nhân sự & kỳ lương đều trống -> báo Cloud đang trống để hiện nút "Đẩy dữ liệu mẫu T10/2026 lên Cloud"
    if (dbEmployees.length === 0 && dbPeriods.length === 0) {
      return { ok: true, isEmpty: true };
    }

    // 1. Khôi phục danh sách nhân sự (ktcn_employees)
    const fallbackByNorm = new Map(
      fallbackState.employees.map((e) => [normalizeMsnv4(e.msnv), e]),
    );

    const employees: EmployeeMaster[] =
      dbEmployees.length > 0
        ? dbEmployees.map((row, idx) => {
            const rawMsnv = String(row.msnv ?? '');
            const fb = fallbackByNorm.get(normalizeMsnv4(rawMsnv));
            const msnvKey = fb ? fb.msnv : rawMsnv;
            const position = String(row.role ?? fb?.position ?? 'Nhân viên');
            const team = fromDbTeam(String(row.team ?? ''), msnvKey, position);
            const defaultRole = inferDefaultRoleAndTeam(msnvKey, position).role;
            return {
              id: String(row.id ?? fb?.id ?? `emp_${msnvKey}`),
              msnv: msnvKey,
              fullName: String(row.full_name ?? fb?.fullName ?? ''),
              position,
              department: fromDbDepartment(String(row.department ?? ''), msnvKey),
              team,
              role: fb?.role ?? defaultRole,
              baseSalary2020: Number(row.base_salary_2020 ?? fb?.baseSalary2020 ?? 0),
              hsCV: Number(row.hs_cv ?? fb?.hsCV ?? 0),
              hsTN: Number(row.hs_tn ?? fb?.hsTN ?? 0),
              active: String(row.status ?? 'ACTIVE') !== 'INACTIVE',
              sortOrder: Number(row.sort_order ?? fb?.sortOrder ?? idx + 1),
            };
          })
        : fallbackState.employees;

    // 2. Khôi phục bảo mật PIN 4 số (ktcn_security_pins)
    const pinByNorm = new Map<string, Record<string, unknown>>();
    for (const p of dbPins) {
      pinByNorm.set(normalizeMsnv4(String(p.msnv ?? '')), p);
    }

    const baseAccounts = buildDefaultAuthAccounts(employees, fallbackState.authAccounts);
    const authAccounts: Record<string, AuthAccount> = {};
    for (const emp of employees) {
      const norm = normalizeMsnv4(emp.msnv);
      const dbPin = pinByNorm.get(norm);
      const defAcc = baseAccounts[emp.msnv];
      if (dbPin) {
        const role = fromDbAccessLevel(
          String(dbPin.access_level ?? ''),
          emp.msnv,
          emp.position,
        );
        authAccounts[emp.msnv] = {
          msnv: emp.msnv,
          normalizedMsnv: norm,
          pinHash: String(dbPin.pin_hash ?? defAcc.pinHash),
          pinDisplayForAdmin: String(dbPin.pin_admin_view ?? defAcc.pinDisplayForAdmin),
          accessGranted: Boolean(dbPin.is_enabled),
          role,
          team: emp.team ?? defAcc.team,
          updatedAt: String(dbPin.updated_at ?? defAcc.updatedAt).slice(0, 10),
        };
        emp.role = role;
      } else {
        authAccounts[emp.msnv] = defAcc;
      }
    }

    // 3. Khôi phục các kỳ lương (ktcn_payroll_periods + ktcn_payroll_entries)
    const empByNorm = new Map(employees.map((e) => [normalizeMsnv4(e.msnv), e]));
    const entriesByPeriod = new Map<string, Record<string, unknown>[]>();
    for (const ent of dbEntries) {
      const pk = String(ent.period_key ?? '');
      const list = entriesByPeriod.get(pk) ?? [];
      list.push(ent);
      entriesByPeriod.set(pk, list);
    }

    const periods: Record<string, PayrollPeriod> = {};
    let latestSignatures: SignatureConfig | undefined;

    for (const pRow of dbPeriods) {
      const periodKey = String(pRow.period_key);
      const snapMeta = (pRow.summary_snapshot_json ?? {}) as Record<string, unknown>;
      const inputMode: InputMode = snapMeta.inputMode === 'direct' ? 'direct' : 'clusters';
      const directQuyKhoan = Number(snapMeta.directQuyKhoan ?? 0);
      const directThuongGop = Number(snapMeta.directThuongGop ?? 0);
      const bonusSharePct = Number(snapMeta.bonusSharePct ?? 50);

      if (snapMeta.signatures && typeof snapMeta.signatures === 'object') {
        latestSignatures = snapMeta.signatures as SignatureConfig;
      }

      const rawClusters = Array.isArray(pRow.clusters_json) ? pRow.clusters_json : [];
      const clusters: ProductionCluster[] = rawClusters.map((c: Record<string, unknown>, i: number) => ({
        id: String(c.id ?? `cluster_${i + 1}`),
        name: String(c.name ?? `Cụm ${i + 1}`),
        unitPrice: Number(c.unitPrice ?? 0),
        quantity: Number(c.quantity ?? 0),
        bonusOutputPct: Number(c.bonusOutputPct ?? 0),
        bonusQualityPct: Number(c.bonusQualityPct ?? 0),
      }));

      const rawDeductions = Array.isArray(pRow.deductions_json) ? pRow.deductions_json : [];
      const deductions: DeductionEntry[] = rawDeductions.map(
        (d: Record<string, unknown>, i: number) => ({
          id: String(d.id ?? `ded_${i + 1}`),
          dateOrRef: String(d.dateOrRef ?? periodKey),
          description: String(d.description ?? ''),
          amount: Number(d.amount ?? 0),
          scope: d.scope === 'ca_nhan' ? 'ca_nhan' : 'quy_thuong_chung',
          msnv: d.msnv ? String(d.msnv) : undefined,
        }),
      );

      const records: Record<string, AttendanceRecord> = {};
      const periodEntries = entriesByPeriod.get(periodKey) ?? [];

      for (const ent of periodEntries) {
        const rawMsnv = String(ent.msnv ?? '');
        const norm = normalizeMsnv4(rawMsnv);
        const masterEmp = empByNorm.get(norm);
        const msnvKey = masterEmp ? masterEmp.msnv : rawMsnv;
        const position = String(ent.role_snapshot ?? masterEmp?.position ?? 'Nhân viên');
        const team = fromDbTeam(String(ent.team_snapshot ?? ''), msnvKey, position);

        records[msnvKey] = {
          msnv: msnvKey,
          fullName: String(ent.full_name_snapshot ?? masterEmp?.fullName ?? ''),
          position,
          department: masterEmp?.department ?? fromDbDepartment('', msnvKey),
          team,
          baseSalary2020: masterEmp?.baseSalary2020 ?? 5310000,
          hsCV: Number(ent.hs_cv_snapshot ?? masterEmp?.hsCV ?? 0),
          hsTN: Number(ent.hs_tn_snapshot ?? masterEmp?.hsTN ?? 0),
          sortOrder: masterEmp?.sortOrder ?? 99,
          congKhoan: Number(ent.cong_khoan ?? 0),
          congBD: Number(ent.cong_bd ?? 0),
          truThuongCaNhan: Number(ent.tru_thuong_ca_nhan ?? 0),
        };
      }

      const status: PeriodStatus = String(pRow.status ?? 'DRAFT') === 'LOCKED' ? 'LOCKED' : 'DRAFT';
      const stdDays = Number(pRow.standard_days ?? 27) === 26 ? 26 : 27;

      periods[periodKey] = {
        periodKey,
        label: String(pRow.title ?? `Tháng ${pRow.month} năm ${pRow.year}`),
        status,
        inputMode,
        directQuyKhoan,
        directThuongGop,
        clusters,
        quyBD: Number(pRow.maintenance_fund ?? 0),
        deductions,
        bonusSharePct,
        calculationMode: fromDbCalcMode(String(pRow.calc_mode ?? 'MERGED')),
        standardDaysForHS1: stdDays,
        records,
      };
    }

    if (Object.keys(periods).length === 0) {
      Object.assign(periods, fallbackState.periods);
    }

    // 4. Khôi phục Quyết định giao khoán (ktcn_decisions)
    const policies: PolicyDecision[] =
      dbDecisions.length > 0
        ? dbDecisions.map((d) => {
            const cfg = (d.config_json ?? {}) as Record<string, unknown>;
            return {
              id: String(d.id),
              code: String(d.decision_number ?? ''),
              title: String(d.title ?? ''),
              effectiveFrom: String(d.effective_from ?? '2026-10'),
              bonusSharePct: Number(cfg.bonusSharePct ?? 50),
              baseSalaryDefault: Number(cfg.baseSalaryDefault ?? 5310000),
              notes: String(d.notes ?? ''),
              attachmentName: cfg.attachmentName ? String(cfg.attachmentName) : undefined,
              attachmentType: cfg.attachmentType ? String(cfg.attachmentType) : undefined,
              attachmentDataUrl: d.file_url ? String(d.file_url) : undefined,
              createdAt: String(d.created_at ?? '2026-10-01').slice(0, 10),
            };
          })
        : fallbackState.policies;

    const sortedPeriodKeys = Object.keys(periods).sort();
    const activePeriodKey = periods[fallbackState.activePeriodKey]
      ? fallbackState.activePeriodKey
      : sortedPeriodKeys[sortedPeriodKeys.length - 1];

    return {
      ok: true,
      isEmpty: false,
      state: {
        schemaVersion: fallbackState.schemaVersion,
        employees,
        periods,
        activePeriodKey,
        policies,
        hrChangeLog: fallbackState.hrChangeLog,
        signatures: latestSignatures ?? fallbackState.signatures,
        authAccounts,
      },
    };
  } catch (err) {
    return {
      ok: false,
      isEmpty: false,
      error: err instanceof Error ? err.message : 'Lỗi kết nối Supabase Cloud.',
    };
  }
}

// ============================================================================
// Các hàm Đồng bộ (Upsert) từ App lên Supabase Cloud
// ============================================================================

export async function syncEmployeesAndPinsToCloud(
  employees: EmployeeMaster[],
  authAccounts: Record<string, AuthAccount>,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Offline mode' };

  const nowIso = new Date().toISOString();
  const empRows = employees.map((emp) => ({
    msnv: normalizeMsnv4(emp.msnv),
    full_name: emp.fullName,
    role: emp.position,
    department: toDbDepartment(emp.department),
    team: toDbTeam(emp.team),
    base_salary_2020: emp.baseSalary2020,
    hs_cv: emp.hsCV,
    hs_tn: emp.hsTN,
    sort_order: emp.sortOrder,
    status: emp.active ? 'ACTIVE' : 'INACTIVE',
    updated_at: nowIso,
  }));

  const pinRows = employees.map((emp) => {
    const acc = authAccounts[emp.msnv];
    const defaults = inferDefaultRoleAndTeam(emp.msnv, emp.position);
    return {
      msnv: normalizeMsnv4(emp.msnv),
      access_level: toDbAccessLevel(acc?.role ?? emp.role ?? defaults.role),
      is_enabled: acc ? acc.accessGranted : false,
      pin_hash: acc?.pinHash ?? '',
      pin_admin_view: acc?.pinDisplayForAdmin ?? normalizeMsnv4(emp.msnv),
      updated_at: nowIso,
    };
  });

  const [res1, res2] = await Promise.all([
    supabase.from('ktcn_employees').upsert(empRows, { onConflict: 'msnv' }),
    supabase.from('ktcn_security_pins').upsert(pinRows, { onConflict: 'msnv' }),
  ]);

  const err = res1.error || res2.error;
  return err ? { ok: false, error: err.message } : { ok: true };
}

export async function syncSinglePinToCloud(
  account: AuthAccount,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Offline mode' };
  const { error } = await supabase.from('ktcn_security_pins').upsert(
    {
      msnv: account.normalizedMsnv,
      access_level: toDbAccessLevel(account.role),
      is_enabled: account.accessGranted,
      pin_hash: account.pinHash,
      pin_admin_view: account.pinDisplayForAdmin,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'msnv' },
  );
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function syncPeriodToCloud(
  period: PayrollPeriod,
  signatures?: SignatureConfig,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Offline mode' };

  const calc = calculatePayroll(period);
  const s = calc.summary;
  const [yearStr, monthStr] = period.periodKey.split('-');
  const year = Number(yearStr) || 2026;
  const month = Number(monthStr) || 10;
  const nowIso = new Date().toISOString();

  const summarySnapshot = {
    quyKhoan: s.quyKhoan,
    quyBD: s.quyBD,
    thuongGop: s.thuongGop,
    tongThuong: s.tongThuong,
    tongQuyLuong: s.tongQuyLuong,
    thuongChia: s.thuongChia,
    quyGiuLai: s.quyGiuLai,
    quyThucChia: s.quyThucChia,
    luongHS1: s.luongHS1,
    donGiaGop: s.donGiaGop,
    tongCongKhoan: s.tongCongKhoan,
    tongHSNgayCong: s.tongHSNgayCong,
    inputMode: period.inputMode,
    directQuyKhoan: period.directQuyKhoan,
    directThuongGop: period.directThuongGop,
    bonusSharePct: period.bonusSharePct,
    signatures,
  };

  const periodRow = {
    period_key: period.periodKey,
    month,
    year,
    title: period.label,
    status: period.status ?? 'DRAFT',
    calc_mode: toDbCalcMode(period.calculationMode),
    standard_days: period.standardDaysForHS1,
    clusters_json: period.clusters,
    maintenance_fund: period.quyBD,
    deductions_json: period.deductions,
    summary_snapshot_json: summarySnapshot,
    updated_at: nowIso,
  };

  const { error: pErr } = await supabase
    .from('ktcn_payroll_periods')
    .upsert(periodRow, { onConflict: 'period_key' });
  if (pErr) return { ok: false, error: pErr.message };

  const entryRows = calc.rows.map((r) => ({
    period_key: period.periodKey,
    msnv: normalizeMsnv4(r.msnv),
    full_name_snapshot: r.fullName,
    role_snapshot: r.position,
    team_snapshot: toDbTeam(r.team ?? inferDefaultRoleAndTeam(r.msnv, r.position).team),
    hs_cv_snapshot: r.hsCV,
    hs_tn_snapshot: r.hsTN,
    cong_khoan: r.congKhoan,
    cong_bd: r.congBD,
    tru_thuong_ca_nhan: r.tongTruThuong,
    luong_khoan: Math.round(r.luongKhoanHienThi),
    luong_bd: Math.round(r.luongBDHienThi),
    tien_thuong: Math.round(r.tienThuongHienThi),
    tong_luong: Math.round(r.tongLuongHienThi),
    updated_at: nowIso,
  }));

  if (entryRows.length > 0) {
    const { error: eErr } = await supabase
      .from('ktcn_payroll_entries')
      .upsert(entryRows, { onConflict: 'period_key,msnv' });
    if (eErr) return { ok: false, error: eErr.message };
  }

  return { ok: true };
}

export async function deletePeriodFromCloud(
  periodKey: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Offline mode' };
  const { error } = await supabase
    .from('ktcn_payroll_periods')
    .delete()
    .eq('period_key', periodKey);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function syncDecisionsToCloud(
  policies: PolicyDecision[],
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Offline mode' };
  if (policies.length === 0) return { ok: true };

  const rows = policies.map((pol) => ({
    id: pol.id,
    decision_number: pol.code,
    effective_from: pol.effectiveFrom,
    title: pol.title,
    notes: pol.notes ?? '',
    file_url: pol.attachmentDataUrl ?? null,
    config_json: {
      bonusSharePct: pol.bonusSharePct,
      baseSalaryDefault: pol.baseSalaryDefault,
      attachmentName: pol.attachmentName,
      attachmentType: pol.attachmentType,
    },
  }));

  const { error } = await supabase.from('ktcn_decisions').upsert(rows, { onConflict: 'id' });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteDecisionFromCloud(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Offline mode' };
  const { error } = await supabase.from('ktcn_decisions').delete().eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Đẩy toàn bộ dữ liệu (Nhân sự + PIN + Các kỳ lương + Quyết định) lên Supabase Cloud chỉ bằng 1 click */
export async function pushFullStateToCloud(
  state: AppState,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) {
    return { ok: false, error: 'Chưa cấu hình kết nối Supabase.' };
  }

  const authAccounts = buildDefaultAuthAccounts(state.employees, state.authAccounts);
  const empPinRes = await syncEmployeesAndPinsToCloud(state.employees, authAccounts);
  if (!empPinRes.ok) return empPinRes;

  for (const period of Object.values(state.periods)) {
    const pRes = await syncPeriodToCloud(period, state.signatures);
    if (!pRes.ok) return pRes;
  }

  const decRes = await syncDecisionsToCloud(state.policies);
  if (!decRes.ok) return decRes;

  return { ok: true };
}
