import React, { useState } from 'react';
import {
  Check,
  Copy,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Shuffle,
  Unlock,
  X,
} from 'lucide-react';
import type {
  AuthAccount,
  EmployeeMaster,
  TeamGroup,
  UserRole,
} from '../types/payroll';
import {
  generateRandomPin4,
  normalizeMsnv4,
  ROLE_LABELS,
  sha256Hex,
  TEAM_LABELS,
} from '../utils/rbacAuth';

interface SecurityAdminModalProps {
  employees: EmployeeMaster[];
  authAccounts: Record<string, AuthAccount>;
  onUpdateAccount: (msnv: string, updater: (prev: AuthAccount) => AuthAccount) => void;
  onUpdateEmployeeTeamRole: (msnv: string, team: TeamGroup, role: UserRole) => void;
  onBulkGrantAll: (grant: boolean) => void;
  onBulkResetDefaultPins: () => void;
  onClose: () => void;
}

export const SecurityAdminModal: React.FC<SecurityAdminModalProps> = ({
  employees,
  authAccounts,
  onUpdateAccount,
  onUpdateEmployeeTeamRole,
  onBulkGrantAll,
  onBulkResetDefaultPins,
  onClose,
}) => {
  const [copiedMsnv, setCopiedMsnv] = useState<string | null>(null);
  const [filterTeam, setFilterTeam] = useState<string>('all');

  const handleSetNewPin = (msnv: string, newPin: string) => {
    onUpdateAccount(msnv, (prev) => ({
      ...prev,
      pinHash: sha256Hex(newPin),
      pinDisplayForAdmin: newPin,
      updatedAt: new Date().toISOString().slice(0, 10),
    }));
  };

  const handleCopyZalo = async (emp: EmployeeMaster, acc: AuthAccount) => {
    const text = `[Phòng KTCN - Gạch Men Phương Nam]\nTài khoản tra cứu lương của ${emp.fullName} (${emp.position}):\n- MSNV đăng nhập: ${acc.normalizedMsnv}\n- Mã PIN 4 số: ${acc.pinDisplayForAdmin}\n- Phạm vi phân quyền: ${ROLE_LABELS[acc.role]} (${TEAM_LABELS[acc.team]})\n(Vui lòng đổi mã PIN cá nhân sau khi đăng nhập)`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMsnv(emp.msnv);
      setTimeout(() => setCopiedMsnv(null), 2000);
    } catch {
      window.prompt('Copy tin nhắn gửi Zalo:', text);
    }
  };

  const sortedEmps = [...employees]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .filter((e) => {
      if (filterTeam === 'all') return true;
      const acc = authAccounts[e.msnv];
      return (acc?.team || e.team) === filterTeam;
    });

  const grantedCount = Object.values(authAccounts).filter((a) => a.accessGranted).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Quản lý Bảo mật, Phân quyền 4 cấp & Cấp mã PIN ({grantedCount}/{employees.length} đã mở)
              </h2>
              <p className="text-xs text-slate-500">
                Mã PIN được băm SHA-256. Admin có thể cấp/khóa quyền truy cập, tạo PIN ngẫu nhiên 4
                số, reset mặc định và copy tin nhắn gửi Zalo.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-6 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Lọc theo Tổ:</span>
            <select
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800"
            >
              <option value="all">Tất cả ({employees.length} người)</option>
              <option value="ban_lanh_dao">Ban lãnh đạo phòng (2 người)</option>
              <option value="to_co_ly">Tổ Cơ lý (8 người)</option>
              <option value="to_qc_kcs">Tổ QC / KCS (12 người)</option>
              <option value="thong_ke">Thống kê phòng (1 người)</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onBulkGrantAll(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              <Unlock className="h-3.5 w-3.5" /> Cấp quyền tất cả ({employees.length})
            </button>
            <button
              type="button"
              onClick={() => onBulkGrantAll(false)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
            >
              <Lock className="h-3.5 w-3.5" /> Chỉ giữ Admin & Trưởng phòng
            </button>
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    'Reset toàn bộ mã PIN của 23 nhân sự về mặc định (4 chữ số MSNV)?',
                  )
                ) {
                  onBulkResetDefaultPins();
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Reset tất cả PIN mặc định
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-100 text-left font-semibold text-slate-600">
              <tr>
                <th className="px-2.5 py-2">STT</th>
                <th className="px-2.5 py-2">MSNV (4 số)</th>
                <th className="px-2.5 py-2">Họ và tên</th>
                <th className="px-2.5 py-2">Chức vụ</th>
                <th className="px-2.5 py-2">Phân Tổ chuyên môn</th>
                <th className="px-2.5 py-2">Cấp phân quyền</th>
                <th className="px-2.5 py-2 text-center">Mã PIN 4 số</th>
                <th className="px-2.5 py-2">SHA-256 Hash</th>
                <th className="px-2.5 py-2 text-center">Trạng thái truy cập</th>
                <th className="px-2.5 py-2 text-right">Thao tác cấp phát PIN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedEmps.map((emp, idx) => {
                const acc = authAccounts[emp.msnv];
                if (!acc) return null;
                const isDefaultAdmin = acc.normalizedMsnv === '1439';
                return (
                  <tr key={emp.msnv} className="hover:bg-slate-50">
                    <td className="px-2.5 py-2 text-slate-500 tabular-nums">{idx + 1}</td>
                    <td className="px-2.5 py-2 font-mono font-bold text-slate-900">
                      {acc.normalizedMsnv}
                    </td>
                    <td className="px-2.5 py-2 font-semibold text-slate-900">{emp.fullName}</td>
                    <td className="px-2.5 py-2 text-slate-600">{emp.position}</td>
                    <td className="px-2.5 py-2">
                      <select
                        value={acc.team}
                        onChange={(e) =>
                          onUpdateEmployeeTeamRole(
                            emp.msnv,
                            e.target.value as TeamGroup,
                            acc.role,
                          )
                        }
                        className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium"
                      >
                        <option value="ban_lanh_dao">Ban lãnh đạo phòng</option>
                        <option value="to_co_ly">Tổ Cơ lý</option>
                        <option value="to_qc_kcs">Tổ QC / KCS</option>
                        <option value="thong_ke">Thống kê phòng</option>
                      </select>
                    </td>
                    <td className="px-2.5 py-2">
                      <select
                        value={acc.role}
                        disabled={isDefaultAdmin}
                        onChange={(e) =>
                          onUpdateEmployeeTeamRole(
                            emp.msnv,
                            acc.team,
                            e.target.value as UserRole,
                          )
                        }
                        className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium disabled:bg-slate-100"
                      >
                        <option value="admin">Cấp 1 — Admin</option>
                        <option value="truong_phong">Cấp 2 — Trưởng phòng</option>
                        <option value="to_quan_ly">Cấp 3 — Tổ trưởng / Tổ phó</option>
                        <option value="nhan_vien">Cấp 4 — Nhân viên</option>
                      </select>
                    </td>
                    <td className="px-2.5 py-2 text-center">
                      <span className="inline-block rounded-md bg-slate-900 px-2.5 py-1 font-mono text-sm font-bold tracking-widest text-amber-300">
                        {acc.pinDisplayForAdmin}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 font-mono text-[10px] text-slate-400">
                      {acc.pinHash.slice(0, 12)}…
                    </td>
                    <td className="px-2.5 py-2 text-center">
                      <button
                        type="button"
                        disabled={isDefaultAdmin}
                        onClick={() =>
                          onUpdateAccount(emp.msnv, (p) => ({
                            ...p,
                            accessGranted: !p.accessGranted,
                          }))
                        }
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                          acc.accessGranted
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        } disabled:cursor-not-allowed`}
                      >
                        {acc.accessGranted ? (
                          <>
                            <Unlock className="h-3 w-3" /> Đã cấp quyền
                          </>
                        ) : (
                          <>
                            <Lock className="h-3 w-3" /> Chưa cấp quyền
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-2.5 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleSetNewPin(emp.msnv, generateRandomPin4())}
                          className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                          title="Tạo PIN ngẫu nhiên 4 số"
                        >
                          <Shuffle className="h-3 w-3" /> Tạo PIN
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleSetNewPin(emp.msnv, normalizeMsnv4(emp.msnv))
                          }
                          className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                          title="Reset PIN về mặc định (MSNV 4 số)"
                        >
                          <RefreshCw className="h-3 w-3" /> Mặc định
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyZalo(emp, acc)}
                          className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-blue-700"
                          title="Copy tin nhắn MSNV + PIN gửi Zalo"
                        >
                          {copiedMsnv === emp.msnv ? (
                            <>
                              <Check className="h-3 w-3" /> Đã copy
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" /> Copy Zalo
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3 text-xs text-slate-500">
          <span>
            Ghi chú: Khi luân chuyển nhân sự giữa Tổ Cơ lý và Tổ QC/KCS, danh sách xem của Tổ
            trưởng/Tổ phó tương ứng sẽ tự động cập nhật ngay lập tức.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-1.5 font-semibold text-white hover:bg-slate-900"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

interface ChangePinModalProps {
  account: AuthAccount;
  employeeName: string;
  onChangePin: (newPin: string) => void;
  onClose: () => void;
}

export const ChangePinModal: React.FC<ChangePinModalProps> = ({
  account,
  employeeName,
  onChangePin,
  onClose,
}) => {
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sha256Hex(oldPin.trim()) !== account.pinHash) {
      setError('Mã PIN hiện tại không đúng.');
      return;
    }
    if (!/^\d{4}$/.test(newPin.trim())) {
      setError('Mã PIN mới phải gồm đúng 4 chữ số.');
      return;
    }
    if (newPin.trim() !== confirmPin.trim()) {
      setError('Xác nhận mã PIN mới không khớp.');
      return;
    }
    onChangePin(newPin.trim());
    setSuccess(true);
    setError(null);
    setTimeout(() => onClose(), 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Đổi mã PIN cá nhân (4 số)</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-2 text-xs text-slate-500">
          Nhân sự: <strong>{employeeName}</strong> (MSNV: <code>{account.normalizedMsnv}</code>)
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Mã PIN 4 số hiện tại
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={oldPin}
              onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center font-mono text-base font-bold tracking-widest focus:border-blue-600 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Mã PIN 4 số mới
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center font-mono text-base font-bold tracking-widest focus:border-blue-600 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Nhập lại mã PIN 4 số mới
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center font-mono text-base font-bold tracking-widest focus:border-blue-600 focus:outline-none"
              required
            />
          </div>
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
            <ShieldAlert className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}
        {success && (
          <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
            <Check className="h-4 w-4 shrink-0" /> Đã đổi mã PIN thành công!
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Lưu mã PIN mới
          </button>
        </div>
      </form>
    </div>
  );
};
