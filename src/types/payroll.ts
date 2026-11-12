export type Department = 'van_phong' | 'day_chuyen';

/** A: Gộp quỹ chia theo công khoán (mẫu KTCN) — B: Tách riêng 3 quỹ */
export type CalculationMode = 'A' | 'B';

export type InputMode = 'clusters' | 'direct';

export interface EmployeeMaster {
  id: string;
  msnv: string;
  fullName: string;
  position: string;
  department: Department;
  baseSalary2020: number;
  hsCV: number;
  hsTN: number;
  active: boolean;
  sortOrder: number;
}

export interface ProductionCluster {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  bonusOutputPct: number; // % thưởng vượt sản lượng
  bonusQualityPct: number; // % thưởng chất lượng
}

export type DeductionScope = 'quy_thuong_chung' | 'ca_nhan';

export interface DeductionEntry {
  id: string;
  dateOrRef: string;
  description: string;
  amount: number;
  scope: DeductionScope;
  msnv?: string;
}

export interface PolicyDecision {
  id: string;
  code: string;
  title: string;
  effectiveFrom: string; // YYYY-MM
  bonusSharePct: number;
  baseSalaryDefault: number;
  notes: string;
  attachmentName?: string;
  attachmentType?: string;
  attachmentDataUrl?: string;
  createdAt: string;
}

/** Bản chụp (snapshot) nhân sự + hệ số tại kỳ lương — bảo toàn lịch sử */
export interface AttendanceRecord {
  msnv: string;
  fullName: string;
  position: string;
  department: Department;
  baseSalary2020: number;
  hsCV: number;
  hsTN: number;
  sortOrder: number;
  congKhoan: number;
  congBD: number;
  truThuongCaNhan: number;
}

export interface PayrollPeriod {
  periodKey: string; // YYYY-MM
  label: string; // "Tháng 10 năm 2026"
  inputMode: InputMode;
  directQuyKhoan: number;
  directThuongGop: number;
  clusters: ProductionCluster[];
  quyBD: number;
  deductions: DeductionEntry[];
  bonusSharePct: number;
  calculationMode: CalculationMode;
  standardDaysForHS1: 27 | 26;
  records: Record<string, AttendanceRecord>; // key = msnv
}

export interface HrChangeLogEntry {
  id: string;
  timestamp: string;
  periodKey: string;
  msnv: string;
  fullName: string;
  action: 'create' | 'update' | 'lock' | 'unlock' | 'import';
  detail: string;
}

export interface SignatureConfig {
  docNumber: string;
  place: string;
  issueDate: string; // YYYY-MM-DD, rỗng = để trống ngày
  preparedBy: string;
  headOfDept: string;
  deputyTCHC: string;
  deputyInCharge: string;
}

export interface AppState {
  schemaVersion: number;
  employees: EmployeeMaster[];
  periods: Record<string, PayrollPeriod>;
  activePeriodKey: string;
  policies: PolicyDecision[];
  hrChangeLog: HrChangeLogEntry[];
  signatures: SignatureConfig;
}
