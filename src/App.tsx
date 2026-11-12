import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Building2,
  Calculator,
  CalendarPlus,
  FileSpreadsheet,
  FolderInput,
  Printer,
  Trash2,
  Users,
} from 'lucide-react';
import type {
  AppState,
  EmployeeMaster,
  HrChangeLogEntry,
  PayrollPeriod,
  PolicyDecision,
  SignatureConfig,
} from './types/payroll';
import { createInitialAppState } from './data/seedOctober2026';
import { calculatePayroll, formatVND } from './utils/payrollCalc';
import {
  buildPeriodFromPrevious,
  isValidPeriodKey,
  loadState,
  nextPeriodKey,
  saveState,
  snapshotFromEmployee,
} from './utils/periodOps';
import { exportPayrollToExcel } from './utils/excelExport';
import { Tab1MonthlyHub } from './components/Tab1MonthlyHub';
import { Tab2HR } from './components/Tab2HR';
import { Tab3Payroll } from './components/Tab3Payroll';
import { Tab4Analytics } from './components/Tab4Analytics';
import { Tab5Export } from './components/Tab5Export';
import { PrintPreview } from './components/PrintPreview';

type TabKey = 'tab1' | 'tab2' | 'tab3' | 'tab4' | 'tab5';

export function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [activeTab, setActiveTab] = useState<TabKey>('tab3');
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [newPeriodInput, setNewPeriodInput] = useState<string>('');
  const [showNewPeriodModal, setShowNewPeriodModal] = useState(false);

  useEffect(() => {
    const err = saveState(state);
    setStorageWarning(err);
  }, [state]);

  const periodKeys = useMemo(() => Object.keys(state.periods).sort(), [state.periods]);
  const activePeriod: PayrollPeriod =
    state.periods[state.activePeriodKey] ?? state.periods[periodKeys[periodKeys.length - 1]];

  const allCalcs = useMemo(() => {
    return periodKeys.map((k) => ({
      period: state.periods[k],
      calc: calculatePayroll(state.periods[k]),
    }));
  }, [periodKeys, state.periods]);

  const activeCalc = useMemo(() => calculatePayroll(activePeriod), [activePeriod]);

  const handleUpdatePeriod = (updater: (prev: PayrollPeriod) => PayrollPeriod) => {
    setState((prev) => {
      const cur = prev.periods[prev.activePeriodKey];
      if (!cur) return prev;
      const updated = updater(cur);
      return {
        ...prev,
        periods: {
          ...prev.periods,
          [prev.activePeriodKey]: updated,
        },
      };
    });
  };

  const handleOpenNewPeriod = () => {
    const latestKey = periodKeys[periodKeys.length - 1] || '2026-10';
    setNewPeriodInput(nextPeriodKey(latestKey));
    setShowNewPeriodModal(true);
  };

  const handleCreateNewPeriod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPeriodKey(newPeriodInput)) return;
    if (state.periods[newPeriodInput]) {
      setState((prev) => ({ ...prev, activePeriodKey: newPeriodInput }));
      setShowNewPeriodModal(false);
      return;
    }
    setState((prev) => {
      const created = buildPeriodFromPrevious(prev, newPeriodInput, prev.activePeriodKey);
      return {
        ...prev,
        periods: {
          ...prev.periods,
          [newPeriodInput]: created,
        },
        activePeriodKey: newPeriodInput,
      };
    });
    setShowNewPeriodModal(false);
  };

  const handleDeleteCurrentPeriod = () => {
    if (periodKeys.length <= 1) return;
    if (!window.confirm(`Xóa kỳ lương ${activePeriod.label}? Dữ liệu kỳ này sẽ mất vĩnh viễn.`)) {
      return;
    }
    setState((prev) => {
      const nextPeriods = { ...prev.periods };
      delete nextPeriods[prev.activePeriodKey];
      const remainingKeys = Object.keys(nextPeriods).sort();
      return {
        ...prev,
        periods: nextPeriods,
        activePeriodKey: remainingKeys[remainingKeys.length - 1],
      };
    });
  };

  // Tab 1 Policy handlers
  const handleAddPolicy = (policy: PolicyDecision) => {
    setState((prev) => ({
      ...prev,
      policies: [policy, ...prev.policies],
    }));
  };

  const handleDeletePolicy = (id: string) => {
    setState((prev) => ({
      ...prev,
      policies: prev.policies.filter((p) => p.id !== id),
    }));
  };

  // Tab 2 HR handlers (preserve historical periods, only update current active period)
  const handleUpsertEmployee = (emp: EmployeeMaster, isNew: boolean): string | null => {
    if (isNew && state.employees.some((e) => e.msnv === emp.msnv)) {
      return `MSNV ${emp.msnv} đã tồn tại trong danh sách.`;
    }
    setState((prev) => {
      const nextEmployees = isNew
        ? [...prev.employees, emp]
        : prev.employees.map((e) => (e.msnv === emp.msnv ? emp : e));

      const curPeriod = prev.periods[prev.activePeriodKey];
      const existingRec = curPeriod.records[emp.msnv];
      const nextRecords = {
        ...curPeriod.records,
        [emp.msnv]: snapshotFromEmployee(emp, existingRec),
      };

      const logEntry: HrChangeLogEntry = {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        periodKey: prev.activePeriodKey,
        msnv: emp.msnv,
        fullName: emp.fullName,
        action: isNew ? 'create' : 'update',
        detail: `${emp.position} | BP: ${emp.department === 'van_phong' ? 'Văn phòng' : 'Dây chuyền'} | HS CV: ${emp.hsCV}, HS TN: ${emp.hsTN}`,
      };

      return {
        ...prev,
        employees: nextEmployees,
        periods: {
          ...prev.periods,
          [prev.activePeriodKey]: {
            ...curPeriod,
            records: nextRecords,
          },
        },
        hrChangeLog: [...prev.hrChangeLog, logEntry],
      };
    });
    return null;
  };

  const handleToggleLock = (msnv: string) => {
    setState((prev) => {
      const target = prev.employees.find((e) => e.msnv === msnv);
      if (!target) return prev;
      const nextActive = !target.active;
      const nextEmp: EmployeeMaster = { ...target, active: nextActive };
      const nextEmployees = prev.employees.map((e) => (e.msnv === msnv ? nextEmp : e));

      const curPeriod = prev.periods[prev.activePeriodKey];
      const nextRecords = { ...curPeriod.records };
      if (!nextActive) {
        delete nextRecords[msnv];
      } else {
        nextRecords[msnv] = snapshotFromEmployee(nextEmp);
      }

      const logEntry: HrChangeLogEntry = {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        periodKey: prev.activePeriodKey,
        msnv: target.msnv,
        fullName: target.fullName,
        action: nextActive ? 'unlock' : 'lock',
        detail: nextActive
          ? `Mở khóa & đưa lại vào kỳ ${curPeriod.label}`
          : `Khóa nhân sự & rút khỏi kỳ ${curPeriod.label} (kỳ cũ giữ nguyên)`,
      };

      return {
        ...prev,
        employees: nextEmployees,
        periods: {
          ...prev.periods,
          [prev.activePeriodKey]: {
            ...curPeriod,
            records: nextRecords,
          },
        },
        hrChangeLog: [...prev.hrChangeLog, logEntry],
      };
    });
  };

  const handleImportEmployees = (
    imported: EmployeeMaster[],
  ): { added: number; updated: number } => {
    let added = 0;
    let updated = 0;
    setState((prev) => {
      const map = new Map(prev.employees.map((e) => [e.msnv, e]));
      const curPeriod = prev.periods[prev.activePeriodKey];
      const nextRecords = { ...curPeriod.records };

      for (const imp of imported) {
        const old = map.get(imp.msnv);
        if (old) {
          updated++;
          const merged = { ...old, ...imp, sortOrder: old.sortOrder };
          map.set(imp.msnv, merged);
          nextRecords[imp.msnv] = snapshotFromEmployee(merged, nextRecords[imp.msnv]);
        } else {
          added++;
          map.set(imp.msnv, imp);
          nextRecords[imp.msnv] = snapshotFromEmployee(imp);
        }
      }

      const logEntry: HrChangeLogEntry = {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        periodKey: prev.activePeriodKey,
        msnv: 'IMPORT',
        fullName: `${imported.length} nhân sự`,
        action: 'import',
        detail: `Thêm mới ${added}, cập nhật ${updated} nhân sự từ file Excel`,
      };

      return {
        ...prev,
        employees: Array.from(map.values()),
        periods: {
          ...prev.periods,
          [prev.activePeriodKey]: {
            ...curPeriod,
            records: nextRecords,
          },
        },
        hrChangeLog: [...prev.hrChangeLog, logEntry],
      };
    });
    return { added, updated };
  };

  const handleUpdateSignatures = (signatures: SignatureConfig) => {
    setState((prev) => ({ ...prev, signatures }));
  };

  const tabs: { key: TabKey; label: string; shortLabel: string; icon: React.ReactNode }[] = [
    {
      key: 'tab1',
      label: 'Tab 1: Nhập liệu & Chứng từ tháng',
      shortLabel: '1. Nhập liệu & Chứng từ',
      icon: <FolderInput className="h-4 w-4" />,
    },
    {
      key: 'tab2',
      label: 'Tab 2: Quản lý Nhân sự & Hệ số',
      shortLabel: '2. Nhân sự & Hệ số',
      icon: <Users className="h-4 w-4" />,
    },
    {
      key: 'tab3',
      label: 'Tab 3: Bảng Tính lương & Đối soát',
      shortLabel: '3. Bảng Tính lương',
      icon: <Calculator className="h-4 w-4" />,
    },
    {
      key: 'tab4',
      label: 'Tab 4: Phân tích & Biến động tháng',
      shortLabel: '4. Báo cáo Phân tích',
      icon: <BarChart3 className="h-4 w-4" />,
    },
    {
      key: 'tab5',
      label: 'Tab 5: Xuất Excel NĐ30 & Sao lưu',
      shortLabel: '5. Xuất NĐ30 & In/Sao lưu',
      icon: <FileSpreadsheet className="h-4 w-4" />,
    },
  ];

  const { summary } = activeCalc;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {/* Top Enterprise Header */}
      <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-slate-900 text-white shadow">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 font-bold text-white shadow-inner">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold tracking-wider text-blue-300 uppercase">
                Công ty Cổ phần Gạch Men Phương Nam
              </div>
              <h1 className="text-base font-bold tracking-tight sm:text-lg">
                Hệ thống Quản lý & Tính lương Phòng Kỹ thuật - Công nghệ
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Chọn kỳ lương */}
            <div className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs">
              <span className="text-slate-400">Kỳ lương:</span>
              <select
                value={activePeriod.periodKey}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, activePeriodKey: e.target.value }))
                }
                className="rounded bg-slate-700 px-2 py-1 font-semibold text-white focus:outline-none"
              >
                {periodKeys.map((k) => (
                  <option key={k} value={k}>
                    {state.periods[k].label} ({k})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleOpenNewPeriod}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
            >
              <CalendarPlus className="h-3.5 w-3.5" /> Tạo kỳ mới từ tháng trước
            </button>

            {periodKeys.length > 1 && (
              <button
                type="button"
                onClick={handleDeleteCurrentPeriod}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-950"
                title="Xóa kỳ lương đang mở"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => exportPayrollToExcel(activePeriod, activeCalc, state.signatures)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Xuất Excel NĐ30
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-700"
            >
              <Printer className="h-3.5 w-3.5" /> In / Xuất PDF
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mx-auto max-w-[1600px] px-4">
          <nav className="flex gap-1 overflow-x-auto pt-1">
            {tabs.map((t) => {
              const isActive = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={`inline-flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition ${
                    isActive
                      ? 'bg-slate-100 text-blue-700 shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {t.icon}
                  <span>{t.shortLabel}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Modal tạo kỳ lương mới */}
      {showNewPeriodModal && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleCreateNewPeriod}
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
          >
            <h3 className="text-base font-bold text-slate-900">
              Tạo kỳ lương mới từ {activePeriod.label}
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              Giữ nguyên danh sách nhân sự đang làm việc, hệ số lương và đơn giá cụm; tự động reset
              ngày công về 0 để nhập nhanh cho tháng mới.
            </p>
            <div className="mt-4">
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Chọn Tháng / Năm mới
              </label>
              <input
                type="month"
                value={newPeriodInput}
                onChange={(e) => setNewPeriodInput(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold focus:border-blue-500 focus:outline-none"
                required
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewPeriodModal(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Khởi tạo kỳ lương
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Content */}
      <main className="mx-auto max-w-[1600px] px-4 py-5">
        {storageWarning && (
          <div className="no-print mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900">
            {storageWarning}
          </div>
        )}

        {/* KPI Strip */}
        <div className="no-print mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="text-[11px] font-medium text-slate-500">Quỹ lương sản lượng khoán</div>
            <div className="mt-1 text-base font-bold text-slate-900 tabular-nums">
              {formatVND(summary.quyKhoan)} đ
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="text-[11px] font-medium text-slate-500">Lương bảo dưỡng DC2</div>
            <div className="mt-1 text-base font-bold text-slate-900 tabular-nums">
              {formatVND(summary.quyBD)} đ
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="text-[11px] font-medium text-slate-500">
              Chia thưởng {activePeriod.bonusSharePct}% / Giữ lại
            </div>
            <div className="mt-1 text-base font-bold text-emerald-700 tabular-nums">
              {formatVND(summary.thuongChia)} đ
            </div>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 shadow-sm">
            <div className="text-[11px] font-semibold text-blue-700">
              Tổng chia lương + thưởng
            </div>
            <div className="mt-1 text-base font-bold text-blue-900 tabular-nums">
              {formatVND(summary.quyThucChia)} đ
            </div>
          </div>
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5 shadow-sm">
            <div className="text-[11px] font-semibold text-indigo-700">
              Lương hệ số 1 ({activePeriod.standardDaysForHS1} công)
            </div>
            <div className="mt-1 text-base font-bold text-indigo-900 tabular-nums">
              {formatVND(summary.luongHS1)} đ
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="text-[11px] font-medium text-slate-500">
              Tổng công khoán / HS ngày công
            </div>
            <div className="mt-1 text-base font-bold text-slate-900 tabular-nums">
              {summary.tongCongKhoan.toFixed(2)} / {summary.tongHSNgayCong.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Active Tab View */}
        <div className={activeTab === 'tab5' ? '' : 'no-print'}>
          {activeTab === 'tab1' && (
            <Tab1MonthlyHub
              period={activePeriod}
              calc={activeCalc}
              employees={state.employees}
              policies={state.policies}
              onUpdatePeriod={handleUpdatePeriod}
              onAddPolicy={handleAddPolicy}
              onDeletePolicy={handleDeletePolicy}
            />
          )}
          {activeTab === 'tab2' && (
            <Tab2HR
              employees={state.employees}
              hrChangeLog={state.hrChangeLog}
              activePeriodLabel={activePeriod.label}
              onUpsertEmployee={handleUpsertEmployee}
              onToggleLock={handleToggleLock}
              onImportEmployees={handleImportEmployees}
            />
          )}
          {activeTab === 'tab3' && (
            <Tab3Payroll
              period={activePeriod}
              calc={activeCalc}
              onUpdatePeriod={handleUpdatePeriod}
            />
          )}
          {activeTab === 'tab4' && (
            <Tab4Analytics items={allCalcs} activePeriodKey={activePeriod.periodKey} />
          )}
          {activeTab === 'tab5' && (
            <Tab5Export
              state={state}
              period={activePeriod}
              calc={activeCalc}
              onUpdateSignatures={handleUpdateSignatures}
              onRestore={(restored) => setState(restored)}
              onResetSample={() => setState(createInitialAppState())}
            />
          )}
        </div>

        {/* Nếu bấm Ctrl+P / In từ Tab 1-4 thì vẫn in ra đúng mẫu NĐ30 */}
        {activeTab !== 'tab5' && (
          <div className="hidden print:block">
            <PrintPreview period={activePeriod} calc={activeCalc} sig={state.signatures} />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
