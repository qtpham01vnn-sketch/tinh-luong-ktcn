import React from 'react';
import type { PayrollPeriod, SignatureConfig } from '../types/payroll';
import type { TbtmCalculationResult, TbtmEmployeeRow } from '../utils/tbtmCalc';
import { formatDecimal, formatVND } from '../utils/payrollCalc';
import { normalizeMsnv4 } from '../utils/rbacAuth';

interface PrintPreviewTBTMProps {
  period: PayrollPeriod;
  tbtmCalc: TbtmCalculationResult;
  sig: SignatureConfig;
}

export const PrintPreviewTBTM: React.FC<PrintPreviewTBTMProps> = ({
  period,
  tbtmCalc,
  sig,
}) => {
  const { summary: s } = tbtmCalc;
  const now = new Date();
  const dateStr = sig.issueDate
    ? `Ngày ${sig.issueDate.slice(8, 10)} tháng ${sig.issueDate.slice(5, 7)} năm ${sig.issueDate.slice(0, 4)}`
    : `${sig.place || 'Đồng Nai'}, ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`;

  return (
    <div
      id="print-area"
      className="print-area mx-auto bg-white text-black p-4 print:p-0 print:text-[9.5pt]"
      style={{ fontFamily: '"Times New Roman", Times, serif' }}
    >
      {/* 1. Header Công ty */}
      <div className="mb-3">
        <div className="text-xs font-bold uppercase tracking-wider text-black">
          CÔNG TY CỔ PHẦN GẠCH MEN PHƯƠNG NAM
        </div>
        <div className="text-xs font-semibold text-black">
          Phòng Kỹ thuật - Công nghệ
        </div>
      </div>

      {/* 2. Tiêu đề Bảng lương & 7 dòng tóm tắt chuẩn TBTM */}
      <div className="mb-3">
        <h2 className="text-sm font-bold uppercase text-black text-center sm:text-base">
          BẢNG THANH TOÁN TIỀN LƯƠNG {period.label.toUpperCase()}
        </h2>
        <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-0.5 text-[9pt]">
          <div className="flex justify-between border-b border-dashed border-slate-400 py-0.5">
            <span>Tổng quỹ lương PKTCN theo sản lượng khoán:</span>
            <strong className="font-mono">{formatVND(s.quyLuongSP)} đ</strong>
          </div>
          <div className="flex justify-between border-b border-dashed border-slate-400 py-0.5">
            <span>Tổng chi quỹ lương + thưởng ({period.periodKey.slice(5)}/{period.periodKey.slice(0, 4)}):</span>
            <strong className="font-mono text-black">{formatVND(s.tongChiQuy)} đ</strong>
          </div>

          <div className="flex justify-between border-b border-dashed border-slate-400 py-0.5">
            <span>Tổng thưởng :</span>
            <strong className="font-mono">{formatVND(s.tongThuong)} đ</strong>
          </div>
          <div className="flex justify-between border-b border-dashed border-slate-400 py-0.5">
            <span>Quỹ dự phòng 50%:</span>
            <strong className="font-mono">{formatVND(s.quyDuPhong50)} đ</strong>
          </div>

          <div className="flex justify-between border-b border-dashed border-slate-400 py-0.5">
            <span>Chi thưởng 50% :</span>
            <strong className="font-mono">{formatVND(s.thuongChia50)} đ</strong>
          </div>
          <div className="flex justify-between border-b border-dashed border-slate-400 py-0.5">
            <span>Lương hệ số 1 TBTM (K THƯỞNG):</span>
            <strong className="font-mono text-black">{formatVND(s.luongHS1KhongThuong)} đ</strong>
          </div>

          <div className="col-span-2 flex justify-between border-b border-black py-0.5 font-bold">
            <span>Lương hệ số 1 (CÓ THƯỞNG):</span>
            <span className="font-mono text-black">{formatVND(s.luongHS1CoThuong)} đ</span>
          </div>
        </div>
      </div>

      {/* 3. Bảng dữ liệu đúng chuẩn form TBTM (không kèm 2 cột đối chiếu) */}
      <table className="w-full border-collapse border border-black text-[9pt] leading-tight">
        <thead>
          <tr className="bg-slate-100 text-center font-bold">
            <th rowSpan={2} className="border border-black px-1.5 py-1 w-8">STT</th>
            <th rowSpan={2} className="border border-black px-1.5 py-1 w-12">MSNV</th>
            <th rowSpan={2} className="border border-black px-2 py-1 text-left">Tên</th>
            <th rowSpan={2} className="border border-black px-2 py-1 text-left w-28">Chức vụ</th>
            <th colSpan={3} className="border border-black px-1 py-0.5">Hệ số</th>
            <th rowSpan={2} className="border border-black px-1.5 py-1 w-16">Công sản phẩm</th>
            <th rowSpan={2} className="border border-black px-1.5 py-1 w-20">Hệ số công sản phẩm</th>
            <th rowSpan={2} className="border border-black px-2 py-1 w-24">Lương sản phẩm</th>
            <th rowSpan={2} className="border border-black px-2 py-1 w-20">Thưởng CL+SL</th>
            <th rowSpan={2} className="border border-black px-2 py-1 w-28 bg-slate-200">Tổng lương + thưởng</th>
          </tr>
          <tr className="bg-slate-100 text-center font-bold text-[8.5pt]">
            <th className="border border-black px-1 py-0.5 w-10">Lương</th>
            <th className="border border-black px-1 py-0.5 w-12">Trách nhiệm</th>
            <th className="border border-black px-1 py-0.5 w-10">Tổng</th>
          </tr>
        </thead>
        <tbody>
          {/* I. VĂN PHÒNG */}
          <tr className="bg-slate-100/80 font-bold">
            <td className="border border-black px-1.5 py-1 text-center"></td>
            <td className="border border-black px-1.5 py-1"></td>
            <td colSpan={2} className="border border-black px-2 py-1 uppercase">
              I. VĂN PHÒNG
            </td>
            <td className="border border-black px-1 py-1 text-right font-mono">
              {formatDecimal(tbtmCalc.subVanPhong.hsCV, 2)}
            </td>
            <td className="border border-black px-1 py-1 text-right font-mono">
              {formatDecimal(tbtmCalc.subVanPhong.hsTN, 2)}
            </td>
            <td className="border border-black px-1 py-1 text-right font-mono">
              {formatDecimal(tbtmCalc.subVanPhong.hsTong, 2)}
            </td>
            <td className="border border-black px-1.5 py-1 text-right font-mono">
              {formatDecimal(tbtmCalc.subVanPhong.congSP, 4)}
            </td>
            <td className="border border-black px-1.5 py-1 text-right font-mono">
              {formatDecimal(tbtmCalc.subVanPhong.hsCongSP26, 5)}
            </td>
            <td className="border border-black px-2 py-1 text-right font-mono">
              {formatVND(tbtmCalc.subVanPhong.luongSP)}
            </td>
            <td className="border border-black px-2 py-1 text-right font-mono">
              {formatVND(tbtmCalc.subVanPhong.tienThuong)}
            </td>
            <td className="border border-black px-2 py-1 text-right font-mono bg-slate-200/80">
              {formatVND(tbtmCalc.subVanPhong.tongLuongTBTM)}
            </td>
          </tr>

          {tbtmCalc.vanPhongRows.map((r) => renderPrintRow(r))}

          {/* II. BP NHÂN VIÊN */}
          <tr className="bg-slate-100/80 font-bold">
            <td className="border border-black px-1.5 py-1 text-center"></td>
            <td className="border border-black px-1.5 py-1"></td>
            <td colSpan={2} className="border border-black px-2 py-1 uppercase">
              II. BP nhân viên
            </td>
            <td className="border border-black px-1 py-1 text-right font-mono">
              {formatDecimal(tbtmCalc.subDayChuyen.hsCV, 2)}
            </td>
            <td className="border border-black px-1 py-1 text-right font-mono">
              {tbtmCalc.subDayChuyen.hsTN > 0 ? formatDecimal(tbtmCalc.subDayChuyen.hsTN, 2) : ''}
            </td>
            <td className="border border-black px-1 py-1 text-right font-mono">
              {formatDecimal(tbtmCalc.subDayChuyen.hsTong, 2)}
            </td>
            <td className="border border-black px-1.5 py-1 text-right font-mono">
              {formatDecimal(tbtmCalc.subDayChuyen.congSP, 4)}
            </td>
            <td className="border border-black px-1.5 py-1 text-right font-mono">
              {formatDecimal(tbtmCalc.subDayChuyen.hsCongSP26, 5)}
            </td>
            <td className="border border-black px-2 py-1 text-right font-mono">
              {formatVND(tbtmCalc.subDayChuyen.luongSP)}
            </td>
            <td className="border border-black px-2 py-1 text-right font-mono">
              {formatVND(tbtmCalc.subDayChuyen.tienThuong)}
            </td>
            <td className="border border-black px-2 py-1 text-right font-mono bg-slate-200/80">
              {formatVND(tbtmCalc.subDayChuyen.tongLuongTBTM)}
            </td>
          </tr>

          {tbtmCalc.dayChuyenRows.map((r) => renderPrintRow(r))}

          {/* TỔNG CỘNG */}
          <tr className="bg-slate-200 font-bold">
            <td className="border border-black px-1.5 py-1 text-center">Tổng</td>
            <td className="border border-black px-1.5 py-1"></td>
            <td colSpan={2} className="border border-black px-2 py-1"></td>
            <td className="border border-black px-1 py-1 text-right font-mono">
              {formatDecimal(tbtmCalc.grandTotal.hsCV, 2)}
            </td>
            <td className="border border-black px-1 py-1 text-right font-mono">
              {formatDecimal(tbtmCalc.grandTotal.hsTN, 2)}
            </td>
            <td className="border border-black px-1 py-1 text-right font-mono">
              {formatDecimal(tbtmCalc.grandTotal.hsTong, 2)}
            </td>
            <td className="border border-black px-1.5 py-1 text-right font-mono">
              {formatDecimal(tbtmCalc.grandTotal.congSP, 4)}
            </td>
            <td className="border border-black px-1.5 py-1 text-right font-mono">
              {formatDecimal(tbtmCalc.grandTotal.hsCongSP26, 5)}
            </td>
            <td className="border border-black px-2 py-1 text-right font-mono">
              {formatVND(tbtmCalc.grandTotal.luongSP)}
            </td>
            <td className="border border-black px-2 py-1 text-right font-mono">
              {formatVND(tbtmCalc.grandTotal.tienThuong)}
            </td>
            <td className="border border-black px-2 py-1 text-right font-mono bg-slate-300">
              {formatVND(tbtmCalc.grandTotal.tongLuongTBTM)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* 4. Ngày tháng & 4 Chữ ký chuẩn TBTM */}
      <div className="sign-block mt-6 break-inside-avoid text-xs">
        <div className="mb-2 text-right italic">{dateStr}</div>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="font-bold uppercase">PTGĐ.TCHC</div>
            <div className="mt-16 font-semibold">{sig.deputyTCHC || ''}</div>
          </div>
          <div>
            <div className="font-bold uppercase">PTGĐ.PT</div>
            <div className="mt-16 font-semibold">{sig.deputyInCharge || ''}</div>
          </div>
          <div>
            <div className="font-bold uppercase">Phòng KTCN</div>
            <div className="mt-16 font-semibold">{sig.headOfDept || 'Đặng Thanh Tùng'}</div>
          </div>
          <div>
            <div className="font-bold uppercase">Người Lập</div>
            <div className="mt-16 font-semibold">{sig.preparedBy || 'Phạm Quốc Tuấn'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

function renderPrintRow(r: TbtmEmployeeRow) {
  return (
    <tr key={r.msnv}>
      <td className="border border-black px-1.5 py-0.5 text-center">{r.stt}</td>
      <td className="border border-black px-1.5 py-0.5 text-center font-mono font-bold">
        {normalizeMsnv4(r.msnv)}
      </td>
      <td className="border border-black px-2 py-0.5 font-medium">{r.fullName}</td>
      <td className="border border-black px-2 py-0.5">{r.position}</td>
      <td className="border border-black px-1 py-0.5 text-right font-mono">
        {formatDecimal(r.hsCV, 2)}
      </td>
      <td className="border border-black px-1 py-0.5 text-right font-mono">
        {r.hsTN > 0 ? formatDecimal(r.hsTN, 2) : ''}
      </td>
      <td className="border border-black px-1 py-0.5 text-right font-mono font-semibold">
        {formatDecimal(r.hsTong, 2)}
      </td>
      <td className="border border-black px-1.5 py-0.5 text-right font-mono">
        {formatDecimal(r.congSP, 4)}
      </td>
      <td className="border border-black px-1.5 py-0.5 text-right font-mono">
        {formatDecimal(r.hsCongSP26, 5)}
      </td>
      <td className="border border-black px-2 py-0.5 text-right font-mono">
        {formatVND(r.luongSPHienThi)}
      </td>
      <td className="border border-black px-2 py-0.5 text-right font-mono">
        {formatVND(r.tienThuongHienThi)}
      </td>
      <td className="border border-black px-2 py-0.5 text-right font-mono font-bold bg-slate-50">
        {formatVND(r.tongLuongTBTMHienThi)}
      </td>
    </tr>
  );
}
