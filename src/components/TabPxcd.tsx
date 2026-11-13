import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Download,
  Plus,
  Trash2,
  Upload,
  Users,
  Wrench,
} from 'lucide-react';
import { MASTER_TARIFFS_2026 } from '../data/masterTariffs2026';
import { formatDecimal, formatVND } from '../utils/payrollCalc';
import { DEFAULT_OCT_2026_INPUTS, type LineProductInput } from './TabPxsx';
import { PrintPreviewDept } from './PrintPreviewDept';

export interface PxcdEmployeeRow {
  id: string;
  msnv: string;
  fullName: string;
  team: string;
  coeff: number;
  workDays: number;
}

export const TabPxcd: React.FC<{
  periodLabel: string;
  sharedItems?: LineProductInput[];
  onChangeSharedItems?: React.Dispatch<React.SetStateAction<LineProductInput[]>>;
}> = ({ periodLabel, sharedItems, onChangeSharedItems }) => {
  const [subTab, setSubTab] = useState<'overview' | 'details'>('overview');
  const [localItems, setLocalItems] = useState<LineProductInput[]>(DEFAULT_OCT_2026_INPUTS);
  const items = sharedItems ?? localItems;
  const setItems = onChangeSharedItems ?? setLocalItems;

  const [bonusPayoutPct, setBonusPayoutPct] = useState<number>(100);
  const [khieuNai, setKhieuNai] = useState<number>(0);

  // Danh sách nhân viên PXCĐ-NL (Upload Excel/CSV hoặc Thêm trực tiếp)
  const [employees, setEmployees] = useState<PxcdEmployeeRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const pxcdMaster = MASTER_TARIFFS_2026.PXCD;
  const q3060 = pxcdMaster.quotas['30x60'];

  const handleUpdateItem = (id: string, field: 'qtyM2' | 'bonusSlPct' | 'bonusClPct', value: number) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)),
    );
  };

  const calc = useMemo(() => {
    const rows = items.map((it) => {
      const unitPrice = pxcdMaster.quotas[it.productCode].unitPriceVND;
      const baseAmount = it.qtyM2 * unitPrice;
      const bonusPct = it.noBonus ? 0 : (it.bonusSlPct + it.bonusClPct) / 100;
      const bonusAmount = baseAmount * bonusPct;
      return { ...it, unitPrice, baseAmount, bonusAmount };
    });

    const baseFund = rows.reduce((s, r) => s + r.baseAmount, 0);
    const grossBonus = rows.reduce((s, r) => s + r.bonusAmount, 0);
    const bonusPaid = grossBonus * (bonusPayoutPct / 100);
    const bonusRetained = grossBonus - bonusPaid;
    const netFund = Math.max(0, baseFund + bonusPaid - khieuNai);
    const hs1 = netFund / q3060.totalCoeff;

    const dc1Base = rows.filter((r) => r.line === 'DC1').reduce((s, r) => s + r.baseAmount, 0);
    const dc2Base = rows.filter((r) => r.line === 'DC2').reduce((s, r) => s + r.baseAmount, 0);

    const groupAllocation = q3060.subGroups.map((g) => ({
      ...g,
      allocatedFund: (g.coeff / q3060.totalCoeff) * netFund,
    }));

    return {
      rows,
      baseFund,
      dc1Base,
      dc2Base,
      grossBonus,
      bonusPaid,
      bonusRetained,
      netFund,
      hs1,
      groupAllocation,
    };
  }, [items, bonusPayoutPct, khieuNai, pxcdMaster, q3060]);

  // Tính lương chi tiết cho danh sách nhân viên đã Upload / Thêm mới (theo chuẩn 26 công)
  const employeeCalc = useMemo(() => {
    const withHs = employees.map((emp) => {
      const hsNgayCong = emp.coeff * (emp.workDays / 26);
      return { ...emp, hsNgayCong };
    });
    const totalHsNgayCong = withHs.reduce((s, e) => s + e.hsNgayCong, 0);
    const unitHs = totalHsNgayCong > 0 ? calc.netFund / totalHsNgayCong : 0;

    const computed = withHs.map((e) => ({
      ...e,
      totalSalary: e.hsNgayCong * unitHs,
    }));

    return { computed, totalHsNgayCong, unitHs };
  }, [employees, calc.netFund]);

  const filteredEmployees = useMemo(() => {
    if (!searchTerm.trim()) return employeeCalc.computed;
    const q = searchTerm.toLowerCase();
    return employeeCalc.computed.filter(
      (e) =>
        e.msnv.toLowerCase().includes(q) ||
        e.fullName.toLowerCase().includes(q) ||
        e.team.toLowerCase().includes(q),
    );
  }, [employeeCalc.computed, searchTerm]);

  const handleAddEmployee = () => {
    setEmployees((prev) => [
      ...prev,
      {
        id: `pxcd_emp_${Date.now()}`,
        msnv: '',
        fullName: 'Nhân viên mới',
        team: 'Trực ca',
        coeff: 1.5,
        workDays: 26,
      },
    ]);
    setSubTab('details');
  };

  const handleUpdateEmp = (id: string, field: keyof PxcdEmployeeRow, value: string | number) => {
    setEmployees((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
    );
  };

  const handleDeleteEmp = (id: string) => {
    setEmployees((prev) => prev.filter((e) => e.id !== id));
  };

  const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

      const parsed: PxcdEmployeeRow[] = [];
      rows.forEach((row, idx) => {
        const keys = Object.keys(row);
        const findVal = (patterns: string[]) => {
          const k = keys.find((key) =>
            patterns.some((p) => key.toLowerCase().includes(p)),
          );
          return k ? row[k] : '';
        };
        const msnv = String(findVal(['msnv', 'mã nv', 'ma nv', 'mã số']) || '').trim();
        const fullName = String(findVal(['họ tên', 'ho ten', 'tên', 'ten', 'name']) || '').trim();
        const team = String(findVal(['tổ', 'to', 'bộ phận', 'bo phan', 'team']) || 'Trực ca').trim();
        const coeff = Number(findVal(['hệ số', 'he so', 'hs', 'coeff']) || 1.5) || 1.5;
        const workDays = Number(findVal(['ngày công', 'ngay cong', 'công', 'cong', 'days']) || 26) || 26;

        if (msnv || fullName) {
          parsed.push({
            id: `pxcd_up_${Date.now()}_${idx}`,
            msnv: msnv || `CD${idx + 1}`,
            fullName: fullName || `Nhân viên ${idx + 1}`,
            team,
            coeff,
            workDays,
          });
        }
      });

      if (parsed.length > 0) {
        setEmployees(parsed);
        setUploadStatus(`Đã nạp ${parsed.length} nhân sự PXCĐ-NL từ file "${file.name}".`);
        setSubTab('details');
      } else {
        setUploadStatus('Không tìm thấy cột MSNV / Họ tên hợp lệ trong file.');
      }
    } catch {
      setUploadStatus('Lỗi đọc file Excel/CSV. Vui lòng kiểm tra định dạng.');
    }
    e.target.value = '';
  };

  const handleExportExcel = () => {
    const dataToExport =
      employeeCalc.computed.length > 0
        ? employeeCalc.computed.map((e, idx) => ({
            STT: idx + 1,
            MSNV: e.msnv,
            'Họ và tên': e.fullName,
            'Tổ / Bộ phận': e.team,
            'Hệ số lương': e.coeff,
            'Ngày công': e.workDays,
            'HS ngày công': Number(e.hsNgayCong.toFixed(4)),
            'Tổng lương + thưởng (đ)': Math.round(e.totalSalary),
          }))
        : calc.groupAllocation.map((g, idx) => ({
            STT: idx + 1,
            'Bộ phận / Tổ': g.groupName,
            'Định biên NL': g.headcount,
            'Hệ số khoán': g.coeff,
            'Quỹ phân bổ (đ)': Math.round(g.allocatedFund),
          }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PXCD_NL');
    XLSX.writeFile(wb, `Bang_Luong_PXCD_NL_${periodLabel.replace(/\s+/g, '_')}.xlsx`);
  };

  return (
    <>
      <div className="no-print space-y-6">
      {/* Header Banner — đồng bộ giao diện với PXSX & P.KTCN */}
      <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-900 to-slate-900 p-5 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-amber-400" />
              <h2 className="text-lg font-bold">
                Phân xưởng Cơ điện - Năng lượng (PXCĐ-NL) – {periodLabel}
              </h2>
            </div>
            <p className="mt-1 text-xs text-blue-200">
              Định biên: <strong>{q3060.totalHeadcount} nhân sự</strong> | Tổng Hệ số:{' '}
              <strong>{q3060.totalCoeff.toFixed(2)} HS</strong> | Cơ cấu 7 tổ chuyên môn theo QĐ 01/KSX-2026/PNC-QĐ
            </p>
          </div>
          <div className="rounded-lg bg-white/10 px-4 py-2 text-right backdrop-blur-sm">
            <div className="text-[11px] uppercase tracking-wider text-blue-200">
              Tổng lương + thưởng PXCĐ-NL
            </div>
            <div className="text-xl font-extrabold text-amber-300">
              {formatVND(calc.netFund)} đ
            </div>
          </div>
        </div>
      </div>

      {/* Sub-navigation pills — đồng bộ PXSX */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'overview' as const, label: 'Tổng hợp Quỹ PXCĐ-NL' },
            {
              id: 'details' as const,
              label: `Chi tiết 7 Tổ & Nhân sự PXCĐ-NL (${employees.length > 0 ? `${employees.length} NV` : '26 công'})`,
            },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                subTab === t.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleExportExcel}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
        >
          <Download className="h-3.5 w-3.5" />
          Xuất Excel PXCĐ-NL
        </button>
      </div>

      {/* 3 Cards Tổng hợp Quỹ PXCĐ-NL */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-500">
            1. Quỹ lương Khoán (DC1 + DC2)
          </div>
          <div className="mt-1 text-2xl font-extrabold text-blue-700">
            {formatVND(calc.baseFund)} đ
          </div>
          <div className="mt-2 space-y-0.5 text-xs text-slate-600">
            <div>Dây chuyền 1 (30x60): {formatVND(calc.dc1Base)} đ</div>
            <div>Dây chuyền 2 (40x80, 50x50, 60x60): {formatVND(calc.dc2Base)} đ</div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-500">
            2. Thưởng SL + CL ({bonusPayoutPct}% chi tháng)
          </div>
          <div className="mt-1 text-2xl font-extrabold text-emerald-700">
            {formatVND(calc.bonusPaid)} đ
          </div>
          <div className="mt-2 space-y-0.5 text-xs text-slate-600">
            <div>Thưởng gộp (100%): {formatVND(calc.grossBonus)} đ</div>
            <div className="text-amber-700">Giữ lại dự phòng: {formatVND(calc.bonusRetained)} đ</div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-500">
            3. Trừ Khiếu nại &amp; Lương HS 1
          </div>
          <div className="mt-1 text-2xl font-extrabold text-slate-900">
            {formatVND(calc.netFund)} đ
          </div>
          <div className="mt-2 space-y-0.5 text-xs text-slate-600">
            <div className="text-rose-600">Trừ khiếu nại: -{formatVND(khieuNai)} đ</div>
            <div>
              Lương Hệ số 1 ({q3060.totalCoeff.toFixed(2)} HS):{' '}
              <strong className="text-blue-700">{formatVND(calc.hs1)} đ</strong>
            </div>
          </div>
        </div>
      </div>

      {subTab === 'overview' && (
        <>
          {/* Bảng Nhập Sản lượng & Đơn giá Khoán từng Chủng loại — đồng bộ 7 dòng như PXSX */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-800">
                Nhập Sản lượng &amp; Đơn giá Khoán PXCĐ-NL từng Chủng loại ({periodLabel})
              </h3>
              <span className="text-xs text-slate-500">
                Sản lượng m² &amp; % Thưởng đồng bộ trực tiếp với PXSX
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="p-2 font-semibold">Dây chuyền / Sản phẩm</th>
                    <th className="p-2 font-semibold">Thời gian</th>
                    <th className="p-2 text-right font-semibold">Sản lượng tính lương (m²)</th>
                    <th className="p-2 text-right font-semibold">ĐG PXCĐ (đ/m²)</th>
                    <th className="p-2 text-right font-semibold">Thưởng SL (%)</th>
                    <th className="p-2 text-right font-semibold">Thưởng CL (%)</th>
                    <th className="p-2 text-right font-semibold">Thành tiền Khoán (đ)</th>
                    <th className="p-2 text-right font-semibold">Thưởng gộp (đ)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {calc.rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="p-2 font-semibold text-slate-800">{r.label}</td>
                      <td className="p-2 text-slate-500">{r.periodText}</td>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          value={r.qtyM2}
                          onChange={(e) =>
                            handleUpdateItem(r.id, 'qtyM2', Number(e.target.value) || 0)
                          }
                          className="w-28 rounded border border-slate-300 px-2 py-1 text-right font-mono"
                        />
                      </td>
                      <td className="p-2 text-right font-mono text-slate-700">{r.unitPrice}</td>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          step="0.5"
                          disabled={r.noBonus}
                          value={r.bonusSlPct}
                          onChange={(e) =>
                            handleUpdateItem(r.id, 'bonusSlPct', Number(e.target.value) || 0)
                          }
                          className="w-16 rounded border border-slate-300 px-2 py-1 text-right font-mono disabled:bg-slate-100"
                        />
                      </td>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          step="0.5"
                          disabled={r.noBonus}
                          value={r.bonusClPct}
                          onChange={(e) =>
                            handleUpdateItem(r.id, 'bonusClPct', Number(e.target.value) || 0)
                          }
                          className="w-16 rounded border border-slate-300 px-2 py-1 text-right font-mono disabled:bg-slate-100"
                        />
                      </td>
                      <td className="p-2 text-right font-semibold text-blue-700">
                        {formatVND(r.baseAmount)} đ
                      </td>
                      <td className="p-2 text-right font-semibold text-emerald-700">
                        {formatVND(r.bonusAmount)} đ
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-rose-700">
                  Tiền khiếu nại / Giảm trừ PXCĐ-NL (đ)
                </label>
                <input
                  type="number"
                  value={khieuNai}
                  onChange={(e) => setKhieuNai(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-mono text-rose-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Tỷ lệ chi thưởng trong tháng (%)
                </label>
                <input
                  type="number"
                  value={bonusPayoutPct}
                  onChange={(e) => setBonusPayoutPct(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-mono"
                />
              </div>
            </div>
          </div>

          {/* Cơ cấu 7 Tổ chuyên môn (thẻ tóm tắt — đồng bộ với 3 thẻ Cơ cấu tổ của PXSX) */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h4 className="mb-3 text-xs font-bold uppercase text-slate-700">
              Cơ cấu phân bổ Quỹ cho 7 Tổ chuyên môn ({q3060.totalHeadcount} NL | {q3060.totalCoeff.toFixed(2)} HS)
            </h4>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {calc.groupAllocation.map((g, idx) => (
                <div
                  key={g.groupName}
                  className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 text-xs"
                >
                  <div className="font-bold text-slate-800">
                    {idx + 1}. {g.groupName}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-slate-500">
                    <span>{g.headcount} NL</span>
                    <span className="font-mono">{g.coeff.toFixed(2)} HS</span>
                  </div>
                  <div className="mt-1.5 text-sm font-bold text-blue-700">
                    {formatVND(g.allocatedFund)} đ
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {subTab === 'details' && (
        <div className="space-y-6">
          {/* Bảng phân bổ 7 tổ */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-slate-800">
              Bảng Phân bổ Quỹ lương theo 7 Tổ chuyên môn (Tổng {q3060.totalHeadcount} NL | {q3060.totalCoeff.toFixed(2)} HS)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="p-2.5 font-semibold">STT</th>
                    <th className="p-2.5 font-semibold">Bộ phận / Tổ</th>
                    <th className="p-2.5 text-center font-semibold">Định biên NL</th>
                    <th className="p-2.5 text-right font-semibold">Hệ số khoán</th>
                    <th className="p-2.5 text-right font-semibold">Quỹ định mức chuẩn (đ)</th>
                    <th className="p-2.5 text-right font-semibold">Quỹ phân bổ thực tế (đ)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {calc.groupAllocation.map((g, idx) => (
                    <tr key={g.groupName} className="hover:bg-slate-50">
                      <td className="p-2.5">{idx + 1}</td>
                      <td className="p-2.5 font-semibold text-slate-800">{g.groupName}</td>
                      <td className="p-2.5 text-center">{g.headcount}</td>
                      <td className="p-2.5 text-right font-mono">{g.coeff.toFixed(2)}</td>
                      <td className="p-2.5 text-right text-slate-500">{formatVND(g.fundVND)} đ</td>
                      <td className="p-2.5 text-right font-bold text-blue-700">
                        {formatVND(g.allocatedFund)} đ
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-bold text-slate-900">
                    <td colSpan={2} className="p-2.5">Tổng cộng PXCĐ-NL</td>
                    <td className="p-2.5 text-center">{q3060.totalHeadcount}</td>
                    <td className="p-2.5 text-right font-mono">{q3060.totalCoeff.toFixed(2)}</td>
                    <td className="p-2.5 text-right">{formatVND(q3060.totalFundVND)} đ</td>
                    <td className="p-2.5 text-right text-blue-800">{formatVND(calc.netFund)} đ</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Bảng Chia lương chi tiết từng MSNV PXCĐ-NL */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <Users className="h-4 w-4 text-blue-600" />
                  Bảng Chia lương chi tiết từng MSNV PXCĐ-NL (Chuẩn 26 công)
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {employees.length > 0
                    ? `Đang tính trên ${employees.length} nhân sự | Tổng HS ngày công: ${formatDecimal(employeeCalc.totalHsNgayCong, 2)} | Đơn giá 1 HS-công: ${formatVND(employeeCalc.unitHs)} đ`
                    : 'Upload file Excel/CSV danh sách MSNV hoặc bấm "+ Thêm nhân viên" để chia quỹ lương đến từng người.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Tìm MSNV / Họ tên / Tổ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                  <Upload className="h-3.5 w-3.5" />
                  Upload Excel/CSV MSNV
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={handleUploadExcel}
                  />
                </label>
                <button
                  type="button"
                  onClick={handleAddEmployee}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                >
                  <Plus className="h-3.5 w-3.5" /> Thêm nhân viên
                </button>
              </div>
            </div>

            {uploadStatus && (
              <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                {uploadStatus}
              </div>
            )}

            {employees.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-600">
                Chưa có danh sách MSNV PXCĐ-NL. Bấm <strong>Upload Excel/CSV MSNV</strong> (gồm các cột: MSNV, Họ tên, Tổ, Hệ số, Ngày công) hoặc <strong>+ Thêm nhân viên</strong> để app tự động chia Quỹ {formatVND(calc.netFund)} đ đến từng người.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                      <th className="p-2 font-semibold">STT</th>
                      <th className="p-2 font-semibold">MSNV</th>
                      <th className="p-2 font-semibold">Họ và tên</th>
                      <th className="p-2 font-semibold">Tổ / Bộ phận</th>
                      <th className="p-2 text-right font-semibold">Hệ số</th>
                      <th className="p-2 text-right font-semibold">Ngày công</th>
                      <th className="p-2 text-right font-semibold">HS ngày công</th>
                      <th className="p-2 text-right font-semibold">Tổng lương thực nhận (đ)</th>
                      <th className="p-2 text-center font-semibold">Xóa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEmployees.map((emp, idx) => (
                      <tr key={emp.id} className="hover:bg-slate-50">
                        <td className="p-2">{idx + 1}</td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={emp.msnv}
                            onChange={(e) => handleUpdateEmp(emp.id, 'msnv', e.target.value)}
                            className="w-20 rounded border border-slate-200 px-1.5 py-1 font-mono"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={emp.fullName}
                            onChange={(e) => handleUpdateEmp(emp.id, 'fullName', e.target.value)}
                            className="w-40 rounded border border-slate-200 px-1.5 py-1"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={emp.team}
                            onChange={(e) => handleUpdateEmp(emp.id, 'team', e.target.value)}
                            className="w-36 rounded border border-slate-200 px-1.5 py-1"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={emp.coeff}
                            onChange={(e) =>
                              handleUpdateEmp(emp.id, 'coeff', Number(e.target.value) || 0)
                            }
                            className="w-16 rounded border border-slate-200 px-1.5 py-1 text-right font-mono"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            step="0.5"
                            value={emp.workDays}
                            onChange={(e) =>
                              handleUpdateEmp(emp.id, 'workDays', Number(e.target.value) || 0)
                            }
                            className="w-16 rounded border border-slate-200 px-1.5 py-1 text-right font-mono"
                          />
                        </td>
                        <td className="p-2 text-right font-mono text-slate-600">
                          {formatDecimal(emp.hsNgayCong, 3)}
                        </td>
                        <td className="p-2 text-right font-bold text-blue-700">
                          {formatVND(emp.totalSalary)} đ
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteEmp(emp.id)}
                            className="rounded p-1 text-rose-500 hover:bg-rose-50"
                            title="Xóa nhân viên"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      </div>

      {/* Bản in chuẩn NĐ 30/2020/NĐ-CP & TCVN cho PXCĐ-NL */}
      <div className="hidden print:block">
        <PrintPreviewDept
          departmentTitle="PHÂN XƯỞNG CƠ ĐIỆN - NĂNG LƯỢNG (PXCĐ-NL)"
          docCode="....../BTTL-PXCĐNL"
          reportTitle="BẢNG THANH TOÁN TIỀN LƯƠNG PHÂN XƯỞNG CƠ ĐIỆN - NĂNG LƯỢNG"
          periodLabel={periodLabel}
          summaryLeft={[
            { label: 'Tổng quỹ lương khoán (DC1 + DC2)', value: `${formatVND(calc.baseFund)} đ` },
            { label: `Thưởng SL + CL (${bonusPayoutPct}% chi tháng)`, value: `${formatVND(calc.bonusPaid)} đ` },
            { label: 'Quỹ dự phòng giữ lại', value: `${formatVND(calc.bonusRetained)} đ` },
          ]}
          summaryRight={[
            { label: 'Trừ khiếu nại / Giảm trừ', value: `-${formatVND(khieuNai)} đ` },
            { label: 'Tổng quỹ lương + thưởng thực chi', value: `${formatVND(calc.netFund)} đ` },
            { label: `Lương Hệ số 1 (${q3060.totalCoeff.toFixed(2)} HS)`, value: `${formatVND(calc.hs1)} đ` },
          ]}
          employees={
            employeeCalc.computed.length > 0
              ? employeeCalc.computed.map((e, i) => ({
                  stt: i + 1,
                  msnv: e.msnv,
                  fullName: e.fullName,
                  position: 'Nhân viên',
                  team: e.team,
                  hsLuong: e.coeff,
                  hsTN: 0,
                  hsBH: 0,
                  hsTong: e.coeff,
                  workDays: e.workDays,
                  hsCongSP: e.hsNgayCong,
                  luongSP: e.totalSalary,
                  thuong: 0,
                  tangCa: 0,
                  tongLuong: e.totalSalary,
                }))
              : undefined
          }
          groupRows={calc.groupAllocation.map((g, idx) => ({
            stt: idx + 1,
            groupName: g.groupName,
            headcount: g.headcount,
            coeff: g.coeff,
            standardFund: g.fundVND,
            allocatedFund: g.allocatedFund,
          }))}
          deptHeadLabel="QUẢN ĐỐC PXCĐ-NL"
        />
      </div>
    </>
  );
};
