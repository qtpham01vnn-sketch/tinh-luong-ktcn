import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Building2,
  Calculator,
  CalendarPlus,
  CheckCircle2,
  Cloud,
  CloudOff,
  CloudUpload,
  Factory,
  FileSpreadsheet,
  FolderInput,
  KeyRound,
  Lock,
  LockOpen,
  LogOut,
  Printer,
  RefreshCw,
  Scale,
  ShieldCheck,
  Trash2,
  Users,
  Wrench,
} from 'lucide-react';
import type {
  AppState,
  AuthAccount,
  EmployeeMaster,
  HrChangeLogEntry,
  PayrollPeriod,
  PolicyDecision,
  SignatureConfig,
  TeamGroup,
  UserRole,
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
import {
  buildDefaultAuthAccounts,
  filterPayrollByRole,
  getRolePermissions,
  normalizeMsnv4,
  sha256Hex,
  TEAM_LABELS,
} from './utils/rbacAuth';
import {
  deleteDecisionFromCloud,
  deletePeriodFromCloud,
  fetchCloudAppState,
  isSupabaseConfigured,
  pushFullStateToCloud,
  syncDecisionsToCloud,
  syncEmployeesAndPinsToCloud,
  syncPeriodToCloud,
  syncSinglePinToCloud,
} from './lib/supabase';
import { Tab1MonthlyHub } from './components/Tab1MonthlyHub';
import { Tab2HR } from './components/Tab2HR';
import { Tab3Payroll } from './components/Tab3Payroll';
import { Tab4Analytics } from './components/Tab4Analytics';
import { Tab5Export } from './components/Tab5Export';
import { TabTbtmCompare } from './components/TabTbtmCompare';
import { DEFAULT_OCT_2026_INPUTS, TabPxsx, type LineProductInput } from './components/TabPxsx';
import { TabPxcd } from './components/TabPxcd';
import { MASTER_TARIFFS_2026 } from './data/masterTariffs2026';
import { PrintPreview } from './components/PrintPreview';
import { PrintPreviewTBTM } from './components/PrintPreviewTBTM';
import { calculateTBTM, exportTbtmToExcel } from './utils/tbtmCalc';
import { LoginScreen } from './components/LoginScreen';
import { ChangePinModal, SecurityAdminModal } from './components/SecurityModal';
import { EmployeeSelfView } from './components/EmployeeSelfView';

type DeptKey = 'PKTCN' | 'PXSX' | 'PXCD';
type TabKey = 'tab1' | 'tab2' | 'tab3' | 'tab4' | 'tab5' | 'tab_tbtm';
type CloudSyncStatus = 'offline' | 'connecting' | 'synced' | 'syncing' | 'empty_cloud' | 'error';

const SESSION_STORAGE_KEY = 'ktcn_payroll_session_msnv_v1';

export function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [loggedInMsnv, setLoggedInMsnv] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(SESSION_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [activeDept, setActiveDept] = useState<DeptKey>('PKTCN');
  const [activeTab, setActiveTab] = useState<TabKey>('tab1');
  const [sharedProductionItems, setSharedProductionItems] = useState<LineProductInput[]>(
    () => DEFAULT_OCT_2026_INPUTS,
  );
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [newPeriodInput, setNewPeriodInput] = useState<string>('');
  const [showNewPeriodModal, setShowNewPeriodModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showChangePinModal, setShowChangePinModal] = useState(false);

  // Trạng thái đồng bộ Supabase Cloud
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>(
    isSupabaseConfigured ? 'connecting' : 'offline',
  );
  const [cloudMessage, setCloudMessage] = useState<string | null>(null);
  const periodSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Luôn lưu dự phòng xuống localStorage (Zero-Downtime Fallback)
  useEffect(() => {
    const err = saveState(state);
    setStorageWarning(err);
  }, [state]);

  // Tự động tải dữ liệu mới nhất từ Supabase Cloud khi mở App
  const loadFromCloud = async () => {
    if (!isSupabaseConfigured) {
      setCloudStatus('offline');
      return;
    }
    setCloudStatus('connecting');
    const res = await fetchCloudAppState(state);
    if (!res.ok) {
      setCloudStatus('error');
      setCloudMessage(`Chế độ Offline (Lỗi Cloud: ${res.error})`);
      return;
    }
    if (res.isEmpty) {
      setCloudStatus('empty_cloud');
      setCloudMessage('Supabase Cloud đã kết nối nhưng chưa có dữ liệu. Hãy bấm "Đẩy dữ liệu mẫu T10/2026 lên Cloud".');
      return;
    }
    if (res.state) {
      setState(res.state);
      setCloudStatus('synced');
      setCloudMessage(null);
    }
  };

  useEffect(() => {
    void loadFromCloud();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hàm đẩy toàn bộ dữ liệu mẫu / hiện tại lên Supabase Cloud bằng 1 cú click
  const handlePushSampleToCloud = async () => {
    if (!isSupabaseConfigured) return;
    setCloudStatus('syncing');
    setCloudMessage('Đang đẩy toàn bộ dữ liệu 23 nhân sự, PIN & bảng lương lên Supabase Cloud...');
    const res = await pushFullStateToCloud(state);
    if (res.ok) {
      setCloudStatus('synced');
      setCloudMessage('Đã đồng bộ 100% dữ liệu lên Supabase Cloud thành công!');
      setTimeout(() => setCloudMessage(null), 4000);
    } else {
      setCloudStatus('error');
      setCloudMessage(`Không thể đẩy lên Cloud: ${res.error}`);
    }
  };

  // Helper tự động đồng bộ Kỳ lương lên Supabase (debounce 600ms để gõ phím mượt)
  const scheduleSyncPeriodToCloud = (periodToSync: PayrollPeriod, signatures: SignatureConfig) => {
    if (!isSupabaseConfigured) return;
    if (periodSyncTimerRef.current) {
      clearTimeout(periodSyncTimerRef.current);
    }
    setCloudStatus('syncing');
    periodSyncTimerRef.current = setTimeout(async () => {
      const res = await syncPeriodToCloud(periodToSync, signatures);
      setCloudStatus(res.ok ? 'synced' : 'error');
      if (!res.ok) setCloudMessage(`Lỗi lưu Cloud: ${res.error}`);
    }, 600);
  };

  const authAccounts = useMemo(
    () => buildDefaultAuthAccounts(state.employees, state.authAccounts),
    [state.employees, state.authAccounts],
  );

  const currentEmployee = useMemo(() => {
    if (!loggedInMsnv) return undefined;
    const norm = normalizeMsnv4(loggedInMsnv);
    return state.employees.find((e) => normalizeMsnv4(e.msnv) === norm && e.active);
  }, [loggedInMsnv, state.employees]);

  const currentAccount = useMemo(() => {
    if (!currentEmployee) return undefined;
    const acc = authAccounts[currentEmployee.msnv];
    if (!acc || !acc.accessGranted) return undefined;
    return acc;
  }, [authAccounts, currentEmployee]);

  const perms = useMemo(
    () => (currentAccount ? getRolePermissions(currentAccount) : null),
    [currentAccount],
  );

  const periodKeys = useMemo(() => Object.keys(state.periods).sort(), [state.periods]);
  const activePeriod: PayrollPeriod =
    state.periods[state.activePeriodKey] ?? state.periods[periodKeys[periodKeys.length - 1]];

  const isPeriodLocked = activePeriod.status === 'LOCKED';
  const canEditActivePeriod = Boolean(perms?.canEdit && !isPeriodLocked);

  const allCalcs = useMemo(() => {
    return periodKeys.map((k) => ({
      period: state.periods[k],
      calc: calculatePayroll(state.periods[k]),
    }));
  }, [periodKeys, state.periods]);

  // Luôn chạy engine tính toán trên toàn bộ 23 nhân sự để đơn giá & tiền lương chuẩn tuyệt đối
  const fullCalc = useMemo(() => calculatePayroll(activePeriod), [activePeriod]);
  const tbtmSummary = useMemo(
    () => calculateTBTM(activePeriod, fullCalc).summary,
    [activePeriod, fullCalc],
  );

  // Lọc kết quả hiển thị theo đúng cấp độ phân quyền (Strict Data Isolation)
  const visibleCalc = useMemo(() => {
    if (!currentAccount) return fullCalc;
    return filterPayrollByRole(fullCalc, currentAccount, authAccounts, state.employees);
  }, [fullCalc, currentAccount, authAccounts, state.employees]);

  const handleLoginSuccess = (account: AuthAccount) => {
    setLoggedInMsnv(account.msnv);
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, account.msnv);
    } catch {
      // ignore sessionStorage error
    }
    setActiveTab('tab3');
  };

  const handleLogout = () => {
    setLoggedInMsnv(null);
    setShowSecurityModal(false);
    setShowChangePinModal(false);
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  // Bảo vệ nghiêm ngặt: Chỉ Admin (canEdit === true) và Kỳ lương chưa khóa sổ (DRAFT) mới được sửa
  const handleUpdatePeriod = (updater: (prev: PayrollPeriod) => PayrollPeriod) => {
    if (!perms?.canEdit) return;
    setState((prev) => {
      const cur = prev.periods[prev.activePeriodKey];
      if (!cur || cur.status === 'LOCKED') return prev;
      const updated = updater(cur);
      scheduleSyncPeriodToCloud(updated, prev.signatures);
      return {
        ...prev,
        periods: {
          ...prev.periods,
          [prev.activePeriodKey]: updated,
        },
      };
    });
  };

  // Khóa sổ / Mở khóa kỳ lương (LOCKED / DRAFT) dành cho Admin
  const handleTogglePeriodLock = () => {
    if (!perms?.canEdit) return;
    const nextStatus = isPeriodLocked ? 'DRAFT' : 'LOCKED';
    if (
      nextStatus === 'LOCKED' &&
      !window.confirm(
        `Xác nhận KHÓA SỔ kỳ lương "${activePeriod.label}"?\n\nSau khi khóa sổ, toàn bộ số liệu và hệ số snapshot của tháng này sẽ được đóng băng chống sửa nhầm (bảo toàn lịch sử vĩnh viễn).`,
      )
    ) {
      return;
    }
    setState((prev) => {
      const cur = prev.periods[prev.activePeriodKey];
      if (!cur) return prev;
      const updated: PayrollPeriod = { ...cur, status: nextStatus };
      scheduleSyncPeriodToCloud(updated, prev.signatures);
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
    if (!perms?.canEdit) return;
    const latestKey = periodKeys[periodKeys.length - 1] || '2026-10';
    setNewPeriodInput(nextPeriodKey(latestKey));
    setShowNewPeriodModal(true);
  };

  const handleCreateNewPeriod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!perms?.canEdit) return;
    if (!isValidPeriodKey(newPeriodInput)) return;
    if (state.periods[newPeriodInput]) {
      setState((prev) => ({ ...prev, activePeriodKey: newPeriodInput }));
      setShowNewPeriodModal(false);
      return;
    }
    setState((prev) => {
      const created = buildPeriodFromPrevious(prev, newPeriodInput, prev.activePeriodKey);
      scheduleSyncPeriodToCloud(created, prev.signatures);
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
    if (!perms?.canEdit) return;
    if (isPeriodLocked) {
      window.alert('Kỳ lương đang ở trạng thái ĐÃ KHÓA SỔ. Vui lòng mở khóa sổ trước khi xóa.');
      return;
    }
    if (periodKeys.length <= 1) return;
    if (!window.confirm(`Xóa kỳ lương ${activePeriod.label}? Dữ liệu kỳ này sẽ mất vĩnh viễn.`)) {
      return;
    }
    const deletedKey = activePeriod.periodKey;
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
    if (isSupabaseConfigured) {
      void deletePeriodFromCloud(deletedKey);
    }
  };

  // Tab 1 Policy handlers
  const handleAddPolicy = (policy: PolicyDecision) => {
    if (!perms?.canEdit) return;
    setState((prev) => {
      const nextPolicies = [policy, ...prev.policies];
      if (isSupabaseConfigured) {
        void syncDecisionsToCloud(nextPolicies);
      }
      return {
        ...prev,
        policies: nextPolicies,
      };
    });
  };

  const handleDeletePolicy = (id: string) => {
    if (!perms?.canEdit) return;
    setState((prev) => ({
      ...prev,
      policies: prev.policies.filter((p) => p.id !== id),
    }));
    if (isSupabaseConfigured) {
      void deleteDecisionFromCloud(id);
    }
  };

  // Tab 2 HR handlers (preserve historical & LOCKED periods, only update current DRAFT period)
  const handleUpsertEmployee = (emp: EmployeeMaster, isNew: boolean): string | null => {
    if (!perms?.canEdit) return 'Chỉ Admin mới có quyền chỉnh sửa nhân sự.';
    if (isNew && state.employees.some((e) => normalizeMsnv4(e.msnv) === normalizeMsnv4(emp.msnv))) {
      return `MSNV ${emp.msnv} đã tồn tại trong danh sách.`;
    }
    setState((prev) => {
      const nextEmployees = isNew
        ? [...prev.employees, emp]
        : prev.employees.map((e) => (e.msnv === emp.msnv ? emp : e));

      const curPeriod = prev.periods[prev.activePeriodKey];
      const isCurLocked = curPeriod.status === 'LOCKED';
      const existingRec = curPeriod.records[emp.msnv];
      const nextRecords = isCurLocked
        ? curPeriod.records
        : {
            ...curPeriod.records,
            [emp.msnv]: snapshotFromEmployee(emp, existingRec),
          };

      const nextAuth = buildDefaultAuthAccounts(nextEmployees, prev.authAccounts);
      if (nextAuth[emp.msnv] && emp.team && emp.role) {
        nextAuth[emp.msnv] = {
          ...nextAuth[emp.msnv],
          team: emp.team,
          role: emp.role,
        };
      }

      const updatedPeriod: PayrollPeriod = {
        ...curPeriod,
        records: nextRecords,
      };

      if (isSupabaseConfigured) {
        setCloudStatus('syncing');
        void syncEmployeesAndPinsToCloud(nextEmployees, nextAuth).then((r) => {
          setCloudStatus(r.ok ? 'synced' : 'error');
        });
        if (!isCurLocked) {
          scheduleSyncPeriodToCloud(updatedPeriod, prev.signatures);
        }
      }

      const logEntry: HrChangeLogEntry = {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        periodKey: prev.activePeriodKey,
        msnv: emp.msnv,
        fullName: emp.fullName,
        action: isNew ? 'create' : 'update',
        detail: `${emp.position} | BP: ${emp.department === 'van_phong' ? 'Văn phòng' : 'Dây chuyền'} | Tổ: ${emp.team ? TEAM_LABELS[emp.team] : ''} | HS CV: ${emp.hsCV}, HS TN: ${emp.hsTN}`,
      };

      return {
        ...prev,
        employees: nextEmployees,
        authAccounts: nextAuth,
        periods: {
          ...prev.periods,
          [prev.activePeriodKey]: updatedPeriod,
        },
        hrChangeLog: [...prev.hrChangeLog, logEntry],
      };
    });
    return null;
  };

  const handleToggleLock = (msnv: string) => {
    if (!perms?.canEdit) return;
    setState((prev) => {
      const target = prev.employees.find((e) => e.msnv === msnv);
      if (!target) return prev;
      const nextActive = !target.active;
      const nextEmp: EmployeeMaster = { ...target, active: nextActive };
      const nextEmployees = prev.employees.map((e) => (e.msnv === msnv ? nextEmp : e));
      const nextAuth = buildDefaultAuthAccounts(nextEmployees, prev.authAccounts);

      const curPeriod = prev.periods[prev.activePeriodKey];
      const isCurLocked = curPeriod.status === 'LOCKED';
      const nextRecords = { ...curPeriod.records };
      if (!isCurLocked) {
        if (!nextActive) {
          delete nextRecords[msnv];
        } else {
          nextRecords[msnv] = snapshotFromEmployee(nextEmp);
        }
      }

      const updatedPeriod: PayrollPeriod = {
        ...curPeriod,
        records: nextRecords,
      };

      if (isSupabaseConfigured) {
        void syncEmployeesAndPinsToCloud(nextEmployees, nextAuth);
        if (!isCurLocked) {
          scheduleSyncPeriodToCloud(updatedPeriod, prev.signatures);
        }
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
        authAccounts: nextAuth,
        periods: {
          ...prev.periods,
          [prev.activePeriodKey]: updatedPeriod,
        },
        hrChangeLog: [...prev.hrChangeLog, logEntry],
      };
    });
  };

  const handleImportEmployees = (
    imported: EmployeeMaster[],
  ): { added: number; updated: number } => {
    if (!perms?.canEdit) return { added: 0, updated: 0 };
    let added = 0;
    let updated = 0;
    setState((prev) => {
      const map = new Map(prev.employees.map((e) => [e.msnv, e]));
      const curPeriod = prev.periods[prev.activePeriodKey];
      const isCurLocked = curPeriod.status === 'LOCKED';
      const nextRecords = { ...curPeriod.records };

      for (const imp of imported) {
        const old = map.get(imp.msnv);
        if (old) {
          updated++;
          const merged = { ...old, ...imp, sortOrder: old.sortOrder };
          map.set(imp.msnv, merged);
          if (!isCurLocked) {
            nextRecords[imp.msnv] = snapshotFromEmployee(merged, nextRecords[imp.msnv]);
          }
        } else {
          added++;
          map.set(imp.msnv, imp);
          if (!isCurLocked) {
            nextRecords[imp.msnv] = snapshotFromEmployee(imp);
          }
        }
      }

      const nextEmployees = Array.from(map.values());
      const nextAuth = buildDefaultAuthAccounts(nextEmployees, prev.authAccounts);
      const updatedPeriod: PayrollPeriod = {
        ...curPeriod,
        records: nextRecords,
      };

      if (isSupabaseConfigured) {
        void syncEmployeesAndPinsToCloud(nextEmployees, nextAuth);
        if (!isCurLocked) {
          scheduleSyncPeriodToCloud(updatedPeriod, prev.signatures);
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
        employees: nextEmployees,
        authAccounts: nextAuth,
        periods: {
          ...prev.periods,
          [prev.activePeriodKey]: updatedPeriod,
        },
        hrChangeLog: [...prev.hrChangeLog, logEntry],
      };
    });
    return { added, updated };
  };

  const handleUpdateSignatures = (signatures: SignatureConfig) => {
    if (!perms?.canEdit) return;
    setState((prev) => {
      const cur = prev.periods[prev.activePeriodKey];
      if (cur) scheduleSyncPeriodToCloud(cur, signatures);
      return { ...prev, signatures };
    });
  };

  // Security & PIN Handlers (đồng bộ trực tiếp lên bảng ktcn_security_pins trên Supabase)
  const handleUpdateAccount = (msnv: string, updater: (prevAcc: AuthAccount) => AuthAccount) => {
    if (!perms?.canManageSecurity) return;
    setState((prev) => {
      const currentAuth = buildDefaultAuthAccounts(prev.employees, prev.authAccounts);
      const target = currentAuth[msnv];
      if (!target) return prev;
      const updatedAcc = updater(target);
      if (isSupabaseConfigured) {
        setCloudStatus('syncing');
        void syncSinglePinToCloud(updatedAcc).then((r) => {
          setCloudStatus(r.ok ? 'synced' : 'error');
        });
      }
      return {
        ...prev,
        authAccounts: {
          ...currentAuth,
          [msnv]: updatedAcc,
        },
      };
    });
  };

  const handleUpdateEmployeeTeamRole = (msnv: string, team: TeamGroup, role: UserRole) => {
    if (!perms?.canManageSecurity) return;
    setState((prev) => {
      const nextEmployees = prev.employees.map((e) =>
        e.msnv === msnv ? { ...e, team, role } : e,
      );
      const currentAuth = buildDefaultAuthAccounts(nextEmployees, prev.authAccounts);
      if (currentAuth[msnv]) {
        currentAuth[msnv] = {
          ...currentAuth[msnv],
          team,
          role,
          updatedAt: new Date().toISOString().slice(0, 10),
        };
      }
      const curPeriod = prev.periods[prev.activePeriodKey];
      const nextRecords = { ...curPeriod.records };
      if (nextRecords[msnv]) {
        nextRecords[msnv] = { ...nextRecords[msnv], team };
      }
      const updatedPeriod: PayrollPeriod = {
        ...curPeriod,
        records: nextRecords,
      };
      if (isSupabaseConfigured) {
        setCloudStatus('syncing');
        void syncEmployeesAndPinsToCloud(nextEmployees, currentAuth).then((r) => {
          setCloudStatus(r.ok ? 'synced' : 'error');
        });
        scheduleSyncPeriodToCloud(updatedPeriod, prev.signatures);
      }
      return {
        ...prev,
        employees: nextEmployees,
        authAccounts: currentAuth,
        periods: {
          ...prev.periods,
          [prev.activePeriodKey]: updatedPeriod,
        },
      };
    });
  };

  const handleBulkGrantAll = (grant: boolean) => {
    if (!perms?.canManageSecurity) return;
    setState((prev) => {
      const currentAuth = buildDefaultAuthAccounts(prev.employees, prev.authAccounts);
      const nextAuth: Record<string, AuthAccount> = {};
      for (const [k, acc] of Object.entries(currentAuth)) {
        const isLeadership = acc.normalizedMsnv === '1439' || acc.normalizedMsnv === '0266';
        nextAuth[k] = {
          ...acc,
          accessGranted: grant ? true : isLeadership,
          updatedAt: new Date().toISOString().slice(0, 10),
        };
      }
      if (isSupabaseConfigured) {
        setCloudStatus('syncing');
        void syncEmployeesAndPinsToCloud(prev.employees, nextAuth).then((r) => {
          setCloudStatus(r.ok ? 'synced' : 'error');
        });
      }
      return { ...prev, authAccounts: nextAuth };
    });
  };

  const handleBulkResetDefaultPins = () => {
    if (!perms?.canManageSecurity) return;
    setState((prev) => {
      const currentAuth = buildDefaultAuthAccounts(prev.employees, prev.authAccounts);
      const nextAuth: Record<string, AuthAccount> = {};
      for (const [k, acc] of Object.entries(currentAuth)) {
        const defPin = acc.normalizedMsnv;
        nextAuth[k] = {
          ...acc,
          pinHash: sha256Hex(defPin),
          pinDisplayForAdmin: defPin,
          updatedAt: new Date().toISOString().slice(0, 10),
        };
      }
      if (isSupabaseConfigured) {
        setCloudStatus('syncing');
        void syncEmployeesAndPinsToCloud(prev.employees, nextAuth).then((r) => {
          setCloudStatus(r.ok ? 'synced' : 'error');
        });
      }
      return { ...prev, authAccounts: nextAuth };
    });
  };

  // Nhân viên hoặc bất kỳ user nào tự đổi mã PIN cá nhân -> lưu thẳng lên bảng ktcn_security_pins trên Supabase
  const handleChangeOwnPin = (newPin: string) => {
    if (!currentAccount) return;
    setState((prev) => {
      const currentAuth = buildDefaultAuthAccounts(prev.employees, prev.authAccounts);
      const acc = currentAuth[currentAccount.msnv];
      if (!acc) return prev;
      const updatedAcc: AuthAccount = {
        ...acc,
        pinHash: sha256Hex(newPin),
        pinDisplayForAdmin: newPin,
        updatedAt: new Date().toISOString().slice(0, 10),
      };
      if (isSupabaseConfigured) {
        setCloudStatus('syncing');
        void syncSinglePinToCloud(updatedAcc).then((r) => {
          setCloudStatus(r.ok ? 'synced' : 'error');
        });
      }
      return {
        ...prev,
        authAccounts: {
          ...currentAuth,
          [currentAccount.msnv]: updatedAcc,
        },
      };
    });
  };

  // Nếu chưa đăng nhập hoặc tài khoản bị thu hồi quyền -> Hiển thị màn hình Đăng nhập PIN 4 số
  if (!currentAccount || !currentEmployee || !perms) {
    return (
      <LoginScreen
        employees={state.employees}
        authAccounts={authAccounts}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  const allTabs: {
    key: TabKey;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
    visible: boolean;
  }[] = [
    {
      key: 'tab1',
      label: 'Tab 1: Nhập liệu & Chứng từ tháng',
      shortLabel: '1. Nhập liệu & Chứng từ',
      icon: <FolderInput className="h-4 w-4" />,
      visible: perms.canViewAllRoom,
    },
    {
      key: 'tab2',
      label: 'Tab 2: Quản lý Nhân sự & Hệ số',
      shortLabel: '2. Nhân sự & Hệ số',
      icon: <Users className="h-4 w-4" />,
      visible: perms.canViewAllRoom,
    },
    {
      key: 'tab3',
      label: 'Tab 3: Bảng Tính lương & Đối soát',
      shortLabel: perms.canViewTeamOnly
        ? `Bảng lương ${TEAM_LABELS[currentAccount.team]}`
        : '3. Bảng Tính lương',
      icon: <Calculator className="h-4 w-4" />,
      visible: !perms.isSelfOnly,
    },
    {
      key: 'tab_tbtm',
      label: 'Tab Đối chiếu Chuẩn TBTM (26 công)',
      shortLabel: 'Đối chiếu Chuẩn TBTM (26 công)',
      icon: <Scale className="h-4 w-4 text-amber-300" />,
      visible: perms.canViewAllRoom, // Chỉ Admin (1439) và Trưởng phòng (0266)
    },
    {
      key: 'tab4',
      label: 'Tab 4: Phân tích & Biến động tháng',
      shortLabel: '4. Báo cáo Phân tích',
      icon: <BarChart3 className="h-4 w-4" />,
      visible: perms.canViewAllRoom,
    },
    {
      key: 'tab5',
      label: 'Tab 5: Xuất Excel NĐ30 & Sao lưu',
      shortLabel: perms.canViewTeamOnly ? 'Xuất Excel & In Tổ' : '5. Xuất NĐ30 & In/Sao lưu',
      icon: <FileSpreadsheet className="h-4 w-4" />,
      visible: !perms.isSelfOnly,
    },
  ];

  const visibleTabs = allTabs.filter((t) => t.visible);
  const { summary } = fullCalc;

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
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold tracking-wider text-blue-300 uppercase">
                  Công ty Cổ phần Gạch Men Phương Nam
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    perms.canEdit
                      ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40'
                      : 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/40'
                  }`}
                >
                  {perms.canEdit ? (
                    <ShieldCheck className="h-3 w-3" />
                  ) : (
                    <Lock className="h-3 w-3" />
                  )}
                  {perms.badgeText}
                </span>

                {/* Huy hiệu Trạng thái Cloud (Supabase) vs Offline/Local */}
                {cloudStatus === 'synced' || cloudStatus === 'syncing' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-400/40">
                    {cloudStatus === 'syncing' ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <Cloud className="h-3 w-3" />
                    )}
                    {cloudStatus === 'syncing'
                      ? 'Đang đồng bộ Cloud...'
                      : 'Đã đồng bộ Cloud (Supabase)'}
                  </span>
                ) : cloudStatus === 'empty_cloud' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[10px] font-bold text-blue-200 ring-1 ring-blue-400/40">
                    <CloudUpload className="h-3 w-3" /> Cloud sẵn sàng (Chưa khởi tạo)
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-slate-700 px-2.5 py-0.5 text-[10px] font-semibold text-slate-300"
                    title="Dữ liệu đang lưu trên trình duyệt (localStorage). Cấu hình VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY để đồng bộ Cloud."
                  >
                    <CloudOff className="h-3 w-3 text-slate-400" /> Chế độ Offline / Local
                  </span>
                )}
              </div>
              <h1 className="text-base font-bold tracking-tight sm:text-lg">
                Hệ thống Quản lý & Tính lương Phòng Kỹ thuật - Công nghệ
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Nút Đẩy dữ liệu mẫu T10/2026 lên Cloud (hiện khi Cloud trống hoặc cho Admin đồng bộ nhanh) */}
            {isSupabaseConfigured && perms.canEdit && (
              <button
                type="button"
                onClick={handlePushSampleToCloud}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold shadow transition ${
                  cloudStatus === 'empty_cloud'
                    ? 'animate-pulse bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                    : 'border border-emerald-500/40 bg-emerald-950/60 text-emerald-200 hover:bg-emerald-900/70'
                }`}
                title="Đẩy toàn bộ dữ liệu nhân sự, mã PIN và các kỳ lương hiện tại lên Supabase Cloud"
              >
                <CloudUpload className="h-3.5 w-3.5" />
                {cloudStatus === 'empty_cloud'
                  ? 'Đẩy dữ liệu mẫu Tháng 10/2026 lên Cloud'
                  : 'Đồng bộ lên Cloud'}
              </button>
            )}

            {/* Thông tin User đang đăng nhập */}
            <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/90 px-3 py-1.5 text-xs">
              <span className="font-mono font-bold text-amber-300">
                {currentAccount.normalizedMsnv}
              </span>
              <span className="font-semibold text-white">{currentEmployee.fullName}</span>
              <span className="hidden text-slate-400 sm:inline">({currentEmployee.position})</span>
            </div>

            {/* Bộ chọn Kỳ lương (Dropdown tất cả các tháng/năm) */}
            <div className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs">
              <span className="text-slate-400">Kỳ lương:</span>
              <select
                value={activePeriod.periodKey}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, activePeriodKey: e.target.value }))
                }
                className="rounded bg-slate-700 px-2 py-1 font-semibold text-white focus:outline-none"
              >
                {periodKeys.map((k) => {
                  const p = state.periods[k];
                  const lockTag = p.status === 'LOCKED' ? ' 🔒 Đã khóa sổ' : '';
                  return (
                    <option key={k} value={k}>
                      {p.label} ({k}){lockTag}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Khóa sổ / Mở khóa kỳ lương (LOCKED / DRAFT) cho Admin */}
            {perms.canEdit && (
              <button
                type="button"
                onClick={handleTogglePeriodLock}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  isPeriodLocked
                    ? 'bg-amber-600 text-white hover:bg-amber-500'
                    : 'border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
                title={
                  isPeriodLocked
                    ? 'Kỳ lương này đang Khóa sổ (chống sửa nhầm). Bấm để Mở khóa.'
                    : 'Khóa sổ tháng này sau khi đã chốt lương để đóng băng lịch sử.'
                }
              >
                {isPeriodLocked ? (
                  <>
                    <Lock className="h-3.5 w-3.5" /> Đã khóa sổ (Mở khóa)
                  </>
                ) : (
                  <>
                    <LockOpen className="h-3.5 w-3.5 text-emerald-400" /> Khóa sổ tháng này
                  </>
                )}
              </button>
            )}

            {perms.canEdit && (
              <>
                <button
                  type="button"
                  onClick={handleOpenNewPeriod}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
                >
                  <CalendarPlus className="h-3.5 w-3.5" /> + Tạo kỳ lương mới
                </button>

                {periodKeys.length > 1 && !isPeriodLocked && (
                  <button
                    type="button"
                    onClick={handleDeleteCurrentPeriod}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-950"
                    title="Xóa kỳ lương đang mở"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </>
            )}

            {perms.canManageSecurity && (
              <button
                type="button"
                onClick={() => setShowSecurityModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 shadow hover:bg-amber-400"
              >
                <ShieldCheck className="h-3.5 w-3.5" /> Quản lý Bảo mật & PIN
              </button>
            )}

            {activeDept === 'PKTCN' && (
              <button
                type="button"
                onClick={() => exportTbtmToExcel(activePeriod, calculateTBTM(activePeriod, fullCalc), state.signatures)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500"
                title="Xuất Excel Bảng chia lương Chuẩn Mới 26 công"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" /> Xuất Excel (26 công)
              </button>
            )}

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-700"
            >
              <Printer className="h-3.5 w-3.5" /> In / PDF
            </button>

            <button
              type="button"
              onClick={() => setShowChangePinModal(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
              title="Đổi mã PIN 4 số cá nhân"
            >
              <KeyRound className="h-3.5 w-3.5 text-amber-300" /> Đổi mã PIN
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1 rounded-lg bg-rose-600/90 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-600"
              title="Đăng xuất khỏi hệ thống"
            >
              <LogOut className="h-3.5 w-3.5" /> Đăng xuất
            </button>
          </div>
        </div>

        {/* 3 TAG BỘ PHẬN CHÍNH */}
        {!perms.isSelfOnly && perms.canViewAllRoom && (
          <div className="border-t border-slate-800 bg-slate-950/60">
            <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2 px-4 py-2">
              <span className="mr-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                Chọn Bộ phận:
              </span>
              <button
                type="button"
                onClick={() => setActiveDept('PKTCN')}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                  activeDept === 'PKTCN'
                    ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>1. P. Kỹ thuật - Công nghệ (P.KTCN)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveDept('PXSX')}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                  activeDept === 'PXSX'
                    ? 'bg-sky-600 text-white shadow-sm ring-1 ring-sky-400'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Factory className="h-3.5 w-3.5" />
                <span>2. PX. Sản xuất (PXSX: DC1 – DC2 – TBTM)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveDept('PXCD')}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                  activeDept === 'PXCD'
                    ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Wrench className="h-3.5 w-3.5" />
                <span>3. PX. Cơ điện - NL (PXCĐ-NL)</span>
              </button>
            </div>
          </div>
        )}

        {/* Navigation Tabs của P.KTCN (chỉ hiện khi đang ở Tag 1: P.KTCN) */}
        {!perms.isSelfOnly && activeDept === 'PKTCN' && (
          <div className="mx-auto max-w-[1600px] px-4">
            <nav className="flex gap-1 overflow-x-auto pt-1">
              {visibleTabs.map((t) => {
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
        )}
      </header>

      {/* Modal Quản lý Bảo mật & Cấp mã PIN (Chỉ Admin 1439) */}
      {showSecurityModal && perms.canManageSecurity && (
        <SecurityAdminModal
          employees={state.employees}
          authAccounts={authAccounts}
          onUpdateAccount={handleUpdateAccount}
          onUpdateEmployeeTeamRole={handleUpdateEmployeeTeamRole}
          onBulkGrantAll={handleBulkGrantAll}
          onBulkResetDefaultPins={handleBulkResetDefaultPins}
          onClose={() => setShowSecurityModal(false)}
        />
      )}

      {/* Modal Đổi mã PIN cá nhân (Mọi cấp) */}
      {showChangePinModal && (
        <ChangePinModal
          account={currentAccount}
          employeeName={currentEmployee.fullName}
          onChangePin={handleChangeOwnPin}
          onClose={() => setShowChangePinModal(false)}
        />
      )}

      {/* Modal tạo kỳ lương mới */}
      {showNewPeriodModal && perms.canEdit && (
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

        {cloudMessage && (
          <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-medium text-blue-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-600" />
              <span>{cloudMessage}</span>
            </div>
            {cloudStatus === 'empty_cloud' && perms.canEdit && (
              <button
                type="button"
                onClick={handlePushSampleToCloud}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white hover:bg-blue-700"
              >
                <CloudUpload className="h-3.5 w-3.5" /> Đẩy dữ liệu mẫu Tháng 10/2026 lên Cloud ngay
              </button>
            )}
          </div>
        )}

        {isPeriodLocked && (
          <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50/90 px-4 py-2.5 text-xs font-medium text-amber-950">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 shrink-0 text-amber-700" />
              <span>
                <strong>Kỳ lương {activePeriod.label} đã KHÓA SỔ (LOCKED):</strong> Toàn bộ số liệu
                công, quỹ lương và bản chụp hệ số (`snapshot`) của tháng này đã được đóng băng để
                bảo toàn lịch sử vĩnh viễn.
              </span>
            </div>
            {perms.canEdit && (
              <button
                type="button"
                onClick={handleTogglePeriodLock}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-400 bg-white px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
              >
                <LockOpen className="h-3.5 w-3.5" /> Mở khóa sổ để chỉnh sửa
              </button>
            )}
          </div>
        )}

        {/* KPI Strip (chỉ hiển thị cho P.KTCN ở Tab 2-5; Tab 1 đã có Banner + 3 Card đồng bộ với PXSX & PXCĐ-NL) */}
        {activeDept === 'PKTCN' && activeTab !== 'tab1' && (
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
                {formatVND(tbtmSummary.tongChiQuy)} đ
              </div>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5 shadow-sm">
              <div className="text-[11px] font-semibold text-indigo-700">
                Lương hệ số 1 (26 công)
              </div>
              <div className="mt-1 text-base font-bold text-indigo-900 tabular-nums">
                {formatVND(tbtmSummary.luongHS1CoThuong)} đ
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <div className="text-[11px] font-medium text-slate-500">
                Tổng công / HS công (26c)
              </div>
              <div className="mt-1 text-base font-bold text-slate-900 tabular-nums">
                {summary.tongCongKhoan.toFixed(2)} / {tbtmSummary.tongHSCongSP26.toFixed(3)}
              </div>
            </div>
          </div>
        )}

        {/* Giao diện theo Cấp phân quyền */}
        {perms.isSelfOnly ? (
          <>
            <div className="no-print">
              <EmployeeSelfView
                period={activePeriod}
                isolatedCalc={visibleCalc}
                account={currentAccount}
                policies={state.policies}
                signatures={state.signatures}
              />
            </div>
            <div className="hidden print:block">
              <PrintPreview period={activePeriod} calc={visibleCalc} sig={state.signatures} />
            </div>
          </>
        ) : activeDept === 'PXSX' && perms.canViewAllRoom ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs text-sky-900">
              <span className="font-bold text-sky-800">Thao tác hàng tháng (PXSX):</span>
              <span>
                <strong>Bước 1:</strong> Nhập <strong>Sản lượng m²</strong> từng loại gạch (DC1, DC2) &amp; <strong>Tiền khiếu nại</strong> ở tab Tổng hợp →
              </span>
              <span>
                <strong>Bước 2:</strong> Chọn <strong>TBTM / DC1 / DC2</strong> để xem bảng chia lương chi tiết từng MSNV (26 / 26.5 công).
              </span>
            </div>
            <TabPxsx
              periodLabel={activePeriod.label}
              sharedItems={sharedProductionItems}
              onChangeSharedItems={setSharedProductionItems}
            />
          </div>
        ) : activeDept === 'PXCD' && perms.canViewAllRoom ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900">
              <span className="font-bold text-emerald-800">Thao tác hàng tháng (PXCĐ-NL):</span>
              <span>
                <strong>Bước 1:</strong> Sản lượng m² DC1 &amp; DC2 đã tự đồng bộ từ bảng sản lượng chung → App tự tra đơn giá QĐ 01/KSX-2026 để tính Tổng quỹ lương 71 định biên.
              </span>
            </div>
            <TabPxcd
              periodLabel={activePeriod.label}
              sharedItems={sharedProductionItems}
              onChangeSharedItems={setSharedProductionItems}
            />
          </div>
        ) : (
          <>
            {perms.canViewAllRoom && (
              <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-900">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-blue-800">Thao tác hàng tháng (P.KTCN):</span>
                  <span>
                    <strong>B1 (Tab 1):</strong> Nhập Sản lượng cụm, Bảo dưỡng DC2 &amp; Giảm trừ →
                  </span>
                  <span>
                    <strong>B2 (Tab 2/3):</strong> Cập nhật Ngày công thực tế từng NV →
                  </span>
                  <span>
                    <strong>B3 (Tab 3/5):</strong> Kiểm tra &amp; Xuất Excel / In PDF.
                  </span>
                </div>
                {canEditActivePeriod && (
                  <button
                    type="button"
                    onClick={() => {
                      const pktcnQuotas = MASTER_TARIFFS_2026.PKTCN.quotas;
                      handleUpdatePeriod((prev) => ({
                        ...prev,
                        clusters: sharedProductionItems
                          .filter((it) => !it.noBonus && it.qtyM2 > 0)
                          .map((it) => ({
                            id: `sync_${it.id}`,
                            name: it.label,
                            quantity: it.qtyM2,
                            unitPrice:
                              it.productCode === '60x60'
                                ? 387
                                : pktcnQuotas[it.productCode].unitPriceVND,
                            bonusOutputPct: it.bonusSlPct,
                            bonusQualityPct: it.bonusClPct,
                          })),
                      }));
                    }}
                    className="rounded-lg bg-blue-700 px-3 py-1 text-xs font-bold text-white shadow-sm hover:bg-blue-800"
                  >
                    Đồng bộ Sản lượng m² từ Bảng chung
                  </button>
                )}
              </div>
            )}
            <div className={activeTab === 'tab5' ? '' : 'no-print'}>
              {activeTab === 'tab1' && perms.canViewAllRoom && (
                <Tab1MonthlyHub
                  period={activePeriod}
                  calc={visibleCalc}
                  employees={state.employees}
                  policies={state.policies}
                  onUpdatePeriod={handleUpdatePeriod}
                  onAddPolicy={handleAddPolicy}
                  onDeletePolicy={handleDeletePolicy}
                  readOnly={!canEditActivePeriod}
                />
              )}
              {activeTab === 'tab2' && perms.canViewAllRoom && (
                <Tab2HR
                  employees={state.employees}
                  hrChangeLog={state.hrChangeLog}
                  activePeriodLabel={activePeriod.label}
                  onUpsertEmployee={handleUpsertEmployee}
                  onToggleLock={handleToggleLock}
                  onImportEmployees={handleImportEmployees}
                  readOnly={!perms.canEdit}
                />
              )}
              {activeTab === 'tab3' && (
                <Tab3Payroll
                  period={activePeriod}
                  calc={visibleCalc}
                  onUpdatePeriod={handleUpdatePeriod}
                  readOnly={!canEditActivePeriod}
                  scopeBadge={perms.scopeTitle}
                />
              )}
              {activeTab === 'tab_tbtm' && perms.canViewAllRoom && (
                <TabTbtmCompare
                  period={activePeriod}
                  fullCalc={fullCalc}
                  signatures={state.signatures}
                />
              )}
              {activeTab === 'tab4' && perms.canViewAllRoom && (
                <Tab4Analytics items={allCalcs} activePeriodKey={activePeriod.periodKey} />
              )}
              {activeTab === 'tab5' && (
                <Tab5Export
                  state={state}
                  period={activePeriod}
                  calc={visibleCalc}
                  onUpdateSignatures={handleUpdateSignatures}
                  onRestore={(restored) => {
                    if (perms.canEdit) {
                      setState(restored);
                      if (isSupabaseConfigured) {
                        void pushFullStateToCloud(restored);
                      }
                    }
                  }}
                  onResetSample={() => {
                    if (perms.canEdit) {
                      const initial = createInitialAppState();
                      setState(initial);
                      if (isSupabaseConfigured) {
                        void pushFullStateToCloud(initial);
                      }
                    }
                  }}
                  readOnly={!perms.canEdit}
                />
              )}
            </div>

            {activeTab !== 'tab5' && (
              <div className="hidden print:block">
                <PrintPreviewTBTM
                  period={activePeriod}
                  tbtmCalc={calculateTBTM(activePeriod, fullCalc)}
                  sig={state.signatures}
                />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
