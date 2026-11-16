import { PXSX_EMPLOYEES_OCT_2026 } from '../data/pxsxOctober2026';
import type { AuthAccount, EmployeeMaster } from '../types/payroll';
import { normalizeMsnv4, sha256Hex } from './rbacAuth';

/** Quản đốc & Thống kê PXSX được phép xem & thao tác toàn bộ tab PXSX */
export const PXSX_MANAGER_MSNVS = new Set(['0589', '0931', '1711', '1884']);

const PXSX_AUTH_STORAGE_KEY = 'pxsx_auth_accounts_v1';

/** Gom danh sách nhân sự duy nhất của PXSX từ dữ liệu TBTM, DC1, DC2 */
export function buildPxsxEmployeeDirectory(): EmployeeMaster[] {
  const byMsnv = new Map<string, EmployeeMaster>();
  let order = 1;
  for (const r of PXSX_EMPLOYEES_OCT_2026) {
    const norm = normalizeMsnv4(r.msnv);
    if (!norm || norm === '0000') continue;
    const existing = byMsnv.get(norm);
    if (!existing) {
      byMsnv.set(norm, {
        id: `pxsx_${norm}`,
        msnv: norm,
        fullName: r.fullName.trim(),
        position: `${r.position || 'CN Sản xuất'} (${r.dept})`,
        department: 'day_chuyen',
        baseSalary2020: 5310000,
        hsCV: r.hsLuong,
        hsTN: r.hsTN,
        sortOrder: order++,
        active: true,
      });
    } else if (!existing.position.includes(r.dept)) {
      existing.position = existing.position.replace(/\)$/, `, ${r.dept})`);
    }
  }
  return Array.from(byMsnv.values()).sort((a, b) => a.msnv.localeCompare(b.msnv));
}

/** Tạo/nạp danh sách tài khoản PXSX (mặc định mở quyền xem cá nhân với PIN = 4 số MSNV) */
export function buildPxsxAuthAccounts(
  pxsxEmployees: EmployeeMaster[],
  existing?: Record<string, AuthAccount>,
): Record<string, AuthAccount> {
  const saved = existing ?? loadStoredPxsxAuthAccounts();
  const result: Record<string, AuthAccount> = {};
  for (const emp of pxsxEmployees) {
    const norm = normalizeMsnv4(emp.msnv);
    const prev = saved[emp.msnv] ?? saved[norm];
    const isManager = PXSX_MANAGER_MSNVS.has(norm);
    if (prev) {
      result[emp.msnv] = {
        ...prev,
        msnv: emp.msnv,
        normalizedMsnv: norm,
        accessGranted: true,
      };
    } else {
      result[emp.msnv] = {
        msnv: emp.msnv,
        normalizedMsnv: norm,
        pinHash: sha256Hex(norm),
        pinDisplayForAdmin: norm,
        accessGranted: true,
        role: isManager ? 'to_quan_ly' : 'nhan_vien',
        team: isManager ? 'ban_lanh_dao' : 'to_qc_kcs',
        updatedAt: '2026-10-01',
      };
    }
  }
  return result;
}

export function loadStoredPxsxAuthAccounts(): Record<string, AuthAccount> {
  try {
    const raw = localStorage.getItem(PXSX_AUTH_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveStoredPxsxAuthAccounts(accounts: Record<string, AuthAccount>): void {
  try {
    localStorage.setItem(PXSX_AUTH_STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    // ignore storage quota errors
  }
}
