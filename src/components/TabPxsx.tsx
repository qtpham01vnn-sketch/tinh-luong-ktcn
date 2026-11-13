import React, { useMemo, useRef, useState } from 'react';
import {
  Calculator,
  CheckCircle2,
  Factory,
  FileSpreadsheet,
  Layers,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { MASTER_TARIFFS_2026 } from '../data/masterTariffs2026';
import {
  PXSX_DEPT_CONFIGS_OCT_2026,
  PXSX_EMPLOYEES_OCT_2026,
  type PxsxDeptKey,
  type PxsxEmployeeRow,
} from '../data/pxsxOctober2026';
import { formatVND } from '../utils/payrollCalc';
import { PrintPreviewDept } from './PrintPreviewDept';

export interface LineProductInput {
  id: string;
  line: 'DC1' | 'DC2';
  label: string;
  productCode: '30x60' | '40x80' | '50x50' | '60x60';
  surface: string;
  periodText: string;
  qtyM2: number;
  a1Pct: number;
  pxsxUnitPrice: number;
  tbtmUnitPrice: number;
  bonusSlPct: number;
  bonusClPct: number;
  noBonus?: boolean;
}

export const DEFAULT_OCT_2026_INPUTS: LineProductInput[] = [
  {
    id: 'dc1_3060',
    line: 'DC1',
    label: 'Gạch 30x60 (DC1)',
    productCode: '30x60',
    surface: 'Thường',
    periodText: '01/10 - 31/10/2026',
    qtyM2: 491688.36,
    a1Pct: 94.93,
    pxsxUnitPrice: 1985, // 1925 + 60 (VP)
    tbtmUnitPrice: 635,
    bonusSlPct: 2,
    bonusClPct: 2,
  },
  {
    id: 'dc2_4080',
    line: 'DC2',
    label: 'Gạch 40x80 (DC2)',
    productCode: '40x80',
    surface: 'Thường',
    periodText: '01/10 - 06/10/2026',
    qtyM2: 73236.96,
    a1Pct: 92.05,
    pxsxUnitPrice: 2409, // 2345 + 64 (VP)
    tbtmUnitPrice: 682,
    bonusSlPct: 0,
    bonusClPct: 2,
  },
  {
    id: 'dc2_6060_matt',
    line: 'DC2',
    label: 'Gạch 60x60 Men Matt (DC2)',
    productCode: '60x60',
    surface: 'Men Matt',
    periodText: '07/10 - 12/10/2026',
    qtyM2: 74844,
    a1Pct: 98.08,
    pxsxUnitPrice: 2873, // 2769 + 76 (+1% thực chi T10)
    tbtmUnitPrice: 813,
    bonusSlPct: 4,
    bonusClPct: 4,
  },
  {
    id: 'dc2_6060_bong',
    line: 'DC2',
    label: 'Gạch 60x60 Men Bóng (DC2)',
    productCode: '60x60',
    surface: 'Men Bóng',
    periodText: '13/10 - 31/10/2026',
    qtyM2: 238253.4,
    a1Pct: 94.53,
    pxsxUnitPrice: 2873,
    tbtmUnitPrice: 813,
    bonusSlPct: 4,
    bonusClPct: 4,
  },
  {
    id: 'dc2_5050_bong',
    line: 'DC2',
    label: 'Gạch 50x50 Men Bóng (DC2)',
    productCode: '50x50',
    surface: 'Men Bóng',
    periodText: 'Nếu có chạy trong tháng',
    qtyM2: 0,
    a1Pct: 89,
    pxsxUnitPrice: 2509, // 2442 + 67 (VP)
    tbtmUnitPrice: 710,
    bonusSlPct: 0,
    bonusClPct: 0,
  },
  {
    id: 'dc2_5050_sugar',
    line: 'DC2',
    label: 'Gạch 50x50 Men Sugar Sân Vườn (DC2)',
    productCode: '50x50',
    surface: 'Men Sugar',
    periodText: 'Nếu có chạy trong tháng',
    qtyM2: 0,
    a1Pct: 94,
    pxsxUnitPrice: 2509, // 2442 + 67 (VP)
    tbtmUnitPrice: 710,
    bonusSlPct: 0,
    bonusClPct: 0,
  },
  {
    id: 'dc2_6060_cd',
    line: 'DC2',
    label: 'Lương chuyển đổi 60x60 (06/10)',
    productCode: '60x60',
    surface: 'Chuyển đổi',
    periodText: '06/10/2026',
    qtyM2: 12040,
    a1Pct: 100,
    pxsxUnitPrice: 2873,
    tbtmUnitPrice: 813,
    bonusSlPct: 0,
    bonusClPct: 0,
    noBonus: true,
  },
];

export const TabPxsx: React.FC<{
  periodLabel: string;
  sharedItems?: LineProductInput[];
  onChangeSharedItems?: React.Dispatch<React.SetStateAction<LineProductInput[]>>;
}> = ({ periodLabel, sharedItems, onChangeSharedItems }) => {
  const [subView, setSubView] = useState<'OVERVIEW' | PxsxDeptKey>('OVERVIEW');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [localItems, setLocalItems] = useState<LineProductInput[]>(DEFAULT_OCT_2026_INPUTS);
  const items = sharedItems ?? localItems;
  const setItems = onChangeSharedItems ?? setLocalItems;
  const [employees, setEmployees] = useState<PxsxEmployeeRow[]>(() => PXSX_EMPLOYEES_OCT_2026);
  const [showAddEmp, setShowAddEmp] = useState(false);
  const [newEmp, setNewEmp] = useState({
    msnv: '',
    fullName: '',
    position: 'CN Vận hành',
    group: '',
    hsLuong: 1.3,
    hsTN: 0,
    hsDH: 0,
    congSP: 26,
  });
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bonusShareByDept, setBonusShareByDept] = useState<Record<PxsxDeptKey, number>>({
    TBTM: 50,
    DC1: 80,
    DC2: 50,
  });
  const [knDc1, setKnDc1] = useState<number>(6640194.5);
  const [knDc2, setKnDc2] = useState<number>(7508208.37);
  const [knTbtm, setKnTbtm] = useState<number>(4250367.13);

  const updateEmployeeCong = (dept: PxsxDeptKey, msnv: string, newCong: number) => {
    const stdDays = PXSX_DEPT_CONFIGS_OCT_2026[dept].standardDays;
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.dept !== dept || emp.msnv !== msnv) return emp;
        const hsTong = emp.hsLuong + emp.hsTN + emp.hsDH;
        const rawOld = emp.congSP > 0 ? (hsTong * emp.congSP) / stdDays : 0;
        const ratio = rawOld > 0 ? emp.hsCongSP / rawOld : 1;
        const nextHsCong = ((hsTong * Math.max(0, newCong)) / stdDays) * ratio;
        return { ...emp, congSP: Math.max(0, newCong), hsCongSP: nextHsCong };
      }),
    );
  };

  const handleAddEmployee = (dept: PxsxDeptKey) => {
    const msnv = newEmp.msnv.trim();
    const fullName = newEmp.fullName.trim();
    if (!msnv || !fullName) return;
    const stdDays = PXSX_DEPT_CONFIGS_OCT_2026[dept].standardDays;
    const hsTong = newEmp.hsLuong + newEmp.hsTN + newEmp.hsDH;
    const hsCongSP = (hsTong * newEmp.congSP) / stdDays;
    setEmployees((prev) => {
      const deptCount = prev.filter((r) => r.dept === dept).length;
      const row: PxsxEmployeeRow = {
        stt: deptCount + 1,
        msnv,
        fullName,
        position: newEmp.position.trim() || 'CN Vận hành',
        group: newEmp.group.trim() || 'Bổ sung mới',
        dept,
        hsLuong: newEmp.hsLuong,
        hsTN: newEmp.hsTN,
        hsDH: newEmp.hsDH,
        congSP: newEmp.congSP,
        hsCongSP,
        isBonusZero: false,
        overtimePay: 0,
        excelLuongSP: 0,
        excelThuong: 0,
        note: 'Thêm mới',
      };
      return [...prev, row];
    });
    setNewEmp({ ...newEmp, msnv: '', fullName: '' });
    setShowAddEmp(false);
    setImportMsg(`Đã thêm nhân sự ${msnv} - ${fullName} vào ${dept}.`);
  };

  const handleDeleteEmployee = (dept: PxsxDeptKey, msnv: string, fullName: string) => {
    if (!window.confirm(`Xóa nhân sự ${msnv} - ${fullName} khỏi danh sách ${dept}?`)) return;
    setEmployees((prev) => prev.filter((r) => !(r.dept === dept && r.msnv === msnv)));
    setImportMsg(`Đã xóa ${msnv} - ${fullName} khỏi ${dept}.`);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>, dept: PxsxDeptKey) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
      const stdDays = PXSX_DEPT_CONFIGS_OCT_2026[dept].standardDays;
      let updatedCount = 0;
      let addedCount = 0;

      setEmployees((prev) => {
        const next = [...prev];
        for (const raw of rows) {
          const msnvRaw = String(raw['MSNV'] ?? raw['msnv'] ?? raw['Mã NV'] ?? '').trim();
          if (!msnvRaw) continue;
          const msnv = /^\d+$/.test(msnvRaw) ? msnvRaw.padStart(4, '0') : msnvRaw;
          const cong = Number(raw['Công SP'] ?? raw['Công'] ?? raw['congSP'] ?? raw['Công thực tế'] ?? NaN);
          const idx = next.findIndex((x) => x.dept === dept && x.msnv === msnv);
          if (idx >= 0) {
            if (!Number.isNaN(cong)) {
              const emp = next[idx];
              const hsTong = emp.hsLuong + emp.hsTN + emp.hsDH;
              const rawOld = emp.congSP > 0 ? (hsTong * emp.congSP) / stdDays : 0;
              const ratio = rawOld > 0 ? emp.hsCongSP / rawOld : 1;
              next[idx] = { ...emp, congSP: cong, hsCongSP: ((hsTong * cong) / stdDays) * ratio };
              updatedCount++;
            }
          } else {
            const fullName = String(raw['Họ và tên'] ?? raw['Tên'] ?? raw['fullName'] ?? '').trim();
            if (fullName) {
              const hsLuong = Number(raw['HS Lương'] ?? raw['Lương'] ?? 1.3) || 1.3;
              const hsTN = Number(raw['HS TN'] ?? raw['Trách nhiệm'] ?? 0) || 0;
              const hsDH = Number(raw['HS ĐH'] ?? raw['Độc hại'] ?? 0) || 0;
              const c = Number.isNaN(cong) ? stdDays : cong;
              next.push({
                stt: next.filter((x) => x.dept === dept).length + 1,
                msnv,
                fullName,
                position: String(raw['Chức vụ'] ?? 'CN Vận hành').trim(),
                group: String(raw['Tổ'] ?? raw['Bộ phận'] ?? 'Upload Excel').trim(),
                dept,
                hsLuong,
                hsTN,
                hsDH,
                congSP: c,
                hsCongSP: ((hsLuong + hsTN + hsDH) * c) / stdDays,
                isBonusZero: false,
                overtimePay: 0,
                excelLuongSP: 0,
                excelThuong: 0,
                note: 'Import Excel',
              });
              addedCount++;
            }
          }
        }
        return next;
      });
      setImportMsg(`Đã nạp từ "${file.name}": cập nhật công ${updatedCount} người, thêm mới ${addedCount} người.`);
    } catch {
      setImportMsg('Không đọc được file Excel/CSV. Cần có cột MSNV, Tên (nếu thêm mới), Công SP.');
    }
  };

  const handleExportDeptExcel = () => {
    if (!deptView) return;
    const data = deptView.filtered.map((r) => ({
      STT: r.stt,
      MSNV: r.msnv,
      'Họ và tên': r.fullName,
      'Chức vụ': r.position,
      'Tổ / Công đoạn': r.group,
      'HS Lương': r.hsLuong,
      'HS TN': r.hsTN,
      'HS ĐH': r.hsDH,
      'HS Tổng': Number((r.hsLuong + r.hsTN + r.hsDH).toFixed(2)),
      'Công SP': r.congSP,
      'HS Công SP': Number(r.hsCongSP.toFixed(4)),
      'Lương SP': r.liveLuongSP,
      'Thưởng SL+CL': r.liveThuong,
      'Tăng ca': r.overtimePay,
      'Tổng Thực Lãnh': r.liveTotalPay,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, deptView.cfg.dept);
    XLSX.writeFile(wb, `Bang_Luong_${deptView.cfg.dept}_${periodLabel.replace(/\s+/g, '_')}.xlsx`);
  };

  const updateItem = (id: string, patch: Partial<LineProductInput>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const calc = useMemo(() => {
    let dc1Khoan = 0;
    let dc1Thuong = 0;
    let dc2Khoan = 0;
    let dc2Thuong = 0;
    let tbtmKhoan = 0;
    let tbtmThuong = 0;

    const details = items.map((it) => {
      const pxsxLuong = it.qtyM2 * it.pxsxUnitPrice;
      const tbtmLuong = it.qtyM2 * it.tbtmUnitPrice;
      const pctSum = it.noBonus ? 0 : (it.bonusSlPct + it.bonusClPct) / 100;
      const pxsxTh = pxsxLuong * pctSum;
      const tbtmTh = tbtmLuong * pctSum;

      if (it.line === 'DC1') {
        dc1Khoan += pxsxLuong;
        dc1Thuong += pxsxTh;
      } else {
        dc2Khoan += pxsxLuong;
        dc2Thuong += pxsxTh;
      }
      tbtmKhoan += tbtmLuong;
      tbtmThuong += tbtmTh;

      return {
        ...it,
        pxsxLuong,
        pxsxTh,
        pxsxTotal: pxsxLuong + pxsxTh,
        tbtmLuong,
        tbtmTh,
        tbtmTotal: tbtmLuong + tbtmTh,
      };
    });

    const dc1Net = dc1Khoan + dc1Thuong - knDc1;
    const dc2Net = dc2Khoan + dc2Thuong - knDc2;
    const tbtmNet = tbtmKhoan + tbtmThuong - knTbtm;
    const grandTotal = dc1Net + dc2Net + tbtmNet;

    return {
      details,
      dc1Khoan,
      dc1Thuong,
      dc1Net,
      dc2Khoan,
      dc2Thuong,
      dc2Net,
      tbtmKhoan,
      tbtmThuong,
      tbtmNet,
      grandTotal,
    };
  }, [items, knDc1, knDc2, knTbtm]);

  const tbtmQuota = MASTER_TARIFFS_2026.TBTM.quotas['30x60'];
  const pxsxDc1Quota = MASTER_TARIFFS_2026.PXSX.quotas['30x60'];
  const pxsxDc2Quota = MASTER_TARIFFS_2026.PXSX.quotas['60x60'];

  const deptView = useMemo(() => {
    if (subView === 'OVERVIEW') return null;
    const cfg = PXSX_DEPT_CONFIGS_OCT_2026[subView];
    const bonusSharePct = bonusShareByDept[subView];
    const allDeptRows = employees.filter((r) => r.dept === subView);

    // Lấy Quỹ lương & Quỹ thưởng động trực tiếp từ bảng Nhập Sản lượng & Khiếu nại
    const liveFundLuong =
      subView === 'TBTM' ? calc.tbtmKhoan : subView === 'DC1' ? calc.dc1Khoan : calc.dc2Khoan;
    const liveRawThuong =
      subView === 'TBTM' ? calc.tbtmThuong : subView === 'DC1' ? calc.dc1Thuong : calc.dc2Thuong;
    const liveKn = subView === 'TBTM' ? knTbtm : subView === 'DC1' ? knDc1 : knDc2;
    const liveThuongSauKn = Math.max(0, liveRawThuong - liveKn);
    const liveThuongChi = liveThuongSauKn * (bonusSharePct / 100);
    const liveDuPhong = liveThuongSauKn - liveThuongChi;

    const totalHsCong = allDeptRows.reduce((s, r) => s + r.hsCongSP, 0);
    const totalHsCongEligible = allDeptRows.reduce(
      (s, r) => s + (r.isBonusZero ? 0 : r.hsCongSP),
      0,
    );
    const donGiaLuong = totalHsCong > 0 ? liveFundLuong / totalHsCong : 0;
    const donGiaThuong = totalHsCongEligible > 0 ? liveThuongChi / totalHsCongEligible : 0;
    const hs1NoBonus = Math.round(donGiaLuong);
    const hs1WithBonus = Math.round(donGiaLuong + donGiaThuong);
    const totalOvertimePay = allDeptRows.reduce((s, r) => s + r.overtimePay, 0);

    const calculatedRows = allDeptRows.map((r) => {
      const luongSP = Math.round(r.hsCongSP * donGiaLuong);
      const thuong = r.isBonusZero ? 0 : Math.round(r.hsCongSP * donGiaThuong);
      const totalPay = luongSP + thuong + r.overtimePay;
      return { ...r, liveLuongSP: luongSP, liveThuong: thuong, liveTotalPay: totalPay };
    });

    const groups = Array.from(new Set(calculatedRows.map((r) => r.group).filter(Boolean)));
    const q = searchQuery.trim().toLowerCase();
    const filtered = calculatedRows.filter((r) => {
      if (groupFilter !== 'ALL' && r.group !== groupFilter) return false;
      if (!q) return true;
      return (
        r.msnv.toLowerCase().includes(q) ||
        r.fullName.toLowerCase().includes(q) ||
        r.position.toLowerCase().includes(q) ||
        r.group.toLowerCase().includes(q)
      );
    });

    const totals = filtered.reduce(
      (acc, r) => {
        const hsTong = r.hsLuong + r.hsTN + r.hsDH;
        acc.hsTong += hsTong;
        acc.congSP += r.congSP;
        acc.hsCongSP += r.hsCongSP;
        acc.luongSP += r.liveLuongSP;
        acc.thuong += r.liveThuong;
        acc.overtimePay += r.overtimePay;
        acc.totalPay += r.liveTotalPay;
        return acc;
      },
      { hsTong: 0, congSP: 0, hsCongSP: 0, luongSP: 0, thuong: 0, overtimePay: 0, totalPay: 0 },
    );

    return {
      cfg,
      bonusSharePct,
      liveFundLuong,
      liveThuongChi,
      liveDuPhong,
      totalHsCong,
      hs1NoBonus,
      hs1WithBonus,
      totalOvertimePay,
      allCount: allDeptRows.length,
      groups,
      filtered,
      totals,
    };
  }, [subView, searchQuery, groupFilter, employees, bonusShareByDept, calc, knDc1, knDc2, knTbtm]);

  return (
    <>
      <div className="no-print space-y-6">
      {/* Header Banner */}
      <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-900 to-slate-900 p-5 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Factory className="h-5 w-5 text-amber-400" />
              <h2 className="text-lg font-bold">
                Phân xưởng Sản xuất (PXSX): DC1 – DC2 – TBTM ({periodLabel})
              </h2>
            </div>
            <p className="mt-1 text-xs text-blue-200">
              Tính toán theo Quyết định 01/KSX-2026/PNC-QĐ (01/04/2026) &amp; Bảng chia lương T10/2026 đã duyệt
            </p>
          </div>
          <div className="rounded-lg bg-white/10 px-4 py-2 text-right backdrop-blur-sm">
            <div className="text-[11px] text-blue-200 uppercase">Tổng Lương + Thưởng PXSX</div>
            <div className="text-xl font-extrabold text-amber-300">{formatVND(calc.grandTotal)} đ</div>
          </div>
        </div>
      </div>

      {/* Sub-view Navigation */}
      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        {(
          [
            { key: 'OVERVIEW', label: 'Tổng hợp Quỹ PXSX' },
            { key: 'TBTM', label: 'Chi tiết TBTM (26 công, 50% thưởng)' },
            { key: 'DC1', label: 'Chi tiết DC1 (26.5 công, 80% thưởng)' },
            { key: 'DC2', label: 'Chi tiết DC2 (26.5 công, 50% thưởng)' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setSubView(tab.key);
              setGroupFilter('ALL');
              setSearchQuery('');
            }}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
              subView === tab.key
                ? 'bg-blue-700 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {subView !== 'OVERVIEW' && deptView ? (
        <div className="space-y-4">
          {/* Dept KPI Strip */}
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 uppercase">Quy chuẩn chia lương</div>
              <div className="mt-1 text-base font-bold text-slate-900">
                {deptView.cfg.standardDays} công chuẩn | Chia{' '}
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={deptView.bonusSharePct}
                  onChange={(e) =>
                    setBonusShareByDept((prev) => ({
                      ...prev,
                      [deptView.cfg.dept]: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                    }))
                  }
                  className="w-12 rounded border border-slate-300 px-1 py-0.5 text-center text-sm font-bold text-blue-700"
                />
                % thưởng
              </div>
              <div className="mt-1 text-xs text-slate-600">
                Tổng nhân sự: <strong>{deptView.allCount} CBCNV</strong> | Tổng HS công:{' '}
                <strong>{deptView.totalHsCong.toFixed(4)}</strong>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 uppercase">Đơn giá Hệ số 1 (Tự động)</div>
              <div className="mt-1 text-base font-extrabold text-blue-700">
                {formatVND(deptView.hs1WithBonus)} đ
              </div>
              <div className="mt-1 text-xs text-slate-600">
                K thưởng: <strong>{formatVND(deptView.hs1NoBonus)} đ</strong>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 uppercase">Quỹ Lương Khoán &amp; Tăng Ca</div>
              <div className="mt-1 text-base font-extrabold text-slate-900">
                {formatVND(deptView.liveFundLuong)} đ
              </div>
              <div className="mt-1 text-xs text-slate-600">
                Tăng ca duyệt chi: <strong>{formatVND(deptView.totalOvertimePay)} đ</strong>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 uppercase">
                Chi Thưởng ({deptView.bonusSharePct}%) &amp; Dự Phòng
              </div>
              <div className="mt-1 text-base font-extrabold text-emerald-700">
                {formatVND(deptView.liveThuongChi)} đ
              </div>
              <div className="mt-1 text-xs text-slate-600">
                Quỹ dự phòng giữ lại: <strong>{formatVND(deptView.liveDuPhong)} đ</strong>
              </div>
            </div>
          </div>

          {/* Search, Filter & HR/Export Actions */}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo MSNV, Họ tên, Chức vụ..."
                  className="w-full rounded-lg border border-slate-300 py-1.5 pr-3 pl-9 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
              >
                <option value="ALL">Tất cả tổ/nhóm ({deptView.allCount} người)</option>
                {deptView.groups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowAddEmp((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
              >
                <Plus className="h-3.5 w-3.5" /> Thêm nhân viên
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <Upload className="h-3.5 w-3.5" /> Upload Excel/CSV
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => handleImportExcel(e, deptView.cfg.dept)}
              />
              <button
                type="button"
                onClick={handleExportDeptExcel}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" /> Xuất Excel {deptView.cfg.dept}
              </button>
            </div>

            {importMsg && (
              <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800">
                {importMsg}
              </div>
            )}

            {showAddEmp && (
              <div className="grid gap-2 rounded-lg border border-blue-200 bg-blue-50/50 p-3 sm:grid-cols-4 lg:grid-cols-8">
                <input
                  placeholder="MSNV *"
                  value={newEmp.msnv}
                  onChange={(e) => setNewEmp({ ...newEmp, msnv: e.target.value })}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                />
                <input
                  placeholder="Họ và tên *"
                  value={newEmp.fullName}
                  onChange={(e) => setNewEmp({ ...newEmp, fullName: e.target.value })}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs sm:col-span-2"
                />
                <input
                  placeholder="Chức vụ"
                  value={newEmp.position}
                  onChange={(e) => setNewEmp({ ...newEmp, position: e.target.value })}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                />
                <input
                  placeholder="Tổ / Công đoạn"
                  value={newEmp.group}
                  onChange={(e) => setNewEmp({ ...newEmp, group: e.target.value })}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                />
                <input
                  type="number"
                  step="0.05"
                  placeholder="HS Lương"
                  value={newEmp.hsLuong}
                  onChange={(e) => setNewEmp({ ...newEmp, hsLuong: Number(e.target.value) || 0 })}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                />
                <input
                  type="number"
                  step="0.5"
                  placeholder="Công SP"
                  value={newEmp.congSP}
                  onChange={(e) => setNewEmp({ ...newEmp, congSP: Number(e.target.value) || 0 })}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={() => handleAddEmployee(deptView.cfg.dept)}
                  className="rounded bg-blue-700 px-3 py-1 text-xs font-bold text-white hover:bg-blue-800"
                >
                  Lưu NV mới
                </button>
              </div>
            )}
          </div>

          {/* Employee Payroll Table */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="p-2 font-semibold">STT</th>
                    <th className="p-2 font-semibold">MSNV</th>
                    <th className="p-2 font-semibold">Họ và tên</th>
                    <th className="p-2 font-semibold">Chức vụ</th>
                    <th className="p-2 font-semibold">Tổ / Công đoạn</th>
                    <th className="p-2 text-right font-semibold">HS Lương</th>
                    <th className="p-2 text-right font-semibold">HS TN</th>
                    <th className="p-2 text-right font-semibold">HS ĐH</th>
                    <th className="p-2 text-right font-semibold">HS Tổng</th>
                    <th className="p-2 text-right font-semibold">Công SP</th>
                    <th className="p-2 text-right font-semibold">HS Công SP</th>
                    <th className="p-2 text-right font-semibold">Lương SP</th>
                    <th className="p-2 text-right font-semibold">Thưởng SL+CL</th>
                    <th className="p-2 text-right font-semibold">Tăng ca</th>
                    <th className="p-2 text-right font-semibold">Tổng Thực Lãnh</th>
                    <th className="p-2 text-center font-semibold">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deptView.filtered.map((emp, idx) => {
                    const hsTong = emp.hsLuong + emp.hsTN + emp.hsDH;
                    return (
                      <tr key={`${emp.dept}-${emp.msnv}-${idx}`} className="hover:bg-slate-50">
                        <td className="p-2 text-slate-500">{emp.stt}</td>
                        <td className="p-2 font-mono font-semibold text-slate-700">{emp.msnv}</td>
                        <td className="p-2 font-semibold text-slate-900">{emp.fullName}</td>
                        <td className="p-2 text-slate-600">{emp.position}</td>
                        <td className="p-2 text-slate-500">{emp.group}</td>
                        <td className="p-2 text-right font-mono">{emp.hsLuong.toFixed(2)}</td>
                        <td className="p-2 text-right font-mono">{emp.hsTN.toFixed(2)}</td>
                        <td className="p-2 text-right font-mono">{emp.hsDH.toFixed(2)}</td>
                        <td className="p-2 text-right font-mono font-semibold text-slate-800">
                          {hsTong.toFixed(2)}
                        </td>
                        <td className="p-1.5 text-right font-mono">
                          <input
                            type="number"
                            step="0.25"
                            min={0}
                            value={emp.congSP}
                            onChange={(e) =>
                              updateEmployeeCong(emp.dept, emp.msnv, Number(e.target.value) || 0)
                            }
                            className="w-16 rounded border border-slate-300 px-1.5 py-0.5 text-right font-mono text-xs focus:border-blue-500 focus:outline-none"
                          />
                        </td>
                        <td className="p-2 text-right font-mono font-semibold text-blue-700">
                          {emp.hsCongSP.toFixed(4)}
                        </td>
                        <td className="p-2 text-right font-mono">{formatVND(emp.liveLuongSP)}</td>
                        <td className="p-2 text-right font-mono text-emerald-700">
                          {emp.isBonusZero ? (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                              0 đ (Thử việc/Kỷ luật)
                            </span>
                          ) : (
                            formatVND(emp.liveThuong)
                          )}
                        </td>
                        <td className="p-2 text-right font-mono text-indigo-700">
                          {emp.overtimePay > 0 ? formatVND(emp.overtimePay) : '—'}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900">
                          {formatVND(emp.liveTotalPay)}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteEmployee(emp.dept, emp.msnv, emp.fullName)}
                            title="Xóa nhân viên"
                            className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold text-slate-900">
                    <td colSpan={8} className="p-2.5 text-right uppercase">
                      Tổng cộng ({deptView.filtered.length} CBCNV):
                    </td>
                    <td className="p-2.5 text-right font-mono">{deptView.totals.hsTong.toFixed(2)}</td>
                    <td className="p-2.5 text-right font-mono">{deptView.totals.congSP.toFixed(2)}</td>
                    <td className="p-2.5 text-right font-mono text-blue-800">
                      {deptView.totals.hsCongSP.toFixed(4)}
                    </td>
                    <td className="p-2.5 text-right font-mono">{formatVND(deptView.totals.luongSP)}</td>
                    <td className="p-2.5 text-right font-mono text-emerald-800">
                      {formatVND(deptView.totals.thuong)}
                    </td>
                    <td className="p-2.5 text-right font-mono text-indigo-800">
                      {formatVND(deptView.totals.overtimePay)}
                    </td>
                    <td className="p-2.5 text-right font-mono text-blue-900">
                      {formatVND(deptView.totals.totalPay)} đ
                    </td>
                    <td className="p-2.5"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>

      {/* Summary 3 Blocks */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase">1. Dây chuyền 1 (DC1)</div>
          <div className="mt-1 text-xl font-extrabold text-blue-700">{formatVND(calc.dc1Net)} đ</div>
          <div className="mt-2 space-y-0.5 text-xs text-slate-600">
            <div>Lương khoán: <strong>{formatVND(calc.dc1Khoan)} đ</strong></div>
            <div>Thưởng SL+CL: <strong className="text-emerald-700">+{formatVND(calc.dc1Thuong)} đ</strong></div>
            <div>Trừ khiếu nại: <strong className="text-rose-600">-{formatVND(knDc1)} đ</strong></div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase">2. Dây chuyền 2 (DC2)</div>
          <div className="mt-1 text-xl font-extrabold text-indigo-700">{formatVND(calc.dc2Net)} đ</div>
          <div className="mt-2 space-y-0.5 text-xs text-slate-600">
            <div>Lương khoán: <strong>{formatVND(calc.dc2Khoan)} đ</strong></div>
            <div>Thưởng SL+CL: <strong className="text-emerald-700">+{formatVND(calc.dc2Thuong)} đ</strong></div>
            <div>Trừ khiếu nại: <strong className="text-rose-600">-{formatVND(knDc2)} đ</strong></div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase">3. Tạo bột - Tạo men (TBTM)</div>
          <div className="mt-1 text-xl font-extrabold text-emerald-700">{formatVND(calc.tbtmNet)} đ</div>
          <div className="mt-2 space-y-0.5 text-xs text-slate-600">
            <div>Lương khoán: <strong>{formatVND(calc.tbtmKhoan)} đ</strong></div>
            <div>Thưởng SL+CL: <strong className="text-emerald-700">+{formatVND(calc.tbtmThuong)} đ</strong></div>
            <div>Trừ khiếu nại: <strong className="text-rose-600">-{formatVND(knTbtm)} đ</strong></div>
          </div>
        </div>
      </div>

      {/* Input Production Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Calculator className="h-4 w-4 text-blue-600" />
            Nhập Sản lượng &amp; Đơn giá Khoán từng Chủng loại (Tháng 10/2026)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="p-2.5 font-semibold">Dây chuyền / Sản phẩm</th>
                <th className="p-2.5 font-semibold">Thời gian</th>
                <th className="p-2.5 text-right font-semibold">Sản lượng tính lương (m²)</th>
                <th className="p-2.5 text-right font-semibold">ĐG PXSX (đ/m²)</th>
                <th className="p-2.5 text-right font-semibold">ĐG TBTM (đ/m²)</th>
                <th className="p-2.5 text-center font-semibold">Thưởng SL (%)</th>
                <th className="p-2.5 text-center font-semibold">Thưởng CL (%)</th>
                <th className="p-2.5 text-right font-semibold">Thành tiền PXSX</th>
                <th className="p-2.5 text-right font-semibold">Thành tiền TBTM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {calc.details.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="p-2.5 font-semibold text-slate-800">{row.label}</td>
                  <td className="p-2.5 text-slate-500">{row.periodText}</td>
                  <td className="p-2.5 text-right">
                    <input
                      type="number"
                      step="0.01"
                      value={row.qtyM2}
                      onChange={(e) => updateItem(row.id, { qtyM2: Number(e.target.value) || 0 })}
                      className="w-28 rounded border border-slate-300 px-2 py-1 text-right font-mono text-xs"
                    />
                  </td>
                  <td className="p-2.5 text-right">
                    <input
                      type="number"
                      value={row.pxsxUnitPrice}
                      onChange={(e) =>
                        updateItem(row.id, { pxsxUnitPrice: Number(e.target.value) || 0 })
                      }
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-right font-mono text-xs"
                    />
                  </td>
                  <td className="p-2.5 text-right">
                    <input
                      type="number"
                      value={row.tbtmUnitPrice}
                      onChange={(e) =>
                        updateItem(row.id, { tbtmUnitPrice: Number(e.target.value) || 0 })
                      }
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-right font-mono text-xs"
                    />
                  </td>
                  <td className="p-2.5 text-center">
                    <input
                      type="number"
                      disabled={row.noBonus}
                      value={row.bonusSlPct}
                      onChange={(e) =>
                        updateItem(row.id, { bonusSlPct: Number(e.target.value) || 0 })
                      }
                      className="w-14 rounded border border-slate-300 px-1.5 py-1 text-center font-mono text-xs disabled:bg-slate-100"
                    />
                  </td>
                  <td className="p-2.5 text-center">
                    <input
                      type="number"
                      disabled={row.noBonus}
                      value={row.bonusClPct}
                      onChange={(e) =>
                        updateItem(row.id, { bonusClPct: Number(e.target.value) || 0 })
                      }
                      className="w-14 rounded border border-slate-300 px-1.5 py-1 text-center font-mono text-xs disabled:bg-slate-100"
                    />
                  </td>
                  <td className="p-2.5 text-right font-semibold text-blue-700">
                    {formatVND(row.pxsxTotal)} đ
                  </td>
                  <td className="p-2.5 text-right font-semibold text-emerald-700">
                    {formatVND(row.tbtmTotal)} đ
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Deductions */}
        <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600">
              Tiền khiếu nại DC1 (đ)
            </label>
            <input
              type="number"
              value={knDc1}
              onChange={(e) => setKnDc1(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-rose-700"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600">
              Tiền khiếu nại DC2 (đ)
            </label>
            <input
              type="number"
              value={knDc2}
              onChange={(e) => setKnDc2(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-rose-700"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600">
              Tiền khiếu nại TBTM (đ)
            </label>
            <input
              type="number"
              value={knTbtm}
              onChange={(e) => setKnTbtm(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-rose-700"
            />
          </div>
        </div>
      </div>

      {/* Tổ đội & Định biên nhân lực */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase">
            <Layers className="h-4 w-4 text-blue-600" />
            Cơ cấu Tổ DC1 ({pxsxDc1Quota.totalHeadcount} NL | {pxsxDc1Quota.totalCoeff} HS)
          </h4>
          <ul className="space-y-1.5 text-xs text-slate-600">
            {pxsxDc1Quota.subGroups.map((g) => (
              <li key={g.groupName} className="flex justify-between border-b border-slate-100 pb-1">
                <span>{g.groupName} ({g.headcount})</span>
                <span className="font-mono font-semibold">{g.coeff.toFixed(2)} HS</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase">
            <Layers className="h-4 w-4 text-indigo-600" />
            Cơ cấu Tổ DC2 ({pxsxDc2Quota.totalHeadcount} NL | {pxsxDc2Quota.totalCoeff} HS)
          </h4>
          <ul className="space-y-1.5 text-xs text-slate-600">
            {pxsxDc2Quota.subGroups.map((g) => (
              <li key={g.groupName} className="flex justify-between border-b border-slate-100 pb-1">
                <span>{g.groupName} ({g.headcount})</span>
                <span className="font-mono font-semibold">{g.coeff.toFixed(2)} HS</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase">
            <Users className="h-4 w-4 text-emerald-600" />
            Cơ cấu Tổ TBTM ({tbtmQuota.totalHeadcount} NL | {tbtmQuota.totalCoeff} HS)
          </h4>
          <ul className="space-y-1.5 text-xs text-slate-600">
            {tbtmQuota.subGroups.map((g) => (
              <li key={g.groupName} className="flex justify-between border-b border-slate-100 pb-1">
                <span>{g.groupName} ({g.headcount})</span>
                <span className="font-mono font-semibold">{g.coeff.toFixed(2)} HS</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Status Box nhân sự đã nạp */}
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        <div>
          <strong>Đã nạp đủ Bảng Chia Lương PXSX Tháng 10/2026 ({PXSX_EMPLOYEES_OCT_2026.length} CBCNV):</strong> Chọn các tab phía trên (<strong>TBTM</strong>, <strong>DC1</strong>, <strong>DC2</strong>) để xem chi tiết từng MSNV, hệ số công sản phẩm (26 công cho TBTM; 26.5 công cho DC1 &amp; DC2), tỷ lệ chi thưởng (50% / 80%), tăng ca và thực lãnh.
        </div>
      </div>
        </>
      )}
      </div>

      {/* Bản in chuẩn NĐ 30/2020/NĐ-CP & TCVN cho PXSX */}
      <div className="hidden print:block">
        {deptView ? (
          <PrintPreviewDept
            departmentTitle={`PHÂN XƯỞNG SẢN XUẤT – BỘ PHẬN ${subView}`}
            docCode={`....../BTTL-PXSX-${subView}`}
            reportTitle={`BẢNG THANH TOÁN TIỀN LƯƠNG BỘ PHẬN ${subView}`}
            periodLabel={`${periodLabel} (${deptView.cfg.standardDays} công chuẩn | Chi ${deptView.bonusSharePct}% thưởng)`}
            summaryLeft={[
              { label: 'Tổng quỹ lương sản phẩm', value: `${formatVND(deptView.liveFundLuong)} đ` },
              { label: `Chi thưởng SL+CL (${deptView.bonusSharePct}%)`, value: `${formatVND(deptView.liveThuongChi)} đ` },
              { label: 'Quỹ dự phòng giữ lại', value: `${formatVND(deptView.liveDuPhong)} đ` },
            ]}
            summaryRight={[
              { label: 'Tổng tăng ca duyệt chi', value: `${formatVND(deptView.totalOvertimePay)} đ` },
              { label: 'Tổng chi lương + thưởng + tăng ca', value: `${formatVND(deptView.totals.totalPay)} đ` },
              { label: 'Đơn giá Hệ số 1 (có thưởng)', value: `${formatVND(deptView.hs1WithBonus)} đ` },
            ]}
            employees={deptView.filtered.map((r, idx) => ({
              stt: idx + 1,
              msnv: r.msnv,
              fullName: r.fullName,
              position: r.position,
              team: r.group,
              hsLuong: r.hsLuong,
              hsTN: r.hsTN,
              hsBH: r.hsDH,
              hsTong: r.hsLuong + r.hsTN + r.hsDH,
              workDays: r.congSP,
              hsCongSP: r.hsCongSP,
              luongSP: r.liveLuongSP,
              thuong: r.liveThuong,
              tangCa: r.overtimePay,
              tongLuong: r.liveTotalPay,
            }))}
            deptHeadLabel="QUẢN ĐỐC PXSX"
          />
        ) : (
          <PrintPreviewDept
            departmentTitle="PHÂN XƯỞNG SẢN XUẤT (PXSX): DC1 – DC2 – TBTM"
            docCode="....../BTTL-PXSX"
            reportTitle="BẢNG TỔNG HỢP QUỸ LƯƠNG PHÂN XƯỞNG SẢN XUẤT"
            periodLabel={periodLabel}
            summaryLeft={[
              { label: '1. Quỹ lương Khoán + Thưởng DC1', value: `${formatVND(calc.dc1Net)} đ` },
              { label: '2. Quỹ lương Khoán + Thưởng DC2', value: `${formatVND(calc.dc2Net)} đ` },
              { label: '3. Quỹ lương Khoán + Thưởng TBTM', value: `${formatVND(calc.tbtmNet)} đ` },
            ]}
            summaryRight={[
              { label: 'Tổng trừ khiếu nại (DC1+DC2+TBTM)', value: `-${formatVND(knDc1 + knDc2 + knTbtm)} đ` },
              { label: 'Tổng chi Lương + Thưởng PXSX', value: `${formatVND(calc.grandTotal)} đ` },
              { label: 'Tổng định biên PXSX', value: `${PXSX_EMPLOYEES_OCT_2026.length} CBCNV` },
            ]}
            groupRows={[
              {
                stt: 1,
                groupName: 'Dây chuyền 1 (DC1 - 26.5 công chuẩn)',
                headcount: pxsxDc1Quota.totalHeadcount,
                coeff: pxsxDc1Quota.totalCoeff,
                standardFund: calc.dc1Khoan,
                allocatedFund: calc.dc1Net,
              },
              {
                stt: 2,
                groupName: 'Dây chuyền 2 (DC2 - 26.5 công chuẩn)',
                headcount: pxsxDc2Quota.totalHeadcount,
                coeff: pxsxDc2Quota.totalCoeff,
                standardFund: calc.dc2Khoan,
                allocatedFund: calc.dc2Net,
              },
              {
                stt: 3,
                groupName: 'Bộ phận Tạo Bột - Tạo Men (TBTM - 26 công chuẩn)',
                headcount: tbtmQuota.totalHeadcount,
                coeff: tbtmQuota.totalCoeff,
                standardFund: calc.tbtmKhoan,
                allocatedFund: calc.tbtmNet,
              },
            ]}
            deptHeadLabel="QUẢN ĐỐC PXSX"
          />
        )}
      </div>
    </>
  );
};
