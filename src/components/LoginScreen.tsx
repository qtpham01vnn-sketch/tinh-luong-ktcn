import React, { useMemo, useRef, useState } from 'react';
import { Building2, KeyRound, Lock, ShieldCheck, UserCheck } from 'lucide-react';
import type { AuthAccount, EmployeeMaster } from '../types/payroll';
import {
  authenticateWithPin,
  normalizeMsnv4,
  ROLE_LABELS,
  TEAM_LABELS,
} from '../utils/rbacAuth';

interface LoginScreenProps {
  employees: EmployeeMaster[];
  authAccounts: Record<string, AuthAccount>;
  onLoginSuccess: (account: AuthAccount, employee: EmployeeMaster) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  employees,
  authAccounts,
  onLoginSuccess,
}) => {
  const [msnvInput, setMsnvInput] = useState('1439');
  const [pinDigits, setPinDigits] = useState<[string, string, string, string]>(['', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const matchedEmp = useMemo(() => {
    const norm = normalizeMsnv4(msnvInput);
    return employees.find((e) => normalizeMsnv4(e.msnv) === norm);
  }, [employees, msnvInput]);

  const matchedAcc = useMemo(() => {
    if (!matchedEmp) return undefined;
    return authAccounts[matchedEmp.msnv];
  }, [authAccounts, matchedEmp]);

  const handleDigitChange = (index: number, raw: string) => {
    setError(null);
    const digit = raw.replace(/\D/g, '').slice(-1);
    const next: [string, string, string, string] = [...pinDigits] as [
      string,
      string,
      string,
      string,
    ];
    next[index] = digit;
    setPinDigits(next);

    if (digit && index < 3) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handlePastePin = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (pasted.length > 0) {
      e.preventDefault();
      const next: [string, string, string, string] = [
        pasted[0] || '',
        pasted[1] || '',
        pasted[2] || '',
        pasted[3] || '',
      ];
      setPinDigits(next);
      const focusIdx = Math.min(3, pasted.length);
      inputRefs[focusIdx].current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const norm = normalizeMsnv4(msnvInput);
    setMsnvInput(norm);
    const pin = pinDigits.join('');
    const res = authenticateWithPin(authAccounts, employees, norm, pin);
    if (!res.ok || !res.account || !res.employee) {
      setError(res.error || 'Đăng nhập không thành công.');
      return;
    }
    onLoginSuccess(res.account, res.employee);
  };

  const handleSelectQuickUser = (msnv: string) => {
    const norm = normalizeMsnv4(msnv);
    setMsnvInput(norm);
    setPinDigits(['', '', '', '']);
    setError(null);
    setTimeout(() => inputRefs[0].current?.focus(), 30);
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 p-4">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-700/80 bg-white p-6 shadow-2xl sm:p-8">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold tracking-wider text-blue-700 uppercase">
              Công ty CP Gạch Men Phương Nam
            </div>
            <h1 className="text-base font-bold text-slate-900">
              Hệ thống Lương Phòng KTCN
            </h1>
            <p className="text-xs text-slate-500">
              Bảo mật phân quyền 4 cấp bằng MSNV & Mã PIN 4 số
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Chọn hoặc nhập MSNV */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              1. Chọn nhân sự hoặc nhập Mã số nhân viên (MSNV 4 số)
            </label>
            <div className="grid grid-cols-12 gap-2">
              <input
                type="text"
                value={msnvInput}
                onChange={(e) => {
                  setMsnvInput(e.target.value);
                  setError(null);
                }}
                onBlur={() => {
                  if (msnvInput.trim()) setMsnvInput(normalizeMsnv4(msnvInput));
                }}
                placeholder="VD: 1439"
                className="col-span-4 rounded-xl border border-slate-300 px-3 py-2 text-center font-mono text-sm font-bold text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <select
                value={matchedEmp?.msnv || ''}
                onChange={(e) => handleSelectQuickUser(e.target.value)}
                className="col-span-8 rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-2 text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none"
              >
                <option value="" disabled>
                  -- Chọn nhanh từ danh sách 23 nhân sự --
                </option>
                {employees.map((emp) => {
                  const acc = authAccounts[emp.msnv];
                  const norm = normalizeMsnv4(emp.msnv);
                  return (
                    <option key={emp.msnv} value={emp.msnv}>
                      {norm} — {emp.fullName} ({emp.position}){' '}
                      {acc?.accessGranted ? '✓ Đã mở' : '🔒 Chưa mở'}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Hiển thị thông tin nhân sự khớp */}
            {matchedEmp && matchedAcc ? (
              <div className="mt-2.5 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                <div>
                  <div className="font-bold text-slate-900">
                    {matchedEmp.fullName}{' '}
                    <span className="font-normal text-slate-500">({matchedEmp.position})</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-600">
                    {ROLE_LABELS[matchedAcc.role]} · {TEAM_LABELS[matchedAcc.team]}
                  </div>
                </div>
                {matchedAcc.accessGranted ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                    <UserCheck className="h-3 w-3" /> Đã cấp quyền
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                    <Lock className="h-3 w-3" /> Chưa cấp quyền
                  </span>
                )}
              </div>
            ) : (
              <div className="mt-2 text-xs text-rose-600">
                Chưa tìm thấy nhân sự khớp với MSNV "{normalizeMsnv4(msnvInput)}".
              </div>
            )}
          </div>

          {/* 4 ô nhập PIN */}
          <div>
            <label className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-700">
              <span>2. Nhập mã PIN bảo mật (4 chữ số)</span>
              <span className="font-normal text-slate-400">Hỗ trợ dán 4 số</span>
            </label>
            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3].map((idx) => (
                <input
                  key={idx}
                  ref={inputRefs[idx]}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={pinDigits[idx]}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  onPaste={handlePastePin}
                  className="h-13 w-13 rounded-xl border-2 border-slate-300 bg-slate-50 text-center font-mono text-xl font-bold text-slate-900 shadow-inner transition focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-blue-700"
          >
            <KeyRound className="h-4 w-4" /> Đăng nhập Hệ thống
          </button>
        </form>

        {/* Hướng dẫn mặc định */}
        <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-[11px] leading-relaxed text-slate-600">
          <div className="mb-1 flex items-center gap-1.5 font-bold text-blue-900">
            <ShieldCheck className="h-4 w-4 text-blue-700" /> Tài khoản kích hoạt mặc định:
          </div>
          <div>
            • <strong>Admin (Toàn quyền):</strong> MSNV <code className="font-bold">1439</code> (Phạm
            Quốc Tuấn) — PIN mặc định: <code className="font-bold">1439</code>
          </div>
          <div>
            • <strong>Trưởng phòng (Xem toàn phòng):</strong> MSNV{' '}
            <code className="font-bold">0266</code> (Đặng Thanh Tùng) — PIN mặc định:{' '}
            <code className="font-bold">0266</code>
          </div>
          <div className="mt-1 text-slate-500">
            • 21 nhân sự còn lại có PIN mặc định = 4 số MSNV (VD: <code className="font-bold">0579</code>), cần Admin bật <em>"Cấp quyền truy cập"</em> trước khi đăng nhập.
          </div>
        </div>
      </div>
    </div>
  );
};
