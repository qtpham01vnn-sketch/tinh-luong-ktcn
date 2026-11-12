import React from 'react';
import {
  FileSpreadsheet,
  FileText,
  Lock,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import type {
  AuthAccount,
  PayrollPeriod,
  PolicyDecision,
  SignatureConfig,
} from '../types/payroll';
import { formatDecimal, formatVND } from '../utils/payrollCalc';
import type { PayrollCalculationResult } from '../utils/payrollCalc';
import { exportPayrollToExcel } from '../utils/excelExport';
import { normalizeMsnv4, TEAM_LABELS } from '../utils/rbacAuth';
import { numberToVietnameseWords } from '../utils/vnWords';

interface EmployeeSelfViewProps {
  period: PayrollPeriod;
  isolatedCalc: PayrollCalculationResult; // Đã lọc chỉ còn đúng 1 dòng của nhân viên đang đăng nhập
  account: AuthAccount;
  policies: PolicyDecision[];
  signatures: SignatureConfig;
}

export const EmployeeSelfView: React.FC<EmployeeSelfViewProps> = ({
  period,
  isolatedCalc,
  account,
  policies,
  signatures,
}) => {
  const row = isolatedCalc.rows[0];
  const { summary: s } = isolatedCalc;
  const isA = period.calculationMode === 'A';

  if (!row) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600 shadow-sm">
        Không tìm thấy dữ liệu lương của nhân sự MSNV <strong>{account.normalizedMsnv}</strong> trong{' '}
        {period.label}.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner chế độ bảo mật cá nhân */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-xs text-emerald-900">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700" />
          <span>
            <strong>Chế độ Bảo mật Cá nhân (Cấp 4 — Read-Only):</strong> Bạn đang xem Phiếu lương cá
            nhân của riêng mình và các chỉ số công khai minh bạch của Phòng KTCN. Lương của 22 nhân
            sự khác được bảo mật tuyệt đối.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportPayrollToExcel(period, isolatedCalc, signatures)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Tải Excel Phiếu lương (.xlsx)
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Printer className="h-3.5 w-3.5" /> In / Lưu PDF Phiếu lương
          </button>
        </div>
      </div>

      {/* PHIẾU LƯƠNG CÁ NHÂN CHI TIẾT */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="text-xs font-bold tracking-wider text-blue-700 uppercase">
              Công ty Cổ phần Gạch Men Phương Nam · Phòng Kỹ thuật - Công nghệ
            </div>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              PHIẾU THANH TOÁN TIỀN LƯƠNG CÁ NHÂN — {period.label.toUpperCase()}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              MSNV: <strong className="font-mono text-slate-800">{normalizeMsnv4(row.msnv)}</strong>{' '}
              | Họ và tên: <strong className="text-slate-800">{row.fullName}</strong> | Chức vụ:{' '}
              <strong className="text-slate-800">{row.position}</strong> | Tổ:{' '}
              <strong className="text-slate-800">{TEAM_LABELS[account.team]}</strong>
            </p>
          </div>
          <div className="rounded-xl bg-blue-600 px-4 py-2.5 text-right text-white shadow">
            <div className="text-[11px] font-medium text-blue-100">TỔNG LƯƠNG THỰC NHẬN</div>
            <div className="text-2xl font-bold tabular-nums">
              {formatVND(row.tongLuongHienThi)} đ
            </div>
          </div>
        </div>

        {/* Chi tiết hệ số, ngày công và cách tính */}
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <h3 className="mb-3 text-xs font-bold tracking-wider text-slate-700 uppercase">
              1. Hệ số định mức & Ngày công trong kỳ
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-dashed border-slate-200 pb-1.5">
                <span className="text-slate-600">Lương cơ bản 2020 (tham chiếu):</span>
                <span className="font-semibold tabular-nums">{formatVND(row.baseSalary2020)} đ</span>
              </div>
              <div className="flex justify-between border-b border-dashed border-slate-200 pb-1.5">
                <span className="text-slate-600">Hệ số công việc (G):</span>
                <span className="font-semibold tabular-nums">{formatDecimal(row.hsCV, 2)}</span>
              </div>
              <div className="flex justify-between border-b border-dashed border-slate-200 pb-1.5">
                <span className="text-slate-600">Hệ số trách nhiệm (H):</span>
                <span className="font-semibold tabular-nums">{formatDecimal(row.hsTN, 2)}</span>
              </div>
              <div className="flex justify-between border-b border-dashed border-slate-200 pb-1.5">
                <span className="text-slate-600">Tổng hệ số lương (I = G + H):</span>
                <span className="font-bold text-blue-800 tabular-nums">
                  {formatDecimal(row.hsTong, 2)}
                </span>
              </div>
              <div className="flex justify-between border-b border-dashed border-slate-200 pb-1.5">
                <span className="text-slate-600">Ngày công khoán (J):</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  {formatDecimal(row.congKhoan, 4)} công
                </span>
              </div>
              <div className="flex justify-between border-b border-dashed border-slate-200 pb-1.5">
                <span className="text-slate-600">Hệ số theo ngày công (K = I × J):</span>
                <span className="font-bold text-blue-800 tabular-nums">
                  {formatDecimal(row.hsNgayCong, 4)}
                </span>
              </div>
              <div className="flex justify-between border-b border-dashed border-slate-200 pb-1.5">
                <span className="text-slate-600">Ngày công bảo dưỡng (L):</span>
                <span className="font-semibold tabular-nums">
                  {formatDecimal(row.congBD, 2)} công
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Hệ số theo ngày công BD (M = I × L):</span>
                <span className="font-semibold tabular-nums">
                  {formatDecimal(row.hsNgayCongBD, 3)}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <h3 className="mb-3 text-xs font-bold tracking-wider text-slate-700 uppercase">
              2. Chi tiết Thành tiền & Công thức quy đổi
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-dashed border-slate-200 pb-1.5">
                <span className="text-slate-600">
                  Đơn giá 1 hệ số công {isA ? '(gộp quỹ)' : '(khoán riêng)'}:
                </span>
                <span className="font-semibold text-blue-800 tabular-nums">
                  {formatDecimal(isA ? s.donGiaGop : s.donGiaKhoanRieng, 2)} đ
                </span>
              </div>
              <div className="flex justify-between border-b border-dashed border-slate-200 pb-1.5">
                <span className="text-slate-600">Lương khoán theo ngày công (N):</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  {formatVND(row.luongKhoanHienThi)} đ
                </span>
              </div>
              <div className="flex justify-between border-b border-dashed border-slate-200 pb-1.5">
                <span className="text-slate-600">
                  Lương bảo dưỡng {isA ? '(tham khảo)' : '(cộng riêng)'} (O):
                </span>
                <span className="font-semibold text-slate-700 tabular-nums">
                  {formatVND(row.luongBDHienThi)} đ
                </span>
              </div>
              <div className="flex justify-between border-b border-dashed border-slate-200 pb-1.5">
                <span className="text-slate-600">
                  Tiền thưởng {isA ? '(tham khảo)' : '(cộng riêng)'} (P):
                </span>
                <span className="font-semibold text-emerald-700 tabular-nums">
                  {formatVND(row.tienThuongHienThi)} đ
                </span>
              </div>
              <div className="flex justify-between border-b border-dashed border-slate-200 pb-1.5">
                <span className="text-slate-600">Trừ thưởng cá nhân (Q):</span>
                <span className="font-semibold text-rose-700 tabular-nums">
                  {row.tongTruThuong > 0 ? `-${formatVND(row.tongTruThuong)} đ` : '0 đ'}
                </span>
              </div>
              <div className="flex justify-between rounded-lg bg-blue-100/80 px-3 py-2 font-bold text-blue-950">
                <span>Tổng lương thực nhận (R):</span>
                <span className="tabular-nums">{formatVND(row.tongLuongHienThi)} đ</span>
              </div>
              <div className="pt-1 text-xs italic text-slate-600">
                <strong>Bằng chữ:</strong> {numberToVietnameseWords(row.tongLuongHienThi)}.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* THÔNG TIN CHUNG CÔNG KHAI CỦA PHÒNG KTCN */}
      <section className="no-print grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Thông tin Quỹ lương & Đơn giá Công khai của Phòng ({period.label})
            </h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
              <Lock className="h-3 w-3" /> Minh bạch nội bộ
            </span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between border-b border-slate-100 py-1.5">
              <span className="text-slate-600">Tổng quỹ lương theo sản lượng khoán:</span>
              <span className="font-semibold tabular-nums">{formatVND(s.quyKhoan)} đ</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 py-1.5">
              <span className="text-slate-600">Lương bảo dưỡng DC2:</span>
              <span className="font-semibold tabular-nums">{formatVND(s.quyBD)} đ</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 py-1.5">
              <span className="text-slate-600">
                Chia thưởng {period.bonusSharePct}% trong tháng:
              </span>
              <span className="font-semibold text-emerald-700 tabular-nums">
                {formatVND(s.thuongChia)} đ
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-100 py-1.5 font-bold text-blue-900">
              <span>Tổng quỹ lương + thưởng thực chia toàn phòng:</span>
              <span className="tabular-nums">{formatVND(s.quyThucChia)} đ</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 py-1.5">
              <span className="text-slate-600">Tổng hệ số ngày công toàn phòng:</span>
              <span className="font-semibold tabular-nums">
                {formatDecimal(s.tongHSNgayCong, 2)} HS-công
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-100 py-1.5 font-bold text-indigo-900">
              <span>Đơn giá 1 hệ số công (Quỹ thực chia / Tổng HS-công):</span>
              <span className="tabular-nums">{formatDecimal(s.donGiaGop, 2)} đ / HS-công</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-600">
                Lương hệ số 1 chuẩn ({period.standardDaysForHS1} công):
              </span>
              <span className="font-semibold tabular-nums">{formatVND(s.luongHS1)} đ</span>
            </div>
          </div>
        </div>

        {/* Quyết định giao khoán công khai */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-slate-900">
            Quyết định Giao khoán Sản phẩm Công khai của Công ty
          </h3>
          <div className="space-y-3">
            {policies.map((pol) => (
              <div key={pol.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">
                    {pol.code}
                  </span>
                  <span className="text-xs text-slate-500">
                    Hiệu lực từ: <strong>{pol.effectiveFrom}</strong>
                  </span>
                </div>
                <div className="mt-1.5 text-sm font-semibold text-slate-900">{pol.title}</div>
                {pol.notes && <p className="mt-1 text-xs text-slate-600">{pol.notes}</p>}
                <div className="mt-2.5 flex items-center justify-between border-t border-slate-200 pt-2 text-xs text-slate-600">
                  <span>
                    Tỷ lệ chia thưởng: <strong>{pol.bonusSharePct}%</strong> | LCB định mức:{' '}
                    <strong>{formatVND(pol.baseSalaryDefault)} đ</strong>
                  </span>
                  {pol.attachmentDataUrl && pol.attachmentDataUrl.startsWith('data:') && (
                    <a
                      href={pol.attachmentDataUrl}
                      download={pol.attachmentName || 'quyet_dinh'}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      <FileText className="h-3.5 w-3.5" /> Tải Quyết định
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
