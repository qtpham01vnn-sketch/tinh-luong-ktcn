import type {
  AppState,
  AttendanceRecord,
  EmployeeMaster,
  PayrollPeriod,
  PolicyDecision,
} from '../types/payroll';
import { createInitialAppState, DEFAULT_SIGNATURES, SCHEMA_VERSION } from '../data/seedOctober2026';

export function periodLabel(periodKey: string): string {
  const [y, m] = periodKey.split('-');
  return `Tháng ${Number(m)} năm ${y}`;
}

export function isValidPeriodKey(key: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(key);
}

export function nextPeriodKey(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

export function snapshotFromEmployee(
  e: EmployeeMaster,
  carry?: Partial<AttendanceRecord>,
): AttendanceRecord {
  return {
    msnv: e.msnv,
    fullName: e.fullName,
    position: e.position,
    department: e.department,
    baseSalary2020: e.baseSalary2020,
    hsCV: e.hsCV,
    hsTN: e.hsTN,
    sortOrder: e.sortOrder,
    congKhoan: carry?.congKhoan ?? 0,
    congBD: carry?.congBD ?? 0,
    truThuongCaNhan: carry?.truThuongCaNhan ?? 0,
  };
}

/** Quyết định khoán có hiệu lực gần nhất (effectiveFrom <= periodKey) */
export function getEffectivePolicy(
  policies: PolicyDecision[],
  periodKey: string,
): PolicyDecision | undefined {
  return [...policies]
    .filter((p) => p.effectiveFrom <= periodKey)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
}

/**
 * Tạo kỳ lương mới từ kỳ trước: giữ cấu hình cụm (đơn giá, %), quỹ BD, chế độ tính;
 * lấy danh sách nhân sự ĐANG HOẠT ĐỘNG từ hồ sơ gốc với hệ số hiện hành; reset công = 0.
 */
export function buildPeriodFromPrevious(
  state: AppState,
  newKey: string,
  sourceKey: string,
): PayrollPeriod {
  const src = state.periods[sourceKey];
  const policy = getEffectivePolicy(state.policies, newKey);
  const records: Record<string, AttendanceRecord> = {};
  for (const e of state.employees.filter((x) => x.active)) {
    records[e.msnv] = snapshotFromEmployee(e);
  }
  return {
    periodKey: newKey,
    label: periodLabel(newKey),
    inputMode: src?.inputMode ?? 'clusters',
    directQuyKhoan: 0,
    directThuongGop: 0,
    clusters: (src?.clusters ?? []).map((c, i) => ({
      ...c,
      id: `cluster_${newKey}_${i}`,
      quantity: 0,
    })),
    quyBD: src?.quyBD ?? 0,
    deductions: [],
    bonusSharePct: policy?.bonusSharePct ?? src?.bonusSharePct ?? 50,
    calculationMode: src?.calculationMode ?? 'A',
    standardDaysForHS1: src?.standardDaysForHS1 ?? 27,
    records,
  };
}

/** Kiểm tra & bổ sung trường thiếu khi nạp dữ liệu từ localStorage / file JSON */
export function normalizeAppState(raw: unknown): AppState {
  if (!raw || typeof raw !== 'object') throw new Error('Dữ liệu không hợp lệ');
  const s = raw as Partial<AppState>;
  if (!Array.isArray(s.employees) || !s.periods || typeof s.periods !== 'object') {
    throw new Error('Thiếu danh sách nhân sự hoặc kỳ lương');
  }
  const employees: EmployeeMaster[] = s.employees.map((e, i) => ({
    ...e,
    sortOrder: typeof e.sortOrder === 'number' ? e.sortOrder : i + 1,
    active: e.active !== false,
  }));
  const orderMap = new Map(employees.map((e) => [e.msnv, e.sortOrder]));

  const periods: Record<string, PayrollPeriod> = {};
  for (const [key, p] of Object.entries(s.periods)) {
    if (!isValidPeriodKey(key) || !p || typeof p !== 'object') continue;
    const records: Record<string, AttendanceRecord> = {};
    for (const [msnv, r] of Object.entries(p.records ?? {})) {
      records[msnv] = {
        ...r,
        sortOrder: typeof r.sortOrder === 'number' ? r.sortOrder : orderMap.get(msnv) ?? 999,
        congKhoan: Number(r.congKhoan) || 0,
        congBD: Number(r.congBD) || 0,
        truThuongCaNhan: Number(r.truThuongCaNhan) || 0,
      };
    }
    periods[key] = {
      ...p,
      periodKey: key,
      label: p.label || periodLabel(key),
      clusters: Array.isArray(p.clusters) ? p.clusters : [],
      deductions: Array.isArray(p.deductions) ? p.deductions : [],
      standardDaysForHS1: p.standardDaysForHS1 === 26 ? 26 : 27,
      calculationMode: p.calculationMode === 'B' ? 'B' : 'A',
      records,
    };
  }
  const keys = Object.keys(periods).sort();
  if (keys.length === 0) throw new Error('Không có kỳ lương hợp lệ');

  return {
    schemaVersion: SCHEMA_VERSION,
    employees,
    periods,
    activePeriodKey:
      s.activePeriodKey && periods[s.activePeriodKey] ? s.activePeriodKey : keys[keys.length - 1],
    policies: Array.isArray(s.policies) ? s.policies : [],
    hrChangeLog: Array.isArray(s.hrChangeLog) ? s.hrChangeLog : [],
    signatures: { ...DEFAULT_SIGNATURES, ...(s.signatures ?? {}) },
  };
}

export const STORAGE_KEY = 'ktcn_payroll_phuongnam_v1';

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeAppState(JSON.parse(raw));
  } catch (err) {
    console.warn('Không đọc được dữ liệu đã lưu, khởi tạo dữ liệu mẫu T10/2026.', err);
  }
  return createInitialAppState();
}

/** Trả về thông báo lỗi nếu không lưu được (VD: vượt dung lượng localStorage) */
export function saveState(state: AppState): string | null {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return null;
  } catch {
    return 'Không thể lưu tự động: bộ nhớ trình duyệt đã đầy (thường do file Quyết định đính kèm quá lớn). Hãy Sao lưu JSON và xóa bớt file đính kèm.';
  }
}
