'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface ChartDataPoint {
  time: string;
  price: number;
  rsi: number;
}

export default function TradingChart() {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Connect to the FastAPI WebSocket
    const ws = new WebSocket('ws://localhost:8000/ws/prices');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to WebSocket stream');
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const date = new Date(payload.timestamp * 1000);
        const timeStr = date.toLocaleTimeString([], { hour12: false, second: '2-digit' });

        setData((prev) => {
          const newData = [...prev, { time: timeStr, price: payload.price, rsi: payload.rsi }];
          // Keep only the last 30 data points so the chart doesn't grow infinitely
          if (newData.length > 30) {
            return newData.slice(newData.length - 30);
          }
          return newData;
        });
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    return () => {
      ws.close();
    };
  }, []);

  return (
    <div className="w-full h-full flex flex-col space-y-4">
      {/* Price Chart */}
      <div className="h-[300px] w-full bg-slate-900 p-4 rounded-xl shadow-lg border border-slate-800">
        <h3 className="text-emerald-400 font-semibold mb-2">BTC/USD Price Live Stream</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} />
            <YAxis domain={['auto', 'auto']} stroke="#94a3b8" fontSize={12} width={80} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
              itemStyle={{ color: '#e2e8f0' }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="price"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* RSI Chart */}
      <div className="h-[200px] w-full bg-slate-900 p-4 rounded-xl shadow-lg border border-slate-800">
        <h3 className="text-blue-400 font-semibold mb-2">RSI (Relative Strength Index)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} />
            <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={12} width={40} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
              itemStyle={{ color: '#e2e8f0' }}
            />
            {/* Overbought/Oversold lines */}
            <line x1="0%" y1="30%" x2="100%" y2="30%" stroke="#ef4444" strokeDasharray="3 3" />
            <line x1="0%" y1="70%" x2="100%" y2="70%" stroke="#ef4444" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="rsi"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}