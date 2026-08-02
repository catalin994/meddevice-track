
import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#64748b'];

export default function DashboardCharts({ statusData, total }: { statusData: { name: string; value: number }[]; total: number }) {
  return (
    <>
      <div className="h-72 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={statusData} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={8} dataKey="value" stroke="none">
              {statusData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
            </Pie>
            {/* themed via the palette variables, so the tooltip follows dark mode */}
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--color-white)',
                color: 'var(--color-slate-900)',
                borderRadius: '16px',
                border: '1px solid var(--color-slate-200)',
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.15)',
                fontSize: '13px',
                fontWeight: 700,
              }}
              itemStyle={{ color: 'var(--color-slate-900)' }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <p className="text-[13px] font-bold text-slate-500">Total</p>
          <p className="text-5xl font-extrabold text-slate-900 tabular-nums tracking-tight">{total}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8">
        {statusData.map((s, i) => (
          <div key={s.name} className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <p className="text-[13px] font-bold text-slate-500 truncate">{s.name}</p>
            </div>
            <p className="text-2xl font-extrabold tabular-nums text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>
    </>
  );
}
