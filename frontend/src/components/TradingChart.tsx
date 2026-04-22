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
  Legend,
  ReferenceLine
} from 'recharts';

interface ChartDataPoint {
  time: string;
  price: number;
  rsi: number;
  mfi?: number;
  cmf?: number;
  stoch_rsi?: number;
  tdi?: number;
  macd?: number;
  obv?: number;
}

interface L2Book {
  bids: [number, number][];
  asks: [number, number][];
}

interface Macro {
  dxy: number;
  sp500: number;
}

const MAX_DATA_POINTS = 10000;

interface Trade {
  id: string;
  symbol: string;
  entry_price: number;
  exit_price?: number;
  pnl?: number;
  status: string;
}

interface TradingChartProps {
  activeTrades?: Trade[];
  historyTrades?: Trade[];
}

export default function TradingChart({ activeTrades = [], historyTrades = [] }: TradingChartProps) {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [l2Book, setL2Book] = useState<L2Book | null>(null);
  const [macro, setMacro] = useState<Macro | null>(null);
  const [sentiment, setSentiment] = useState<string>("Neutral");
  const [timeWindow, setTimeWindow] = useState<number>(30); // Default to 30 points
  const [activeIndicators, setActiveIndicators] = useState<string[]>(['rsi']);

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
          const newData = [...prev, {
            time: timeStr,
            price: payload.price,
            rsi: payload.rsi,
            mfi: payload.mfi,
            cmf: payload.cmf,
            stoch_rsi: payload.stoch_rsi,
            tdi: payload.tdi,
            macd: payload.macd,
            obv: payload.obv
          }];
          if (newData.length > MAX_DATA_POINTS) {
            return newData.slice(newData.length - MAX_DATA_POINTS);
          }
          return newData;
        });

        if (payload.order_book) setL2Book(payload.order_book);
        if (payload.macro) setMacro(payload.macro);
        if (payload.news_sentiment) setSentiment(payload.news_sentiment);
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

  // Calculate a mock "Liquidation Heatmap" band based on the current price
  // We'll show this as ReferenceAreas or just plot lines if we had them,
  // but for simplicity we'll just plot a custom reference line area representing "High Leverage Longs"
  const currentPrice = data.length > 0 ? data[data.length - 1].price : 0;
  const longLiqBand = currentPrice * 0.98; // 2% drop
  const shortLiqBand = currentPrice * 1.02; // 2% pump

  const displayData = timeWindow > 0 ? data.slice(-timeWindow) : data;

  const indicatorConfigs: Record<string, { title: string, color: string, domain: [any, any], referenceLines?: { y: number, color: string }[] }> = {
    rsi: { title: "RSI (Relative Strength Index)", color: "#3b82f6", domain: [0, 100], referenceLines: [{ y: 30, color: "#10b981" }, { y: 70, color: "#ef4444" }] },
    mfi: { title: "MFI (Money Flow Index)", color: "#8b5cf6", domain: [0, 100], referenceLines: [{ y: 20, color: "#10b981" }, { y: 80, color: "#ef4444" }] },
    cmf: { title: "CMF (Chaikin Money Flow)", color: "#14b8a6", domain: [-1, 1], referenceLines: [{ y: 0, color: "#94a3b8" }] },
    stoch_rsi: { title: "StochRSI (Stochastic RSI)", color: "#f59e0b", domain: [0, 100], referenceLines: [{ y: 20, color: "#10b981" }, { y: 80, color: "#ef4444" }] },
    tdi: { title: "TDI (Traders Dynamic Index)", color: "#ec4899", domain: [30, 70], referenceLines: [{ y: 50, color: "#94a3b8" }] },
    macd: { title: "MACD", color: "#6366f1", domain: ['auto', 'auto'], referenceLines: [{ y: 0, color: "#94a3b8" }] },
    obv: { title: "OBV (On-Balance Volume)", color: "#eab308", domain: ['auto', 'auto'] }
  };

  return (
    <div className="w-full h-full flex flex-col space-y-4">
      {/* Real-Time Macro & Sentiment Bar */}
      <div className="flex gap-4 p-3 bg-surface-container rounded-xl border border-outline-variant/20 shadow-lg justify-between items-center text-xs">
        <div className="flex gap-6">
           <div>
             <span className="text-outline uppercase">DXY (Dollar) </span>
             <span className="text-on-surface font-mono font-bold">{macro?.dxy.toFixed(2) || '---'}</span>
           </div>
           <div>
             <span className="text-outline uppercase">S&P 500 </span>
             <span className="text-on-surface font-mono font-bold">{macro?.sp500.toFixed(2) || '---'}</span>
           </div>
        </div>
        <div>
           <span className="text-outline uppercase mr-2">News Sentiment </span>
           <span className={`px-2 py-1 rounded font-bold ${sentiment.includes('Bullish') ? 'bg-secondary/10 text-secondary' : sentiment.includes('Bearish') ? 'bg-error/10 text-error' : 'bg-surface-container-highest text-on-surface-variant'}`}>
             {sentiment.replace("_", " ")}
           </span>
        </div>
      </div>

      {/* Main UI row: Chart + L2 Order Book */}
      <div className="flex gap-4 h-[300px]">
        {/* Price Chart */}
        <div className="flex-1 bg-surface-container p-4 rounded-xl shadow-lg border border-outline-variant/20 flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-4">
              <h3 className="text-secondary font-semibold">BTC/USD Price Live Stream</h3>
              <div className="flex gap-1">
                {[30, 100, 0].map((val) => (
                  <button
                    key={val}
                    onClick={() => setTimeWindow(val)}
                    className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
                      timeWindow === val
                        ? 'bg-secondary/10 border-secondary text-secondary-fixed'
                        : 'bg-surface-container-highest border-outline-variant/30 text-outline hover:bg-surface-variant'
                    }`}
                  >
                    {val === 0 ? 'All' : `${val} Ticks`}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 ml-4 border-l border-outline-variant/30 pl-4">
                {['rsi', 'mfi', 'cmf', 'stoch_rsi', 'tdi', 'macd', 'obv'].map((indicator) => (
                  <button
                    key={indicator}
                    onClick={() => setActiveIndicators(prev =>
                      prev.includes(indicator)
                        ? prev.filter(i => i !== indicator)
                        : [...prev, indicator]
                    )}
                    className={`px-2 py-0.5 text-[10px] rounded border transition-colors uppercase ${
                      activeIndicators.includes(indicator)
                        ? 'bg-primary-container/20 border-primary-container text-primary-fixed-dim'
                        : 'bg-surface-container-highest border-outline-variant/30 text-outline hover:bg-surface-variant'
                    }`}
                  >
                    {indicator.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
            <span className="text-[10px] text-amber-500 bg-amber-900/30 px-2 py-0.5 rounded border border-amber-800 hidden lg:inline-block">
               ⚠️ Showing Estimated Liquidation Bands (±2%)
            </span>
          </div>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
          <LineChart data={displayData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3b494b" />
            <XAxis dataKey="time" stroke="#849495" fontSize={12} />
            <YAxis domain={['auto', 'auto']} stroke="#849495" fontSize={12} width={80} tickFormatter={(value) => `$${value.toLocaleString()}`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
              itemStyle={{ color: '#e2e8f0' }}
              formatter={(value: number, name: string) => {
                if (name === 'price') return [`$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Price'];
                return [value, name];
              }}
            />
            <Legend />
            {/* Mock Liquidation Heatmaps */}
            {currentPrice > 0 && (
              <ReferenceLine y={longLiqBand} stroke="#ffb4ab" strokeWidth={4} strokeOpacity={0.2} label={{ position: 'insideBottomLeft', value: 'Long Liq', fill: '#ffb4ab', fontSize: 10 }} />
            )}
            {currentPrice > 0 && (
              <ReferenceLine y={shortLiqBand} stroke="#00e475" strokeWidth={4} strokeOpacity={0.2} label={{ position: 'insideTopLeft', value: 'Short Liq', fill: '#00e475', fontSize: 10 }} />
            )}

            <Line
              type="monotone"
              dataKey="price"
              stroke="#00e475"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* L2 Order Book Simulation */}
        <div className="w-[200px] bg-surface-container p-4 rounded-xl shadow-lg border border-outline-variant/20 flex flex-col overflow-hidden">
          <h3 className="text-on-surface-variant font-semibold text-xs uppercase tracking-wider mb-2 border-b border-outline-variant/20 pb-2">L2 Order Book</h3>
          <div className="flex-1 flex flex-col text-[10px] font-mono justify-center gap-1">
            {/* Asks (Sell Orders - Red) */}
            <div className="flex flex-col-reverse gap-0.5">
              {l2Book?.asks.map((ask, i) => (
                <div key={`ask-${i}`} className="flex justify-between text-error relative">
                   <div className="absolute right-0 top-0 h-full bg-error-container/20" style={{width: `${(ask[1]/5)*100}%`}}></div>
                   <span>${ask[0].toFixed(2)}</span>
                   <span>{ask[1].toFixed(3)}</span>
                </div>
              ))}
            </div>

            {/* Spread Marker */}
            <div className="text-center text-slate-500 py-1 my-1 border-y border-outline-variant/20 bg-surface-container-lowest font-bold">
               ${currentPrice.toFixed(2)}
            </div>

            {/* Bids (Buy Orders - Green) */}
            <div className="flex flex-col gap-0.5">
              {l2Book?.bids.map((bid, i) => (
                <div key={`bid-${i}`} className="flex justify-between text-secondary relative">
                   <div className="absolute right-0 top-0 h-full bg-emerald-900/20" style={{width: `${(bid[1]/5)*100}%`}}></div>
                   <span>${bid[0].toFixed(2)}</span>
                   <span>{bid[1].toFixed(3)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stacked Indicator Charts */}
      {activeIndicators.map(indicator => {
        const config = indicatorConfigs[indicator];
        if (!config) return null;

        return (
          <div key={indicator} className="h-[200px] w-full bg-surface-container p-4 rounded-xl shadow-lg border border-outline-variant/20">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold" style={{ color: config.color }}>{config.title}</h3>
              <button
                onClick={() => setActiveIndicators(prev => prev.filter(i => i !== indicator))}
                className="text-slate-500 hover:text-error"
              >
                ✕
              </button>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={displayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3b494b" />
                <XAxis dataKey="time" stroke="#849495" fontSize={12} />
                <YAxis domain={config.domain} stroke="#849495" fontSize={12} width={40} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                  itemStyle={{ color: '#e2e8f0' }}
                  formatter={(value: number, name: string) => {
                    if (name === indicator) return [value.toFixed(2), indicator.toUpperCase()];
                    return [value, name];
                  }}
                />
                {config.referenceLines && config.referenceLines.map((line, idx) => (
                  <ReferenceLine key={idx} y={line.y} stroke={line.color} strokeDasharray="3 3" />
                ))}
                <Line
                  type="monotone"
                  dataKey={indicator}
                  stroke={config.color}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      })}
{/* Open Orders / Positions Tab */}
      <div className="bg-surface-container-low rounded-xl p-4">
        <div className="flex gap-6 border-b border-outline-variant/10 mb-4">
          <button className="pb-2 text-xs font-bold uppercase tracking-widest text-on-surface border-b border-primary">Active Positions ({activeTrades.length})</button>
          <button className="pb-2 text-xs font-bold uppercase tracking-widest text-outline hover:text-on-surface">Order History</button>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] uppercase font-bold text-outline tracking-wider">
              <th className="pb-2">Asset</th>
              <th className="pb-2">Type</th>
              <th className="pb-2">Entry</th>
              <th className="pb-2 text-right">PnL</th>
            </tr>
          </thead>
          <tbody className="text-xs font-mono">
            {activeTrades.map((trade) => (
              <tr key={trade.id} className="border-b border-outline-variant/5">
                <td className="py-3 text-on-surface font-headline font-bold">{trade.symbol}</td>
                <td className="py-3 text-secondary font-bold">LONG</td>
                <td className="py-3 text-on-surface-variant">{trade.entry_price.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="py-3 text-right text-secondary">ACTIVE</td>
              </tr>
            ))}
            {historyTrades.slice(0, 5).map((trade) => (
               <tr key={trade.id} className="border-b border-outline-variant/5">
                <td className="py-3 text-on-surface font-headline font-bold">{trade.symbol}</td>
                <td className="py-3 text-outline font-bold">CLOSED</td>
                <td className="py-3 text-on-surface-variant">{trade.entry_price.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className={`py-3 text-right font-bold ${trade.pnl && trade.pnl >= 0 ? 'text-secondary' : 'text-error'}`}>
                  {trade.pnl && trade.pnl >= 0 ? '+' : ''}{trade.pnl?.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
