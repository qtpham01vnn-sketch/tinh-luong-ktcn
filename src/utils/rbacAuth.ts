import type {
  AuthAccount,
  Department,
  EmployeeMaster,
  TeamGroup,
  UserRole,
} from '../types/payroll';
import type {
  CalculatedEmployeeRow,
  DepartmentSubtotal,
  PayrollCalculationResult,
} from './payrollCalc';

/** Chuẩn hóa MSNV thành 4 chữ số: VD "579" -> "0579", "0266" -> "0266" */
export function normalizeMsnv4(raw: string): string {
  const trimmed = String(raw ?? '').trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return trimmed;
  return digits.padStart(4, '0').slice(-4);
}

/** Băm SHA-256 chuẩn FIPS 180-4 (đồng bộ, chạy trên cả Browser và Node test) */
export function sha256Hex(ascii: string): string {
  const rightRotate = (value: number, amount: number) =>
    (value >>> amount) | (value << (32 - amount));

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';

  const words: number[] = [];
  const bytes = new TextEncoder().encode(ascii);
  const bitLength = bytes.length * 8;

  let hash = sha256Hex._h ? sha256Hex._h.slice(0) : [];
  const k = sha256Hex._k ? sha256Hex._k : [];
  let primeCounter = k.length;

  if (!primeCounter) {
    const isComposite: Record<number, number> = {};
    for (let candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (let i = 0; i < 313; i += candidate) {
          isComposite[i] = candidate;
        }
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    sha256Hex._h = hash.slice(0);
    sha256Hex._k = k;
  }

  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 4, bitLength, false);

  for (let i = 0; i < paddedLength; i += 4) {
    words.push(view.getUint32(i, false));
  }

  const w = new Array<number>(64);
  for (let j = 0; j < words.length; j += 16) {
    const oldHash = hash.slice(0);
    for (let i = 0; i < 64; i++) {
      if (i < 16) {
        w[i] = words[j + i];
      } else {
        const gamma0x = w[i - 15];
        const gamma0 =
          rightRotate(gamma0x, 7) ^ rightRotate(gamma0x, 18) ^ (gamma0x >>> 3);
        const gamma1x = w[i - 2];
        const gamma1 =
          rightRotate(gamma1x, 17) ^ rightRotate(gamma1x, 19) ^ (gamma1x >>> 10);
        w[i] = (w[i - 16] + gamma0 + w[i - 7] + gamma1) | 0;
      }

      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const sigma0 =
        rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const sigma1 =
        rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);

      const t1 = (hash[7] + sigma1 + ch + k[i] + w[i]) | 0;
      const t2 = (sigma0 + maj) | 0;

      hash = [
        (t1 + t2) | 0,
        hash[0],
        hash[1],
        hash[2],
        (hash[3] + t1) | 0,
        hash[4],
        hash[5],
        hash[6],
      ];
    }

    for (let i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}
sha256Hex._h = undefined as number[] | undefined;
sha256Hex._k = undefined as number[] | undefined;

export const TEAM_LABELS: Record<TeamGroup, string> = {
  ban_lanh_dao: 'Ban lãnh đạo phòng',
  to_co_ly: 'Tổ Cơ lý',
  to_qc_kcs: 'Tổ QC / KCS',
  thong_ke: 'Thống kê phòng',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Cấp 1 — Admin (Toàn quyền)',
  truong_phong: 'Cấp 2 — Trưởng phòng (Xem toàn phòng)',
  to_quan_ly: 'Cấp 3 — Tổ trưởng / Tổ phó (Xem theo Tổ)',
  nhan_vien: 'Cấp 4 — Nhân viên (Xem cá nhân)',
};

const CO_LY_MANAGERS = new Set(['0812', '0821', '1300']);
const CO_LY_MEMBERS = new Set(['0812', '0821', '1300', '1529', '0696', '0883', '0959', '1820']);

const QC_KCS_MANAGERS = new Set(['0582', '0884', '0280']);
const QC_KCS_MEMBERS = new Set([
  '0582',
  '0884',
  '0280',
  '0915',
  '0886',
  '1202',
  '1528',
  '1215',
  '1547',
  '1255',
  '1117',
  '1116',
]);

/** Xác định Cấp phân quyền và Tổ mặc định theo đúng cơ cấu 23 nhân sự Phòng KTCN */
export function inferDefaultRoleAndTeam(
  msnv: string,
  position: string,
): { role: UserRole; team: TeamGroup } {
  const norm = normalizeMsnv4(msnv);
  if (norm === '1439') {
    return { role: 'admin', team: 'ban_lanh_dao' };
  }
  if (norm === '0266') {
    return { role: 'truong_phong', team: 'ban_lanh_dao' };
  }
  if (CO_LY_MANAGERS.has(norm)) {
    return { role: 'to_quan_ly', team: 'to_co_ly' };
  }
  if (QC_KCS_MANAGERS.has(norm)) {
    return { role: 'to_quan_ly', team: 'to_qc_kcs' };
  }
  if (CO_LY_MEMBERS.has(norm)) {
    return { role: 'nhan_vien', team: 'to_co_ly' };
  }
  if (QC_KCS_MEMBERS.has(norm)) {
    return { role: 'nhan_vien', team: 'to_qc_kcs' };
  }
  if (norm === '0579') {
    return { role: 'nhan_vien', team: 'thong_ke' };
  }

  // Fallback theo chức vụ cho nhân sự mới thêm sau này
  const posLower = (position || '').toLowerCase();
  if (posLower.includes('trưởng phòng')) {
    return { role: 'truong_phong', team: 'ban_lanh_dao' };
  }
  if (posLower.includes('phó phòng')) {
    return { role: 'admin', team: 'ban_lanh_dao' };
  }
  const isManager = posLower.includes('tổ trưởng') || posLower.includes('tổ phó');
  if (posLower.includes('cơ lý') || posLower.includes('cl')) {
    return { role: isManager ? 'to_quan_ly' : 'nhan_vien', team: 'to_co_ly' };
  }
  if (posLower.includes('thống kê')) {
    return { role: 'nhan_vien', team: 'thong_ke' };
  }
  return { role: isManager ? 'to_quan_ly' : 'nhan_vien', team: 'to_qc_kcs' };
}

/** Khởi tạo tài khoản PIN mặc định từ danh sách nhân sự (PIN 4 số = MSNV chuẩn hóa 4 ký tự) */
export function buildDefaultAuthAccounts(
  employees: EmployeeMaster[],
  existing?: Record<string, AuthAccount>,
): Record<string, AuthAccount> {
  const result: Record<string, AuthAccount> = {};
  for (const emp of employees) {
    const norm = normalizeMsnv4(emp.msnv);
    const prev = existing?.[emp.msnv] ?? existing?.[norm];
    const defaults = inferDefaultRoleAndTeam(emp.msnv, emp.position);
    const role = emp.role ?? prev?.role ?? defaults.role;
    const team = emp.team ?? prev?.team ?? defaults.team;
    const defaultPin = norm;

    if (prev) {
      result[emp.msnv] = {
        ...prev,
        msnv: emp.msnv,
        normalizedMsnv: norm,
        role,
        team,
      };
    } else {
      result[emp.msnv] = {
        msnv: emp.msnv,
        normalizedMsnv: norm,
        pinHash: sha256Hex(defaultPin),
        pinDisplayForAdmin: defaultPin,
        // Mặc định kích hoạt sẵn cho Admin (1439) và Trưởng phòng (0266)
        accessGranted: norm === '1439' || norm === '0266',
        role,
        team,
        updatedAt: '2026-10-01',
      };
    }
  }
  return result;
}

export function generateRandomPin4(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return String(n);
}

export interface AuthLoginResult {
  ok: boolean;
  account?: AuthAccount;
  employee?: EmployeeMaster;
  error?: string;
}

export function authenticateWithPin(
  authAccounts: Record<string, AuthAccount>,
  employees: EmployeeMaster[],
  inputMsnv: string,
  inputPin: string,
): AuthLoginResult {
  const normInput = normalizeMsnv4(inputMsnv);
  const pinTrimmed = String(inputPin ?? '').trim();

  if (!/^\d{4}$/.test(pinTrimmed)) {
    return { ok: false, error: 'Mã PIN phải gồm đúng 4 chữ số.' };
  }

  const employee = employees.find((e) => normalizeMsnv4(e.msnv) === normInput);
  if (!employee) {
    return { ok: false, error: `Không tìm thấy nhân sự có MSNV "${normInput}".` };
  }
  if (!employee.active) {
    return { ok: false, error: `Nhân sự ${employee.fullName} (${normInput}) hiện đang bị khóa trạng thái làm việc.` };
  }

  const account = authAccounts[employee.msnv] ?? Object.values(authAccounts).find((a) => a.normalizedMsnv === normInput);
  if (!account) {
    return { ok: false, error: 'Không tìm thấy cấu hình bảo mật cho nhân sự này.' };
  }

  if (!account.accessGranted) {
    return {
      ok: false,
      error: `Tài khoản ${employee.fullName} (MSNV ${normInput}) chưa được cấp quyền truy cập. Vui lòng liên hệ Admin Phạm Quốc Tuấn (1439) để mở quyền.`,
    };
  }

  const inputHash = sha256Hex(pinTrimmed);
  if (inputHash !== account.pinHash) {
    return { ok: false, error: 'Mã PIN 4 số không chính xác. Vui lòng kiểm tra lại.' };
  }

  return { ok: true, account, employee };
}

export interface RolePermissionMatrix {
  role: UserRole;
  team: TeamGroup;
  canEdit: boolean;
  canManageSecurity: boolean;
  canViewAllRoom: boolean;
  canViewTeamOnly: boolean;
  isSelfOnly: boolean;
  canExportFullRoom: boolean;
  canExportTeam: boolean;
  canExportSelfSlip: boolean;
  scopeTitle: string;
  badgeText: string;
}

export function getRolePermissions(account: AuthAccount): RolePermissionMatrix {
  switch (account.role) {
    case 'admin':
      return {
        role: 'admin',
        team: account.team,
        canEdit: true,
        canManageSecurity: true,
        canViewAllRoom: true,
        canViewTeamOnly: false,
        isSelfOnly: false,
        canExportFullRoom: true,
        canExportTeam: true,
        canExportSelfSlip: true,
        scopeTitle: 'Toàn phòng KTCN (23/23 nhân sự)',
        badgeText: 'Cấp 1: Admin — Toàn quyền Chỉnh sửa & Quản trị Bảo mật',
      };
    case 'truong_phong':
      return {
        role: 'truong_phong',
        team: account.team,
        canEdit: false,
        canManageSecurity: false,
        canViewAllRoom: true,
        canViewTeamOnly: false,
        isSelfOnly: false,
        canExportFullRoom: true,
        canExportTeam: true,
        canExportSelfSlip: true,
        scopeTitle: 'Toàn phòng KTCN (23/23 nhân sự)',
        badgeText: 'Chế độ Xem (Chỉ Admin được chỉnh sửa)',
      };
    case 'to_quan_ly':
      return {
        role: 'to_quan_ly',
        team: account.team,
        canEdit: false,
        canManageSecurity: false,
        canViewAllRoom: false,
        canViewTeamOnly: true,
        isSelfOnly: false,
        canExportFullRoom: false,
        canExportTeam: true,
        canExportSelfSlip: true,
        scopeTitle: `${TEAM_LABELS[account.team]} (${account.team === 'to_co_ly' ? '8 nhân sự' : '12 nhân sự'})`,
        badgeText: `Chế độ Xem ${TEAM_LABELS[account.team]} (Read-Only)`,
      };
    case 'nhan_vien':
    default:
      return {
        role: 'nhan_vien',
        team: account.team,
        canEdit: false,
        canManageSecurity: false,
        canViewAllRoom: false,
        canViewTeamOnly: false,
        isSelfOnly: true,
        canExportFullRoom: false,
        canExportTeam: false,
        canExportSelfSlip: true,
        scopeTitle: 'Phiếu lương cá nhân (Bảo mật tuyệt đối)',
        badgeText: 'Chế độ Xem Cá nhân (Read-Only)',
      };
  }
}

function sumSubtotal(
  dept: Department,
  label: string,
  deptRows: CalculatedEmployeeRow[],
): DepartmentSubtotal {
  return {
    department: dept,
    label,
    count: deptRows.length,
    hsCV: deptRows.reduce((s, r) => s + r.hsCV, 0),
    hsTN: deptRows.reduce((s, r) => s + r.hsTN, 0),
    hsTong: deptRows.reduce((s, r) => s + r.hsTong, 0),
    congKhoan: deptRows.reduce((s, r) => s + r.congKhoan, 0),
    hsNgayCong: deptRows.reduce((s, r) => s + r.hsNgayCong, 0),
    congBD: deptRows.reduce((s, r) => s + r.congBD, 0),
    hsNgayCongBD: deptRows.reduce((s, r) => s + r.hsNgayCongBD, 0),
    luongKhoan: deptRows.reduce((s, r) => s + r.luongKhoanHienThi, 0),
    luongBD: deptRows.reduce((s, r) => s + r.luongBDHienThi, 0),
    tienThuong: deptRows.reduce((s, r) => s + r.tienThuongHienThi, 0),
    truThuong: deptRows.reduce((s, r) => s + r.tongTruThuong, 0),
    tongLuong: deptRows.reduce((s, r) => s + r.tongLuongHienThi, 0),
  };
}

/**
 * Lọc kết quả bảng lương theo đúng phân quyền 4 cấp (Strict Data Isolation):
 * - Cấp 1 (Admin) & Cấp 2 (Trưởng phòng): trả về nguyên vẹn 23/23 nhân sự.
 * - Cấp 3 (Tổ trưởng / Tổ phó): chỉ trả về đúng các nhân sự thuộc Tổ mình (Tổ Cơ lý = 8 người, Tổ QC/KCS = 12 người).
 * - Cấp 4 (Nhân viên): chỉ trả về duy nhất 1 dòng của chính nhân viên đó.
 * Lưu ý: Tiền lương từng người vẫn giữ nguyên 100% từ kết quả tính toàn phòng!
 */
export function filterPayrollByRole(
  fullCalc: PayrollCalculationResult,
  account: AuthAccount,
  authAccounts: Record<string, AuthAccount>,
  employees: EmployeeMaster[],
): PayrollCalculationResult {
  if (account.role === 'admin' || account.role === 'truong_phong') {
    return fullCalc;
  }

  const teamByMsnv = new Map<string, TeamGroup>();
  for (const emp of employees) {
    const acc = authAccounts[emp.msnv];
    const team = emp.team ?? acc?.team ?? inferDefaultRoleAndTeam(emp.msnv, emp.position).team;
    teamByMsnv.set(emp.msnv, team);
    teamByMsnv.set(normalizeMsnv4(emp.msnv), team);
  }

  let filteredRows: CalculatedEmployeeRow[];
  if (account.role === 'to_quan_ly') {
    filteredRows = fullCalc.rows
      .filter((r) => {
        const rowTeam =
          r.team ??
          teamByMsnv.get(r.msnv) ??
          teamByMsnv.get(normalizeMsnv4(r.msnv)) ??
          inferDefaultRoleAndTeam(r.msnv, r.position).team;
        return rowTeam === account.team;
      })
      .map((r, idx) => ({ ...r, stt: idx + 1 }));
  } else {
    // Cấp 4: Nhân viên — chỉ thấy chính mình
    filteredRows = fullCalc.rows
      .filter((r) => normalizeMsnv4(r.msnv) === account.normalizedMsnv)
      .map((r) => ({ ...r, stt: 1 }));
  }

  const vanPhongRows = filteredRows.filter((r) => r.department === 'van_phong');
  const dayChuyenRows = filteredRows.filter((r) => r.department === 'day_chuyen');

  const subVanPhong = sumSubtotal('van_phong', 'Cộng BP Văn phòng (trong Tổ)', vanPhongRows);
  const subDayChuyen = sumSubtotal(
    'day_chuyen',
    'Cộng BP Nhân viên dây chuyền (trong Tổ)',
    dayChuyenRows,
  );

  const grandTotal = {
    count: filteredRows.length,
    hsCV: subVanPhong.hsCV + subDayChuyen.hsCV,
    hsTN: subVanPhong.hsTN + subDayChuyen.hsTN,
    hsTong: subVanPhong.hsTong + subDayChuyen.hsTong,
    congKhoan: subVanPhong.congKhoan + subDayChuyen.congKhoan,
    hsNgayCong: subVanPhong.hsNgayCong + subDayChuyen.hsNgayCong,
    congBD: subVanPhong.congBD + subDayChuyen.congBD,
    hsNgayCongBD: subVanPhong.hsNgayCongBD + subDayChuyen.hsNgayCongBD,
    luongKhoan: subVanPhong.luongKhoan + subDayChuyen.luongKhoan,
    luongBD: subVanPhong.luongBD + subDayChuyen.luongBD,
    tienThuong: subVanPhong.tienThuong + subDayChuyen.tienThuong,
    truThuong: subVanPhong.truThuong + subDayChuyen.truThuong,
    tongLuong: subVanPhong.tongLuong + subDayChuyen.tongLuong,
  };

  return {
    summary: fullCalc.summary,
    rows: filteredRows,
    vanPhongRows,
    dayChuyenRows,
    subVanPhong,
    subDayChuyen,
    grandTotal,
  };
}
