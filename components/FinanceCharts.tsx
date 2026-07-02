
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

interface MonthlySpend {
  month: string;
  total: number;
}

interface FinanceChartsProps {
  monthlyData: MonthlySpend[];
  currency: string;
}

const FinanceCharts: React.FC<FinanceChartsProps> = ({ monthlyData, currency }) => {
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={60} />
          <Tooltip
            formatter={(value: any) => [`${Number(value).toLocaleString()} ${currency}`, 'Cost']}
            contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', fontSize: 12, fontWeight: 700 }}
          />
          <Bar dataKey="total" radius={[8, 8, 0, 0]} maxBarSize={48}>
            {monthlyData.map((_, i) => (
              <Cell key={i} fill={i === monthlyData.length - 1 ? '#2563eb' : '#93c5fd'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default FinanceCharts;
