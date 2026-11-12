import React from 'react';
import type { PayrollPeriod } from '../types/payroll';
import { formatDecimal, formatVND } from '../utils/payrollCalc';
import type { PayrollCalculationResult } from '../utils/payrollCalc';

export interface PeriodAnalytics {
  period: PayrollPeriod;
  calc: PayrollCalculationResult;
}

interface Tab4Props {
  items: PeriodAnalytics[]; // đã sắp xếp tăng dần theo kỳ
  activePeriodKey: string;
}

const BarChart: React.FC<{
  title: string;
  data: { label: string; value: number }[];
  color: string;
  format?: (v: number) => string;
}> = ({ title, data, color, format = formatVND }) => {
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));
  const barW = 46;
  const gap = 22;
  const h = 170;
  const width = Math.max(320, data.length * (barW + gap) + gap);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-bold text-slate-800">{title}</h3>
      <div className="overflow-x-auto">
        <svg width={width} height={h + 44} role="img" aria-label={title}>
          <line x1={0} y1={h} x2={width} y2={h} stroke="#cbd5e1" />
          {data.map((d, i) => {
            const bh = (Math.abs(d.value) / max) * (h - 24);
            const x = gap + i * (barW + gap);
            return (
              <g key={d.label}>
                <rect x={x} y={h - bh} width={barW} height={bh} rx={4} fill={color}>
                  <title>{`${d.label}: ${format(d.value)}`}</title>
                </rect>
                <text x={x + barW / 2} y={h - bh - 5} textAnchor="middle" fontSize={9.5} fill="#334155">
                  {format(d.value)}
                </text>
                <text x={x + barW / 2} y={h + 16} textAnchor="middle" fontSize={11} fill="#475569">
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

const shortLabel = (key: string) => {
  const [y, m] = key.split('-');
  return `T${Number(m)}/${y.slice(2)}`;
};

const compact = (v: number) =>
  Math.abs(v) >= 1e6 ? `${formatDecimal(v / 1e6, 1)}tr` : formatVND(v);

const pctChange = (cur: number, prev?: number) => {
  if (prev === undefined || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
};

export const Tab4Analytics: React.FC<Tab4Props> = ({ items, activePeriodKey }) => {
  const active = items.find((i) => i.period.periodKey === activePeriodKey) ?? items[items.length - 1];

  const series = (pick: (c: PayrollCalculationResult) => number) =>
    items.map((i) => ({ label: shortLabel(i.period.periodKey), value: pick(i.calc) }));

  const vp = active?.calc.subVanPhong.tongLuong ?? 0;
  const dc = active?.calc.subDayChuyen.tongLuong ?? 0;
  const total = vp + dc;
  const vpPct = total > 0 ? (vp / total) * 100 : 0;

  // Donut
  const R = 60;
  const C = 2 * Math.PI * R;

  return (
    <div className="space-y-5">
      {items.length < 2 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-800">
          Hiện mới có {items.length} kỳ lương. Tạo thêm kỳ mới (nút "Tạo kỳ mới" trên thanh tiêu đề) để
          xem biến động qua các tháng.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <BarChart title="Quỹ thực chia (lương + thưởng) theo kỳ" data={series((c) => c.summary.quyThucChia)} color="#2563eb" format={compact} />
        <BarChart
          title="Đơn giá 1 hệ số-công (gộp) theo kỳ"
          data={series((c) => c.summary.donGiaGop)}
          color="#0d9488"
          format={(v) => formatVND(v)}
        />
        <BarChart title="Tổng thưởng 2 dây chuyền (sau giảm trừ)" data={series((c) => c.summary.tongThuong)} color="#16a34a" format={compact} />
        <BarChart
          title="Giảm trừ (trừ khoán, lỗi SP, khiếu nại) — quỹ chung + cá nhân"
          data={series((c) => c.summary.giamTruChung + c.grandTotal.truThuong)}
          color="#e11d48"
          format={compact}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-bold text-slate-800">
            Tỷ trọng chi lương — {active?.period.label}
          </h3>
          <div className="flex items-center gap-5">
            <svg width={150} height={150} viewBox="0 0 150 150" role="img" aria-label="Tỷ trọng">
              <circle cx={75} cy={75} r={R} fill="none" stroke="#f59e0b" strokeWidth={22} />
              <circle
                cx={75}
                cy={75}
                r={R}
                fill="none"
                stroke="#2563eb"
                strokeWidth={22}
                strokeDasharray={`${(vpPct / 100) * C} ${C}`}
                transform="rotate(-90 75 75)"
              />
              <text x={75} y={80} textAnchor="middle" fontSize={14} fontWeight={700} fill="#0f172a">
                {formatDecimal(vpPct, 1)}%
              </text>
            </svg>
            <div className="space-y-2 text-xs">
              <div>
                <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-blue-600" />
                BP Văn phòng: <strong>{formatVND(vp)} đ</strong> ({formatDecimal(vpPct, 1)}%)
              </div>
              <div>
                <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-amber-500" />
                BP Dây chuyền 1+2: <strong>{formatVND(dc)} đ</strong> ({formatDecimal(100 - vpPct, 1)}%)
              </div>
              <div className="text-slate-500">
                Bình quân/người: VP {formatVND(vp / Math.max(1, active?.calc.subVanPhong.count ?? 1))} đ · DC{' '}
                {formatVND(dc / Math.max(1, active?.calc.subDayChuyen.count ?? 1))} đ
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h3 className="mb-2 text-sm font-bold text-slate-800">Bảng so sánh giữa các kỳ lương</h3>
          <table className="w-full border-collapse text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-2 py-1.5 text-left">Kỳ</th>
                <th className="px-2 py-1.5 text-right">Quỹ khoán</th>
                <th className="px-2 py-1.5 text-right">Tổng thưởng</th>
                <th className="px-2 py-1.5 text-right">Giảm trừ</th>
                <th className="px-2 py-1.5 text-right">Quỹ thực chia</th>
                <th className="px-2 py-1.5 text-right">± so kỳ trước</th>
                <th className="px-2 py-1.5 text-right">Đơn giá HS-công</th>
                <th className="px-2 py-1.5 text-right">Lương HS1</th>
                <th className="px-2 py-1.5 text-right">Số NS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((it, idx) => {
                const c = it.calc.summary;
                const change = pctChange(c.quyThucChia, items[idx - 1]?.calc.summary.quyThucChia);
                return (
                  <tr key={it.period.periodKey} className={it.period.periodKey === activePeriodKey ? 'bg-blue-50/60' : ''}>
                    <td className="px-2 py-1.5 font-semibold">{it.period.label}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatVND(c.quyKhoan)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatVND(c.tongThuong)}</td>
                    <td className="px-2 py-1.5 text-right text-rose-700 tabular-nums">
                      {formatVND(c.giamTruChung + it.calc.grandTotal.truThuong)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{formatVND(c.quyThucChia)}</td>
                    <td
                      className={`px-2 py-1.5 text-right tabular-nums ${
                        change === null ? 'text-slate-400' : change >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {change === null ? '—' : `${change >= 0 ? '+' : ''}${formatDecimal(change, 1)}%`}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatDecimal(c.donGiaGop, 0)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatVND(c.luongHS1)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{it.calc.rows.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
