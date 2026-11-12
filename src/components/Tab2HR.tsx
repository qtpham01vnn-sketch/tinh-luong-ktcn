import React, { useMemo, useState } from 'react';
import { History, Lock, Pencil, Plus, Save, Search, Unlock, Upload, X } from 'lucide-react';
import type {
  Department,
  EmployeeMaster,
  HrChangeLogEntry,
  TeamGroup,
} from '../types/payroll';
import { formatDecimal, formatVND } from '../utils/payrollCalc';
import { parseEmployeesFromGrid, parseNumberLoose, readSpreadsheetRows } from '../utils/importParsers';
import { inferDefaultRoleAndTeam, TEAM_LABELS } from '../utils/rbacAuth';

interface Tab2Props {
  employees: EmployeeMaster[];
  hrChangeLog: HrChangeLogEntry[];
  activePeriodLabel: string;
  onUpsertEmployee: (emp: EmployeeMaster, isNew: boolean) => string | null;
  onToggleLock: (msnv: string) => void;
  onImportEmployees: (list: EmployeeMaster[]) => { added: number; updated: number };
  readOnly?: boolean;
}

interface FormState {
  msnv: string;
  fullName: string;
  position: string;
  department: Department;
  team: TeamGroup;
  baseSalary2020: string;
  hsCV: string;
  hsTN: string;
}

const EMPTY_FORM: FormState = {
  msnv: '',
  fullName: '',
  position: 'Nhân viên KCS',
  department: 'day_chuyen',
  team: 'to_qc_kcs',
  baseSalary2020: '5310000',
  hsCV: '1.42',
  hsTN: '0',
};

export const Tab2HR: React.FC<Tab2Props> = ({
  employees,
  hrChangeLog,
  activePeriodLabel,
  onUpsertEmployee,
  onToggleLock,
  onImportEmployees,
  readOnly = false,
}) => {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingMsnv, setEditingMsnv] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showLocked, setShowLocked] = useState(true);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...employees]
      .filter((e) => (showLocked ? true : e.active))
      .filter(
        (e) =>
          !q ||
          e.msnv.includes(q) ||
          e.fullName.toLowerCase().includes(q) ||
          e.position.toLowerCase().includes(q),
      )
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [employees, query, showLocked]);

  const groups: { dept: Department; title: string }[] = [
    { dept: 'van_phong', title: 'I. Bộ phận Văn phòng' },
    { dept: 'day_chuyen', title: 'II. Bộ phận Nhân viên Dây chuyền 1+2' },
  ];

  const openNew = () => {
    if (readOnly) return;
    setForm(EMPTY_FORM);
    setEditingMsnv(null);
    setShowForm(true);
    setError(null);
  };

  const openEdit = (e: EmployeeMaster) => {
    if (readOnly) return;
    const defaults = inferDefaultRoleAndTeam(e.msnv, e.position);
    setForm({
      msnv: e.msnv,
      fullName: e.fullName,
      position: e.position,
      department: e.department,
      team: e.team ?? defaults.team,
      baseSalary2020: String(e.baseSalary2020),
      hsCV: String(e.hsCV),
      hsTN: String(e.hsTN),
    });
    setEditingMsnv(e.msnv);
    setShowForm(true);
    setError(null);
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (readOnly) return;
    const msnv = form.msnv.trim();
    const fullName = form.fullName.trim().replace(/\s+/g, ' ');
    const hsCV = parseNumberLoose(form.hsCV);
    const hsTN = parseNumberLoose(form.hsTN);
    const lcb = parseNumberLoose(form.baseSalary2020);

    if (!/^\d{2,6}$/.test(msnv)) return setError('MSNV phải là 2–6 chữ số.');
    if (!fullName) return setError('Vui lòng nhập họ tên.');
    if (hsCV <= 0 || hsCV > 10) return setError('Hệ số công việc phải trong khoảng (0; 10].');
    if (hsTN < 0 || hsTN > 10) return setError('Hệ số trách nhiệm phải trong khoảng [0; 10].');
    if (lcb < 0) return setError('Lương cơ bản không hợp lệ.');

    const existing = employees.find((e) => e.msnv === (editingMsnv ?? msnv));
    const defaults = inferDefaultRoleAndTeam(msnv, form.position);
    const emp: EmployeeMaster = {
      id: existing?.id ?? `emp_${msnv}`,
      msnv,
      fullName,
      position: form.position.trim() || 'Nhân viên',
      department: form.department,
      team: form.team,
      role: existing?.role ?? defaults.role,
      baseSalary2020: lcb,
      hsCV,
      hsTN,
      active: existing?.active ?? true,
      sortOrder:
        existing?.sortOrder ?? Math.max(0, ...employees.map((e) => e.sortOrder)) + 1,
    };
    const err = onUpsertEmployee(emp, !editingMsnv);
    if (err) return setError(err);
    setShowForm(false);
    setInfo(
      editingMsnv
        ? `Đã cập nhật ${fullName} (${TEAM_LABELS[form.team]}). Hệ số mới áp dụng cho kỳ ${activePeriodLabel}; các kỳ cũ giữ nguyên.`
        : `Đã thêm ${fullName} (${TEAM_LABELS[form.team]}) vào danh sách và kỳ ${activePeriodLabel} (công = 0).`,
    );
  };

  const handleImport = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file || readOnly) return;
    try {
      const grid = await readSpreadsheetRows(file);
      const startOrder = Math.max(0, ...employees.map((e) => e.sortOrder)) + 1;
      const list = parseEmployeesFromGrid(grid, startOrder);
      if (list.length === 0) {
        setInfo(
          'Không đọc được nhân sự nào. Cấu trúc cột: MSNV | Họ tên | Chức vụ | Bộ phận (Văn phòng/Dây chuyền) | LCB 2020 | HS CV | HS TN.',
        );
        return;
      }
      const { added, updated } = onImportEmployees(list);
      setInfo(`Nhập từ "${file.name}": thêm mới ${added}, cập nhật ${updated} nhân sự.`);
    } catch (err) {
      setInfo(err instanceof Error ? err.message : 'Không đọc được file nhân sự.');
    }
  };

  const inputCls =
    'w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none';

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Hồ sơ Nhân sự, Phân Tổ & Hệ số định mức
            </h2>
            <p className="text-xs text-slate-500">
              Sửa hệ số hoặc luân chuyển Tổ áp dụng cho kỳ đang mở ({activePeriodLabel}) và các kỳ
              tạo sau; các kỳ lương đã qua giữ nguyên bản chụp.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2 h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm MSNV, tên, chức vụ..."
                className="w-56 rounded-lg border border-slate-300 py-1.5 pl-8 pr-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={showLocked}
                onChange={(e) => setShowLocked(e.target.checked)}
              />
              Hiện NV đã khóa
            </label>
            {!readOnly && (
              <>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                  <Upload className="h-3.5 w-3.5" /> Upload Excel nhân sự
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={handleImport}
                  />
                </label>
                <button
                  type="button"
                  onClick={openNew}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <Plus className="h-3.5 w-3.5" /> Thêm nhân sự
                </button>
              </>
            )}
          </div>
        </div>

        {info && (
          <div className="mb-3 flex items-start justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
            <span>{info}</span>
            <button type="button" onClick={() => setInfo(null)} aria-label="Đóng">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {showForm && !readOnly && (
          <form
            onSubmit={handleSubmit}
            className="mb-5 grid gap-3 rounded-lg border border-blue-200 bg-blue-50/40 p-4 sm:grid-cols-9"
          >
            <div className="sm:col-span-1">
              <label className="mb-1 block text-xs font-semibold text-slate-700">MSNV</label>
              <input
                value={form.msnv}
                disabled={!!editingMsnv}
                onChange={(e) => setForm({ ...form, msnv: e.target.value })}
                className={`${inputCls} disabled:bg-slate-100`}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-700">Họ và tên</label>
              <input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-1">
              <label className="mb-1 block text-xs font-semibold text-slate-700">Chức vụ</label>
              <input
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-1">
              <label className="mb-1 block text-xs font-semibold text-slate-700">Bộ phận</label>
              <select
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value as Department })}
                className={inputCls}
              >
                <option value="van_phong">Văn phòng</option>
                <option value="day_chuyen">Dây chuyền 1+2</option>
              </select>
            </div>
            <div className="sm:col-span-1">
              <label className="mb-1 block text-xs font-semibold text-slate-700">Phân Tổ</label>
              <select
                value={form.team}
                onChange={(e) => setForm({ ...form, team: e.target.value as TeamGroup })}
                className={inputCls}
              >
                <option value="ban_lanh_dao">Ban lãnh đạo</option>
                <option value="to_co_ly">Tổ Cơ lý</option>
                <option value="to_qc_kcs">Tổ QC / KCS</option>
                <option value="thong_ke">Thống kê</option>
              </select>
            </div>
            <div className="sm:col-span-1">
              <label className="mb-1 block text-xs font-semibold text-slate-700">LCB 2020</label>
              <input
                value={form.baseSalary2020}
                onChange={(e) => setForm({ ...form, baseSalary2020: e.target.value })}
                className={`${inputCls} text-right`}
              />
            </div>
            <div className="sm:col-span-1">
              <label className="mb-1 block text-xs font-semibold text-slate-700">HS CV (G)</label>
              <input
                value={form.hsCV}
                onChange={(e) => setForm({ ...form, hsCV: e.target.value })}
                className={`${inputCls} text-right`}
              />
            </div>
            <div className="sm:col-span-1">
              <label className="mb-1 block text-xs font-semibold text-slate-700">HS TN (H)</label>
              <input
                value={form.hsTN}
                onChange={(e) => setForm({ ...form, hsTN: e.target.value })}
                className={`${inputCls} text-right`}
              />
            </div>
            <div className="flex items-end justify-between gap-2 sm:col-span-9">
              <span className="text-xs text-rose-700">{error}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <Save className="h-3.5 w-3.5" /> {editingMsnv ? 'Lưu thay đổi' : 'Thêm mới'}
                </button>
              </div>
            </div>
          </form>
        )}

        {groups.map(({ dept, title }) => {
          const list = filtered.filter((e) => e.department === dept);
          return (
            <div key={dept} className="mb-5 overflow-x-auto">
              <h3 className="mb-2 text-sm font-bold text-slate-800">
                {title}{' '}
                <span className="font-normal text-slate-500">
                  ({list.filter((e) => e.active).length} đang làm / {list.length})
                </span>
              </h3>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-600">
                    <th className="px-3 py-2">MSNV</th>
                    <th className="px-3 py-2">Họ và tên</th>
                    <th className="px-3 py-2">Chức vụ</th>
                    <th className="px-3 py-2">Phân Tổ chuyên môn</th>
                    <th className="px-3 py-2 text-right">LCB 2020</th>
                    <th className="px-3 py-2 text-right">HS CV</th>
                    <th className="px-3 py-2 text-right">HS TN</th>
                    <th className="px-3 py-2 text-right">HS Cộng</th>
                    <th className="px-3 py-2 text-center">Trạng thái</th>
                    {!readOnly && <th className="px-3 py-2 text-center">Thao tác</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {list.map((e) => {
                    const team = e.team ?? inferDefaultRoleAndTeam(e.msnv, e.position).team;
                    return (
                      <tr
                        key={e.msnv}
                        className={e.active ? 'hover:bg-slate-50' : 'bg-slate-50 text-slate-400'}
                      >
                        <td className="px-3 py-1.5 font-mono">{e.msnv}</td>
                        <td className="px-3 py-1.5 font-medium">{e.fullName}</td>
                        <td className="px-3 py-1.5">{e.position}</td>
                        <td className="px-3 py-1.5">
                          <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            {TEAM_LABELS[team]}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {formatVND(e.baseSalary2020)}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {formatDecimal(e.hsCV)}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {formatDecimal(e.hsTN)}
                        </td>
                        <td className="px-3 py-1.5 text-right font-semibold tabular-nums">
                          {formatDecimal(e.hsCV + e.hsTN)}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {e.active ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                              Đang làm
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                              Đã khóa
                            </span>
                          )}
                        </td>
                        {!readOnly && (
                          <td className="px-3 py-1.5 text-center">
                            <div className="inline-flex gap-1">
                              <button
                                type="button"
                                onClick={() => openEdit(e)}
                                className="rounded p-1 text-slate-500 hover:bg-blue-50 hover:text-blue-700"
                                title="Sửa"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const msg = e.active
                                    ? `Khóa ${e.fullName}? Nhân sự sẽ bị loại khỏi kỳ ${activePeriodLabel} (kỳ cũ giữ nguyên).`
                                    : `Mở khóa ${e.fullName} và thêm lại vào kỳ ${activePeriodLabel} (công = 0)?`;
                                  if (window.confirm(msg)) onToggleLock(e.msnv);
                                }}
                                className="rounded p-1 text-slate-500 hover:bg-amber-50 hover:text-amber-700"
                                title={e.active ? 'Khóa (nghỉ việc)' : 'Mở khóa'}
                              >
                                {e.active ? (
                                  <Lock className="h-4 w-4" />
                                ) : (
                                  <Unlock className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {list.length === 0 && (
                    <tr>
                      <td
                        colSpan={readOnly ? 9 : 10}
                        className="px-3 py-3 text-center text-xs text-slate-400"
                      >
                        Không có nhân sự phù hợp.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          );
        })}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-900">
          <History className="h-4 w-4" /> Lịch sử biến động nhân sự & hệ số
        </h2>
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-3 py-1.5">Thời điểm</th>
                <th className="px-3 py-1.5">Kỳ áp dụng</th>
                <th className="px-3 py-1.5">MSNV</th>
                <th className="px-3 py-1.5">Họ tên</th>
                <th className="px-3 py-1.5">Hành động</th>
                <th className="px-3 py-1.5">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {hrChangeLog.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-center text-slate-400">
                    Chưa có biến động nào.
                  </td>
                </tr>
              ) : (
                [...hrChangeLog].reverse().slice(0, 200).map((l) => (
                  <tr key={l.id}>
                    <td className="px-3 py-1.5 tabular-nums">
                      {new Date(l.timestamp).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-3 py-1.5">{l.periodKey}</td>
                    <td className="px-3 py-1.5 font-mono">{l.msnv}</td>
                    <td className="px-3 py-1.5">{l.fullName}</td>
                    <td className="px-3 py-1.5">
                      {{
                        create: 'Thêm mới',
                        update: 'Cập nhật',
                        lock: 'Khóa',
                        unlock: 'Mở khóa',
                        import: 'Nhập file',
                      }[l.action]}
                    </td>
                    <td className="px-3 py-1.5 text-slate-600">{l.detail}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
