import type { Borders, Cell, Fill, Font, Worksheet } from 'exceljs';
import type { PayrollPeriod, SignatureConfig } from '../types/payroll';
import type { CalculatedEmployeeRow, PayrollCalculationResult } from './payrollCalc';
import { numberToVietnameseWords } from './vnWords';

export const COMPANY_NAME = 'CÔNG TY CỔ PHẦN GẠCH MEN PHƯƠNG NAM';
export const DEPT_NAME = 'PHÒNG KỸ THUẬT - CÔNG NGHỆ';
export const COMPANY_ADDRESS =
  'Địa chỉ: 135/37/74 Nguyễn Hữu Cảnh, Phường 22, Quận Bình Thạnh, TP. Hồ Chí Minh';
export const DOC_SYMBOL = 'BTTL-KTCN';

/**
 * Địa danh, ngày tháng theo Phụ lục I – NĐ 30/2020/NĐ-CP:
 * ngày < 10 và tháng 1, 2 phải ghi thêm số 0 phía trước.
 */
export function formatPlaceDate(sig: SignatureConfig, periodKey: string): string {
  const place = sig.place?.trim() || 'TP. Hồ Chí Minh';
  if (!sig.issueDate) {
    const year = periodKey.slice(0, 4);
    return `${place}, ngày …… tháng …… năm ${year}`;
  }
  const [y, m, d] = sig.issueDate.split('-').map(Number);
  const dd = d < 10 ? `0${d}` : String(d);
  const mm = m <= 2 ? `0${m}` : String(m);
  return `${place}, ngày ${dd} tháng ${mm} năm ${y}`;
}

export function formatDocNumber(sig: SignatureConfig): string {
  return `Số: ${sig.docNumber?.trim() || '……'}/${DOC_SYMBOL}`;
}

export function modeDescription(period: PayrollPeriod): string {
  return period.calculationMode === 'A'
    ? 'Chế độ chia: Gộp quỹ (Khoán + Bảo dưỡng + Thưởng) chia theo hệ số ngày công khoán'
    : 'Chế độ chia: Tách riêng 3 quỹ (Khoán theo HS ngày công + Bảo dưỡng theo HS công BD + Thưởng)';
}

// ---------- Style helpers (Times New Roman – TCVN 6909:2001 Unicode) ----------
const FONT_NAME = 'Times New Roman';
const THIN: Borders = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
  diagonal: {},
};
const FILL_HEADER: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7ECF3' } };
const FILL_GROUP: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } };
const FILL_TOTAL: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF4D6' } };

const FMT_MONEY = '#,##0';
const FMT_COEF = '0.00';
const FMT_HS = '#,##0.00##';
const FMT_DAY = 'General';

function font(size: number, opts: Partial<Font> = {}): Partial<Font> {
  return { name: FONT_NAME, size, ...opts };
}

function setText(
  ws: Worksheet,
  range: string,
  value: string,
  f: Partial<Font>,
  align: 'left' | 'center' | 'right' = 'center',
): Cell {
  const first = range.split(':')[0];
  if (range.includes(':')) ws.mergeCells(range);
  const cell = ws.getCell(first);
  cell.value = value;
  cell.font = f;
  cell.alignment = { horizontal: align, vertical: 'middle', wrapText: true };
  return cell;
}

function setFormula(
  cell: Cell,
  formula: string,
  result: number,
  numFmt: string,
  f: Partial<Font> = font(11),
) {
  cell.value = { formula, result: Number.isFinite(result) ? result : 0 };
  cell.numFmt = numFmt;
  cell.font = f;
  cell.alignment = { horizontal: 'right', vertical: 'middle' };
}

function setNumber(cell: Cell, value: number, numFmt: string, f: Partial<Font> = font(11)) {
  cell.value = Number.isFinite(value) ? value : 0;
  cell.numFmt = numFmt;
  cell.font = f;
  cell.alignment = { horizontal: 'right', vertical: 'middle' };
}

const COLS = 'ABCDEFGHIJKLMNOPQR'.split('');

/**
 * Xuất Bảng thanh toán tiền lương chuẩn trình ký.
 * – Thể thức theo NĐ 30/2020/NĐ-CP: Times New Roman, Quốc hiệu – Tiêu ngữ, Số/ký hiệu,
 *   Địa danh – ngày tháng, Tên loại văn bản in hoa đậm, chức danh người ký in hoa đậm, Nơi nhận.
 * – Khổ A4 ngang, lề trên/dưới 20 mm, trái 30 mm, phải 15 mm, lặp tiêu đề bảng mỗi trang.
 * – Giữ nguyên số thực + công thức Excel, chỉ định dạng #,##0 để tổng luôn khớp khít.
 */
export async function exportPayrollToExcel(
  period: PayrollPeriod,
  calc: PayrollCalculationResult,
  sig: SignatureConfig,
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Phòng KTCN - Gạch Men Phương Nam';
  wb.created = new Date();

  const ws = wb.addWorksheet(`Luong ${period.periodKey}`, {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { top: 0.79, bottom: 0.79, left: 1.18, right: 0.59, header: 0.3, footer: 0.3 },
    },
    headerFooter: {
      oddFooter: `&"Times New Roman"&10Bảng thanh toán tiền lương P.KTCN – ${period.label} – Trang &P/&N`,
    },
    views: [{ showGridLines: false }],
  });

  ws.columns = [
    { width: 5 }, // A STT
    { width: 7.5 }, // B MSNV
    { width: 23 }, // C Họ tên
    { width: 15 }, // D Chức vụ
    { width: 12 }, // E LCB
    { width: 8 }, // F Lương HS1
    { width: 8 }, // G HS CV
    { width: 9 }, // H HS TN
    { width: 7 }, // I Cộng
    { width: 8.5 }, // J Công khoán
    { width: 10 }, // K HS ngày công
    { width: 8 }, // L Công BD
    { width: 9 }, // M HS BD
    { width: 13.5 }, // N Lương khoán
    { width: 11.5 }, // O Lương BD
    { width: 11 }, // P Thưởng
    { width: 10 }, // Q Trừ thưởng
    { width: 13.5 }, // R Tổng lương
  ];

  const { summary: s, vanPhongRows, dayChuyenRows } = calc;
  const isA = period.calculationMode === 'A';

  // ---------- Pre-compute layout ----------
  const HEADER_ROW_1 = 19;
  const HEADER_ROW_2 = 20;
  const VP_GROUP_ROW = 21;
  const VP_START = VP_GROUP_ROW + 1;
  const VP_END = VP_START + vanPhongRows.length - 1;
  const VP_SUB = VP_END + 1;
  const DC_GROUP_ROW = VP_SUB + 1;
  const DC_START = DC_GROUP_ROW + 1;
  const DC_END = DC_START + dayChuyenRows.length - 1;
  const DC_SUB = DC_END + 1;
  const GRAND = DC_SUB + 1;

  // ---------- 1. Thể thức đầu văn bản (NĐ30) ----------
  setText(ws, 'A1:F1', COMPANY_NAME, font(12));
  setText(ws, 'K1:R1', 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', font(12, { bold: true }));
  setText(ws, 'A2:F2', DEPT_NAME, font(12, { bold: true, underline: true }));
  setText(ws, 'K2:R2', 'Độc lập - Tự do - Hạnh phúc', font(13, { bold: true, underline: true }));
  setText(ws, 'A3:F3', formatDocNumber(sig), font(12));
  setText(ws, 'K3:R3', formatPlaceDate(sig, period.periodKey), font(12, { italic: true }));
  setText(ws, 'A4:F4', COMPANY_ADDRESS, font(9, { italic: true }));
  ws.getRow(4).height = 24;

  setText(ws, 'A6:R6', 'BẢNG THANH TOÁN TIỀN LƯƠNG', font(14, { bold: true }));
  setText(
    ws,
    'A7:R7',
    `Phòng Kỹ thuật - Công nghệ ${period.label.toLowerCase()}`,
    font(13, { bold: true }),
  );
  setText(ws, 'A8:R8', `(${modeDescription(period)})`, font(11, { italic: true }));
  ws.getRow(6).height = 22;
  ws.getRow(7).height = 20;

  // ---------- 2. Bảng tổng hợp quỹ (có công thức) ----------
  const lbl = font(11);
  const val = font(11, { bold: true });
  const leftItems: [string, number][] = [
    ['Tổng quỹ lương theo sản lượng khoán:', 10],
    ['Lương bảo dưỡng DC2:', 11],
    ['Tổng thưởng 2 dây chuyền (sau giảm trừ):', 12],
    [`Tổng quỹ lương ${period.label.toLowerCase()}:`, 13],
    [`Chia thưởng ${period.bonusSharePct}%:`, 14],
    ['Tổng chia lương + thưởng:', 15],
    ['Quỹ lương giữ lại:', 16],
    [`Lương hệ số 1 (${period.standardDaysForHS1} công):`, 17],
  ];
  for (const [text, r] of leftItems) {
    setText(ws, `A${r}:D${r}`, text, lbl, 'left');
    ws.mergeCells(`E${r}:F${r}`);
  }
  const rightItems: [string, number][] = [
    ['Thưởng gộp trước giảm trừ:', 10],
    ['Giảm trừ quỹ thưởng chung (trừ khoán, lỗi SP, khiếu nại):', 11],
    ['Tỷ lệ chia thưởng trong tháng:', 12],
    ['Tổng hệ số ngày công khoán:', 13],
    ['Tổng hệ số ngày công bảo dưỡng:', 14],
    [isA ? 'Đơn giá 1 HS-công (gộp quỹ thực chia):' : 'Đơn giá 1 HS-công (quỹ khoán riêng):', 15],
    ['Đơn giá 1 HS-công bảo dưỡng:', 16],
    ['Đơn giá thưởng / 1 HS-công:', 17],
  ];
  for (const [text, r] of rightItems) {
    setText(ws, `I${r}:M${r}`, text, lbl, 'left');
    ws.mergeCells(`N${r}:O${r}`);
  }

  setNumber(ws.getCell('E10'), s.quyKhoan, FMT_MONEY, val);
  setNumber(ws.getCell('E11'), s.quyBD, FMT_MONEY, val);
  setNumber(ws.getCell('N10'), s.thuongGop, FMT_MONEY, val);
  setNumber(ws.getCell('N11'), s.giamTruChung, FMT_MONEY, val);
  setNumber(ws.getCell('N12'), period.bonusSharePct / 100, '0%', val);
  setFormula(ws.getCell('E12'), 'MAX(0,N10-N11)', s.tongThuong, FMT_MONEY, val);
  setFormula(ws.getCell('E13'), 'E10+E11+E12', s.tongQuyLuong, FMT_MONEY, val);
  setFormula(ws.getCell('E14'), 'E12*N12', s.thuongChia, FMT_MONEY, val);
  setFormula(ws.getCell('E15'), 'E10+E11+E14', s.quyThucChia, FMT_MONEY, val);
  setFormula(ws.getCell('E16'), 'E12-E14', s.quyGiuLai, FMT_MONEY, val);
  setFormula(
    ws.getCell('E17'),
    `IF(N13=0,0,E15/N13)*${period.standardDaysForHS1}`,
    s.luongHS1,
    FMT_MONEY,
    val,
  );
  setFormula(ws.getCell('N13'), `K${GRAND}`, s.tongHSNgayCong, FMT_HS, val);
  setFormula(ws.getCell('N14'), `M${GRAND}`, s.tongHSNgayCongBD, FMT_HS, val);
  setFormula(
    ws.getCell('N15'),
    isA ? 'IF(N13=0,0,E15/N13)' : 'IF(N13=0,0,E10/N13)',
    isA ? s.donGiaGop : s.donGiaKhoanRieng,
    '#,##0.00',
    val,
  );
  setFormula(ws.getCell('N16'), 'IF(N14=0,0,E11/N14)', s.donGiaBD, '#,##0.00', val);
  setFormula(ws.getCell('N17'), 'IF(N13=0,0,E14/N13)', s.donGiaThuong, '#,##0.00', val);

  // ---------- 3. Tiêu đề bảng (2 dòng) ----------
  const hdrFont = font(10, { bold: true });
  const singleHeaders: [string, string][] = [
    ['A', 'STT'],
    ['B', 'MSNV'],
    ['C', 'Họ và tên'],
    ['D', 'Chức vụ'],
    ['E', 'Lương cơ bản 2020'],
    ['F', 'Lương hệ số 1'],
    ['J', 'Công khoán'],
    ['K', 'Hệ số theo ngày công'],
    ['L', 'Công bảo dưỡng'],
    ['M', 'Hệ số theo ngày công BD'],
    ['N', 'Lương khoán theo ngày công'],
    ['O', 'Lương bảo dưỡng'],
    ['P', 'Tiền thưởng'],
    ['Q', 'Trừ thưởng'],
    ['R', 'Tổng lương'],
  ];
  for (const [c, text] of singleHeaders) {
    setText(ws, `${c}${HEADER_ROW_1}:${c}${HEADER_ROW_2}`, text, hdrFont);
  }
  setText(ws, `G${HEADER_ROW_1}:I${HEADER_ROW_1}`, 'Hệ số lương', hdrFont);
  setText(ws, `G${HEADER_ROW_2}`, 'Công việc', hdrFont);
  setText(ws, `H${HEADER_ROW_2}`, 'Trách nhiệm', hdrFont);
  setText(ws, `I${HEADER_ROW_2}`, 'Cộng', hdrFont);
  ws.getRow(HEADER_ROW_1).height = 22;
  ws.getRow(HEADER_ROW_2).height = 30;
  for (const r of [HEADER_ROW_1, HEADER_ROW_2]) {
    for (const c of COLS) ws.getCell(`${c}${r}`).fill = FILL_HEADER;
  }

  // ---------- 4. Dữ liệu nhân viên (công thức sống) ----------
  const bodyFont = font(10.5);
  const writeEmployee = (r: number, e: CalculatedEmployeeRow, stt: number) => {
    const row = ws.getRow(r);
    row.getCell('A').value = stt;
    row.getCell('A').alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell('B').value = e.msnv;
    row.getCell('B').alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell('C').value = e.fullName;
    row.getCell('D').value = e.position;
    for (const c of ['A', 'B', 'C', 'D']) row.getCell(c).font = bodyFont;
    setNumber(row.getCell('E'), e.baseSalary2020, FMT_MONEY, bodyFont);
    setFormula(row.getCell('F'), `I${r}`, e.hsTong, FMT_COEF, bodyFont);
    setNumber(row.getCell('G'), e.hsCV, FMT_COEF, bodyFont);
    setNumber(row.getCell('H'), e.hsTN, FMT_COEF, bodyFont);
    setFormula(row.getCell('I'), `G${r}+H${r}`, e.hsTong, FMT_COEF, bodyFont);
    setNumber(row.getCell('J'), e.congKhoan, FMT_DAY, bodyFont);
    setFormula(row.getCell('K'), `J${r}*I${r}`, e.hsNgayCong, FMT_HS, bodyFont);
    setNumber(row.getCell('L'), e.congBD, FMT_DAY, bodyFont);
    setFormula(row.getCell('M'), `L${r}*I${r}`, e.hsNgayCongBD, FMT_HS, bodyFont);
    setFormula(row.getCell('N'), `K${r}*$N$15`, e.luongKhoanHienThi, FMT_MONEY, bodyFont);
    setFormula(row.getCell('O'), `M${r}*$N$16`, e.luongBDHienThi, FMT_MONEY, bodyFont);
    setFormula(row.getCell('P'), `K${r}*$N$17`, e.tienThuongHienThi, FMT_MONEY, bodyFont);
    setNumber(row.getCell('Q'), e.tongTruThuong, FMT_MONEY, bodyFont);
    setFormula(
      row.getCell('R'),
      isA ? `MAX(0,N${r}-Q${r})` : `MAX(0,N${r}+O${r}+P${r}-Q${r})`,
      e.tongLuongHienThi,
      FMT_MONEY,
      font(10.5, { bold: true }),
    );
  };

  const writeGroupTitle = (r: number, title: string) => {
    setText(ws, `A${r}:R${r}`, title, font(11, { bold: true, italic: true }), 'left');
    ws.getCell(`A${r}`).fill = FILL_GROUP;
  };

  const SUM_COLS = ['F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'];
  const SUM_FMT: Record<string, string> = {
    F: FMT_COEF, G: FMT_COEF, H: FMT_COEF, I: FMT_COEF,
    J: '#,##0.00##', K: FMT_HS, L: '#,##0.00##', M: FMT_HS,
    N: FMT_MONEY, O: FMT_MONEY, P: FMT_MONEY, Q: FMT_MONEY, R: FMT_MONEY,
  };

  const writeSubtotal = (
    r: number,
    title: string,
    from: number,
    to: number,
    sub: PayrollCalculationResult['subVanPhong'],
  ) => {
    setText(ws, `A${r}:E${r}`, title, font(11, { bold: true }), 'left');
    const results: Record<string, number> = {
      F: sub.hsTong, G: sub.hsCV, H: sub.hsTN, I: sub.hsTong,
      J: sub.congKhoan, K: sub.hsNgayCong, L: sub.congBD, M: sub.hsNgayCongBD,
      N: sub.luongKhoan, O: sub.luongBD, P: sub.tienThuong, Q: sub.truThuong, R: sub.tongLuong,
    };
    for (const c of SUM_COLS) {
      const formula = to >= from ? `SUM(${c}${from}:${c}${to})` : '0';
      setFormula(ws.getCell(`${c}${r}`), formula, results[c], SUM_FMT[c], font(10.5, { bold: true }));
    }
    for (const c of COLS) ws.getCell(`${c}${r}`).fill = FILL_GROUP;
  };

  writeGroupTitle(VP_GROUP_ROW, 'I. BỘ PHẬN VĂN PHÒNG');
  vanPhongRows.forEach((e, i) => writeEmployee(VP_START + i, e, i + 1));
  writeSubtotal(VP_SUB, 'Cộng BP Văn phòng', VP_START, VP_END, calc.subVanPhong);

  writeGroupTitle(DC_GROUP_ROW, 'II. BỘ PHẬN NHÂN VIÊN DÂY CHUYỀN 1 + 2');
  dayChuyenRows.forEach((e, i) =>
    writeEmployee(DC_START + i, e, vanPhongRows.length + i + 1),
  );
  writeSubtotal(DC_SUB, 'Cộng BP Nhân viên dây chuyền 1+2', DC_START, DC_END, calc.subDayChuyen);

  // Tổng cộng toàn phòng
  setText(ws, `A${GRAND}:E${GRAND}`, 'TỔNG CỘNG TOÀN PHÒNG', font(11, { bold: true }), 'center');
  const g = calc.grandTotal;
  const grandResults: Record<string, number> = {
    F: g.hsTong, G: g.hsCV, H: g.hsTN, I: g.hsTong,
    J: g.congKhoan, K: g.hsNgayCong, L: g.congBD, M: g.hsNgayCongBD,
    N: g.luongKhoan, O: g.luongBD, P: g.tienThuong, Q: g.truThuong, R: g.tongLuong,
  };
  for (const c of SUM_COLS) {
    setFormula(
      ws.getCell(`${c}${GRAND}`),
      `${c}${VP_SUB}+${c}${DC_SUB}`,
      grandResults[c],
      SUM_FMT[c],
      font(11, { bold: true }),
    );
  }
  for (const c of COLS) ws.getCell(`${c}${GRAND}`).fill = FILL_TOTAL;

  // Kẻ khung toàn bảng
  for (let r = HEADER_ROW_1; r <= GRAND; r++) {
    for (const c of COLS) {
      const cell = ws.getCell(`${c}${r}`);
      cell.border = THIN;
      if (!cell.alignment) cell.alignment = { vertical: 'middle' };
    }
    if (r > HEADER_ROW_2) ws.getRow(r).height = 18;
  }

  // ---------- 5. Số tiền bằng chữ ----------
  let r = GRAND + 1;
  setText(
    ws,
    `A${r}:R${r}`,
    `Tổng số tiền thực chi (bằng chữ): ${numberToVietnameseWords(g.tongLuong)}.`,
    font(11, { italic: true, bold: true }),
    'left',
  );
  ws.getRow(r).height = 20;

  // ---------- 6. Vùng ký duyệt (chức danh in hoa đậm – NĐ30) ----------
  r += 2;
  const signRow = r;
  const blocks: [string, string, string][] = [
    ['A', 'D', 'NGƯỜI LẬP BIỂU'],
    ['E', 'I', 'TRƯỞNG PHÒNG KTCN'],
    ['J', 'N', 'P.TGĐ PT. TC-HC'],
    ['O', 'R', 'P.TGĐ PHỤ TRÁCH'],
  ];
  const names = [sig.preparedBy, sig.headOfDept, sig.deputyTCHC, sig.deputyInCharge];
  blocks.forEach(([from, to, title], i) => {
    setText(ws, `${from}${signRow}:${to}${signRow}`, title, font(12, { bold: true }));
    setText(
      ws,
      `${from}${signRow + 1}:${to}${signRow + 1}`,
      '(Ký, ghi rõ họ tên)',
      font(11, { italic: true }),
    );
    setText(
      ws,
      `${from}${signRow + 6}:${to}${signRow + 6}`,
      names[i]?.trim() || '',
      font(12, { bold: true }),
    );
  });

  // ---------- 7. Nơi nhận ----------
  r = signRow + 8;
  setText(ws, `A${r}:F${r}`, 'Nơi nhận:', font(12, { bold: true, italic: true }), 'left');
  const recipients = ['- P.TGĐ phụ trách;', '- P.TGĐ PT. TC-HC;', '- P.TC-HC, P.KT;', '- Lưu: VT, P.KTCN.'];
  recipients.forEach((text, i) => {
    setText(ws, `A${r + 1 + i}:F${r + 1 + i}`, text, font(11), 'left');
  });

  // Lặp lại tiêu đề bảng khi in nhiều trang
  ws.pageSetup.printTitlesRow = `${HEADER_ROW_1}:${HEADER_ROW_2}`;
  ws.pageSetup.printArea = `A1:R${r + recipients.length}`;

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, `Bang_thanh_toan_luong_KTCN_${period.periodKey}.xlsx`);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
