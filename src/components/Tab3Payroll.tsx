import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { AttendanceRecord, PayrollPeriod } from '../types/payroll';
import { formatDecimal, formatVND } from '../utils/payrollCalc';
import type {
  CalculatedEmployeeRow,
  DepartmentSubtotal,
  PayrollCalculationResult,
} from '../utils/payrollCalc';
import { parseNumberLoose } from '../utils/importParsers';

type EditableField = 'congKhoan' | 'congBD' | 'truThuongCaNhan';

interface Tab3Props {
  period: PayrollPeriod;
  calc: PayrollCalculationResult;
  onUpdatePeriod: (updater: (prev: PayrollPeriod) => PayrollPeriod) => void;
}

/** Ô số sửa trực tiếp: commit khi blur/Enter, hỗ trợ dán cột nhiều dòng từ Excel */
const NumberCell: React.FC<{
  value: number;
  onCommit: (v: number) => void;
  onPasteColumn: (values: number[]) => void;
  highlight?: boolean;
  width?: string;
}> = ({ value, onCommit, onPasteColumn, highlight, width = 'w-20' }) => {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const commit = () => {
    const n = Math.max(0, parseNumberLoose(text));
    if (n !== value) onCommit(n);
    else setText(String(value));
  };

  return (
    <input
      value={text}
      inputMode="decimal"
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') setText(String(value));
      }}
      onPaste={(e) => {
        const raw = e.clipboardData.getData('text');
        if (/\r?\n/.test(raw.trim())) {
          e.preventDefault();
          const values = raw
            .split(/\r?\n/)
            .filter((l, i, arr) => !(i === arr.length - 1 && l.trim() === ''))
            .map((l) => Math.max(0, parseNumberLoose(l.split('\t')[0])));
          onPasteColumn(values);
        }
      }}
      className={`${width} rounded border px-1.5 py-0.5 text-right text-sm tabular-nums focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-300 ${
        highlight ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white'
      }`}
    />
  );
};

export const Tab3Payroll: React.FC<Tab3Props> = ({ period, calc, onUpdatePeriod }) => {
  const { summary: s, vanPhongRows, dayChuyenRows, subVanPhong, subDayChuyen, grandTotal } = calc;
  const isA = period.calculationMode === 'A';
  const orderedMsnv = calc.rows.map((r) => r.msnv);

  const updateRecord = (msnv: string, field: EditableField, value: number) => {
    onUpdatePeriod((prev) => {
      const rec = prev.records[msnv];
      if (!rec) return prev;
      const next: AttendanceRecord = { ...rec, [field]: value };
      return { ...prev, records: { ...prev.records, [msnv]: next } };
    });
  };

  const pasteColumn = (startMsnv: string, field: EditableField, values: number[]) => {
    const startIdx = orderedMsnv.indexOf(startMsnv);
    if (startIdx < 0) return;
    onUpdatePeriod((prev) => {
      const records = { ...prev.records };
      values.forEach((v, i) => {
        const m = orderedMsnv[startIdx + i];
        if (m && records[m]) records[m] = { ...records[m], [field]: v };
      });
      return { ...prev, records };
    });
  };

  // Đối soát: tổng thực chi + tổng trừ cá nhân phải bằng quỹ thực chia
  const allocated = grandTotal.tongLuong + grandTotal.truThuong;
  const diff = s.quyThucChia - allocated;
  const balanced = Math.abs(diff) < 1;
  const anomalies = calc.rows.filter((r) => r.isAnomalyCong);

  const fundRows: [string, number, string?][] = [
    ['Tổng quỹ lương theo sản lượng khoán', s.quyKhoan],
    ['Lương bảo dưỡng DC2', s.quyBD],
    ['Thưởng gộp trước giảm trừ', s.thuongGop, 'text-slate-500'],
    ['Giảm trừ quỹ thưởng chung', -s.giamTruChung, 'text-rose-700'],
    ['Tổng thưởng 2 dây chuyền', s.tongThuong],
    [`Tổng quỹ lương ${period.label.toLowerCase()}`, s.tongQuyLuong, 'font-bold'],
    [`Chia thưởng ${period.bonusSharePct}%`, s.thuongChia],
    ['Tổng chia lương + thưởng (Quỹ thực chia)', s.quyThucChia, 'font-bold text-blue-800'],
    ['Quỹ lương giữ lại', s.quyGiuLai, 'text-amber-700'],
  ];

  const renderSubtotal = (sub: DepartmentSubtotal | (typeof grandTotal & { label: string }), cls: string) => (
    <tr className={cls}>
      <td colSpan={4} className="px-2 py-1.5 font-bold">{sub.label}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{formatDecimal(sub.hsCV)}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{formatDecimal(sub.hsTN)}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{formatDecimal(sub.hsTong)}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{formatDecimal(sub.congKhoan, 4)}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{formatDecimal(sub.hsNgayCong, 4)}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{formatDecimal(sub.congBD)}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{formatDecimal(sub.hsNgayCongBD, 3)}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{formatVND(sub.luongKhoan)}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{formatVND(sub.luongBD)}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{formatVND(sub.tienThuong)}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{formatVND(sub.truThuong)}</td>
      <td className="px-2 py-1.5 text-right font-bold tabular-nums">{formatVND(sub.tongLuong)}</td>
      {!isA && <td className="px-2 py-1.5" />}
    </tr>
  );

  const renderRow = (r: CalculatedEmployeeRow) => (
    <tr
      key={r.msnv}
      className={r.isAnomalyCong ? 'bg-amber-50' : 'hover:bg-slate-50'}
      title={r.anomalyReason}
    >
      <td className="px-2 py-1 text-center tabular-nums">{r.stt}</td>
      <td className="px-2 py-1 font-mono text-xs">{r.msnv}</td>
      <td className="px-2 py-1 font-medium whitespace-nowrap">
        {r.fullName}
        {r.isAnomalyCong && <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-amber-600" />}
      </td>
      <td className="px-2 py-1 text-xs whitespace-nowrap text-slate-600">{r.position}</td>
      <td className="px-2 py-1 text-right tabular-nums">{formatDecimal(r.hsCV)}</td>
      <td className="px-2 py-1 text-right tabular-nums">{formatDecimal(r.hsTN)}</td>
      <td className="px-2 py-1 text-right font-semibold tabular-nums">{formatDecimal(r.hsTong)}</td>
      <td className="px-1 py-1 text-right">
        <NumberCell
          value={r.congKhoan}
          highlight={r.isAnomalyCong}
          onCommit={(v) => updateRecord(r.msnv, 'congKhoan', v)}
          onPasteColumn={(vals) => pasteColumn(r.msnv, 'congKhoan', vals)}
        />
      </td>
      <td className="px-2 py-1 text-right tabular-nums">{formatDecimal(r.hsNgayCong, 4)}</td>
      <td className="px-1 py-1 text-right">
        <NumberCell
          value={r.congBD}
          width="w-16"
          onCommit={(v) => updateRecord(r.msnv, 'congBD', v)}
          onPasteColumn={(vals) => pasteColumn(r.msnv, 'congBD', vals)}
        />
      </td>
      <td className="px-2 py-1 text-right tabular-nums">{formatDecimal(r.hsNgayCongBD, 3)}</td>
      <td className="px-2 py-1 text-right tabular-nums">{formatVND(r.luongKhoanHienThi)}</td>
      <td className={`px-2 py-1 text-right tabular-nums ${isA ? 'text-slate-400 italic' : ''}`}>
        {formatVND(r.luongBDHienThi)}
      </td>
      <td className={`px-2 py-1 text-right tabular-nums ${isA ? 'text-slate-400 italic' : ''}`}>
        {formatVND(r.tienThuongHienThi)}
      </td>
      <td className="px-1 py-1 text-right">
        <NumberCell
          value={r.truThuongCaNhan}
          width="w-24"
          onCommit={(v) => updateRecord(r.msnv, 'truThuongCaNhan', v)}
          onPasteColumn={(vals) => pasteColumn(r.msnv, 'truThuongCaNhan', vals)}
        />
        {r.truThuongTuNhatKy > 0 && (
          <div className="text-[10px] text-rose-600">+{formatVND(r.truThuongTuNhatKy)} nhật ký</div>
        )}
      </td>
      <td className="px-2 py-1 text-right font-bold text-slate-900 tabular-nums">
        {formatVND(r.tongLuongHienThi)}
      </td>
      {!isA && (
        <td
          className={`px-2 py-1 text-right text-xs font-semibold tabular-nums ${
            r.chenhLechBvsA > 0 ? 'text-emerald-700' : r.chenhLechBvsA < 0 ? 'text-rose-700' : 'text-slate-400'
          }`}
        >
          {r.chenhLechBvsA > 0 ? '+' : ''}
          {formatVND(r.chenhLechBvsA)}
        </td>
      )}
    </tr>
  );

  const toggleBtn = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-xs font-semibold transition ${
      active ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
    }`;

  return (
    <div className="space-y-5">
      {/* Bảng tổng hợp quỹ + điều khiển */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-3 text-base font-bold text-slate-900">
            Bảng tổng hợp Quỹ lương — {period.label}
          </h2>
          <div className="grid gap-x-8 sm:grid-cols-2">
            {fundRows.map(([label, value, cls]) => (
              <div key={label} className="flex justify-between border-b border-dashed border-slate-100 py-1.5 text-sm">
                <span className="text-slate-600">{label}</span>
                <span className={`tabular-nums ${cls ?? 'font-semibold text-slate-900'}`}>
                  {formatVND(value)} đ
                </span>
              </div>
            ))}
            <div className="flex justify-between border-b border-dashed border-slate-100 py-1.5 text-sm">
              <span className="text-slate-600">
                Đơn giá 1 HS-công {isA ? '(gộp)' : '(khoán riêng)'}
              </span>
              <span className="font-semibold tabular-nums">
                {formatDecimal(isA ? s.donGiaGop : s.donGiaKhoanRieng, 2)} đ
              </span>
            </div>
            <div className="flex justify-between border-b border-dashed border-slate-100 py-1.5 text-sm">
              <span className="text-slate-600">Đơn giá BD / Thưởng 1 HS-công</span>
              <span className="font-semibold tabular-nums">
                {formatDecimal(s.donGiaBD, 2)} / {formatDecimal(s.donGiaThuong, 2)}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <div className="mb-1.5 text-xs font-semibold text-slate-700">Chế độ chia quỹ</div>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
              <button
                type="button"
                className={toggleBtn(isA)}
                onClick={() => onUpdatePeriod((p) => ({ ...p, calculationMode: 'A' }))}
              >
                Chế độ 1 — Gộp quỹ (mẫu KTCN)
              </button>
              <button
                type="button"
                className={toggleBtn(!isA)}
                onClick={() => onUpdatePeriod((p) => ({ ...p, calculationMode: 'B' }))}
              >
                Chế độ 2 — Tách 3 quỹ
              </button>
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
              {isA
                ? 'Toàn bộ quỹ thực chia chia theo HS ngày công khoán. Cột Lương BD & Thưởng chỉ hiển thị tham khảo (đúng như file Excel gốc).'
                : 'Khoán chia theo HS ngày công, Bảo dưỡng chia theo HS công BD, Thưởng chia theo HS ngày công. Cột cuối là chênh lệch so với Chế độ 1.'}
            </p>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-semibold text-slate-700">Chuẩn Lương hệ số 1</div>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
              {([27, 26] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  className={toggleBtn(period.standardDaysForHS1 === d)}
                  onClick={() => onUpdatePeriod((p) => ({ ...p, standardDaysForHS1: d }))}
                >
                  {d} công
                </button>
              ))}
            </div>
            <div className="mt-2 rounded-lg bg-blue-50 px-3 py-2">
              <div className="text-xs text-blue-700">
                Lương hệ số 1 ({period.standardDaysForHS1} công)
              </div>
              <div className="text-xl font-bold text-blue-900 tabular-nums">
                {formatVND(s.luongHS1)} đ
              </div>
            </div>
          </div>

          <div
            className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
              balanced ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
            }`}
          >
            {balanced ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>
              {balanced
                ? `Đối soát khớp: Tổng thực chi ${formatVND(grandTotal.tongLuong)} đ + Trừ cá nhân ${formatVND(grandTotal.truThuong)} đ = Quỹ thực chia.`
                : `Lệch ${formatVND(diff)} đ so với quỹ thực chia. ${
                    s.tongHSNgayCongBD === 0 && !isA && s.quyBD > 0
                      ? 'Chế độ 2: chưa có công bảo dưỡng nên quỹ BD chưa được phân bổ.'
                      : 'Kiểm tra công khoán = 0 hoặc khoản trừ vượt lương.'
                  }`}
            </span>
          </div>
        </div>
      </section>

      {anomalies.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>{anomalies.length} nhân sự có ngày công bất thường:</strong>{' '}
            {anomalies.map((a) => `${a.fullName} (${a.anomalyReason})`).join('; ')}.
          </span>
        </div>
      )}

      {/* Bảng chi tiết */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-base font-bold text-slate-900">
            Bảng lương chi tiết ({calc.rows.length} nhân sự)
          </h2>
          <span className="text-xs text-slate-500">
            Sửa trực tiếp Công khoán / Công BD / Trừ thưởng — dán cột nhiều dòng từ Excel vào ô đầu tiên.
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
              <tr className="border-b border-slate-200">
                <th className="px-2 py-2">STT</th>
                <th className="px-2 py-2 text-left">MSNV</th>
                <th className="px-2 py-2 text-left">Họ và tên</th>
                <th className="px-2 py-2 text-left">Chức vụ</th>
                <th className="px-2 py-2 text-right">HS CV</th>
                <th className="px-2 py-2 text-right">HS TN</th>
                <th className="px-2 py-2 text-right">HS Cộng</th>
                <th className="px-2 py-2 text-right">Công khoán</th>
                <th className="px-2 py-2 text-right">HS ngày công</th>
                <th className="px-2 py-2 text-right">Công BD</th>
                <th className="px-2 py-2 text-right">HS công BD</th>
                <th className="px-2 py-2 text-right">Lương khoán</th>
                <th className="px-2 py-2 text-right">Lương BD{isA && '*'}</th>
                <th className="px-2 py-2 text-right">Tiền thưởng{isA && '*'}</th>
                <th className="px-2 py-2 text-right">Trừ thưởng</th>
                <th className="px-2 py-2 text-right">Tổng lương</th>
                {!isA && <th className="px-2 py-2 text-right">Chênh lệch so CĐ1</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="bg-slate-100/70">
                <td colSpan={isA ? 16 : 17} className="px-2 py-1.5 text-xs font-bold italic text-slate-700">
                  I. BỘ PHẬN VĂN PHÒNG
                </td>
              </tr>
              {vanPhongRows.map(renderRow)}
              {renderSubtotal(subVanPhong, 'bg-slate-100 text-slate-800')}
              <tr className="bg-slate-100/70">
                <td colSpan={isA ? 16 : 17} className="px-2 py-1.5 text-xs font-bold italic text-slate-700">
                  II. BỘ PHẬN NHÂN VIÊN DÂY CHUYỀN 1 + 2
                </td>
              </tr>
              {dayChuyenRows.map(renderRow)}
              {renderSubtotal(subDayChuyen, 'bg-slate-100 text-slate-800')}
              {renderSubtotal({ ...grandTotal, label: 'TỔNG CỘNG TOÀN PHÒNG' }, 'bg-amber-100 text-slate-900')}
            </tbody>
          </table>
        </div>
        {isA && (
          <p className="px-5 py-2 text-[11px] italic text-slate-500">
            (*) Chế độ 1: Lương BD và Tiền thưởng đã nằm trong Lương khoán (quỹ gộp), chỉ hiển thị tham khảo — không cộng thêm vào Tổng lương.
          </p>
        )}
      </section>
    </div>
  );
};
