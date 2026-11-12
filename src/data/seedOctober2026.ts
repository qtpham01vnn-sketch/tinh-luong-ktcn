import type {
  AppState,
  AttendanceRecord,
  EmployeeMaster,
  PayrollPeriod,
  SignatureConfig,
} from '../types/payroll';
import { buildDefaultAuthAccounts, inferDefaultRoleAndTeam } from '../utils/rbacAuth';

export const SCHEMA_VERSION = 2;

export const DEFAULT_SIGNATURES: SignatureConfig = {
  docNumber: '',
  place: 'TP. Hồ Chí Minh',
  issueDate: '',
  preparedBy: '',
  headOfDept: 'Đặng Thanh Tùng',
  deputyTCHC: '',
  deputyInCharge: '',
};

interface SeedEmpInput {
  msnv: string;
  fullName: string;
  position: string;
  department: 'van_phong' | 'day_chuyen';
  baseSalary2020: number;
  hsCV: number;
  hsTN: number;
  congKhoan: number;
  congBD: number;
}

const SEED_EMPLOYEES_WITH_ATTENDANCE: SeedEmpInput[] = [
  // A. Bộ phận Văn phòng (8 người)
  { msnv: '0266', fullName: 'Đặng Thanh Tùng', position: 'Trưởng phòng', department: 'van_phong', baseSalary2020: 8400000, hsCV: 3.0, hsTN: 1.8, congKhoan: 27, congBD: 0.5 },
  { msnv: '1439', fullName: 'Phạm Quốc Tuấn', position: 'Phó phòng', department: 'van_phong', baseSalary2020: 7560000, hsCV: 2.5, hsTN: 1.3, congKhoan: 27, congBD: 0.5 },
  { msnv: '0812', fullName: 'Phạm Thị Thu Hiền', position: 'Tổ trưởng CL', department: 'van_phong', baseSalary2020: 5870000, hsCV: 1.6, hsTN: 0.8, congKhoan: 27.25, congBD: 0.5 },
  { msnv: '0582', fullName: 'Châu Minh Thiện', position: 'Tổ trưởng KCS', department: 'van_phong', baseSalary2020: 5870000, hsCV: 1.6, hsTN: 0.8, congKhoan: 28.25, congBD: 1.5 },
  { msnv: '0821', fullName: 'Vũ Ngọc Thiện', position: 'Tổ phó Cơ lý', department: 'van_phong', baseSalary2020: 5870000, hsCV: 1.6, hsTN: 0.4, congKhoan: 27, congBD: 0.5 },
  { msnv: '0884', fullName: 'Nguyễn Hoàng Long', position: 'Tổ phó QC', department: 'van_phong', baseSalary2020: 5870000, hsCV: 1.6, hsTN: 0.4, congKhoan: 29.875, congBD: 0 },
  { msnv: '0280', fullName: 'Hà Duy Đức', position: 'Tổ phó QC', department: 'van_phong', baseSalary2020: 5870000, hsCV: 1.6, hsTN: 0.4, congKhoan: 30.4375, congBD: 0.5 },
  { msnv: '1300', fullName: 'Nguyễn A. Mạnh Quyết', position: 'Tổ phó Cơ lý', department: 'van_phong', baseSalary2020: 5870000, hsCV: 1.6, hsTN: 0.4, congKhoan: 27, congBD: 0.5 },

  // B. Bộ phận Nhân viên Dây chuyền 1+2 (15 người)
  { msnv: '579', fullName: 'Phạm Huyền Trang', position: 'Thống kê', department: 'day_chuyen', baseSalary2020: 5310000, hsCV: 1.4, hsTN: 0, congKhoan: 26.3125, congBD: 0.5 },
  { msnv: '1529', fullName: 'Trần Thị Thu Thủy', position: 'Nhân viên cơ lý', department: 'day_chuyen', baseSalary2020: 5310000, hsCV: 1.42, hsTN: 0, congKhoan: 26.75, congBD: 0.5 },
  { msnv: '0696', fullName: 'Mai Thị Thùy', position: 'Nhân viên cơ lý', department: 'day_chuyen', baseSalary2020: 5310000, hsCV: 1.42, hsTN: 0, congKhoan: 27, congBD: 0.75 },
  { msnv: '0883', fullName: 'Lê Thị Mỹ Quyên', position: 'Nhân viên cơ lý', department: 'day_chuyen', baseSalary2020: 5310000, hsCV: 1.42, hsTN: 0, congKhoan: 25.9375, congBD: 0.5 },
  { msnv: '0959', fullName: 'Nguyễn Thị Loan', position: 'Nhân viên cơ lý', department: 'day_chuyen', baseSalary2020: 5310000, hsCV: 1.42, hsTN: 0, congKhoan: 27, congBD: 0.75 },
  { msnv: '1820', fullName: 'Vũ Bích Trâm', position: 'Nhân viên cơ lý', department: 'day_chuyen', baseSalary2020: 5310000, hsCV: 1.42, hsTN: 0, congKhoan: 26.9375, congBD: 0 },
  { msnv: '0915', fullName: 'Nguyễn Kim Ngân', position: 'Nhân viên KCS', department: 'day_chuyen', baseSalary2020: 5310000, hsCV: 1.42, hsTN: 0, congKhoan: 29.75, congBD: 1.5 },
  { msnv: '0886', fullName: 'Nguyễn Minh Phước', position: 'Nhân viên KCS', department: 'day_chuyen', baseSalary2020: 5310000, hsCV: 1.42, hsTN: 0, congKhoan: 30, congBD: 0 },
  { msnv: '1202', fullName: 'Phạm Tấn Phát', position: 'Nhân viên KCS', department: 'day_chuyen', baseSalary2020: 5310000, hsCV: 1.42, hsTN: 0, congKhoan: 0.125, congBD: 0 },
  { msnv: '1528', fullName: 'Nguyễn Quốc Tộc', position: 'Nhân viên KCS', department: 'day_chuyen', baseSalary2020: 5310000, hsCV: 1.42, hsTN: 0, congKhoan: 30, congBD: 0 },
  { msnv: '1215', fullName: 'Trương Thành Phát', position: 'Nhân viên KCS', department: 'day_chuyen', baseSalary2020: 5310000, hsCV: 1.42, hsTN: 0, congKhoan: 30.25, congBD: 0 },
  { msnv: '1547', fullName: 'Nguyễn Bá Huy', position: 'Nhân viên KCS', department: 'day_chuyen', baseSalary2020: 5310000, hsCV: 1.42, hsTN: 0, congKhoan: 23, congBD: 0 },
  { msnv: '1255', fullName: 'Hoàng T.M Tuyền', position: 'MC', department: 'day_chuyen', baseSalary2020: 5310000, hsCV: 1.42, hsTN: 0, congKhoan: 25.4375, congBD: 0 },
  { msnv: '1117', fullName: 'Trần Minh Thuận', position: 'MC', department: 'day_chuyen', baseSalary2020: 5310000, hsCV: 1.42, hsTN: 0, congKhoan: 26.9375, congBD: 0 },
  { msnv: '1116', fullName: 'Mai Thanh Vinh', position: 'MC', department: 'day_chuyen', baseSalary2020: 5310000, hsCV: 1.42, hsTN: 0, congKhoan: 26, congBD: 0 },
];

export function createInitialAppState(): AppState {
  const employees: EmployeeMaster[] = SEED_EMPLOYEES_WITH_ATTENDANCE.map((e, idx) => {
    const { role, team } = inferDefaultRoleAndTeam(e.msnv, e.position);
    return {
      id: `emp_${e.msnv}`,
      msnv: e.msnv,
      fullName: e.fullName,
      position: e.position,
      department: e.department,
      team,
      role,
      baseSalary2020: e.baseSalary2020,
      hsCV: e.hsCV,
      hsTN: e.hsTN,
      active: true,
      sortOrder: idx + 1,
    };
  });

  const records: Record<string, AttendanceRecord> = {};
  SEED_EMPLOYEES_WITH_ATTENDANCE.forEach((e, idx) => {
    const { team } = inferDefaultRoleAndTeam(e.msnv, e.position);
    records[e.msnv] = {
      msnv: e.msnv,
      congKhoan: e.congKhoan,
      congBD: e.congBD,
      truThuongCaNhan: 0,
      hsCV: e.hsCV,
      hsTN: e.hsTN,
      baseSalary2020: e.baseSalary2020,
      fullName: e.fullName,
      position: e.position,
      department: e.department,
      team,
      sortOrder: idx + 1,
    };
  });

  const authAccounts = buildDefaultAuthAccounts(employees);

  const oct2026: PayrollPeriod = {
    periodKey: '2026-10',
    label: 'Tháng 10 năm 2026',
    inputMode: 'clusters',
    directQuyKhoan: 293952278.88,
    directThuongGop: 16128798.6672,
    clusters: [
      {
        id: 'cluster_1',
        name: 'Cụm 1 (Dây chuyền 1)',
        unitPrice: 491688.36,
        quantity: 303,
        bonusOutputPct: 2,
        bonusQualityPct: 2,
      },
      {
        id: 'cluster_2',
        name: 'Cụm 2 (Dây chuyền 2)',
        unitPrice: 73236.96,
        quantity: 325,
        bonusOutputPct: 2,
        bonusQualityPct: 0,
      },
      {
        id: 'cluster_3',
        name: 'Cụm 3 (Sản lượng chung)',
        unitPrice: 313097.4,
        quantity: 387,
        bonusOutputPct: 4,
        bonusQualityPct: 4,
      },
    ],
    quyBD: 4659480,
    deductions: [
      {
        id: 'ded_oct_1',
        dateOrRef: 'T10/2026',
        description: 'Trừ khoán tháng 10/2026',
        amount: 2030028,
        scope: 'quy_thuong_chung',
      },
    ],
    bonusSharePct: 50,
    calculationMode: 'A',
    standardDaysForHS1: 27,
    records,
  };

  return {
    schemaVersion: SCHEMA_VERSION,
    hrChangeLog: [],
    signatures: { ...DEFAULT_SIGNATURES },
    authAccounts,
    employees,
    periods: {
      '2026-10': oct2026,
    },
    activePeriodKey: '2026-10',
    policies: [
      {
        id: 'pol_2026_default',
        code: 'QĐ-KHOÁN-2026',
        title: 'Quy định giao khoán sản lượng & thưởng Phòng KTCN năm 2026',
        effectiveFrom: '2026-01',
        bonusSharePct: 50,
        baseSalaryDefault: 5310000,
        notes: 'Trích thưởng 50% chia trong tháng, 50% giữ lại quỹ. Lương HS 1 tính theo 27 công chuẩn.',
        createdAt: '2026-10-01',
      },
    ],
  };
}
