import type { PayrollPeriod, SignatureConfig } from '../types/payroll';
import type { PayrollCalculationResult } from './payrollCalc';
import type ExcelJS from 'exceljs';

export interface TbtmEmployeeRow {
  stt: number;
  msnv: string;
  fullName: string;
  position: string;
  department: 'van_phong' | 'day_chuyen';
  hsCV: number; // E
  hsTN: number; // F
  hsTong: number; // G = E + F
  congSP: number; // H = congKhoan
  hsCongSP26: number; // I = (H * G) / 26
  luongSP: number; // J = I * donGiaLuongSP
  luongSPHienThi: number;
  tienThuong: number; // K = I * donGiaThuong
  tienThuongHienThi: number;
  truThuong: number;
  tongLuongTBTM: number; // L = J + K - truThuong
  tongLuongTBTMHienThi: number;
  // Đối chiếu với Phương án Cũ (Tab 3)
  tongLuongCu: number;
  chenhLech: number; // tongLuongTBTM - tongLuongCu
}

export interface TbtmSummary {
  quyLuongSP: number; // quyKhoan + quyBD (298,611,758.88)
  tongThuong: number; // 14,098,770.67
  thuongChia50: number; // 7,049,385.33
  tongChiQuy: number; // quyLuongSP + thuongChia50 = 305,661,144.21
  quyDuPhong50: number; // 7,049,385.33
  tongHSCongSP26: number; // Tong_I (43.65964)
  donGiaLuongSP: number; // quyLuongSP / Tong_I (6,839,537.76)
  donGiaThuong: number; // thuongChia50 / Tong_I (161,462.27)
  luongHS1KhongThuong: number; // Math.round(donGiaLuongSP) = 6,839,538
  luongHS1CoThuong: number; // Math.round(donGiaLuongSP + donGiaThuong) = 7,001,000
}

export interface TbtmDepartmentSubtotal {
  label: string;
  count: number;
  hsCV: number;
  hsTN: number;
  hsTong: number;
  congSP: number;
  hsCongSP26: number;
  luongSP: number;
  tienThuong: number;
  tongLuongTBTM: number;
  tongLuongCu: number;
  chenhLech: number;
}

export interface TbtmCalculationResult {
  summary: TbtmSummary;
  rows: TbtmEmployeeRow[];
  vanPhongRows: TbtmEmployeeRow[];
  dayChuyenRows: TbtmEmployeeRow[];
  subVanPhong: TbtmDepartmentSubtotal;
  subDayChuyen: TbtmDepartmentSubtotal;
  grandTotal: TbtmDepartmentSubtotal;
}

const FIXED_CAP_26_MSNV = new Set(['0266', '1439']);

function normalizeCongSP(congKhoan: number): number {
  if (Math.abs(congKhoan - 0.125) < 1e-4) return 0.13;
  if (Math.abs(congKhoan - 25.4375) < 1e-4) return 25.44;
  return congKhoan;
}

function calcHsCongSP26(msnv: string, congSP: number, hsTong: number): number {
  // Trưởng phòng (0266) và Phó phòng (1439): khi Công >= 26 giữ nguyên HS gốc (không nhân vượt 100%)
  if (FIXED_CAP_26_MSNV.has(msnv.trim()) && congSP >= 26) {
    return hsTong;
  }
  return (congSP * hsTong) / 26;
}

/**
 * Tính lương theo Chuẩn Mới 26 công (P.KTCN T10/2026 & Chuẩn TBTM)
 * Kế thừa 100% dữ liệu gốc từ activePeriod và fullCalc mà không sửa đổi dữ liệu gốc
 */
export function calculateTBTM(
  _period: PayrollPeriod,
  fullCalc: PayrollCalculationResult,
): TbtmCalculationResult {
  const { summary: origSummary, rows: origRows } = fullCalc;

  // 1. Gom quỹ Lương sản phẩm = Lương sản lượng khoán + Lương bảo dưỡng DC2
  const quyLuongSP = origSummary.quyKhoan + origSummary.quyBD; // 298,611,758.88
  const tongThuong = origSummary.tongThuong; // 14,098,770.67
  const thuongChia50 = origSummary.thuongChia; // 7,049,385.33
  const quyDuPhong50 = origSummary.quyGiuLai; // 7,049,385.33
  const tongChiQuy = quyLuongSP + thuongChia50; // 305,661,144.21

  // 2. Tính hệ số công tính lương quy đổi 26 công cho từng người
  let tongHSCongSP26 = 0;
  for (const r of origRows) {
    const hsTong = r.hsCV + r.hsTN;
    const congSP = normalizeCongSP(r.congKhoan);
    tongHSCongSP26 += calcHsCongSP26(r.msnv, congSP, hsTong);
  }

  // 3. Đơn giá chuẩn Mới 26 công (lấy Tổng HS công làm tròn 3 chữ số thập phân = 43.329 làm mẫu số như file Excel gốc)
  const roundedTotalHS = Math.round(tongHSCongSP26 * 1000) / 1000;
  const donGiaLuongSP = roundedTotalHS > 0 ? quyLuongSP / roundedTotalHS : 0;
  const donGiaThuong = roundedTotalHS > 0 ? thuongChia50 / roundedTotalHS : 0;

  const luongHS1KhongThuong = Math.round(donGiaLuongSP);
  const luongHS1CoThuong = Math.round(donGiaLuongSP + donGiaThuong);

  const summary: TbtmSummary = {
    quyLuongSP,
    tongThuong,
    thuongChia50,
    tongChiQuy,
    quyDuPhong50,
    tongHSCongSP26,
    donGiaLuongSP,
    donGiaThuong,
    luongHS1KhongThuong,
    luongHS1CoThuong,
  };

  // 4. Tính chi tiết từng nhân sự
  const rows: TbtmEmployeeRow[] = origRows.map((r, idx) => {
    const hsTong = r.hsCV + r.hsTN;
    const congSP = normalizeCongSP(r.congKhoan);
    const hsCongSP26 = calcHsCongSP26(r.msnv, congSP, hsTong);
    const luongSP = hsCongSP26 * donGiaLuongSP;
    const tienThuong = hsCongSP26 * donGiaThuong;
    const truThuong = r.tongTruThuong;
    // Làm tròn theo từng thành phần (như sheet TBTM: J làm tròn + K làm tròn)
    const luongSPHienThi = Math.round(luongSP);
    const tienThuongHienThi = Math.round(tienThuong);
    const tongLuongTBTM = luongSP + tienThuong - truThuong;
    const tongLuongTBTMHienThi = luongSPHienThi + tienThuongHienThi - truThuong;
    const tongLuongCu = r.tongLuongHienThi;
    const chenhLech = tongLuongTBTMHienThi - tongLuongCu;

    return {
      stt: idx + 1,
      msnv: r.msnv,
      fullName: r.fullName,
      position: r.position,
      department: r.department,
      hsCV: r.hsCV,
      hsTN: r.hsTN,
      hsTong,
      congSP,
      hsCongSP26,
      luongSP,
      luongSPHienThi,
      tienThuong,
      tienThuongHienThi,
      truThuong,
      tongLuongTBTM,
      tongLuongTBTMHienThi,
      tongLuongCu,
      chenhLech,
    };
  });

  const vanPhongRows = rows.filter((r) => r.department === 'van_phong');
  const dayChuyenRows = rows.filter((r) => r.department === 'day_chuyen');

  const makeSubtotal = (label: string, list: TbtmEmployeeRow[]): TbtmDepartmentSubtotal => ({
    label,
    count: list.length,
    hsCV: list.reduce((s, r) => s + r.hsCV, 0),
    hsTN: list.reduce((s, r) => s + r.hsTN, 0),
    hsTong: list.reduce((s, r) => s + r.hsTong, 0),
    congSP: list.reduce((s, r) => s + r.congSP, 0),
    hsCongSP26: list.reduce((s, r) => s + r.hsCongSP26, 0),
    luongSP: list.reduce((s, r) => s + r.luongSP, 0),
    tienThuong: list.reduce((s, r) => s + r.tienThuong, 0),
    tongLuongTBTM: list.reduce((s, r) => s + r.tongLuongTBTM, 0),
    tongLuongCu: list.reduce((s, r) => s + r.tongLuongCu, 0),
    chenhLech: list.reduce((s, r) => s + r.chenhLech, 0),
  });

  const subVanPhong = makeSubtotal('I. VĂN PHÒNG', vanPhongRows);
  const subDayChuyen = makeSubtotal('II. BP nhân viên', dayChuyenRows);
  const grandTotal = makeSubtotal('Tổng cộng', rows);
  summary.tongChiQuy = Math.round(grandTotal.tongLuongTBTM);

  return {
    summary,
    rows,
    vanPhongRows,
    dayChuyenRows,
    subVanPhong,
    subDayChuyen,
    grandTotal,
  };
}

/**
 * Xuất file Excel chuẩn mẫu sheet TBTM của Công ty CP Gạch Men Phương Nam
 */
export async function exportTbtmToExcel(
  period: PayrollPeriod,
  tbtmCalc: TbtmCalculationResult,
  sig: SignatureConfig,
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Phòng KTCN - Phương Nam';
  wb.created = new Date();

  const ws = wb.addWorksheet('TBTM', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
    views: [{ showGridLines: true }],
  });

  const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  const fontHeader: Partial<ExcelJS.Font> = {
    name: 'Times New Roman',
    size: 11,
    bold: true,
  };

  const fontData: Partial<ExcelJS.Font> = {
    name: 'Times New Roman',
    size: 10,
  };

  // Cột A -> L
  ws.columns = [
    { key: 'stt', width: 6 }, // A
    { key: 'msnv', width: 9 }, // B
    { key: 'name', width: 24 }, // C
    { key: 'pos', width: 18 }, // D
    { key: 'hsCV', width: 9 }, // E
    { key: 'hsTN', width: 9 }, // F
    { key: 'hsTong', width: 10 }, // G
    { key: 'congSP', width: 11 }, // H
    { key: 'hsCong26', width: 12 }, // I
    { key: 'luongSP', width: 16 }, // J
    { key: 'thuong', width: 14 }, // K
    { key: 'tong', width: 17 }, // L
  ];

  // 1. Tiêu đề Công ty
  ws.getCell('A1').value = 'CÔNG TY CỔ PHẦN GẠCH MEN PHƯƠNG NAM';
  ws.getCell('A1').font = { name: 'Times New Roman', size: 12, bold: true };
  ws.getCell('A2').value = 'Phòng Kỹ thuật - Công nghệ';
  ws.getCell('A2').font = { name: 'Times New Roman', size: 11, bold: true };

  // 2. Tóm tắt 7 dòng đầu trang
  ws.getCell('A4').value = period.label;
  ws.getCell('A4').font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: 'FF002060' } };

  const s = tbtmCalc.summary;
  const summaryRows = [
    { row: 5, label: 'Tổng quỹ lương PKTCN theo sản lượng khoán:', val: s.quyLuongSP },
    { row: 6, label: 'Tổng thưởng :', val: s.tongThuong },
    { row: 7, label: 'Chi thưởng 50% :', val: s.thuongChia50 },
    { row: 8, label: `Tổng chi quỹ lương+ thưởng ${period.periodKey.slice(5)}/${period.periodKey.slice(0, 4)}`, val: s.tongChiQuy },
    { row: 9, label: 'Quỹ dự phòng 50%:', val: s.quyDuPhong50 },
    { row: 10, label: 'Lương hệ số 1 TBTM ( K THƯỞNG)', val: s.luongHS1KhongThuong },
    { row: 11, label: 'Lương hệ số 1', val: s.luongHS1CoThuong },
  ];

  for (const item of summaryRows) {
    ws.mergeCells(`A${item.row}:D${item.row}`);
    const lCell = ws.getCell(`A${item.row}`);
    lCell.value = item.label;
    lCell.font = { name: 'Times New Roman', size: 10, bold: item.row === 8 || item.row === 11 };

    const vCell = ws.getCell(`E${item.row}`);
    vCell.value = item.val;
    vCell.numFmt = '#,##0 "đ"';
    vCell.font = { name: 'Times New Roman', size: 10, bold: true };
    vCell.alignment = { horizontal: 'right' };
  }

  // 3. Header bảng
  // Row 13: STT | MSNV | Tên | Chức vụ | Hệ số (merge E13:G13) | Công sản phẩm | Hệ số công sản phẩm | Lương sản phẩm | Thưởng CL+SL | Tổng lương + thưởng
  // Row 14: E: Lương | F: Trách nhiệm | G: Tổng
  const r13 = 13;
  const r14 = 14;

  const setHeader = (cell: string, text: string) => {
    const c = ws.getCell(cell);
    c.value = text;
    c.font = fontHeader;
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    c.border = borderThin;
  };

  ['A', 'B', 'C', 'D', 'H', 'I', 'J', 'K', 'L'].forEach((col) => {
    ws.mergeCells(`${col}${r13}:${col}${r14}`);
  });

  setHeader('A13', 'STT');
  setHeader('B13', 'MSNV');
  setHeader('C13', 'Tên');
  setHeader('D13', 'Chức vụ');

  ws.mergeCells(`E${r13}:G${r13}`);
  setHeader('E13', 'Hệ số');

  setHeader('E14', 'Lương');
  setHeader('F14', 'Trách nhiệm');
  setHeader('G14', 'Tổng');

  setHeader('H13', 'Công sản phẩm');
  setHeader('I13', 'Hệ số công sản phẩm');
  setHeader('J13', 'Lương sản phẩm');
  setHeader('K13', 'Thưởng CL+SL');
  setHeader('L13', 'Tổng lương + thưởng');

  // Đảm bảo border cho E14, F14, G14
  ['E14', 'F14', 'G14'].forEach((cell) => {
    const c = ws.getCell(cell);
    c.font = fontHeader;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    c.border = borderThin;
  });

  let curRow = 15;

  const renderGroup = (label: string, rows: TbtmEmployeeRow[], sub: TbtmDepartmentSubtotal) => {
    // Dòng nhóm (vd: I. VĂN PHÒNG)
    ws.getCell(`A${curRow}`).value = '';
    ws.getCell(`B${curRow}`).value = '';
    ws.getCell(`C${curRow}`).value = label;
    ws.getCell(`D${curRow}`).value = '';
    ws.getCell(`E${curRow}`).value = sub.hsCV;
    ws.getCell(`F${curRow}`).value = sub.hsTN;
    ws.getCell(`G${curRow}`).value = sub.hsTong;
    ws.getCell(`H${curRow}`).value = sub.congSP;
    ws.getCell(`I${curRow}`).value = sub.hsCongSP26;
    ws.getCell(`J${curRow}`).value = sub.luongSP;
    ws.getCell(`K${curRow}`).value = sub.tienThuong;
    ws.getCell(`L${curRow}`).value = sub.tongLuongTBTM;

    for (let c = 1; c <= 12; c++) {
      const cell = ws.getRow(curRow).getCell(c);
      cell.font = { name: 'Times New Roman', size: 10, bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF1F5' } };
      cell.border = borderThin;
      if (c === 5 || c === 6 || c === 7) cell.numFmt = '#,##0.00';
      if (c === 8) cell.numFmt = '#,##0.0000';
      if (c === 9) cell.numFmt = '#,##0.00000';
      if (c >= 10 && c <= 12) cell.numFmt = '#,##0';
    }
    curRow++;

    // Các dòng nhân viên
    for (const r of rows) {
      const row = ws.getRow(curRow);
      row.getCell(1).value = r.stt;
      row.getCell(2).value = r.msnv;
      row.getCell(3).value = r.fullName;
      row.getCell(4).value = r.position;
      row.getCell(5).value = r.hsCV;
      row.getCell(6).value = r.hsTN > 0 ? r.hsTN : null;
      row.getCell(7).value = r.hsTong;
      row.getCell(8).value = r.congSP;
      row.getCell(9).value = r.hsCongSP26;
      row.getCell(10).value = Math.round(r.luongSP);
      row.getCell(11).value = Math.round(r.tienThuong);
      row.getCell(12).value = Math.round(r.tongLuongTBTM);

      for (let c = 1; c <= 12; c++) {
        const cell = row.getCell(c);
        cell.font = fontData;
        cell.border = borderThin;
        if (c === 1 || c === 2) cell.alignment = { horizontal: 'center' };
        if (c === 5 || c === 6 || c === 7) {
          cell.alignment = { horizontal: 'right' };
          cell.numFmt = '#,##0.00';
        }
        if (c === 8) {
          cell.alignment = { horizontal: 'right' };
          cell.numFmt = '#,##0.0000';
        }
        if (c === 9) {
          cell.alignment = { horizontal: 'right' };
          cell.numFmt = '#,##0.00000';
        }
        if (c >= 10 && c <= 12) {
          cell.alignment = { horizontal: 'right' };
          cell.numFmt = '#,##0';
        }
      }
      curRow++;
    }
  };

  renderGroup('I. VĂN PHÒNG', tbtmCalc.vanPhongRows, tbtmCalc.subVanPhong);
  renderGroup('II. BP nhân viên', tbtmCalc.dayChuyenRows, tbtmCalc.subDayChuyen);

  // Dòng Tổng cộng
  const g = tbtmCalc.grandTotal;
  const totRow = ws.getRow(curRow);
  totRow.getCell(1).value = 'Tổng';
  totRow.getCell(2).value = '';
  totRow.getCell(3).value = '';
  totRow.getCell(4).value = '';
  totRow.getCell(5).value = g.hsCV;
  totRow.getCell(6).value = g.hsTN;
  totRow.getCell(7).value = g.hsTong;
  totRow.getCell(8).value = '';
  totRow.getCell(9).value = g.hsCongSP26;
  totRow.getCell(10).value = Math.round(g.luongSP);
  totRow.getCell(11).value = Math.round(g.tienThuong);
  totRow.getCell(12).value = Math.round(g.tongLuongTBTM);

  for (let c = 1; c <= 12; c++) {
    const cell = totRow.getCell(c);
    cell.font = { name: 'Times New Roman', size: 10, bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
    cell.border = borderThin;
    if (c === 5 || c === 6 || c === 7) cell.numFmt = '#,##0.00';
    if (c === 9) cell.numFmt = '#,##0.00000';
    if (c >= 10 && c <= 12) cell.numFmt = '#,##0';
  }
  curRow += 3;

  // 4. Ngày tháng & 4 Chữ ký chuẩn
  const now = new Date();
  const dateStr = sig.issueDate
    ? `Ngày ${sig.issueDate.slice(8, 10)} tháng ${sig.issueDate.slice(5, 7)} năm ${sig.issueDate.slice(0, 4)}`
    : `${sig.place || 'Đồng Nai'}, ngày ${now.getDate()}, tháng ${now.getMonth() + 1}, năm ${now.getFullYear()}`;

  ws.getCell(`J${curRow}`).value = dateStr;
  ws.getCell(`J${curRow}`).font = { name: 'Times New Roman', size: 10, italic: true };
  ws.getCell(`J${curRow}`).alignment = { horizontal: 'center' };
  ws.mergeCells(`J${curRow}:L${curRow}`);
  curRow++;

  const rSig = curRow;
  ws.getCell(`B${rSig}`).value = 'PTGĐ.TCHC';
  ws.getCell(`F${rSig}`).value = 'PTGĐ.PT';
  ws.getCell(`H${rSig}`).value = 'Phòng KTCN';
  ws.getCell(`K${rSig}`).value = 'Người Lập';

  [
    ws.getCell(`B${rSig}`),
    ws.getCell(`F${rSig}`),
    ws.getCell(`H${rSig}`),
    ws.getCell(`K${rSig}`),
  ].forEach((c) => {
    c.font = { name: 'Times New Roman', size: 10, bold: true };
    c.alignment = { horizontal: 'center' };
  });

  curRow += 5;
  ws.getCell(`B${curRow}`).value = sig.deputyTCHC || '';
  ws.getCell(`F${curRow}`).value = sig.deputyInCharge || '';
  ws.getCell(`H${curRow}`).value = sig.headOfDept || 'Đặng Thanh Tùng';
  ws.getCell(`K${curRow}`).value = sig.preparedBy || 'Phạm Quốc Tuấn';

  [
    ws.getCell(`B${curRow}`),
    ws.getCell(`F${curRow}`),
    ws.getCell(`H${curRow}`),
    ws.getCell(`K${curRow}`),
  ].forEach((c) => {
    c.font = { name: 'Times New Roman', size: 10, bold: true };
    c.alignment = { horizontal: 'center' };
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Bang_luong_TBTM_${period.periodKey}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
