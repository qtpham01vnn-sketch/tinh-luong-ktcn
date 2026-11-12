import React from 'react';
import type { PayrollPeriod, SignatureConfig } from '../types/payroll';
import { formatDecimal, formatVND } from '../utils/payrollCalc';
import type { CalculatedEmployeeRow, PayrollCalculationResult } from '../utils/payrollCalc';
import {
  COMPANY_ADDRESS,
  COMPANY_NAME,
  DEPT_NAME,
  formatDocNumber,
  formatPlaceDate,
  modeDescription,
} from '../utils/excelExport';
import { numberToVietnameseWords } from '../utils/vnWords';

interface Props {
  period: PayrollPeriod;
  calc: PayrollCalculationResult;
  sig: SignatureConfig;
}

/** Bản xem trước in / PDF theo thể thức NĐ 30/2020/NĐ-CP (Times New Roman, A4 ngang) */
export const PrintPreview: React.FC<Props> = ({ period, calc, sig }) => {
  const { summary: s, vanPhongRows, dayChuyenRows, subVanPhong, subDayChuyen, grandTotal: g } = calc;
  const isA = period.calculationMode === 'A';

  const td = 'border border-black px-1 py-[2px]';
  const num = `${td} text-right tabular-nums`;

  const row = (r: CalculatedEmployeeRow) => (
    <tr key={r.msnv}>
      <td className={`${td} text-center`}>{r.stt}</td>
      <td className={`${td} text-center`}>{r.msnv}</td>
      <td className={`${td} whitespace-nowrap`}>{r.fullName}</td>
      <td className={`${td} whitespace-nowrap`}>{r.position}</td>
      <td className={num}>{formatVND(r.baseSalary2020)}</td>
      <td className={num}>{formatDecimal(r.hsCV)}</td>
      <td className={num}>{r.hsTN ? formatDecimal(r.hsTN) : '-'}</td>
      <td className={num}>{formatDecimal(r.hsTong)}</td>
      <td className={num}>{formatDecimal(r.congKhoan, 4)}</td>
      <td className={num}>{formatDecimal(r.hsNgayCong, 4)}</td>
      <td className={num}>{r.congBD ? formatDecimal(r.congBD) : ''}</td>
      <td className={num}>{r.hsNgayCongBD ? formatDecimal(r.hsNgayCongBD, 3) : ''}</td>
      <td className={num}>{formatVND(r.luongKhoanHienThi)}</td>
      <td className={num}>{r.luongBDHienThi ? formatVND(r.luongBDHienThi) : ''}</td>
      <td className={num}>{formatVND(r.tienThuongHienThi)}</td>
      <td className={num}>{r.tongTruThuong ? formatVND(r.tongTruThuong) : '-'}</td>
      <td className={`${num} font-bold`}>{formatVND(r.tongLuongHienThi)}</td>
    </tr>
  );

  const sub = (label: string, x: typeof g, bg: string) => (
    <tr className={`font-bold ${bg}`}>
      <td className={td} colSpan={5}>{label}</td>
      <td className={num}>{formatDecimal(x.hsCV)}</td>
      <td className={num}>{formatDecimal(x.hsTN)}</td>
      <td className={num}>{formatDecimal(x.hsTong)}</td>
      <td className={num}>{formatDecimal(x.congKhoan, 4)}</td>
      <td className={num}>{formatDecimal(x.hsNgayCong, 4)}</td>
      <td className={num}>{formatDecimal(x.congBD)}</td>
      <td className={num}>{formatDecimal(x.hsNgayCongBD, 3)}</td>
      <td className={num}>{formatVND(x.luongKhoan)}</td>
      <td className={num}>{formatVND(x.luongBD)}</td>
      <td className={num}>{formatVND(x.tienThuong)}</td>
      <td className={num}>{formatVND(x.truThuong)}</td>
      <td className={num}>{formatVND(x.tongLuong)}</td>
    </tr>
  );

  const sumLine = (label: string, value: string) => (
    <div className="flex justify-between gap-3">
      <span>{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  );

  const signers: [string, string][] = [
    ['NGƯỜI LẬP BIỂU', sig.preparedBy],
    ['TRƯỞNG PHÒNG KTCN', sig.headOfDept],
    ['P.TGĐ PT. TC-HC', sig.deputyTCHC],
    ['P.TGĐ PHỤ TRÁCH', sig.deputyInCharge],
  ];

  return (
    <div
      id="print-area"
      className="print-area mx-auto bg-white text-black"
      style={{ fontFamily: '"Times New Roman", Times, serif' }}
    >
      {/* Thể thức đầu văn bản */}
      <div className="grid grid-cols-2 text-center text-[12pt] leading-snug">
        <div>
          <div className="uppercase">{COMPANY_NAME}</div>
          <div className="font-bold uppercase">{DEPT_NAME}</div>
          <div className="mx-auto mt-0.5 w-32 border-t border-black" />
          <div className="mt-1">{formatDocNumber(sig)}</div>
        </div>
        <div>
          <div className="font-bold uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
          <div className="text-[13pt] font-bold">Độc lập - Tự do - Hạnh phúc</div>
          <div className="mx-auto mt-0.5 w-52 border-t border-black" />
          <div className="mt-1 italic">{formatPlaceDate(sig, period.periodKey)}</div>
        </div>
      </div>
      <div className="mt-0.5 text-[9pt] italic">{COMPANY_ADDRESS}</div>

      <div className="mt-3 text-center">
        <div className="text-[14pt] font-bold">BẢNG THANH TOÁN TIỀN LƯƠNG</div>
        <div className="text-[13pt] font-bold">Phòng Kỹ thuật - Công nghệ {period.label.toLowerCase()}</div>
        <div className="text-[10.5pt] italic">({modeDescription(period)})</div>
      </div>

      {/* Tổng hợp quỹ */}
      <div className="mt-2 grid grid-cols-2 gap-x-12 text-[10.5pt]">
        <div>
          {sumLine('Tổng quỹ lương theo sản lượng khoán:', `${formatVND(s.quyKhoan)} đ`)}
          {sumLine('Lương bảo dưỡng DC2:', `${formatVND(s.quyBD)} đ`)}
          {sumLine('Tổng thưởng 2 dây chuyền (sau giảm trừ):', `${formatVND(s.tongThuong)} đ`)}
          {sumLine(`Tổng quỹ lương ${period.label.toLowerCase()}:`, `${formatVND(s.tongQuyLuong)} đ`)}
          {sumLine(`Chia thưởng ${period.bonusSharePct}%:`, `${formatVND(s.thuongChia)} đ`)}
        </div>
        <div>
          {sumLine('Tổng chia lương + thưởng:', `${formatVND(s.quyThucChia)} đ`)}
          {sumLine('Quỹ lương giữ lại:', `${formatVND(s.quyGiuLai)} đ`)}
          {sumLine(`Lương hệ số 1 (${period.standardDaysForHS1} công):`, `${formatVND(s.luongHS1)} đ`)}
          {sumLine('Giảm trừ quỹ thưởng chung:', `${formatVND(s.giamTruChung)} đ`)}
          {sumLine(
            `Đơn giá 1 HS-công ${isA ? '(gộp)' : '(khoán)'}:`,
            `${formatDecimal(isA ? s.donGiaGop : s.donGiaKhoanRieng, 2)} đ`,
          )}
        </div>
      </div>

      {/* Bảng chi tiết */}
      <table className="mt-2 w-full border-collapse text-[9pt] leading-tight">
        <thead className="bg-slate-100 text-center font-bold">
          <tr>
            <th className={td} rowSpan={2}>STT</th>
            <th className={td} rowSpan={2}>MSNV</th>
            <th className={td} rowSpan={2}>Họ và tên</th>
            <th className={td} rowSpan={2}>Chức vụ</th>
            <th className={td} rowSpan={2}>Lương CB 2020</th>
            <th className={td} colSpan={3}>Hệ số lương</th>
            <th className={td} rowSpan={2}>Công khoán</th>
            <th className={td} rowSpan={2}>HS theo ngày công</th>
            <th className={td} rowSpan={2}>Công BD</th>
            <th className={td} rowSpan={2}>HS ngày công BD</th>
            <th className={td} rowSpan={2}>Lương khoán theo ngày công</th>
            <th className={td} rowSpan={2}>Lương bảo dưỡng</th>
            <th className={td} rowSpan={2}>Tiền thưởng</th>
            <th className={td} rowSpan={2}>Trừ thưởng</th>
            <th className={td} rowSpan={2}>Tổng lương</th>
          </tr>
          <tr>
            <th className={td}>Công việc</th>
            <th className={td}>Trách nhiệm</th>
            <th className={td}>Cộng</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={`${td} font-bold italic`} colSpan={17}>I. BỘ PHẬN VĂN PHÒNG</td>
          </tr>
          {vanPhongRows.map(row)}
          {sub('Cộng BP Văn phòng', subVanPhong, 'bg-slate-50')}
          <tr>
            <td className={`${td} font-bold italic`} colSpan={17}>II. BỘ PHẬN NHÂN VIÊN DÂY CHUYỀN 1 + 2</td>
          </tr>
          {dayChuyenRows.map(row)}
          {sub('Cộng BP Nhân viên dây chuyền 1+2', subDayChuyen, 'bg-slate-50')}
          {sub('TỔNG CỘNG TOÀN PHÒNG', g, 'bg-amber-50')}
        </tbody>
      </table>

      <div className="mt-1.5 text-[11pt] font-bold italic">
        Tổng số tiền thực chi (bằng chữ): {numberToVietnameseWords(g.tongLuong)}.
      </div>

      {/* Vùng ký duyệt */}
      <div className="sign-block mt-3 grid grid-cols-4 text-center text-[12pt]">
        {signers.map(([title, name]) => (
          <div key={title}>
            <div className="font-bold">{title}</div>
            <div className="text-[11pt] italic">(Ký, ghi rõ họ tên)</div>
            <div className="h-20" />
            <div className="font-bold">{name}</div>
          </div>
        ))}
      </div>

      {/* Nơi nhận */}
      <div className="mt-3 text-[11pt] leading-snug">
        <div className="text-[12pt] font-bold italic">Nơi nhận:</div>
        <div>- P.TGĐ phụ trách;</div>
        <div>- P.TGĐ PT. TC-HC;</div>
        <div>- P.TC-HC, P.KT;</div>
        <div>- Lưu: VT, P.KTCN.</div>
      </div>
    </div>
  );
};
