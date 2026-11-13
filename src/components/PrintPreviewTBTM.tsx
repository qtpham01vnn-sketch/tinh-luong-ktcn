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
    ? `Đồng Nai, ngày ${sig.issueDate.slice(8, 10)}, tháng ${sig.issueDate.slice(5, 7)}, năm ${sig.issueDate.slice(0, 4)}`
    : `Đồng Nai, ngày ${now.getDate()}, tháng ${now.getMonth() + 1}, năm ${now.getFullYear()}`;

  return (
    <div
      id="print-area"
      className="print-area mx-auto bg-white text-black p-2 print:p-0 print:text-[8.5pt]"
      style={{ fontFamily: '"Times New Roman", Times, serif' }}
    >
      {/* 1. Header Công ty */}
      <div className="mb-1.5">
        <div className="text-[10pt] font-bold uppercase tracking-wider text-black">
          CÔNG TY CỔ PHẦN GẠCH MEN PHƯƠNG NAM
        </div>
        <div className="text-[9.5pt] font-semibold text-black">
          Phòng Kỹ thuật - Công nghệ
        </div>
      </div>

      {/* 2. Tiêu đề Bảng lương & tóm tắt */}
      <div className="mb-2">
        <h2 className="text-[11pt] font-bold uppercase text-black text-center">
          {period.label}
        </h2>
        <div className="mt-1 grid grid-cols-2 gap-x-8 gap-y-0 text-[8.5pt] leading-tight">
          <div className="flex justify-between border-b border-dashed border-slate-400 py-[1px]">
            <span>Tổng quỹ lương PKTCN theo sản lượng khoán:</span>
            <strong className="font-mono">{formatVND(s.quyLuongSP)} đ</strong>
          </div>
          <div className="flex justify-between border-b border-dashed border-slate-400 py-[1px]">
            <span>Tổng chi quỹ lương + thưởng ({period.periodKey.slice(5)}/{period.periodKey.slice(0, 4)}):</span>
            <strong className="font-mono text-black">{formatVND(tbtmCalc.grandTotal.tongLuongTBTM)} đ</strong>
          </div>

          <div className="flex justify-between border-b border-dashed border-slate-400 py-[1px]">
            <span>Tổng thưởng :</span>
            <strong className="font-mono">{formatVND(s.tongThuong)} đ</strong>
          </div>
          <div className="flex justify-between border-b border-dashed border-slate-400 py-[1px]">
            <span>Quỹ dự phòng 50%:</span>
            <strong className="font-mono">{formatVND(s.quyDuPhong50)} đ</strong>
          </div>

          <div className="flex justify-between border-b border-dashed border-slate-400 py-[1px]">
            <span>Chi thưởng 50% :</span>
            <strong className="font-mono">{formatVND(s.thuongChia50)} đ</strong>
          </div>
          <div className="flex justify-between border-b border-dashed border-slate-400 py-[1px]">
            <span>Lương hệ số 1:</span>
            <strong className="font-mono text-black">{formatVND(s.luongHS1CoThuong)} đ</strong>
          </div>
        </div>
      </div>

      {/* 3. Bảng dữ liệu đúng chuẩn PDF P.KTCN */}
      <table className="w-full border-collapse border border-black text-[8pt] leading-[1.15]">
        <thead>
          <tr className="bg-slate-100 text-center font-bold">
            <th rowSpan={2} className="border border-black px-1 py-[2px] w-7">STT</th>
            <th rowSpan={2} className="border border-black px-1 py-[2px] w-11">MSNV</th>
            <th rowSpan={2} className="border border-black px-1.5 py-[2px] text-left">Tên</th>
            <th rowSpan={2} className="border border-black px-1.5 py-[2px] text-left w-24">Chức vụ</th>
            <th colSpan={3} className="border border-black px-1 py-[1px]">Hệ số</th>
            <th rowSpan={2} className="border border-black px-1 py-[2px] w-14">Công thực tế</th>
            <th rowSpan={2} className="border border-black px-1 py-[2px] w-16">Hệ số công tính lương</th>
            <th rowSpan={2} className="border border-black px-1.5 py-[2px] w-20">Lương sản phẩm</th>
            <th rowSpan={2} className="border border-black px-1.5 py-[2px] w-16">Thưởng CL+SL</th>
            <th rowSpan={2} className="border border-black px-1.5 py-[2px] w-22 bg-slate-200">Tổng lương + thưởng</th>
            <th rowSpan={2} className="border border-black px-1.5 py-[2px] w-16">Ghi chú</th>
          </tr>
          <tr className="bg-slate-100 text-center font-bold text-[7.5pt]">
            <th className="border border-black px-1 py-[1px] w-9">Lương</th>
            <th className="border border-black px-1 py-[1px] w-11">Trách nhiệm</th>
            <th className="border border-black px-1 py-[1px] w-9">Tổng</th>
          </tr>
        </thead>
        <tbody>
          {/* I. VĂN PHÒNG */}
          <tr className="bg-slate-100/80 font-bold">
            <td className="border border-black px-1 py-[1px] text-center"></td>
            <td className="border border-black px-1 py-[1px]"></td>
            <td colSpan={2} className="border border-black px-1.5 py-[1px] uppercase">
              I. VĂN PHÒNG
            </td>
            <td className="border border-black px-1 py-[1px] text-right font-mono">
              {formatDecimal(tbtmCalc.subVanPhong.hsCV, 2)}
            </td>
            <td className="border border-black px-1 py-[1px] text-right font-mono">
              {formatDecimal(tbtmCalc.subVanPhong.hsTN, 2)}
            </td>
            <td className="border border-black px-1 py-[1px] text-right font-mono">
              {formatDecimal(tbtmCalc.subVanPhong.hsTong, 2)}
            </td>
            <td className="border border-black px-1 py-[1px] text-right font-mono">
              {formatDecimal(tbtmCalc.subVanPhong.congSP, 3)}
            </td>
            <td className="border border-black px-1 py-[1px] text-right font-mono">
              {formatDecimal(tbtmCalc.subVanPhong.hsCongSP26, 3)}
            </td>
            <td className="border border-black px-1.5 py-[1px] text-right font-mono">
              {formatVND(tbtmCalc.subVanPhong.luongSP)}
            </td>
            <td className="border border-black px-1.5 py-[1px] text-right font-mono">
              {formatVND(tbtmCalc.subVanPhong.tienThuong)}
            </td>
            <td className="border border-black px-1.5 py-[1px] text-right font-mono bg-slate-200/80">
              {formatVND(tbtmCalc.subVanPhong.tongLuongTBTM)}
            </td>
            <td className="border border-black px-1 py-[1px]"></td>
          </tr>

          {tbtmCalc.vanPhongRows.map((r) => renderPrintRow(r))}

          {/* II. BP NHÂN VIÊN */}
          <tr className="bg-slate-100/80 font-bold">
            <td className="border border-black px-1 py-[1px] text-center"></td>
            <td className="border border-black px-1 py-[1px]"></td>
            <td colSpan={2} className="border border-black px-1.5 py-[1px]">
              II. BP nhân viên
            </td>
            <td className="border border-black px-1 py-[1px] text-right font-mono">
              {formatDecimal(tbtmCalc.subDayChuyen.hsCV, 2)}
            </td>
            <td className="border border-black px-1 py-[1px] text-right font-mono">
              {tbtmCalc.subDayChuyen.hsTN > 0 ? formatDecimal(tbtmCalc.subDayChuyen.hsTN, 2) : ''}
            </td>
            <td className="border border-black px-1 py-[1px] text-right font-mono">
              {formatDecimal(tbtmCalc.subDayChuyen.hsTong, 2)}
            </td>
            <td className="border border-black px-1 py-[1px] text-right font-mono">
              {formatDecimal(tbtmCalc.subDayChuyen.congSP, 3)}
            </td>
            <td className="border border-black px-1 py-[1px] text-right font-mono">
              {formatDecimal(tbtmCalc.subDayChuyen.hsCongSP26, 3)}
            </td>
            <td className="border border-black px-1.5 py-[1px] text-right font-mono">
              {formatVND(tbtmCalc.subDayChuyen.luongSP)}
            </td>
            <td className="border border-black px-1.5 py-[1px] text-right font-mono">
              {formatVND(tbtmCalc.subDayChuyen.tienThuong)}
            </td>
            <td className="border border-black px-1.5 py-[1px] text-right font-mono bg-slate-200/80">
              {formatVND(tbtmCalc.subDayChuyen.tongLuongTBTM)}
            </td>
            <td className="border border-black px-1 py-[1px]"></td>
          </tr>

          {tbtmCalc.dayChuyenRows.map((r) => renderPrintRow(r))}

          {/* TỔNG CỘNG */}
          <tr className="bg-slate-200 font-bold">
            <td colSpan={4} className="border border-black px-1.5 py-[2px] text-center">Tổng</td>
            <td className="border border-black px-1 py-[2px] text-right font-mono">
              {formatDecimal(tbtmCalc.grandTotal.hsCV, 2)}
            </td>
            <td className="border border-black px-1 py-[2px] text-right font-mono">
              {formatDecimal(tbtmCalc.grandTotal.hsTN, 2)}
            </td>
            <td className="border border-black px-1 py-[2px] text-right font-mono">
              {formatDecimal(tbtmCalc.grandTotal.hsTong, 2)}
            </td>
            <td className="border border-black px-1 py-[2px] text-right font-mono"></td>
            <td className="border border-black px-1 py-[2px] text-right font-mono">
              {formatDecimal(tbtmCalc.grandTotal.hsCongSP26, 3)}
            </td>
            <td className="border border-black px-1.5 py-[2px] text-right font-mono">
              {formatVND(tbtmCalc.grandTotal.luongSP)}
            </td>
            <td className="border border-black px-1.5 py-[2px] text-right font-mono">
              {formatVND(tbtmCalc.grandTotal.tienThuong)}
            </td>
            <td className="border border-black px-1.5 py-[2px] text-right font-mono bg-slate-300">
              {formatVND(tbtmCalc.grandTotal.tongLuongTBTM)}
            </td>
            <td className="border border-black px-1 py-[2px]"></td>
          </tr>
        </tbody>
      </table>

      {/* 4. Ngày tháng & 4 Chữ ký chuẩn P.KTCN */}
      <div className="sign-block mt-1.5 break-inside-avoid text-[8pt]">
        <div className="mb-0.5 text-right italic">{dateStr}</div>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="font-bold">PTGĐ.TCHC</div>
            <div className="mt-7 font-semibold">{sig.deputyTCHC || ''}</div>
          </div>
          <div>
            <div className="font-bold">PTGĐ.PT</div>
            <div className="mt-7 font-semibold">{sig.deputyInCharge || ''}</div>
          </div>
          <div>
            <div className="font-bold">Phòng KTCN</div>
            <div className="mt-7 font-semibold">{sig.headOfDept || 'Đặng Thanh Tùng'}</div>
          </div>
          <div>
            <div className="font-bold">Người Lập</div>
            <div className="mt-7 font-semibold">{sig.preparedBy || 'Phạm Quốc Tuấn'}</div>
          </div>
        </div>
        <div className="mt-1 text-[7.5pt] italic leading-tight">
          <div>-Nơi gửi: P.TGĐ phụ trách; P.KT-TC, P.TCHC; Lưu PKTCN</div>
        </div>
      </div>
    </div>
  );
};

function renderPrintRow(r: TbtmEmployeeRow) {
  return (
    <tr key={r.msnv}>
      <td className="border border-black px-1 py-[1px] text-center">{r.stt}</td>
      <td className="border border-black px-1 py-[1px] text-center font-mono">
        {normalizeMsnv4(r.msnv)}
      </td>
      <td className="border border-black px-1.5 py-[1px] whitespace-nowrap">{r.fullName}</td>
      <td className="border border-black px-1.5 py-[1px] whitespace-nowrap">{r.position}</td>
      <td className="border border-black px-1 py-[1px] text-right font-mono">
        {formatDecimal(r.hsCV, 2)}
      </td>
      <td className="border border-black px-1 py-[1px] text-right font-mono">
        {r.hsTN > 0 ? formatDecimal(r.hsTN, 2) : ''}
      </td>
      <td className="border border-black px-1 py-[1px] text-right font-mono">
        {formatDecimal(r.hsTong, 2)}
      </td>
      <td className="border border-black px-1 py-[1px] text-right font-mono">
        {formatDecimal(r.congSP, 3)}
      </td>
      <td className="border border-black px-1 py-[1px] text-right font-mono">
        {formatDecimal(r.hsCongSP26, 3)}
      </td>
      <td className="border border-black px-1.5 py-[1px] text-right font-mono">
        {formatVND(r.luongSPHienThi)}
      </td>
      <td className="border border-black px-1.5 py-[1px] text-right font-mono">
        {formatVND(r.tienThuongHienThi)}
      </td>
      <td className="border border-black px-1.5 py-[1px] text-right font-mono font-semibold bg-slate-50">
        {formatVND(r.tongLuongTBTMHienThi)}
      </td>
      <td className="border border-black px-1 py-[1px]"></td>
    </tr>
  );
}
