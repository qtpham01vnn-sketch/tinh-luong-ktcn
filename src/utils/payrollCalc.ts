import type {
  AttendanceRecord,
  Department,
  PayrollPeriod,
} from '../types/payroll';

const DEPT_RANK: Record<Department, number> = { van_phong: 0, day_chuyen: 1 };

/** Sắp xếp ổn định: BP Văn phòng trước, sau đó theo sortOrder (không phụ thuộc thứ tự key object) */
export function sortRecords(records: AttendanceRecord[]): AttendanceRecord[] {
  return [...records].sort(
    (a, b) =>
      DEPT_RANK[a.department] - DEPT_RANK[b.department] ||
      a.sortOrder - b.sortOrder ||
      a.msnv.localeCompare(b.msnv),
  );
}

export function safeDiv(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }
  return numerator / denominator;
}

export function formatVND(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Math.round(value).toLocaleString('vi-VN');
}

export function formatDecimal(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export interface FundSummary {
  quyKhoan: number;
  quyBD: number;
  thuongGop: number;
  giamTruChung: number;
  tongThuong: number;
  tongQuyLuong: number;
  thuongChia: number;
  quyGiuLai: number;
  quyThucChia: number;
  tongHSCong: number;
  tongCongKhoan: number;
  tongHSNgayCong: number;
  tongCongBD: number;
  tongHSNgayCongBD: number;
  donGiaGop: number;
  donGiaKhoanRieng: number;
  donGiaBD: number;
  donGiaThuong: number;
  luongHS1: number;
}

export interface CalculatedEmployeeRow extends AttendanceRecord {
  stt: number;
  hsTong: number;
  hsNgayCong: number;
  hsNgayCongBD: number;
  truThuongTuNhatKy: number;
  tongTruThuong: number;
  // Chế độ A (Gộp quỹ)
  luongKhoanModeA: number;
  luongBDThamKhao: number;
  tienThuongThamKhao: number;
  tongLuongModeA: number;
  // Chế độ B (Tách riêng 3 quỹ)
  luongKhoanModeB: number;
  luongBDModeB: number;
  tienThuongModeB: number;
  tongLuongModeB: number;
  // Giá trị hiển thị theo mode đang chọn
  luongKhoanHienThi: number;
  luongBDHienThi: number;
  tienThuongHienThi: number;
  tongLuongHienThi: number;
  chenhLechBvsA: number;
  isAnomalyCong: boolean;
  anomalyReason?: string;
}

export interface DepartmentSubtotal {
  department: Department;
  label: string;
  count: number;
  hsCV: number;
  hsTN: number;
  hsTong: number;
  congKhoan: number;
  hsNgayCong: number;
  congBD: number;
  hsNgayCongBD: number;
  luongKhoan: number;
  luongBD: number;
  tienThuong: number;
  truThuong: number;
  tongLuong: number;
}

export interface PayrollCalculationResult {
  summary: FundSummary;
  rows: CalculatedEmployeeRow[];
  vanPhongRows: CalculatedEmployeeRow[];
  dayChuyenRows: CalculatedEmployeeRow[];
  subVanPhong: DepartmentSubtotal;
  subDayChuyen: DepartmentSubtotal;
  grandTotal: Omit<DepartmentSubtotal, 'department' | 'label'>;
}

export function calculatePayroll(period: PayrollPeriod): PayrollCalculationResult {
  // 1. Tổng hợp quỹ đầu vào (giữ nguyên số thực)
  let quyKhoan = 0;
  let thuongGop = 0;

  if (period.inputMode === 'clusters') {
    for (const c of period.clusters) {
      const clusterAmount = (c.unitPrice || 0) * (c.quantity || 0);
      quyKhoan += clusterAmount;
      const totalPct = ((c.bonusOutputPct || 0) + (c.bonusQualityPct || 0)) / 100;
      thuongGop += clusterAmount * totalPct;
    }
  } else {
    quyKhoan = period.directQuyKhoan || 0;
    thuongGop = period.directThuongGop || 0;
  }

  const quyBD = period.quyBD || 0;

  let giamTruChung = 0;
  const giamTruCaNhanMap: Record<string, number> = {};
  for (const d of period.deductions) {
    if (d.scope === 'quy_thuong_chung') {
      giamTruChung += d.amount || 0;
    } else if (d.scope === 'ca_nhan' && d.msnv) {
      giamTruCaNhanMap[d.msnv] = (giamTruCaNhanMap[d.msnv] || 0) + (d.amount || 0);
    }
  }

  const tongThuong = Math.max(0, thuongGop - giamTruChung);
  const tongQuyLuong = quyKhoan + quyBD + tongThuong;

  const shareRatio = Math.min(100, Math.max(0, period.bonusSharePct || 0)) / 100;
  const thuongChia = tongThuong * shareRatio;
  const quyGiuLai = tongThuong - thuongChia;
  const quyThucChia = quyKhoan + quyBD + thuongChia;

  // 2. Sắp xếp danh sách nhân viên theo bộ phận (BP Văn phòng trước, BP Dây chuyền 1+2 sau)
  const orderedRecords = sortRecords(Object.values(period.records));

  let tongHSCong = 0;
  let tongCongKhoan = 0;
  let tongHSNgayCong = 0;
  let tongCongBD = 0;
  let tongHSNgayCongBD = 0;

  for (const r of orderedRecords) {
    const hsTong = (r.hsCV || 0) + (r.hsTN || 0);
    tongHSCong += hsTong;
    tongCongKhoan += r.congKhoan || 0;
    tongHSNgayCong += (r.congKhoan || 0) * hsTong;
    tongCongBD += r.congBD || 0;
    tongHSNgayCongBD += (r.congBD || 0) * hsTong;
  }

  // 3. Đơn giá chia
  const donGiaGop = safeDiv(quyThucChia, tongHSNgayCong);
  const donGiaKhoanRieng = safeDiv(quyKhoan, tongHSNgayCong);
  const donGiaBD = safeDiv(quyBD, tongHSNgayCongBD);
  const donGiaThuong = safeDiv(thuongChia, tongHSNgayCong);

  const luongHS1 = donGiaGop * period.standardDaysForHS1;

  const summary: FundSummary = {
    quyKhoan,
    quyBD,
    thuongGop,
    giamTruChung,
    tongThuong,
    tongQuyLuong,
    thuongChia,
    quyGiuLai,
    quyThucChia,
    tongHSCong,
    tongCongKhoan,
    tongHSNgayCong,
    tongCongBD,
    tongHSNgayCongBD,
    donGiaGop,
    donGiaKhoanRieng,
    donGiaBD,
    donGiaThuong,
    luongHS1,
  };

  // 4. Tính chi tiết từng nhân viên
  const rows: CalculatedEmployeeRow[] = orderedRecords.map((r, index) => {
    const hsTong = (r.hsCV || 0) + (r.hsTN || 0);
    const hsNgayCong = (r.congKhoan || 0) * hsTong;
    const hsNgayCongBD = (r.congBD || 0) * hsTong;
    const truThuongTuNhatKy = giamTruCaNhanMap[r.msnv] || 0;
    const tongTruThuong = (r.truThuongCaNhan || 0) + truThuongTuNhatKy;

    // Chế độ A
    const luongKhoanModeA = hsNgayCong * donGiaGop;
    const luongBDThamKhao = hsNgayCongBD * donGiaBD;
    const tienThuongThamKhao = hsNgayCong * donGiaThuong;
    const tongLuongModeA = Math.max(0, luongKhoanModeA - tongTruThuong);

    // Chế độ B
    const luongKhoanModeB = hsNgayCong * donGiaKhoanRieng;
    const luongBDModeB = hsNgayCongBD * donGiaBD;
    const tienThuongModeB = hsNgayCong * donGiaThuong;
    const tongLuongModeB = Math.max(
      0,
      luongKhoanModeB + luongBDModeB + tienThuongModeB - tongTruThuong,
    );

    const isModeA = period.calculationMode === 'A';
    const luongKhoanHienThi = isModeA ? luongKhoanModeA : luongKhoanModeB;
    const luongBDHienThi = isModeA ? luongBDThamKhao : luongBDModeB;
    const tienThuongHienThi = isModeA ? tienThuongThamKhao : tienThuongModeB;
    const tongLuongHienThi = isModeA ? tongLuongModeA : tongLuongModeB;

    let isAnomalyCong = false;
    let anomalyReason: string | undefined;
    if (r.congKhoan > 0 && r.congKhoan < 5) {
      isAnomalyCong = true;
      anomalyReason = `Công khoán thấp (${r.congKhoan} công < 5)`;
    } else if (r.congKhoan > 31) {
      isAnomalyCong = true;
      anomalyReason = `Công khoán cao bất thường (${r.congKhoan} > 31)`;
    }

    return {
      ...r,
      stt: index + 1,
      hsTong,
      hsNgayCong,
      hsNgayCongBD,
      truThuongTuNhatKy,
      tongTruThuong,
      luongKhoanModeA,
      luongBDThamKhao,
      tienThuongThamKhao,
      tongLuongModeA,
      luongKhoanModeB,
      luongBDModeB,
      tienThuongModeB,
      tongLuongModeB,
      luongKhoanHienThi,
      luongBDHienThi,
      tienThuongHienThi,
      tongLuongHienThi,
      chenhLechBvsA: tongLuongModeB - tongLuongModeA,
      isAnomalyCong,
      anomalyReason,
    };
  });

  const vanPhongRows = rows.filter((r) => r.department === 'van_phong');
  const dayChuyenRows = rows.filter((r) => r.department === 'day_chuyen');

  const buildSubtotal = (
    dept: Department,
    label: string,
    deptRows: CalculatedEmployeeRow[],
  ): DepartmentSubtotal => ({
    department: dept,
    label,
    count: deptRows.length,
    hsCV: deptRows.reduce((s, r) => s + r.hsCV, 0),
    hsTN: deptRows.reduce((s, r) => s + r.hsTN, 0),
    hsTong: deptRows.reduce((s, r) => s + r.hsTong, 0),
    congKhoan: deptRows.reduce((s, r) => s + r.congKhoan, 0),
    hsNgayCong: deptRows.reduce((s, r) => s + r.hsNgayCong, 0),
    congBD: deptRows.reduce((s, r) => s + r.congBD, 0),
    hsNgayCongBD: deptRows.reduce((s, r) => s + r.hsNgayCongBD, 0),
    luongKhoan: deptRows.reduce((s, r) => s + r.luongKhoanHienThi, 0),
    luongBD: deptRows.reduce((s, r) => s + r.luongBDHienThi, 0),
    tienThuong: deptRows.reduce((s, r) => s + r.tienThuongHienThi, 0),
    truThuong: deptRows.reduce((s, r) => s + r.tongTruThuong, 0),
    tongLuong: deptRows.reduce((s, r) => s + r.tongLuongHienThi, 0),
  });

  const subVanPhong = buildSubtotal('van_phong', 'Cộng BP Văn phòng', vanPhongRows);
  const subDayChuyen = buildSubtotal(
    'day_chuyen',
    'Cộng BP Nhân viên dây chuyền 1+2',
    dayChuyenRows,
  );

  const grandTotal = {
    count: rows.length,
    hsCV: subVanPhong.hsCV + subDayChuyen.hsCV,
    hsTN: subVanPhong.hsTN + subDayChuyen.hsTN,
    hsTong: subVanPhong.hsTong + subDayChuyen.hsTong,
    congKhoan: subVanPhong.congKhoan + subDayChuyen.congKhoan,
    hsNgayCong: subVanPhong.hsNgayCong + subDayChuyen.hsNgayCong,
    congBD: subVanPhong.congBD + subDayChuyen.congBD,
    hsNgayCongBD: subVanPhong.hsNgayCongBD + subDayChuyen.hsNgayCongBD,
    luongKhoan: subVanPhong.luongKhoan + subDayChuyen.luongKhoan,
    luongBD: subVanPhong.luongBD + subDayChuyen.luongBD,
    tienThuong: subVanPhong.tienThuong + subDayChuyen.tienThuong,
    truThuong: subVanPhong.truThuong + subDayChuyen.truThuong,
    tongLuong: subVanPhong.tongLuong + subDayChuyen.tongLuong,
  };

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
