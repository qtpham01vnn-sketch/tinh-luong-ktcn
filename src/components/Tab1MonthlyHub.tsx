import React, { useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardPaste,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Plus,
  ShieldAlert,
  Trash2,
  Upload,
} from 'lucide-react';
import type {
  DeductionEntry,
  EmployeeMaster,
  PayrollPeriod,
  PolicyDecision,
  ProductionCluster,
} from '../types/payroll';
import { formatDecimal, formatVND } from '../utils/payrollCalc';
import type { PayrollCalculationResult } from '../utils/payrollCalc';
import {
  buildNameLookup,
  parseAttendanceFromGrid,
  parseClustersFromGrid,
  parseNumberLoose,
  readSpreadsheetRows,
  textToGrid,
} from '../utils/importParsers';
import type { ParsedAttendanceItem } from '../utils/importParsers';

interface Tab1Props {
  period: PayrollPeriod;
  calc: PayrollCalculationResult;
  employees: EmployeeMaster[];
  policies: PolicyDecision[];
  onUpdatePeriod: (updater: (prev: PayrollPeriod) => PayrollPeriod) => void;
  onAddPolicy: (policy: PolicyDecision) => void;
  onDeletePolicy: (id: string) => void;
  readOnly?: boolean;
}

export const Tab1MonthlyHub: React.FC<Tab1Props> = ({
  period,
  calc,
  employees,
  policies,
  onUpdatePeriod,
  onAddPolicy,
  onDeletePolicy,
  readOnly = false,
}) => {
  // Paste / Preview state for Attendance
  const [pasteText, setPasteText] = useState('');
  const [previewItems, setPreviewItems] = useState<ParsedAttendanceItem[] | null>(null);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  // New deduction form state
  const [dedDate, setDedDate] = useState(period.periodKey);
  const [dedDesc, setDedDesc] = useState('');
  const [dedAmount, setDedAmount] = useState('');
  const [dedScope, setDedScope] = useState<'quy_thuong_chung' | 'ca_nhan'>('quy_thuong_chung');
  const [dedMsnv, setDedMsnv] = useState(employees[0]?.msnv || '');

  // New Policy form state
  const [polCode, setPolCode] = useState('');
  const [polTitle, setPolTitle] = useState('');
  const [polEff, setPolEff] = useState(period.periodKey);
  const [polBonusPct, setPolBonusPct] = useState('50');
  const [polBaseSal, setPolBaseSal] = useState('5310000');
  const [polNotes, setPolNotes] = useState('');
  const [polFile, setPolFile] = useState<{ name: string; type: string; dataUrl: string } | null>(
    null,
  );
  const [polError, setPolError] = useState<string | null>(null);

  const handleClusterChange = (
    id: string,
    field: keyof ProductionCluster,
    value: string | number,
  ) => {
    onUpdatePeriod((prev) => ({
      ...prev,
      clusters: prev.clusters.map((c) =>
        c.id === id
          ? { ...c, [field]: typeof value === 'string' && field !== 'name' ? Number(value) || 0 : value }
          : c,
      ),
    }));
  };

  const handleAddCluster = () => {
    onUpdatePeriod((prev) => ({
      ...prev,
      clusters: [
        ...prev.clusters,
        {
          id: `cluster_${Date.now()}`,
          name: `Cụm ${prev.clusters.length + 1}`,
          unitPrice: 0,
          quantity: 0,
          bonusOutputPct: 2,
          bonusQualityPct: 0,
        },
      ],
    }));
  };

  const handleDeleteCluster = (id: string) => {
    onUpdatePeriod((prev) => ({
      ...prev,
      clusters: prev.clusters.filter((c) => c.id !== id),
    }));
  };

  const handleUploadClusters = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const grid = await readSpreadsheetRows(file);
      const parsed = parseClustersFromGrid(grid);
      if (parsed.length === 0) {
        setUploadMsg('Không đọc được cụm sản lượng nào từ file. Kiểm tra lại cấu trúc cột: Tên cụm | Đơn giá | Sản lượng | % Thưởng SL | % Thưởng CL.');
      } else {
        onUpdatePeriod((prev) => ({ ...prev, inputMode: 'clusters', clusters: parsed }));
        setUploadMsg(`Đã nạp ${parsed.length} cụm sản lượng từ file "${file.name}".`);
      }
    } catch {
      setUploadMsg('Lỗi đọc file Excel/CSV sản lượng.');
    }
    e.target.value = '';
  };

  const handleAddDeduction = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseNumberLoose(dedAmount);
    if (!dedDesc.trim() || !Number.isFinite(amt) || amt <= 0) return;
    const entry: DeductionEntry = {
      id: `ded_${Date.now()}`,
      dateOrRef: dedDate.trim() || period.periodKey,
      description: dedDesc.trim(),
      amount: amt,
      scope: dedScope,
      msnv: dedScope === 'ca_nhan' ? dedMsnv : undefined,
    };
    onUpdatePeriod((prev) => ({
      ...prev,
      deductions: [...prev.deductions, entry],
    }));
    setDedDesc('');
    setDedAmount('');
  };

  const handleDeleteDeduction = (id: string) => {
    onUpdatePeriod((prev) => ({
      ...prev,
      deductions: prev.deductions.filter((d) => d.id !== id),
    }));
  };

  const nameLookup = () => buildNameLookup(Object.values(period.records));

  const handleUploadAttendance = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const grid = await readSpreadsheetRows(file);
      const parsed = parseAttendanceFromGrid(grid, nameLookup());
      setPreviewItems(parsed);
      setUploadMsg(
        parsed.length > 0
          ? `Đã đọc ${parsed.length} dòng chấm công từ "${file.name}". Kiểm tra đối soát bên dưới rồi bấm Xác nhận nạp.`
          : 'Không tìm thấy dòng nào có MSNV / Họ tên hợp lệ trong file.',
      );
    } catch (err) {
      setUploadMsg(err instanceof Error ? err.message : 'Không thể đọc file chấm công.');
    }
    e.target.value = '';
  };

  const handleParsePaste = () => {
    const parsed = parseAttendanceFromGrid(textToGrid(pasteText), nameLookup());
    setPreviewItems(parsed);
    setUploadMsg(
      parsed.length > 0
        ? `Đã phân tích ${parsed.length} dòng từ dữ liệu dán. Kiểm tra đối soát trước khi nạp.`
        : 'Chưa nhận diện được dữ liệu. Định dạng mỗi dòng: MSNV [Tab] Họ tên [Tab] Công khoán [Tab] Công BD.',
    );
  };

  const handleApplyAttendancePreview = () => {
    if (!previewItems || previewItems.length === 0) return;
    onUpdatePeriod((prev) => {
      const nextRecords = { ...prev.records };
      for (const item of previewItems) {
        if (nextRecords[item.msnv]) {
          nextRecords[item.msnv] = {
            ...nextRecords[item.msnv],
            congKhoan: item.congKhoan,
            congBD: item.congBD,
          };
        }
      }
      return { ...prev, records: nextRecords };
    });
    setUploadMsg(`Đã cập nhật công thành công cho kỳ ${period.label}!`);
    setPreviewItems(null);
    setPasteText('');
  };

  const handlePolicyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      setPolError('File đính kèm vượt quá 1.5MB (giới hạn lưu trình duyệt). Vui lòng nén hoặc dùng PDF/ảnh nhẹ hơn.');
      return;
    }
    setPolError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setPolFile({
        name: file.name,
        type: file.type,
        dataUrl: String(reader.result || ''),
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSavePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!polCode.trim() || !polTitle.trim()) return;
    onAddPolicy({
      id: `pol_${Date.now()}`,
      code: polCode.trim(),
      title: polTitle.trim(),
      effectiveFrom: polEff,
      bonusSharePct: Number(polBonusPct) || 50,
      baseSalaryDefault: Number(polBaseSal) || 5310000,
      notes: polNotes.trim(),
      attachmentName: polFile?.name,
      attachmentType: polFile?.type,
      attachmentDataUrl: polFile?.dataUrl,
      createdAt: new Date().toISOString().slice(0, 10),
    });
    setPolCode('');
    setPolTitle('');
    setPolNotes('');
    setPolFile(null);
  };

  return (
    <fieldset disabled={readOnly} className="space-y-6">
      {readOnly && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-900">
          Chế độ Xem (Chỉ Admin được chỉnh sửa số liệu, thêm giảm trừ hoặc upload chứng từ).
        </div>
      )}

      {/* Header Banner — đồng bộ giao diện với PXSX & PXCĐ-NL */}
      <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-900 to-slate-900 p-5 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-amber-400" />
              <h2 className="text-lg font-bold">
                Phòng Kỹ thuật - Công nghệ (P.KTCN) – {period.label}
              </h2>
            </div>
            <p className="mt-1 text-xs text-blue-200">
              Nhân sự: <strong>{employees.length} CBCNV</strong> | Tổng công khoán:{' '}
              <strong>{formatDecimal(calc.summary.tongCongKhoan, 2)}</strong> | Tổng HS ngày công:{' '}
              <strong>{formatDecimal(calc.summary.tongHSNgayCong, 2)} HS</strong>
            </p>
          </div>
          <div className="rounded-lg bg-white/10 px-4 py-2 text-right backdrop-blur-sm">
            <div className="text-[11px] uppercase tracking-wider text-blue-200">
              Tổng chia lương + thưởng P.KTCN
            </div>
            <div className="text-xl font-extrabold text-amber-300">
              {formatVND(calc.summary.quyThucChia)} đ
            </div>
          </div>
        </div>
      </div>

      {/* 3 Cards Tổng hợp Quỹ P.KTCN — đồng bộ PXSX & PXCĐ-NL */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-500">
            1. Quỹ lương Khoán &amp; Bảo dưỡng
          </div>
          <div className="mt-1 text-2xl font-extrabold text-blue-700">
            {formatVND(calc.summary.quyKhoan + calc.summary.quyBD)} đ
          </div>
          <div className="mt-2 space-y-0.5 text-xs text-slate-600">
            <div>Quỹ sản lượng khoán: {formatVND(calc.summary.quyKhoan)} đ</div>
            <div>Lương bảo dưỡng DC2: {formatVND(calc.summary.quyBD)} đ</div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-500">
            2. Thưởng SL + CL ({period.bonusSharePct}% chi tháng)
          </div>
          <div className="mt-1 text-2xl font-extrabold text-emerald-700">
            {formatVND(calc.summary.thuongChia)} đ
          </div>
          <div className="mt-2 space-y-0.5 text-xs text-slate-600">
            <div>Thưởng gộp trước giảm trừ: {formatVND(calc.summary.thuongGop)} đ</div>
            <div className="text-amber-700">Quỹ phòng giữ lại: {formatVND(calc.summary.quyGiuLai)} đ</div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-500">
            3. Trừ Khiếu nại &amp; Lương HS 1
          </div>
          <div className="mt-1 text-2xl font-extrabold text-slate-900">
            {formatVND(calc.summary.quyThucChia)} đ
          </div>
          <div className="mt-2 space-y-0.5 text-xs text-slate-600">
            <div className="text-rose-600">
              Trừ quỹ thưởng chung: -{formatVND(calc.summary.giamTruChung)} đ
            </div>
            <div>
              Lương Hệ số 1 (26 công):{' '}
              <strong className="text-blue-700">{formatVND(calc.summary.luongHS1)} đ</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 1. Sản lượng, Đơn giá & Quỹ Bảo dưỡng */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              1. Bảng Sản lượng, Đơn giá & Quỹ Bảo dưỡng ({period.label})
            </h2>
            <p className="text-xs text-slate-500">
              Hỗ trợ nhập chi tiết từng cụm (Đơn giá × SL) hoặc nhập thẳng Tổng quỹ khoán từ Kế toán.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => onUpdatePeriod((p) => ({ ...p, inputMode: 'clusters' }))}
                className={`rounded-md px-3 py-1.5 transition ${
                  period.inputMode === 'clusters'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Nhập theo Cụm (ĐG × SL)
              </button>
              <button
                type="button"
                onClick={() => onUpdatePeriod((p) => ({ ...p, inputMode: 'direct' }))}
                className={`rounded-md px-3 py-1.5 transition ${
                  period.inputMode === 'direct'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Nhập thẳng Tổng quỹ
              </button>
            </div>

            {period.inputMode === 'clusters' && (
              <>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                  <Upload className="h-3.5 w-3.5" />
                  Upload Excel Cụm
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={handleUploadClusters}
                  />
                </label>
                <button
                  type="button"
                  onClick={handleAddCluster}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                >
                  <Plus className="h-3.5 w-3.5" /> Thêm cụm
                </button>
              </>
            )}
          </div>
        </div>

        {period.inputMode === 'clusters' ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-600">
                  <th className="px-3 py-2">Tên cụm / Dây chuyền</th>
                  <th className="px-3 py-2 text-right">Sản lượng / HS</th>
                  <th className="px-3 py-2 text-right">Đơn giá khoán (đ)</th>
                  <th className="px-3 py-2 text-right">% Thưởng SL</th>
                  <th className="px-3 py-2 text-right">% Thưởng CL</th>
                  <th className="px-3 py-2 text-right">Thành tiền Quỹ khoán</th>
                  <th className="px-3 py-2 text-right">Thưởng gộp cụm (đ)</th>
                  <th className="px-3 py-2 text-center">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {period.clusters.map((c) => {
                  const amount = c.unitPrice * c.quantity;
                  const bonus = amount * ((c.bonusOutputPct + c.bonusQualityPct) / 100);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70">
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={c.name}
                          onChange={(e) => handleClusterChange(c.id, 'name', e.target.value)}
                          className="w-full rounded border border-slate-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          step="0.01"
                          value={c.quantity}
                          onChange={(e) => handleClusterChange(c.id, 'quantity', e.target.value)}
                          className="w-28 rounded border border-slate-200 px-2 py-1 text-right text-sm tabular-nums focus:border-blue-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          step="0.01"
                          value={c.unitPrice}
                          onChange={(e) => handleClusterChange(c.id, 'unitPrice', e.target.value)}
                          className="w-28 rounded border border-slate-200 px-2 py-1 text-right text-sm tabular-nums focus:border-blue-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          step="0.1"
                          value={c.bonusOutputPct}
                          onChange={(e) =>
                            handleClusterChange(c.id, 'bonusOutputPct', e.target.value)
                          }
                          className="w-20 rounded border border-slate-200 px-2 py-1 text-right text-sm tabular-nums focus:border-blue-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          step="0.1"
                          value={c.bonusQualityPct}
                          onChange={(e) =>
                            handleClusterChange(c.id, 'bonusQualityPct', e.target.value)
                          }
                          className="w-20 rounded border border-slate-200 px-2 py-1 text-right text-sm tabular-nums focus:border-blue-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right font-semibold text-blue-700 tabular-nums">
                        {formatVND(amount)} đ
                      </td>
                      <td className="px-3 py-1.5 text-right font-semibold text-emerald-700 tabular-nums">
                        {formatVND(bonus)} đ
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteCluster(c.id)}
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Xóa cụm"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Tổng quỹ lương theo sản lượng khoán (đ)
              </label>
              <input
                type="number"
                value={period.directQuyKhoan}
                onChange={(e) =>
                  onUpdatePeriod((p) => ({
                    ...p,
                    directQuyKhoan: Number(e.target.value) || 0,
                  }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-right font-semibold tabular-nums focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Tổng thưởng gộp 2 dây chuyền trước trừ khoán (đ)
              </label>
              <input
                type="number"
                value={period.directThuongGop}
                onChange={(e) =>
                  onUpdatePeriod((p) => ({
                    ...p,
                    directThuongGop: Number(e.target.value) || 0,
                  }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-right font-semibold tabular-nums focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Lương bảo dưỡng DC2 (đ)
            </label>
            <input
              type="number"
              value={period.quyBD}
              onChange={(e) =>
                onUpdatePeriod((p) => ({ ...p, quyBD: Number(e.target.value) || 0 }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-right text-sm font-semibold tabular-nums focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Tỷ lệ chia thưởng trong tháng (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={period.bonusSharePct}
              onChange={(e) =>
                onUpdatePeriod((p) => ({
                  ...p,
                  bonusSharePct: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-right text-sm font-semibold tabular-nums focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="rounded-lg bg-blue-50 px-3 py-2">
            <div className="text-xs text-blue-700">Tổng quỹ lương khoán</div>
            <div className="text-base font-bold text-blue-900 tabular-nums">
              {formatVND(calc.summary.quyKhoan)} đ
            </div>
          </div>
          <div className="rounded-lg bg-emerald-50 px-3 py-2">
            <div className="text-xs text-emerald-700">Tổng quỹ thực chia</div>
            <div className="text-base font-bold text-emerald-900 tabular-nums">
              {formatVND(calc.summary.quyThucChia)} đ
            </div>
          </div>
        </div>
      </section>

      {/* 2. Nhật ký Các khoản Giảm trừ */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              2. Nhật ký Các khoản Giảm trừ (Trừ khoán / Lỗi SP / Khiếu nại KH)
            </h2>
            <p className="text-xs text-slate-500">
              Khoản trừ phạm vi "Quỹ thưởng chung" tự động trừ vào Tổng thưởng gộp trước khi chia{' '}
              {period.bonusSharePct}%. Khoản trừ "Cá nhân" trừ thẳng vào Tổng lương của nhân sự đó.
            </p>
          </div>
          <div className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 tabular-nums">
            Tổng trừ quỹ thưởng chung: {formatVND(calc.summary.giamTruChung)} đ
          </div>
        </div>

        <form onSubmit={handleAddDeduction} className="mb-4 grid gap-2 sm:grid-cols-12">
          <input
            type="text"
            placeholder="Ngày / Số phiếu"
            value={dedDate}
            onChange={(e) => setDedDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm sm:col-span-2"
          />
          <input
            type="text"
            placeholder="Nội dung giảm trừ (VD: Khiếu nại lô gạch...)"
            value={dedDesc}
            onChange={(e) => setDedDesc(e.target.value)}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm sm:col-span-4"
            required
          />
          <input
            type="number"
            placeholder="Số tiền (đ)"
            value={dedAmount}
            onChange={(e) => setDedAmount(e.target.value)}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-right text-sm tabular-nums sm:col-span-2"
            required
          />
          <select
            value={dedScope}
            onChange={(e) =>
              setDedScope(e.target.value as 'quy_thuong_chung' | 'ca_nhan')
            }
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm sm:col-span-2"
          >
            <option value="quy_thuong_chung">Trừ quỹ thưởng chung</option>
            <option value="ca_nhan">Trừ cá nhân</option>
          </select>
          {dedScope === 'ca_nhan' ? (
            <select
              value={dedMsnv}
              onChange={(e) => setDedMsnv(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm sm:col-span-1"
            >
              {employees.map((emp) => (
                <option key={emp.msnv} value={emp.msnv}>
                  {emp.msnv} - {emp.fullName}
                </option>
              ))}
            </select>
          ) : (
            <div className="hidden sm:col-span-1 sm:block" />
          )}
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900 sm:col-span-1"
          >
            <Plus className="h-3.5 w-3.5" /> Thêm
          </button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-600">
                <th className="px-3 py-2">Ngày / Số phiếu</th>
                <th className="px-3 py-2">Nội dung giảm trừ</th>
                <th className="px-3 py-2">Phạm vi</th>
                <th className="px-3 py-2 text-right">Số tiền trừ (đ)</th>
                <th className="px-3 py-2 text-center">Xóa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {period.deductions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-xs text-slate-400">
                    Chưa có khoản giảm trừ nào trong kỳ này.
                  </td>
                </tr>
              ) : (
                period.deductions.map((d) => (
                  <tr key={d.id}>
                    <td className="px-3 py-2 text-slate-600">{d.dateOrRef}</td>
                    <td className="px-3 py-2 font-medium text-slate-800">{d.description}</td>
                    <td className="px-3 py-2">
                      {d.scope === 'quy_thuong_chung' ? (
                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Quỹ thưởng chung
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800">
                          Cá nhân ({d.msnv})
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-rose-700 tabular-nums">
                      -{formatVND(d.amount)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteDeduction(d.id)}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. Upload Bảng Chấm công & Paste nhanh */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              3. Upload Bảng Chấm công (Excel/CSV) & Dán nhanh từ Excel
            </h2>
            <p className="text-xs text-slate-500">
              Tự động khớp theo MSNV để điền Công khoán & Công BD, có bảng đối soát trước khi nạp.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700">
            <FileSpreadsheet className="h-4 w-4" />
            Upload File Chấm công (.xlsx/.csv)
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleUploadAttendance}
            />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <textarea
            rows={4}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={'Dán trực tiếp từ Excel (MSNV | Họ tên | Công khoán | Công BD)\nVí dụ:\n0266\tĐặng Thanh Tùng\t27\t0.5\n1439\tPhạm Quốc Tuấn\t27\t0.5'}
            className="rounded-lg border border-slate-300 p-2.5 font-mono text-xs focus:border-blue-500 focus:outline-none md:col-span-2"
          />
          <div className="flex flex-col justify-between gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
            <div className="text-xs text-slate-600">
              Copy vùng dữ liệu chấm công trong Excel (có cột MSNV và cột Công khoán, Công BD) rồi
              dán vào ô bên trái và bấm Phân tích.
            </div>
            <button
              type="button"
              onClick={handleParsePaste}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <ClipboardPaste className="h-4 w-4" /> Phân tích & Đối soát
            </button>
          </div>
        </div>

        {uploadMsg && (
          <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800">
            {uploadMsg}
          </div>
        )}

        {previewItems && previewItems.length > 0 && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-bold text-slate-800">
                Bảng Đối soát trước khi nạp ({previewItems.length} dòng)
                <span className="ml-3 text-xs font-medium">
                  <span className="text-emerald-700">
                    ✔ Khớp: {previewItems.filter((i) => period.records[i.msnv]).length}
                  </span>
                  <span className="ml-2 text-amber-700">
                    ⚠ Công bất thường:{' '}
                    {previewItems.filter((i) => i.congKhoan < 5 || i.congKhoan > 31).length}
                  </span>
                  <span className="ml-2 text-rose-700">
                    ✖ MSNV mới / không có trong kỳ:{' '}
                    {previewItems.filter((i) => !period.records[i.msnv]).length}
                  </span>
                  <span className="ml-2 text-slate-500">
                    Chưa có công trong file:{' '}
                    {
                      Object.keys(period.records).filter(
                        (m) => !previewItems.some((i) => i.msnv === m),
                      ).length
                    }{' '}
                    người
                  </span>
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewItems(null)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleApplyAttendancePreview}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Xác nhận nạp vào kỳ {period.label}
                </button>
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto rounded border border-slate-200 bg-white">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-2.5 py-1.5 text-left">MSNV</th>
                    <th className="px-2.5 py-1.5 text-left">Họ tên (File)</th>
                    <th className="px-2.5 py-1.5 text-right">Công khoán mới</th>
                    <th className="px-2.5 py-1.5 text-right">Công BD mới</th>
                    <th className="px-2.5 py-1.5 text-left">Trạng thái đối soát</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewItems.map((item, idx) => {
                    const existing = period.records[item.msnv];
                    const isAnomaly = item.congKhoan < 5 || item.congKhoan > 31;
                    return (
                      <tr
                        key={`${item.msnv}_${idx}`}
                        className={!existing ? 'bg-rose-50' : isAnomaly ? 'bg-amber-50' : ''}
                      >
                        <td className="px-2.5 py-1.5 font-mono font-semibold">{item.msnv}</td>
                        <td className="px-2.5 py-1.5">
                          {existing ? existing.fullName : item.fullName || '(Chưa có trong HR)'}
                        </td>
                        <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums">
                          {formatDecimal(item.congKhoan, 4)}
                        </td>
                        <td className="px-2.5 py-1.5 text-right tabular-nums">
                          {formatDecimal(item.congBD, 2)}
                        </td>
                        <td className="px-2.5 py-1.5">
                          {!existing ? (
                            <span className="inline-flex items-center gap-1 text-rose-700">
                              <ShieldAlert className="h-3.5 w-3.5" /> MSNV mới (chưa có ở Tab 2)
                            </span>
                          ) : isAnomaly ? (
                            <span className="inline-flex items-center gap-1 text-amber-700">
                              <AlertTriangle className="h-3.5 w-3.5" /> Ngày công bất thường
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Khớp hợp lệ
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* 4. Kho lưu trữ Quyết định Khoán */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-bold text-slate-900">
            4. Kho Lưu trữ Quyết định Khoán Sản phẩm (Policy & Decision Vault)
          </h2>
          <p className="text-xs text-slate-500">
            Đính kèm file PDF / ảnh chụp / Word / Excel Quyết định giao khoán theo từng giai đoạn, lưu
            định mức theo mốc hiệu lực.
          </p>
        </div>

        <form onSubmit={handleSavePolicy} className="mb-4 grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-12">
          <input
            type="text"
            placeholder="Số QĐ (VD: QĐ-05/2026)"
            value={polCode}
            onChange={(e) => setPolCode(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm sm:col-span-2"
            required
          />
          <input
            type="text"
            placeholder="Tên / Trích yếu Quyết định"
            value={polTitle}
            onChange={(e) => setPolTitle(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm sm:col-span-3"
            required
          />
          <input
            type="month"
            value={polEff}
            onChange={(e) => setPolEff(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm sm:col-span-2"
            title="Tháng bắt đầu hiệu lực"
          />
          <input
            type="number"
            placeholder="% Chia thưởng"
            value={polBonusPct}
            onChange={(e) => setPolBonusPct(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-right text-sm sm:col-span-1"
            title="% Chia thưởng trong tháng"
          />
          <input
            type="number"
            placeholder="LCB định mức"
            value={polBaseSal}
            onChange={(e) => setPolBaseSal(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-right text-sm sm:col-span-2"
            title="Lương cơ bản định mức (đ)"
          />
          <label className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 sm:col-span-2">
            <Upload className="h-3.5 w-3.5" />
            {polFile ? polFile.name.slice(0, 12) + '...' : 'Đính kèm file'}
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xlsx,.xls"
              className="hidden"
              onChange={handlePolicyFileChange}
            />
          </label>
          <input
            type="text"
            placeholder="Ghi chú định mức (tùy chọn)"
            value={polNotes}
            onChange={(e) => setPolNotes(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm sm:col-span-10"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 sm:col-span-2"
          >
            <FileCheck2 className="h-3.5 w-3.5" /> Lưu Quyết định
          </button>
        </form>

        {polError && (
          <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{polError}</div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {policies.map((pol) => (
            <div
              key={pol.id}
              className="flex flex-col justify-between rounded-lg border border-slate-200 p-3.5"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-block rounded bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">
                      {pol.code}
                    </span>
                    <span className="ml-2 text-xs text-slate-500">
                      Hiệu lực từ: <strong>{pol.effectiveFrom}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeletePolicy(pol.id)}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    title="Xóa quyết định"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <h3 className="mt-1.5 text-sm font-semibold text-slate-900">{pol.title}</h3>
                {pol.notes && <p className="mt-1 text-xs text-slate-600">{pol.notes}</p>}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-xs">
                <span className="text-slate-600">
                  Chia thưởng: <strong>{pol.bonusSharePct}%</strong> | LCB định mức:{' '}
                  <strong>{formatVND(pol.baseSalaryDefault)} đ</strong>
                </span>
                <div className="flex items-center gap-2">
                  {pol.attachmentDataUrl && pol.attachmentDataUrl.startsWith('data:') && (
                    <a
                      href={pol.attachmentDataUrl}
                      download={pol.attachmentName || 'quyet_dinh'}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <FileText className="h-3 w-3" /> Tải file
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      onUpdatePeriod((p) => ({ ...p, bonusSharePct: pol.bonusSharePct }))
                    }
                    className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-blue-100 hover:text-blue-800"
                  >
                    Áp dụng kỳ này
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </fieldset>
  );
};
