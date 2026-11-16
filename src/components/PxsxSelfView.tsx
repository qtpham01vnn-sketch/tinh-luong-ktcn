import React, { useMemo } from 'react';
import { Factory, Lock, Printer } from 'lucide-react';
import {
  PXSX_DEPT_CONFIGS_OCT_2026,
  PXSX_EMPLOYEES_OCT_2026,
  type PxsxDeptKey,
} from '../data/pxsxOctober2026';
import type { EmployeeMaster } from '../types/payroll';
import { formatVND } from '../utils/payrollCalc';
import { normalizeMsnv4 } from '../utils/rbacAuth';
import type { LineProductInput } from './TabPxsx';

interface PxsxSelfViewProps {
  employee: EmployeeMaster;
  periodLabel: string;
  sharedItems: LineProductInput[];
}

const DEFAULT_KN: Record<PxsxDeptKey, number> = {
  DC1: 6640194.5,
  DC2: 7508208.37,
  TBTM: 4250367.13,
};

export const PxsxSelfView: React.FC<PxsxSelfViewProps> = ({
  employee,
  periodLabel,
  sharedItems,
}) => {
  const normMsnv = normalizeMsnv4(employee.msnv);

  const myPayslips = useMemo(() => {
    // Tính quỹ lương & thưởng của từng dây chuyền từ sharedItems
    let dc1Khoan = 0;
    let dc1Thuong = 0;
    let dc2Khoan = 0;
    let dc2Thuong = 0;
    let tbtmKhoan = 0;
    let tbtmThuong = 0;

    for (const it of sharedItems) {
      const pxsxLuong = it.qtyM2 * it.pxsxUnitPrice;
      const tbtmLuong = it.qtyM2 * it.tbtmUnitPrice;
      const pctSum = it.noBonus ? 0 : (it.bonusSlPct + it.bonusClPct) / 100;
      const pxsxTh = pxsxLuong * pctSum;
      const tbtmTh = tbtmLuong * pctSum;
      if (it.line === 'DC1') {
        dc1Khoan += pxsxLuong;
        dc1Thuong += pxsxTh;
      } else {
        dc2Khoan += pxsxLuong;
        dc2Thuong += pxsxTh;
      }
      tbtmKhoan += tbtmLuong;
      tbtmThuong += tbtmTh;
    }

    const funds: Record<PxsxDeptKey, { luong: number; rawThuong: number }> = {
      DC1: { luong: dc1Khoan, rawThuong: dc1Thuong },
      DC2: { luong: dc2Khoan, rawThuong: dc2Thuong },
      TBTM: { luong: tbtmKhoan, rawThuong: tbtmThuong },
    };

    const depts: PxsxDeptKey[] = ['TBTM', 'DC1', 'DC2'];
    const slips = [];

    for (const dept of depts) {
      const cfg = PXSX_DEPT_CONFIGS_OCT_2026[dept];
      const allRows = PXSX_EMPLOYEES_OCT_2026.filter((r) => r.dept === dept);
      const totalHsCong = allRows.reduce((s, r) => s + r.hsCongSP, 0);
      const donGiaLuong = totalHsCong > 0 ? funds[dept].luong / totalHsCong : 0;
      const thuongSauKn = Math.max(0, funds[dept].rawThuong - DEFAULT_KN[dept]);
      const thuongChi = thuongSauKn * (cfg.bonusSharePct / 100);
      const donGiaThuong = totalHsCong > 0 ? thuongChi / totalHsCong : 0;

      const myRows = allRows
        .filter((r) => normalizeMsnv4(r.msnv) === normMsnv)
        .map((r) => {
          const luongSP = Math.round(r.hsCongSP * donGiaLuong);
          const thuong = r.isBonusZero ? 0 : Math.round(r.hsCongSP * donGiaThuong);
          const totalPay = luongSP + thuong + r.overtimePay;
          return {
            ...r,
            hsTong: r.hsLuong + r.hsTN + r.hsDH,
            luongSP,
            thuong,
            totalPay,
          };
        });

      if (myRows.length > 0) {
        slips.push({
          dept,
          label: cfg.label,
          standardDays: cfg.standardDays,
          bonusSharePct: cfg.bonusSharePct,
          hs1NoBonus: Math.round(donGiaLuong),
          hs1WithBonus: Math.round(donGiaLuong + donGiaThuong),
          rows: myRows,
          subtotalPay: myRows.reduce((s, r) => s + r.totalPay, 0),
        });
      }
    }

    return slips;
  }, [normMsnv, sharedItems]);

  const grandTotal = myPayslips.reduce((s, slip) => s + slip.subtotalPay, 0);

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 shrink-0 text-emerald-700" />
          <span>
            <strong>Chế độ Bảo mật Cá nhân PXSX:</strong> Bạn chỉ xem được Phiếu lương của riêng mình (MSNV{' '}
            <strong className="font-mono">{normMsnv}</strong>). Lương của các CBCNV khác được bảo mật tuyệt đối.
          </span>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-800"
        >
          <Printer className="h-3.5 w-3.5" /> In / Lưu PDF Phiếu lương
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:border-none print:p-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-blue-700 uppercase">
              <Factory className="h-4 w-4" />
              Công ty CP Gạch Men Phương Nam • Phân xưởng Sản xuất (PXSX)
            </div>
            <h2 className="mt-1 text-xl font-extrabold text-slate-900">
              PHIẾU THANH TOÁN TIỀN LƯƠNG CÁ NHÂN — {periodLabel.toUpperCase()}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              MSNV: <strong className="font-mono text-slate-900">{normMsnv}</strong> | Họ và tên:{' '}
              <strong className="text-slate-900">{employee.fullName}</strong> | Chức vụ:{' '}
              <strong>{employee.position}</strong>
            </p>
          </div>
          <div className="rounded-xl bg-blue-600 px-5 py-3 text-right text-white shadow-sm print:border print:border-slate-300 print:bg-white print:text-black">
            <div className="text-[11px] font-semibold uppercase opacity-90">Tổng lương thực nhận</div>
            <div className="text-2xl font-extrabold tabular-nums">{formatVND(grandTotal)} đ</div>
          </div>
        </div>

        <div className="mt-5 space-y-5">
          {myPayslips.map((slip) => (
            <div key={slip.dept} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{slip.label}</h3>
                  <p className="text-xs text-slate-500">
                    Công chuẩn: {slip.standardDays} công | Chi thưởng: {slip.bonusSharePct}% | Lương HS1:{' '}
                    <strong className="text-blue-700">{formatVND(slip.hs1WithBonus)} đ</strong> (K thưởng:{' '}
                    {formatVND(slip.hs1NoBonus)} đ)
                  </p>
                </div>
                <div className="text-sm font-bold text-slate-900 tabular-nums">
                  Cộng {slip.dept}: {formatVND(slip.subtotalPay)} đ
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse rounded-lg bg-white text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100 text-slate-600">
                      <th className="p-2 text-left">Tổ / Công đoạn</th>
                      <th className="p-2 text-left">Chức vụ</th>
                      <th className="p-2 text-right">HS Lương</th>
                      <th className="p-2 text-right">HS TN</th>
                      <th className="p-2 text-right">HS ĐH</th>
                      <th className="p-2 text-right">HS Tổng</th>
                      <th className="p-2 text-right">Công SP</th>
                      <th className="p-2 text-right">HS Công SP</th>
                      <th className="p-2 text-right">Lương SP</th>
                      <th className="p-2 text-right">Thưởng SL+CL</th>
                      <th className="p-2 text-right">Tăng ca</th>
                      <th className="p-2 text-right">Tổng Thực Lãnh</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {slip.rows.map((r, i) => (
                      <tr key={`${slip.dept}-${i}`}>
                        <td className="p-2 font-medium text-slate-800">{r.group}</td>
                        <td className="p-2 text-slate-600">{r.position}</td>
                        <td className="p-2 text-right font-mono">{r.hsLuong.toFixed(2)}</td>
                        <td className="p-2 text-right font-mono">{r.hsTN.toFixed(2)}</td>
                        <td className="p-2 text-right font-mono">{r.hsDH.toFixed(2)}</td>
                        <td className="p-2 text-right font-mono font-semibold">{r.hsTong.toFixed(2)}</td>
                        <td className="p-2 text-right font-mono font-semibold text-blue-700">{r.congSP}</td>
                        <td className="p-2 text-right font-mono">{r.hsCongSP.toFixed(4)}</td>
                        <td className="p-2 text-right font-mono">{formatVND(r.luongSP)} đ</td>
                        <td className="p-2 text-right font-mono text-emerald-700">
                          {r.isBonusZero ? '0 đ (Trừ thưởng)' : `${formatVND(r.thuong)} đ`}
                        </td>
                        <td className="p-2 text-right font-mono text-indigo-700">
                          {r.overtimePay > 0 ? `${formatVND(r.overtimePay)} đ` : '—'}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900">
                          {formatVND(r.totalPay)} đ
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {myPayslips.length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center text-xs text-amber-800">
              Không tìm thấy dữ liệu lương PXSX cho MSNV {normMsnv} trong kỳ này.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
