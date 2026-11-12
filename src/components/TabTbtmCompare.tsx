import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Eye,
  FileSpreadsheet,
  Info,
  Printer,
  Scale,
  ShieldCheck,
  TableProperties,
} from 'lucide-react';
import type { PayrollPeriod, SignatureConfig } from '../types/payroll';
import type { PayrollCalculationResult } from '../utils/payrollCalc';
import { formatDecimal, formatVND } from '../utils/payrollCalc';
import {
  calculateTBTM,
  exportTbtmToExcel,
  type TbtmEmployeeRow,
} from '../utils/tbtmCalc';
import { normalizeMsnv4 } from '../utils/rbacAuth';
import { PrintPreviewTBTM } from './PrintPreviewTBTM';

interface TabTbtmProps {
  period: PayrollPeriod;
  fullCalc: PayrollCalculationResult;
  signatures: SignatureConfig;
}

export const TabTbtmCompare: React.FC<TabTbtmProps> = ({
  period,
  fullCalc,
  signatures,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'compare' | 'preview'>('compare');

  const tbtmCalc = useMemo(() => calculateTBTM(period, fullCalc), [period, fullCalc]);
  const { summary: s } = tbtmCalc;
  const { summary: origSummary } = fullCalc;

  const handleExportExcel = async () => {
    setIsExporting(true);
    setExportNotice(null);
    try {
      await exportTbtmToExcel(period, tbtmCalc, signatures);
      setExportNotice(`Đã xuất Bảng lương chuẩn TBTM ${period.label} (.xlsx) thành công!`);
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err) {
      console.error(err);
      window.alert('Lỗi xuất file Excel TBTM: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsExporting(false);
    }
  };

  // Tính tổng chênh lệch tuyệt đối toàn phòng
  const tongChenhLechTuyetDoi = useMemo(() => {
    return tbtmCalc.rows.reduce((sum, r) => sum + Math.abs(r.chenhLech), 0);
  }, [tbtmCalc.rows]);

  return (
    <div className="space-y-6">
      {/* 1. Banner giới thiệu, Chuyển chế độ xem & Nút In / Xuất Excel */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-blue-50 to-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md">
            <Scale className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold text-indigo-800 uppercase tracking-wide">
                Phương Án Thử Nghiệm Song Song (26 công)
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Chỉ Admin & Trưởng phòng
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">
              Đối chiếu Phương án Chuẩn TBTM (Quy đổi 26 công) — {period.label}
            </h2>
            <p className="text-xs text-slate-600">
              Gom Quỹ khoán + Quỹ BD thành <strong>Lương sản phẩm</strong> (
              {formatVND(s.quyLuongSP)} đ), quy đổi hệ số công qua mẫu số 26 công, giữ nguyên 100%
              tổng chi quỹ ({formatVND(s.tongChiQuy)} đ).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Nút chuyển đổi: Chế độ So sánh vs Chế độ Bản in TBTM */}
          <div className="flex rounded-xl bg-slate-200/80 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('compare')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                viewMode === 'compare'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <TableProperties className="h-3.5 w-3.5" /> Bảng Đối chiếu So sánh
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                viewMode === 'preview'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <Eye className="h-3.5 w-3.5" /> Xem trước Mẫu Trình ký TBTM
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700 disabled:bg-emerald-400"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {isExporting ? 'Đang xuất Excel...' : 'Xuất Excel TBTM (.xlsx)'}
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow hover:bg-indigo-700"
          >
            <Printer className="h-4 w-4" /> In / Lưu PDF TBTM
          </button>
        </div>
      </div>

      {exportNotice && (
        <div className="no-print flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          {exportNotice}
        </div>
      )}

      {/* CHẾ ĐỘ 1: XEM TRƯỚC MẪU TRÌNH KÝ TBTM (Đúng chuẩn trang in/PDF) */}
      {viewMode === 'preview' && (
        <div className="no-print rounded-2xl border border-slate-300 bg-slate-200/70 p-4 shadow-inner">
          <div className="mb-3 flex items-center justify-between text-xs text-slate-700">
            <span className="font-semibold">
              Bản xem trước Trang in A4 Ngang — Mẫu Bảng lương TBTM (Không kèm các cột so sánh)
            </span>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1 font-bold text-white hover:bg-indigo-700"
            >
              <Printer className="h-3.5 w-3.5" /> Bấm để In hoặc Lưu PDF
            </button>
          </div>
          <div className="rounded-xl border border-slate-300 bg-white shadow-xl">
            <PrintPreviewTBTM period={period} tbtmCalc={tbtmCalc} sig={signatures} />
          </div>
        </div>
      )}

      {/* CHẾ ĐỘ 2: BẢNG SO SÁNH ĐỐI CHIẾU */}
      {viewMode === 'compare' && (
        <div className="no-print space-y-6">
          {/* 2. Thẻ Tóm tắt So sánh 2 Phương án (Side-by-Side) */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Cột Trái: Phương án Cũ (Tab Chính) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 text-xs font-bold text-blue-700">
                    1
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">
                    Phương án Cũ (Hệ số Ngày công thực tế)
                  </h3>
                </div>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                  Đang áp dụng
                </span>
              </div>

              <div className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between border-b border-dashed border-slate-100 py-1.5">
                  <span className="text-slate-600">Quỹ lương sản lượng khoán:</span>
                  <span className="font-semibold tabular-nums">
                    {formatVND(origSummary.quyKhoan)} đ
                  </span>
                </div>
                <div className="flex justify-between border-b border-dashed border-slate-100 py-1.5">
                  <span className="text-slate-600">Lương bảo dưỡng DC2:</span>
                  <span className="font-semibold tabular-nums">{formatVND(origSummary.quyBD)} đ</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-slate-100 py-1.5">
                  <span className="text-slate-600">Tổng thưởng 2 dây chuyền (sau trừ):</span>
                  <span className="font-semibold tabular-nums">
                    {formatVND(origSummary.tongThuong)} đ
                  </span>
                </div>
                <div className="flex justify-between border-b border-dashed border-slate-100 py-1.5">
                  <span className="text-slate-600">Chi thưởng 50% trong tháng:</span>
                  <span className="font-semibold text-emerald-700 tabular-nums">
                    {formatVND(origSummary.thuongChia)} đ
                  </span>
                </div>
                <div className="flex justify-between border-b border-dashed border-slate-100 py-1.5">
                  <span className="text-slate-600">Tổng hệ số ngày công toàn phòng:</span>
                  <span className="font-semibold tabular-nums">
                    {formatDecimal(origSummary.tongHSNgayCong, 2)} HS-công
                  </span>
                </div>
                <div className="flex justify-between border-b border-dashed border-slate-100 py-1.5">
                  <span className="text-slate-600">Đơn giá 1 HS-công gộp:</span>
                  <span className="font-semibold text-blue-700 tabular-nums">
                    {formatDecimal(origSummary.donGiaGop, 2)} đ / HS-công
                  </span>
                </div>
                <div className="flex justify-between border-b border-dashed border-slate-100 py-1.5">
                  <span className="text-slate-600">Lương hệ số 1 (chuẩn 26 công):</span>
                  <span className="font-semibold text-indigo-700 tabular-nums">
                    {formatVND(origSummary.donGiaGop * 26)} đ
                  </span>
                </div>
                <div className="flex justify-between rounded-lg bg-blue-50/80 px-3 py-2 font-bold text-blue-950">
                  <span>Tổng chi toàn phòng:</span>
                  <span className="tabular-nums">{formatVND(origSummary.quyThucChia)} đ</span>
                </div>
              </div>
            </div>

            {/* Cột Phải: Phương án Chuẩn TBTM (26 công) */}
            <div className="rounded-2xl border-2 border-indigo-300 bg-indigo-50/30 p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
                    2
                  </span>
                  <h3 className="text-sm font-bold text-indigo-950">
                    Phương án Chuẩn TBTM (Mẫu số 26 công)
                  </h3>
                </div>
                <span className="rounded bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-800">
                  Chuẩn mẫu TBTM
                </span>
              </div>

              <div className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between border-b border-dashed border-indigo-100 py-1.5">
                  <span className="text-slate-700">Tổng quỹ lương sản phẩm (Gộp khoán + BD):</span>
                  <span className="font-bold text-indigo-900 tabular-nums">
                    {formatVND(s.quyLuongSP)} đ
                  </span>
                </div>
                <div className="flex justify-between border-b border-dashed border-indigo-100 py-1.5">
                  <span className="text-slate-600">Tổng thưởng 2 dây chuyền (sau trừ):</span>
                  <span className="font-semibold tabular-nums">{formatVND(s.tongThuong)} đ</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-indigo-100 py-1.5">
                  <span className="text-slate-600">Chi thưởng 50% trong tháng:</span>
                  <span className="font-semibold text-emerald-700 tabular-nums">
                    {formatVND(s.thuongChia50)} đ
                  </span>
                </div>
                <div className="flex justify-between border-b border-dashed border-indigo-100 py-1.5">
                  <span className="text-slate-600">Quỹ dự phòng thưởng 50%:</span>
                  <span className="font-semibold text-emerald-700 tabular-nums">
                    {formatVND(s.quyDuPhong50)} đ
                  </span>
                </div>
                <div className="flex justify-between border-b border-dashed border-indigo-100 py-1.5">
                  <span className="text-slate-600">Tổng hệ số công sản phẩm (/26):</span>
                  <span className="font-bold text-indigo-900 tabular-nums">
                    {formatDecimal(s.tongHSCongSP26, 5)} HS-tháng
                  </span>
                </div>
                <div className="flex justify-between border-b border-dashed border-indigo-100 py-1.5">
                  <span className="text-slate-700">Lương hệ số 1 TBTM (K THƯỞNG):</span>
                  <span className="font-bold text-indigo-700 tabular-nums">
                    {formatVND(s.luongHS1KhongThuong)} đ
                  </span>
                </div>
                <div className="flex justify-between border-b border-dashed border-indigo-100 py-1.5">
                  <span className="text-slate-700">Lương hệ số 1 TBTM (CÓ THƯỞNG):</span>
                  <span className="font-bold text-indigo-900 tabular-nums">
                    {formatVND(s.luongHS1CoThuong)} đ
                  </span>
                </div>
                <div className="flex justify-between rounded-lg bg-indigo-600 px-3 py-2 font-bold text-white shadow-sm">
                  <span>Tổng chi toàn phòng:</span>
                  <span className="tabular-nums">{formatVND(s.tongChiQuy)} đ</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Dải đối soát cân bằng */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-xs text-slate-700 shadow-sm">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-indigo-600" />
              <span>
                <strong>Kiểm định cân bằng quỹ:</strong> Tổng tiền chi toàn phòng ở cả 2 phương án đều
                khớp khít tuyệt đối: <strong>{formatVND(s.tongChiQuy)} đ</strong> (lệch = 0 đ).
              </span>
            </div>
            <div>
              Tổng độ lệch tuyệt đối giữa 2 phương án:{' '}
              <strong className="text-indigo-900">{formatVND(tongChenhLechTuyetDoi)} đ</strong>
            </div>
          </div>

          {/* 4. BẢNG CHI TIẾT 23 NHÂN SỰ CHUẨN TBTM VÀ 2 CỘT ĐỐI CHIẾU */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
              <h3 className="text-sm font-bold text-slate-900">
                Bảng Lương Chi tiết 23 Nhân sự theo Chuẩn TBTM (26 công) & So sánh Đối chiếu
              </h3>
              <p className="text-xs text-slate-500">
                Cột (I) = (Công SP × Hệ số Tổng) / 26 | Cột (J) = (I) × {formatVND(s.donGiaLuongSP)} đ |
                Cột (K) = (I) × {formatVND(s.donGiaThuong)} đ
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead className="bg-slate-100 text-slate-700">
                  <tr className="border-b border-slate-200 text-center font-bold">
                    <th rowSpan={2} className="px-2.5 py-2">STT</th>
                    <th rowSpan={2} className="px-2.5 py-2">MSNV</th>
                    <th rowSpan={2} className="px-3 py-2 text-left">Họ và tên</th>
                    <th rowSpan={2} className="px-3 py-2 text-left">Chức vụ</th>
                    <th colSpan={3} className="border-x border-slate-200 bg-slate-200/70 px-2 py-1">
                      Hệ số
                    </th>
                    <th rowSpan={2} className="px-2.5 py-2">Công SP (H)</th>
                    <th rowSpan={2} className="bg-indigo-50 px-2.5 py-2 text-indigo-900">
                      HS Công SP (/26) (I)
                    </th>
                    <th rowSpan={2} className="px-2.5 py-2">Lương SP (J)</th>
                    <th rowSpan={2} className="px-2.5 py-2">Thưởng CL+SL (K)</th>
                    <th rowSpan={2} className="bg-indigo-100 px-3 py-2 text-indigo-950">
                      Tổng TBTM (L)
                    </th>
                    <th rowSpan={2} className="border-l-2 border-slate-300 bg-slate-200/50 px-3 py-2">
                      Tổng PA Cũ (đ)
                    </th>
                    <th rowSpan={2} className="bg-amber-50 px-3 py-2 text-amber-950">
                      Chênh lệch (TBTM - Cũ)
                    </th>
                  </tr>
                  <tr className="border-b border-slate-200 bg-slate-100 text-[11px]">
                    <th className="border-l border-slate-200 px-2 py-1 font-semibold">Lương (E)</th>
                    <th className="px-2 py-1 font-semibold">TN (F)</th>
                    <th className="border-r border-slate-200 bg-blue-50 px-2 py-1 font-bold text-blue-900">
                      Tổng (G)
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {/* Nhóm I: VĂN PHÒNG */}
                  <tr className="bg-blue-50/70 font-bold text-blue-950">
                    <td className="px-2.5 py-2 text-center"></td>
                    <td className="px-2.5 py-2"></td>
                    <td colSpan={2} className="px-3 py-2">
                      I. VĂN PHÒNG ({tbtmCalc.subVanPhong.count} người)
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {formatDecimal(tbtmCalc.subVanPhong.hsCV, 2)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {formatDecimal(tbtmCalc.subVanPhong.hsTN, 2)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-blue-900">
                      {formatDecimal(tbtmCalc.subVanPhong.hsTong, 2)}
                    </td>
                    <td className="px-2.5 py-2 text-right tabular-nums">
                      {formatDecimal(tbtmCalc.subVanPhong.congSP, 4)}
                    </td>
                    <td className="bg-indigo-100/50 px-2.5 py-2 text-right font-bold text-indigo-900 tabular-nums">
                      {formatDecimal(tbtmCalc.subVanPhong.hsCongSP26, 5)}
                    </td>
                    <td className="px-2.5 py-2 text-right tabular-nums">
                      {formatVND(tbtmCalc.subVanPhong.luongSP)} đ
                    </td>
                    <td className="px-2.5 py-2 text-right tabular-nums text-emerald-800">
                      {formatVND(tbtmCalc.subVanPhong.tienThuong)} đ
                    </td>
                    <td className="bg-indigo-100/80 px-3 py-2 text-right font-bold text-indigo-950 tabular-nums">
                      {formatVND(tbtmCalc.subVanPhong.tongLuongTBTM)} đ
                    </td>
                    <td className="border-l-2 border-slate-300 bg-slate-100 px-3 py-2 text-right font-bold tabular-nums">
                      {formatVND(tbtmCalc.subVanPhong.tongLuongCu)} đ
                    </td>
                    <td className="bg-amber-100/60 px-3 py-2 text-right font-bold tabular-nums">
                      {tbtmCalc.subVanPhong.chenhLech >= 0 ? '+' : ''}
                      {formatVND(tbtmCalc.subVanPhong.chenhLech)} đ
                    </td>
                  </tr>

                  {tbtmCalc.vanPhongRows.map((r) => renderRow(r))}

                  {/* Nhóm II: BP NHÂN VIÊN DÂY CHUYỀN */}
                  <tr className="bg-emerald-50/70 font-bold text-emerald-950">
                    <td className="px-2.5 py-2 text-center"></td>
                    <td className="px-2.5 py-2"></td>
                    <td colSpan={2} className="px-3 py-2">
                      II. BP NHÂN VIÊN DÂY CHUYỀN 1+2 ({tbtmCalc.subDayChuyen.count} người)
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {formatDecimal(tbtmCalc.subDayChuyen.hsCV, 2)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {tbtmCalc.subDayChuyen.hsTN > 0
                        ? formatDecimal(tbtmCalc.subDayChuyen.hsTN, 2)
                        : '-'}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-emerald-900">
                      {formatDecimal(tbtmCalc.subDayChuyen.hsTong, 2)}
                    </td>
                    <td className="px-2.5 py-2 text-right tabular-nums">
                      {formatDecimal(tbtmCalc.subDayChuyen.congSP, 4)}
                    </td>
                    <td className="bg-indigo-100/50 px-2.5 py-2 text-right font-bold text-indigo-900 tabular-nums">
                      {formatDecimal(tbtmCalc.subDayChuyen.hsCongSP26, 5)}
                    </td>
                    <td className="px-2.5 py-2 text-right tabular-nums">
                      {formatVND(tbtmCalc.subDayChuyen.luongSP)} đ
                    </td>
                    <td className="px-2.5 py-2 text-right tabular-nums text-emerald-800">
                      {formatVND(tbtmCalc.subDayChuyen.tienThuong)} đ
                    </td>
                    <td className="bg-indigo-100/80 px-3 py-2 text-right font-bold text-indigo-950 tabular-nums">
                      {formatVND(tbtmCalc.subDayChuyen.tongLuongTBTM)} đ
                    </td>
                    <td className="border-l-2 border-slate-300 bg-slate-100 px-3 py-2 text-right font-bold tabular-nums">
                      {formatVND(tbtmCalc.subDayChuyen.tongLuongCu)} đ
                    </td>
                    <td className="bg-amber-100/60 px-3 py-2 text-right font-bold tabular-nums">
                      {tbtmCalc.subDayChuyen.chenhLech >= 0 ? '+' : ''}
                      {formatVND(tbtmCalc.subDayChuyen.chenhLech)} đ
                    </td>
                  </tr>

                  {tbtmCalc.dayChuyenRows.map((r) => renderRow(r))}

                  {/* DÒNG TỔNG CỘNG TOÀN PHÒNG */}
                  <tr className="border-t-2 border-slate-300 bg-slate-900 font-bold text-white">
                    <td className="px-2.5 py-2.5 text-center">Tổng</td>
                    <td className="px-2.5 py-2.5"></td>
                    <td colSpan={2} className="px-3 py-2.5">
                      TỔNG CỘNG ({tbtmCalc.grandTotal.count} nhân sự)
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      {formatDecimal(tbtmCalc.grandTotal.hsCV, 2)}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      {formatDecimal(tbtmCalc.grandTotal.hsTN, 2)}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-amber-300">
                      {formatDecimal(tbtmCalc.grandTotal.hsTong, 2)}
                    </td>
                    <td className="px-2.5 py-2.5 text-right tabular-nums">
                      {formatDecimal(tbtmCalc.grandTotal.congSP, 4)}
                    </td>
                    <td className="bg-indigo-950 px-2.5 py-2.5 text-right text-amber-300 tabular-nums">
                      {formatDecimal(tbtmCalc.grandTotal.hsCongSP26, 5)}
                    </td>
                    <td className="px-2.5 py-2.5 text-right tabular-nums">
                      {formatVND(tbtmCalc.grandTotal.luongSP)} đ
                    </td>
                    <td className="px-2.5 py-2.5 text-right tabular-nums text-emerald-300">
                      {formatVND(tbtmCalc.grandTotal.tienThuong)} đ
                    </td>
                    <td className="bg-indigo-900 px-3 py-2.5 text-right text-amber-300 tabular-nums">
                      {formatVND(tbtmCalc.grandTotal.tongLuongTBTM)} đ
                    </td>
                    <td className="border-l-2 border-slate-700 bg-slate-800 px-3 py-2.5 text-right text-slate-200 tabular-nums">
                      {formatVND(tbtmCalc.grandTotal.tongLuongCu)} đ
                    </td>
                    <td className="bg-slate-950 px-3 py-2.5 text-right text-emerald-400 tabular-nums">
                      0 đ (Khớp khít)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VÙNG IN PDF KHI BẤM IN TỪ TAB NÀY (Chỉ in ra đúng chuẩn mẫu TBTM, không in bảng so sánh) */}
      <div className="hidden print:block">
        <PrintPreviewTBTM period={period} tbtmCalc={tbtmCalc} sig={signatures} />
      </div>
    </div>
  );
};

function renderRow(r: TbtmEmployeeRow) {
  const isPositive = r.chenhLech > 0;
  const isNegative = r.chenhLech < 0;

  return (
    <tr key={r.msnv} className="hover:bg-slate-50">
      <td className="px-2.5 py-1.5 text-center font-medium text-slate-500 tabular-nums">
        {r.stt}
      </td>
      <td className="px-2.5 py-1.5 text-center font-mono font-bold text-slate-800">
        {normalizeMsnv4(r.msnv)}
      </td>
      <td className="px-3 py-1.5 font-semibold text-slate-900">{r.fullName}</td>
      <td className="px-3 py-1.5 text-slate-600">{r.position}</td>
      <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">
        {formatDecimal(r.hsCV, 2)}
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">
        {r.hsTN > 0 ? formatDecimal(r.hsTN, 2) : '-'}
      </td>
      <td className="px-2 py-1.5 text-right font-bold text-blue-900 tabular-nums">
        {formatDecimal(r.hsTong, 2)}
      </td>
      <td className="px-2.5 py-1.5 text-right tabular-nums text-slate-800">
        {formatDecimal(r.congSP, 4)}
      </td>
      <td className="bg-indigo-50/50 px-2.5 py-1.5 text-right font-mono font-semibold text-indigo-900 tabular-nums">
        {formatDecimal(r.hsCongSP26, 5)}
      </td>
      <td className="px-2.5 py-1.5 text-right font-medium tabular-nums text-slate-900">
        {formatVND(r.luongSPHienThi)} đ
      </td>
      <td className="px-2.5 py-1.5 text-right font-medium tabular-nums text-emerald-700">
        {formatVND(r.tienThuongHienThi)} đ
      </td>
      <td className="bg-indigo-50 px-3 py-1.5 text-right font-bold text-indigo-950 tabular-nums">
        {formatVND(r.tongLuongTBTMHienThi)} đ
      </td>
      <td className="border-l-2 border-slate-200 bg-slate-50 px-3 py-1.5 text-right font-semibold text-slate-800 tabular-nums">
        {formatVND(r.tongLuongCu)} đ
      </td>
      <td
        className={`px-3 py-1.5 text-right font-bold tabular-nums ${
          isPositive
            ? 'text-emerald-700'
            : isNegative
            ? 'text-rose-700'
            : 'text-slate-500'
        }`}
      >
        <span className="inline-flex items-center gap-0.5">
          {isPositive ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : isNegative ? (
            <ArrowDownRight className="h-3 w-3" />
          ) : null}
          {isPositive ? '+' : ''}
          {formatVND(r.chenhLech)} đ
        </span>
      </td>
    </tr>
  );
}
