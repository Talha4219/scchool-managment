"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export default function EnrollmentAreaChart({ data }: { data: { month: string; applications: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="enrollmentFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: "none", boxShadow: "0 8px 24px -8px rgba(30,41,82,0.25)" }} />
        <Area type="monotone" dataKey="applications" stroke="hsl(var(--primary))" strokeWidth={4} fill="url(#enrollmentFill)" dot={false} activeDot={{ r: 5, fill: "hsl(var(--primary))" }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
