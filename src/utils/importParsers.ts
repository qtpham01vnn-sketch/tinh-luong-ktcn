import * as XLSX from 'xlsx';
import type { Department, EmployeeMaster, ProductionCluster } from '../types/payroll';

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/** Đọc sheet đầu tiên của file Excel/CSV thành lưới chuỗi */
export async function readSpreadsheetRows(file: File): Promise<string[][]> {
  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error('File vượt quá 5MB, vui lòng tách nhỏ dữ liệu.');
  }
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return [];
  const ws = wb.Sheets[firstSheetName];
  const data = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
    header: 1,
    defval: '',
    raw: true,
  });
  return data.map((row) => row.map((cell) => String(cell ?? '').trim()));
}

/**
 * Chuyển chuỗi số kiểu Việt Nam / quốc tế về number.
 * "1.234.567" → 1234567 ; "1,234,567" → 1234567 ; "27,25" → 27.25 ; "27.25" → 27.25
 */
export function parseNumberLoose(raw: string | number | undefined | null): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  if (raw === undefined || raw === null) return 0;
  let s = String(raw).replace(/đ|vnd|%/gi, '').replace(/\s+/g, '').trim();
  if (!s || s === '-') return 0;

  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  if (hasDot && hasComma) {
    // Dấu xuất hiện sau cùng là dấu thập phân
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    const parts = s.split(',');
    // "1,234,567" (nhóm 3 số) → phân cách nghìn ; "27,25" → thập phân
    s = parts.length > 2 || (parts.length === 2 && parts[1].length === 3)
      ? s.replace(/,/g, '')
      : s.replace(',', '.');
  } else if (hasDot) {
    const parts = s.split('.');
    if (parts.length > 2) s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

const MSNV_RE = /^\d{2,6}$/;
const HAS_LETTER_RE = /[a-zA-ZÀ-ỹ]/;

function normalizeName(s: string): string {
  return s.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
}

export interface ParsedAttendanceItem {
  msnv: string;
  fullName: string;
  congKhoan: number;
  congBD: number;
}

/**
 * Nhận diện dòng chấm công: [STT?] MSNV | Họ tên | Công khoán | Công BD
 * Dòng không có MSNV nhưng có họ tên sẽ được khớp theo tên (nameLookup).
 */
export function parseAttendanceFromGrid(
  grid: string[][],
  nameLookup?: Map<string, string>,
): ParsedAttendanceItem[] {
  const results: ParsedAttendanceItem[] = [];
  for (const row of grid) {
    const cells = row.map((c) => c.trim());
    if (cells.filter(Boolean).length < 2) continue;

    let msnvIdx = -1;
    if (MSNV_RE.test(cells[0]) && cells[1] && MSNV_RE.test(cells[1])) msnvIdx = 1; // STT + MSNV
    else if (MSNV_RE.test(cells[0])) msnvIdx = 0;
    else if (cells[1] && MSNV_RE.test(cells[1])) msnvIdx = 1;

    let msnv = '';
    let rest: string[];
    if (msnvIdx >= 0) {
      msnv = cells[msnvIdx];
      rest = cells.slice(msnvIdx + 1);
    } else {
      rest = cells;
    }

    const fullName = rest.find((c) => HAS_LETTER_RE.test(c)) || '';
    if (!msnv && fullName && nameLookup) {
      msnv = nameLookup.get(normalizeName(fullName)) || '';
    }
    if (!msnv) continue;

    const numbers = rest
      .filter((c) => c !== '' && !HAS_LETTER_RE.test(c))
      .map((c) => parseNumberLoose(c));
    if (numbers.length === 0) continue;

    results.push({
      msnv,
      fullName,
      congKhoan: Math.max(0, numbers[0] ?? 0),
      congBD: Math.max(0, numbers[1] ?? 0),
    });
  }
  return results;
}

export function buildNameLookup(list: { msnv: string; fullName: string }[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const e of list) map.set(normalizeName(e.fullName), e.msnv);
  return map;
}

export function textToGrid(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.trim().length > 0)
    .map((line) => {
      if (line.includes('\t')) return line.split('\t');
      if (line.includes(';')) return line.split(';');
      return line.split(/\s{2,}|,(?=\S)/);
    });
}

/** Cấu trúc cột: Tên cụm | Đơn giá | Sản lượng | % Thưởng SL | % Thưởng CL */
export function parseClustersFromGrid(grid: string[][]): ProductionCluster[] {
  const clusters: ProductionCluster[] = [];
  const stamp = Date.now();
  grid.forEach((row, idx) => {
    if (row.length < 3) return;
    const name = row[0]?.trim();
    if (!name || /^(tên|stt|đơn giá|cụm\s*$)/i.test(name)) return;
    const unitPrice = parseNumberLoose(row[1]);
    const quantity = parseNumberLoose(row[2]);
    if (unitPrice <= 0 && quantity <= 0) return;
    clusters.push({
      id: `cluster_imp_${stamp}_${idx}`,
      name,
      unitPrice,
      quantity,
      bonusOutputPct: parseNumberLoose(row[3] ?? '0'),
      bonusQualityPct: parseNumberLoose(row[4] ?? '0'),
    });
  });
  return clusters;
}

/** Cấu trúc cột: [STT?] MSNV | Họ tên | Chức vụ | Bộ phận | LCB 2020 | HS CV | HS TN */
export function parseEmployeesFromGrid(grid: string[][], startOrder: number): EmployeeMaster[] {
  const list: EmployeeMaster[] = [];
  let order = startOrder;
  for (const row of grid) {
    const cells = row.map((c) => c.trim());
    let msnvIdx = -1;
    if (MSNV_RE.test(cells[0]) && cells[1] && MSNV_RE.test(cells[1])) msnvIdx = 1;
    else if (MSNV_RE.test(cells[0]) && cells[1] && HAS_LETTER_RE.test(cells[1])) msnvIdx = 0;
    else if (cells[1] && MSNV_RE.test(cells[1])) msnvIdx = 1;
    if (msnvIdx === -1) continue;

    const msnv = cells[msnvIdx];
    const fullName = cells[msnvIdx + 1] || '';
    if (!fullName || !HAS_LETTER_RE.test(fullName)) continue;
    const position = cells[msnvIdx + 2] || 'Nhân viên';
    const deptRaw = (cells[msnvIdx + 3] || '').toLowerCase();
    const department: Department =
      deptRaw.includes('văn phòng') || deptRaw === 'vp' || deptRaw.includes('van phong')
        ? 'van_phong'
        : 'day_chuyen';
    const hsCVRaw = parseNumberLoose(cells[msnvIdx + 5]);
    list.push({
      id: `emp_${msnv}`,
      msnv,
      fullName,
      position,
      department,
      baseSalary2020: parseNumberLoose(cells[msnvIdx + 4]) || 5310000,
      hsCV: hsCVRaw > 0 ? hsCVRaw : 1.42,
      hsTN: Math.max(0, parseNumberLoose(cells[msnvIdx + 6])),
      active: true,
      sortOrder: order++,
    });
  }
  return list;
}
