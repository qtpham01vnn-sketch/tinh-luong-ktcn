import React from 'react';
import { formatDecimal, formatVND } from '../utils/payrollCalc';
import { normalizeMsnv4 } from '../utils/rbacAuth';

export interface DeptPrintEmployeeRow {
  stt: number;
  msnv: string;
  fullName: string;
  position: string;
  team: string;
  hsLuong: number;
  hsTN: number;
  hsBH: number;
  hsTong: number;
  workDays: number;
  hsCongSP: number;
  luongSP: number;
  thuong: number;
  tangCa: number;
  tongLuong: number;
}

export interface DeptPrintSummaryLine {
  label: string;
  value: string;
}

interface PrintPreviewDeptProps {
  departmentTitle: string;
  docCode: string;
  reportTitle: string;
  periodLabel: string;
  summaryLeft: DeptPrintSummaryLine[];
  summaryRight: DeptPrintSummaryLine[];
  employees?: DeptPrintEmployeeRow[];
  groupRows?: Array<{
    stt: number;
    groupName: string;
    headcount: number;
    coeff: number;
    standardFund: number;
    allocatedFund: number;
  }>;
  deptHeadLabel?: string;
  preparedBy?: string;
}

export const PrintPreviewDept: React.FC<PrintPreviewDeptProps> = ({
  departmentTitle,
  docCode,
  reportTitle,
  periodLabel,
  summaryLeft,
  summaryRight,
  employees,
  groupRows,
  deptHeadLabel = 'QUẢN ĐỐC PHÂN XƯỞNG',
  preparedBy = 'Phạm Quốc Tuấn',
}) => {
  const now = new Date();
  const dateStr = `Đồng Nai, ngày ${now.getDate()}, tháng ${now.getMonth() + 1}, năm ${now.getFullYear()}`;

  // Nhóm nhân viên theo Tổ / Bộ phận
  const groupedEmployees = React.useMemo(() => {
    if (!employees || employees.length === 0) return [];
    const map = new Map<string, DeptPrintEmployeeRow[]>();
    for (const emp of employees) {
      const key = emp.team || 'Khác';
      const arr = map.get(key) ?? [];
      arr.push(emp);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [employees]);

  const totals = React.useMemo(() => {
    if (!employees || employees.length === 0) return null;
    return employees.reduce(
      (acc, e) => ({
        hsLuong: acc.hsLuong + e.hsLuong,
        hsTN: acc.hsTN + e.hsTN,
        hsBH: acc.hsBH + e.hsBH,
        hsTong: acc.hsTong + e.hsTong,
        workDays: acc.workDays + e.workDays,
        hsCongSP: acc.hsCongSP + e.hsCongSP,
        luongSP: acc.luongSP + e.luongSP,
        thuong: acc.thuong + e.thuong,
        tangCa: acc.tangCa + e.tangCa,
        tongLuong: acc.tongLuong + e.tongLuong,
      }),
      {
        hsLuong: 0,
        hsTN: 0,
        hsBH: 0,
        hsTong: 0,
        workDays: 0,
        hsCongSP: 0,
        luongSP: 0,
        thuong: 0,
        tangCa: 0,
        tongLuong: 0,
      },
    );
  }, [employees]);

  return (
    <div
      id="print-area-dept"
      className="print-area mx-auto bg-white text-black print:p-0 print:text-[8pt]"
      style={{ fontFamily: '"Times New Roman", Times, serif' }}
    >
      {/* 1. Header theo chuẩn NĐ 30/2020/NĐ-CP */}
      <div className="mb-2 flex items-start justify-between">
        <div className="text-center">
          <div className="text-[9.5pt] font-bold uppercase text-black">
            CÔNG TY CỔ PHẦN GẠCH MEN PHƯƠNG NAM
          </div>
          <div className="text-[9pt] font-bold uppercase text-black">
            {departmentTitle}
          </div>
          <div className="mt-0.5 text-[8.5pt] text-black">Số: {docCode}</div>
          <div className="mt-0.5 text-[7.5pt] italic text-black">
            Địa chỉ: 135/37/74 Nguyễn Hữu Cảnh, P.22, Q. Bình Thạnh, TP. Hồ Chí Minh
          </div>
        </div>

        <div className="text-center">
          <div className="text-[9.5pt] font-bold uppercase text-black">
            CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
          </div>
          <div className="inline-block border-b border-black pb-0.5 text-[9pt] font-bold text-black">
            Độc lập - Tự do - Hạnh phúc
          </div>
          <div className="mt-1 text-[8.5pt] italic text-black">{dateStr}</div>
        </div>
      </div>

      {/* 2. Tiêu đề chính */}
      <div className="mb-2 text-center">
        <h2 className="text-[11.5pt] font-bold uppercase text-black">{reportTitle}</h2>
        <div className="text-[9.5pt] font-semibold text-black">{periodLabel}</div>
      </div>

      {/* 3. Bảng tóm tắt 2 cột */}
      <div className="mb-2 grid grid-cols-2 gap-x-8 text-[8.5pt] leading-tight">
        <div className="space-y-0.5">
          {summaryLeft.map((item) => (
            <div key={item.label} className="flex justify-between border-b border-dotted border-slate-400">
              <span>{item.label}:</span>
              <strong className="font-mono">{item.value}</strong>
            </div>
          ))}
        </div>
        <div className="space-y-0.5">
          {summaryRight.map((item) => (
            <div key={item.label} className="flex justify-between border-b border-dotted border-slate-400">
              <span>{item.label}:</span>
              <strong className="font-mono">{item.value}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* 4A. Bảng chi tiết nhân sự (nếu có) */}
      {employees && employees.length > 0 && totals && (
        <table className="w-full border-collapse border border-black text-[7.5pt] leading-tight">
          <thead>
            <tr className="bg-slate-100 font-bold text-black">
              <th className="border border-black px-1 py-1 text-center">STT</th>
              <th className="border border-black px-1 py-1 text-center">MSNV</th>
              <th className="border border-black px-1.5 py-1 text-left">Họ và tên</th>
              <th className="border border-black px-1.5 py-1 text-left">Chức vụ</th>
              <th className="border border-black px-1 py-1 text-right">HS Lương</th>
              <th className="border border-black px-1 py-1 text-right">HS TN</th>
              <th className="border border-black px-1 py-1 text-right">HS BH</th>
              <th className="border border-black px-1 py-1 text-right">HS Tổng</th>
              <th className="border border-black px-1 py-1 text-right">Công SP</th>
              <th className="border border-black px-1 py-1 text-right">HS Công SP</th>
              <th className="border border-black px-1.5 py-1 text-right">Lương SP (đ)</th>
              <th className="border border-black px-1.5 py-1 text-right">Thưởng SL+CL (đ)</th>
              <th className="border border-black px-1.5 py-1 text-right">Tăng ca (đ)</th>
              <th className="border border-black px-1.5 py-1 text-right">Tổng thực nhận (đ)</th>
              <th className="border border-black px-1.5 py-1 text-center">Ký nhận</th>
            </tr>
          </thead>
          <tbody>
            {groupedEmployees.map(([teamName, rows]) => {
              const sub = rows.reduce(
                (a, r) => ({
                  hsTong: a.hsTong + r.hsTong,
                  hsCongSP: a.hsCongSP + r.hsCongSP,
                  luongSP: a.luongSP + r.luongSP,
                  thuong: a.thuong + r.thuong,
                  tangCa: a.tangCa + r.tangCa,
                  tongLuong: a.tongLuong + r.tongLuong,
                }),
                { hsTong: 0, hsCongSP: 0, luongSP: 0, thuong: 0, tangCa: 0, tongLuong: 0 },
              );
              return (
                <React.Fragment key={teamName}>
                  <tr className="bg-slate-200 font-bold">
                    <td colSpan={7} className="border border-black px-1.5 py-0.5 uppercase">
                      {teamName} ({rows.length} NL)
                    </td>
                    <td className="border border-black px-1 py-0.5 text-right font-mono">
                      {formatDecimal(sub.hsTong, 2)}
                    </td>
                    <td className="border border-black px-1 py-0.5" />
                    <td className="border border-black px-1 py-0.5 text-right font-mono">
                      {formatDecimal(sub.hsCongSP, 3)}
                    </td>
                    <td className="border border-black px-1.5 py-0.5 text-right font-mono">
                      {formatVND(sub.luongSP)}
                    </td>
                    <td className="border border-black px-1.5 py-0.5 text-right font-mono">
                      {formatVND(sub.thuong)}
                    </td>
                    <td className="border border-black px-1.5 py-0.5 text-right font-mono">
                      {sub.tangCa > 0 ? formatVND(sub.tangCa) : '-'}
                    </td>
                    <td className="border border-black px-1.5 py-0.5 text-right font-mono">
                      {formatVND(sub.tongLuong)}
                    </td>
                    <td className="border border-black px-1 py-0.5" />
                  </tr>
                  {rows.map((r) => (
                    <tr key={`${r.stt}_${r.msnv}`}>
                      <td className="border border-black px-1 py-[1.5px] text-center">{r.stt}</td>
                      <td className="border border-black px-1 py-[1.5px] text-center font-mono">
                        {normalizeMsnv4(r.msnv)}
                      </td>
                      <td className="border border-black px-1.5 py-[1.5px] whitespace-nowrap">
                        {r.fullName}
                      </td>
                      <td className="border border-black px-1.5 py-[1.5px] whitespace-nowrap">
                        {r.position}
                      </td>
                      <td className="border border-black px-1 py-[1.5px] text-right font-mono">
                        {formatDecimal(r.hsLuong, 2)}
                      </td>
                      <td className="border border-black px-1 py-[1.5px] text-right font-mono">
                        {r.hsTN > 0 ? formatDecimal(r.hsTN, 2) : ''}
                      </td>
                      <td className="border border-black px-1 py-[1.5px] text-right font-mono">
                        {r.hsBH > 0 ? formatDecimal(r.hsBH, 2) : ''}
                      </td>
                      <td className="border border-black px-1 py-[1.5px] text-right font-mono font-semibold">
                        {formatDecimal(r.hsTong, 2)}
                      </td>
                      <td className="border border-black px-1 py-[1.5px] text-right font-mono">
                        {formatDecimal(r.workDays, 2)}
                      </td>
                      <td className="border border-black px-1 py-[1.5px] text-right font-mono">
                        {formatDecimal(r.hsCongSP, 3)}
                      </td>
                      <td className="border border-black px-1.5 py-[1.5px] text-right font-mono">
                        {formatVND(r.luongSP)}
                      </td>
                      <td className="border border-black px-1.5 py-[1.5px] text-right font-mono">
                        {formatVND(r.thuong)}
                      </td>
                      <td className="border border-black px-1.5 py-[1.5px] text-right font-mono">
                        {r.tangCa > 0 ? formatVND(r.tangCa) : '-'}
                      </td>
                      <td className="border border-black px-1.5 py-[1.5px] text-right font-mono font-bold">
                        {formatVND(r.tongLuong)}
                      </td>
                      <td className="border border-black px-1.5 py-[1.5px]" />
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
            <tr className="bg-slate-200 font-bold text-black">
              <td colSpan={4} className="border border-black px-1.5 py-1 text-center uppercase">
                TỔNG CỘNG ({employees.length} CBCNV)
              </td>
              <td className="border border-black px-1 py-1 text-right font-mono">
                {formatDecimal(totals.hsLuong, 2)}
              </td>
              <td className="border border-black px-1 py-1 text-right font-mono">
                {formatDecimal(totals.hsTN, 2)}
              </td>
              <td className="border border-black px-1 py-1 text-right font-mono">
                {formatDecimal(totals.hsBH, 2)}
              </td>
              <td className="border border-black px-1 py-1 text-right font-mono">
                {formatDecimal(totals.hsTong, 2)}
              </td>
              <td className="border border-black px-1 py-1 text-right font-mono">
                {formatDecimal(totals.workDays, 2)}
              </td>
              <td className="border border-black px-1 py-1 text-right font-mono">
                {formatDecimal(totals.hsCongSP, 3)}
              </td>
              <td className="border border-black px-1.5 py-1 text-right font-mono">
                {formatVND(totals.luongSP)}
              </td>
              <td className="border border-black px-1.5 py-1 text-right font-mono">
                {formatVND(totals.thuong)}
              </td>
              <td className="border border-black px-1.5 py-1 text-right font-mono">
                {totals.tangCa > 0 ? formatVND(totals.tangCa) : '-'}
              </td>
              <td className="border border-black px-1.5 py-1 text-right font-mono">
                {formatVND(totals.tongLuong)}
              </td>
              <td className="border border-black px-1.5 py-1" />
            </tr>
          </tbody>
        </table>
      )}

      {/* 4B. Bảng phân bổ theo Tổ / Bộ phận (khi chưa nạp danh sách MSNV hoặc in tổng hợp) */}
      {(!employees || employees.length === 0) && groupRows && groupRows.length > 0 && (
        <table className="w-full border-collapse border border-black text-[8.5pt] leading-snug">
          <thead>
            <tr className="bg-slate-100 font-bold text-black">
              <th className="border border-black px-2 py-1.5 text-center">STT</th>
              <th className="border border-black px-2 py-1.5 text-left">Bộ phận / Tổ chuyên môn</th>
              <th className="border border-black px-2 py-1.5 text-center">Định biên (NL)</th>
              <th className="border border-black px-2 py-1.5 text-right">Hệ số khoán</th>
              <th className="border border-black px-2 py-1.5 text-right">Quỹ định mức chuẩn (đ)</th>
              <th className="border border-black px-2 py-1.5 text-right">Quỹ phân bổ thực tế (đ)</th>
              <th className="border border-black px-2 py-1.5 text-center">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {groupRows.map((g) => (
              <tr key={g.stt}>
                <td className="border border-black px-2 py-1 text-center">{g.stt}</td>
                <td className="border border-black px-2 py-1 font-semibold">{g.groupName}</td>
                <td className="border border-black px-2 py-1 text-center">{g.headcount}</td>
                <td className="border border-black px-2 py-1 text-right font-mono">
                  {g.coeff.toFixed(2)}
                </td>
                <td className="border border-black px-2 py-1 text-right font-mono">
                  {formatVND(g.standardFund)}
                </td>
                <td className="border border-black px-2 py-1 text-right font-mono font-bold">
                  {formatVND(g.allocatedFund)}
                </td>
                <td className="border border-black px-2 py-1" />
              </tr>
            ))}
            <tr className="bg-slate-200 font-bold">
              <td colSpan={2} className="border border-black px-2 py-1.5 text-center uppercase">
                TỔNG CỘNG
              </td>
              <td className="border border-black px-2 py-1.5 text-center">
                {groupRows.reduce((s, g) => s + g.headcount, 0)}
              </td>
              <td className="border border-black px-2 py-1.5 text-right font-mono">
                {groupRows.reduce((s, g) => s + g.coeff, 0).toFixed(2)}
              </td>
              <td className="border border-black px-2 py-1.5 text-right font-mono">
                {formatVND(groupRows.reduce((s, g) => s + g.standardFund, 0))}
              </td>
              <td className="border border-black px-2 py-1.5 text-right font-mono">
                {formatVND(groupRows.reduce((s, g) => s + g.allocatedFund, 0))}
              </td>
              <td className="border border-black px-2 py-1.5" />
            </tr>
          </tbody>
        </table>
      )}

      {/* 5. Khối chữ ký theo NĐ 30/2020/NĐ-CP */}
      <div className="mt-4 break-inside-avoid">
        <div className="grid grid-cols-4 gap-2 text-center text-[8.5pt]">
          <div>
            <div className="font-bold uppercase">NGƯỜI LẬP BIỂU</div>
            <div className="text-[7.5pt] italic">(Ký, ghi rõ họ tên)</div>
            <div className="mt-10 font-bold">{preparedBy}</div>
          </div>
          <div>
            <div className="font-bold uppercase">{deptHeadLabel}</div>
            <div className="text-[7.5pt] italic">(Ký, ghi rõ họ tên)</div>
            <div className="mt-10 font-bold">&nbsp;</div>
          </div>
          <div>
            <div className="font-bold uppercase">P.TGĐ PT. TC-HC</div>
            <div className="text-[7.5pt] italic">(Ký, ghi rõ họ tên)</div>
            <div className="mt-10 font-bold">&nbsp;</div>
          </div>
          <div>
            <div className="font-bold uppercase">P.TGĐ PHỤ TRÁCH</div>
            <div className="text-[7.5pt] italic">(Ký, ghi rõ họ tên)</div>
            <div className="mt-10 font-bold">&nbsp;</div>
          </div>
        </div>
        <div className="mt-2 text-[7.5pt] italic leading-snug">
          <div>
            <strong>Nơi nhận:</strong> P.TGĐ phụ trách; P.TGĐ PT. TC-HC; P.TC-HC; P.KT-TC; Lưu VT.
          </div>
        </div>
      </div>
    </div>
  );
};
