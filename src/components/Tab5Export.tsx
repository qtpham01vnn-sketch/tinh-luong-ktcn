import React, { useRef, useState } from 'react';
import { DatabaseBackup, FileSpreadsheet, Printer, RotateCcw, Upload } from 'lucide-react';
import type { AppState, PayrollPeriod, SignatureConfig } from '../types/payroll';
import type { PayrollCalculationResult } from '../utils/payrollCalc';
import { downloadBlob, exportPayrollToExcel } from '../utils/excelExport';
import { normalizeAppState } from '../utils/periodOps';
import { PrintPreview } from './PrintPreview';

interface Tab5Props {
  state: AppState;
  period: PayrollPeriod;
  calc: PayrollCalculationResult;
  onUpdateSignatures: (sig: SignatureConfig) => void;
  onRestore: (state: AppState) => void;
  onResetSample: () => void;
}

const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

export const Tab5Export: React.FC<Tab5Props> = ({
  state,
  period,
  calc,
  onUpdateSignatures,
  onRestore,
  onResetSample,
}) => {
  const sig = state.signatures;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const setSig = (field: keyof SignatureConfig, value: string) =>
    onUpdateSignatures({ ...sig, [field]: value });

  const handleExcel = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await exportPayrollToExcel(period, calc, sig);
      setMsg({ type: 'ok', text: `Đã xuất Bảng thanh toán tiền lương ${period.label} (.xlsx).` });
    } catch (err) {
      console.error(err);
      setMsg({ type: 'err', text: 'Xuất Excel thất bại. Vui lòng thử lại.' });
    } finally {
      setBusy(false);
    }
  };

  const handleBackup = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    downloadBlob(blob, `SaoLuu_Luong_KTCN_${stamp}.json`);
    setMsg({ type: 'ok', text: 'Đã tải file sao lưu JSON.' });
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      setMsg({ type: 'err', text: 'File sao lưu quá lớn (> 20MB).' });
      return;
    }
    try {
      const restored = normalizeAppState(JSON.parse(await file.text()));
      const n = Object.keys(restored.periods).length;
      if (
        window.confirm(
          `Khôi phục từ "${file.name}" (${n} kỳ lương, ${restored.employees.length} nhân sự)? Dữ liệu hiện tại sẽ bị thay thế.`,
        )
      ) {
        onRestore(restored);
        setMsg({ type: 'ok', text: 'Khôi phục dữ liệu thành công.' });
      }
    } catch (err) {
      setMsg({
        type: 'err',
        text: `File sao lưu không hợp lệ: ${err instanceof Error ? err.message : 'lỗi định dạng'}.`,
      });
    }
  };

  const inputCls =
    'w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none';

  return (
    <div className="space-y-5">
      <section className="no-print grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-1 text-base font-bold text-slate-900">Thông tin trình ký (thể thức NĐ 30/2020/NĐ-CP)</h2>
          <p className="mb-3 text-xs text-slate-500">
            Font Times New Roman, Quốc hiệu – Tiêu ngữ, Số/ký hiệu, Địa danh – ngày tháng, chức danh người ký in hoa
            đậm, Nơi nhận. Khổ A4 ngang, lề trên/dưới 20 mm, trái 30 mm, phải 15 mm.
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Số văn bản</label>
              <input value={sig.docNumber} onChange={(e) => setSig('docNumber', e.target.value)} placeholder="VD: 15" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Địa danh</label>
              <input value={sig.place} onChange={(e) => setSig('place', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Ngày ban hành</label>
              <input type="date" value={sig.issueDate} onChange={(e) => setSig('issueDate', e.target.value)} className={inputCls} />
            </div>
            <div className="flex items-end text-[11px] text-slate-500">Để trống ngày → in “ngày …… tháng ……” để ghi tay.</div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Người lập biểu</label>
              <input value={sig.preparedBy} onChange={(e) => setSig('preparedBy', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Trưởng phòng KTCN</label>
              <input value={sig.headOfDept} onChange={(e) => setSig('headOfDept', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">P.TGĐ PT. TC-HC</label>
              <input value={sig.deputyTCHC} onChange={(e) => setSig('deputyTCHC', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">P.TGĐ Phụ trách</label>
              <input value={sig.deputyInCharge} onChange={(e) => setSig('deputyInCharge', e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>

        <div className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-base font-bold text-slate-900">Xuất file & Sao lưu</h2>
          <button
            type="button"
            disabled={busy}
            onClick={handleExcel}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <FileSpreadsheet className="h-4 w-4" /> {busy ? 'Đang tạo file...' : 'Xuất Excel trình ký (.xlsx)'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Printer className="h-4 w-4" /> In / Lưu PDF (bản xem trước bên dưới)
          </button>
          <button
            type="button"
            onClick={handleBackup}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <DatabaseBackup className="h-4 w-4" /> Sao lưu dữ liệu (JSON)
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Upload className="h-4 w-4" /> Khôi phục từ file JSON
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleRestore} />
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Xóa toàn bộ dữ liệu và nạp lại dữ liệu mẫu tháng 10/2026? Hãy sao lưu trước!')) {
                onResetSample();
              }
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Nạp lại dữ liệu mẫu T10/2026
          </button>
          <p className="text-[11px] text-slate-500">
            Dữ liệu tự động lưu trên trình duyệt (localStorage). Khi in: chọn máy in “Microsoft Print to PDF / Save as
            PDF”, khổ A4, hướng ngang.
          </p>
          {msg && (
            <div
              className={`rounded-lg px-3 py-2 text-xs font-medium ${
                msg.type === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
              }`}
            >
              {msg.text}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-300 bg-slate-200/60 p-4 print:border-0 print:bg-white print:p-0">
        <div className="no-print mb-2 text-xs font-semibold text-slate-600">
          Bản xem trước in (A4 ngang) — {period.label}
        </div>
        <div className="overflow-x-auto">
          <div className="mx-auto w-[277mm] bg-white p-[8mm] shadow-lg print:w-auto print:p-0 print:shadow-none">
            <PrintPreview period={period} calc={calc} sig={sig} />
          </div>
        </div>
      </section>
    </div>
  );
};
