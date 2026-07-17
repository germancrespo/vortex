/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  Sparkles,
  Plus,
  Trash2,
  AlertTriangle,
  Calendar,
  Wallet,
  PiggyBank,
  Check,
  Loader2,
  RefreshCw,
  Lightbulb,
  X,
  PlusCircle,
  DollarSign
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import {
  Transaction,
  Budget,
  CurrencyRate,
  ForecastResponse,
  AdviceResponse,
  NaturalLanguageExtractionResponse
} from './types';

export default function App() {
  // --- STATE ---
  const [currencies, setCurrencies] = useState<CurrencyRate[]>([]);
  const [loadingCurrencies, setLoadingCurrencies] = useState(true);
  const [displayCurrency, setDisplayCurrency] = useState('USD');

  // Load initial transactions from localStorage or use defaults
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('vortex_transactions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [
      {
        id: '1',
        type: 'income',
        description: 'Sueldo de Consultoría Freelance',
        amount: 2500,
        currency: 'USD',
        category: 'Ingresos',
        date: '2026-07-15'
      },
      {
        id: '2',
        type: 'expense',
        description: 'Compra de Euros para viaje',
        amount: 500,
        currency: 'USD',
        category: 'Transporte',
        date: '2026-07-16'
      },
      {
        id: '3',
        type: 'expense',
        description: 'Almuerzo familiar domingo',
        amount: 850,
        currency: 'MXN',
        category: 'Comida',
        date: '2026-07-16'
      },
      {
        id: '4',
        type: 'expense',
        description: 'Suscripción de Streaming',
        amount: 14.99,
        currency: 'EUR',
        category: 'Entretenimiento',
        date: '2026-07-17'
      }
    ];
  });

  // Load budgets from localStorage or use defaults
  const [budgets, setBudgets] = useState<Budget[]>(() => {
    const saved = localStorage.getItem('vortex_budgets');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [
      { category: 'Comida', limit: 300, spent: 46.58 }, // stored in USD equivalents for simplicity
      { category: 'Transporte', limit: 200, spent: 500 },
      { category: 'Entretenimiento', limit: 100, spent: 16.30 },
      { category: 'Servicios', limit: 250, spent: 0 },
      { category: 'Vivienda', limit: 800, spent: 0 },
      { category: 'Otros', limit: 150, spent: 0 }
    ];
  });

  // Calculator State
  const [convertFrom, setConvertFrom] = useState('USD');
  const [convertTo, setConvertTo] = useState('EUR');
  const [convertAmount, setConvertAmount] = useState<number>(1000);
  const [exchangeRate, setExchangeRate] = useState<number>(0.92);

  // Historical Chart State
  const [historyData, setHistoryData] = useState<{ date: string; rate: number }[]>([]);
  const [historyDays, setHistoryDays] = useState(30);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // AI Forecast State
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);

  // AI Natural Language Input State
  const [naturalText, setNaturalText] = useState('');
  const [extractedResult, setExtractedResult] = useState<NaturalLanguageExtractionResponse | null>(null);
  const [loadingExtract, setLoadingExtract] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  // AI Coach Advisory State
  const [advice, setAdvice] = useState<AdviceResponse | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);

  // Manual Transaction Form
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDesc, setNewDesc] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newType, setNewType] = useState<'income' | 'expense'>('expense');
  const [newCurrency, setNewCurrency] = useState('USD');
  const [newCategory, setNewCategory] = useState('Comida');
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Edit Budget Limits
  const [editingBudgetCategory, setEditingBudgetCategory] = useState<string | null>(null);
  const [tempBudgetLimit, setTempBudgetLimit] = useState('');

  // Save to localStorage whenever transactions or budgets change
  useEffect(() => {
    localStorage.setItem('vortex_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('vortex_budgets', JSON.stringify(budgets));
  }, [budgets]);

  // Fetch Available Currencies
  useEffect(() => {
    fetch('/api/currencies')
      .then((res) => {
        if (!res.ok) throw new Error('Error al cargar monedas');
        return res.json();
      })
      .then((data: CurrencyRate[]) => {
        setCurrencies(data);
        setLoadingCurrencies(false);
      })
      .catch((err) => {
        console.error(err);
        setLoadingCurrencies(false);
      });
  }, []);

  // Fetch rate and historical rate when convertFrom or convertTo changes
  useEffect(() => {
    if (currencies.length === 0) return;
    
    setLoadingHistory(true);
    fetch(`/api/history-rates?from=${convertFrom}&to=${convertTo}&days=${historyDays}`)
      .then((res) => res.json())
      .then((data) => {
        setHistoryData(data.history || []);
        setExchangeRate(data.currentRate || 1);
        setLoadingHistory(false);
      })
      .catch((err) => {
        console.error(err);
        setLoadingHistory(false);
      });
  }, [convertFrom, convertTo, historyDays, currencies]);

  // Recalculate spent amounts in budgets whenever transactions change
  useEffect(() => {
    if (currencies.length === 0) return;

    const updatedBudgets = budgets.map((b) => {
      // Find all transactions in this category that are expenses
      const categoryExpenses = transactions.filter(
        (t) => t.category === b.category && t.type === 'expense'
      );

      // Convert each expense amount to USD for unified budget tracking
      const totalSpentInUsd = categoryExpenses.reduce((sum, t) => {
        const rateToUsd = getConversionRate(t.currency, 'USD');
        return sum + (t.amount * rateToUsd);
      }, 0);

      return {
        ...b,
        spent: Number(totalSpentInUsd.toFixed(2))
      };
    });

    // Simple deep equality check to prevent infinite loop
    if (JSON.stringify(updatedBudgets) !== JSON.stringify(budgets)) {
      setBudgets(updatedBudgets);
    }
  }, [transactions, currencies]);

  // Trigger AI Advice on load or transactions change
  useEffect(() => {
    if (transactions.length > 0) {
      triggerAiAdvice();
    }
  }, [transactions]);

  // --- HELPERS ---
  const getConversionRate = (fromCode: string, toCode: string): number => {
    const fromCurr = currencies.find((c) => c.code === fromCode);
    const toCurr = currencies.find((c) => c.code === toCode);
    if (!fromCurr || !toCurr) return 1;
    return toCurr.rateVsUsd / fromCurr.rateVsUsd;
  };

  const getAmountInDisplay = (amount: number, fromCurr: string): number => {
    const rate = getConversionRate(fromCurr, displayCurrency);
    return amount * rate;
  };

  // Calculate Net totals
  const totalIncomes = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + getAmountInDisplay(t.amount, t.currency), 0);

  const totalExpenses = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + getAmountInDisplay(t.amount, t.currency), 0);

  const netBalance = totalIncomes - totalExpenses;

  // Manual Transaction Add Handler
  const handleAddTransaction = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newDesc || !newAmount) return;

    const amt = parseFloat(newAmount);
    if (isNaN(amt) || amt <= 0) return;

    const newTx: Transaction = {
      id: Date.now().toString(),
      type: newType,
      description: newDesc,
      amount: amt,
      currency: newCurrency,
      category: newType === 'income' ? 'Ingresos' : newCategory,
      date: newDate
    };

    setTransactions([newTx, ...transactions]);
    setShowAddModal(false);
    setNewDesc('');
    setNewAmount('');
  };

  // Delete Transaction Handler
  const handleDeleteTransaction = (id: string) => {
    setTransactions(transactions.filter((t) => t.id !== id));
  };

  // Calculator Convert Call
  const calculatedResult = convertAmount * exchangeRate;

  // Execute Exchange Transaction (Creates real-world transaction log)
  const handleExecuteExchange = () => {
    if (convertAmount <= 0) return;

    // Log the transaction as a conversion activity
    const fromTx: Transaction = {
      id: 'ex-' + Date.now() + '-out',
      type: 'expense',
      description: `Conversión: Venta de ${convertAmount} ${convertFrom} para adquirir ${convertTo}`,
      amount: convertAmount,
      currency: convertFrom,
      category: 'Otros',
      date: new Date().toISOString().split('T')[0]
    };

    const toTx: Transaction = {
      id: 'ex-' + Date.now() + '-in',
      type: 'income',
      description: `Conversión: Adquisición de ${calculatedResult.toFixed(2)} ${convertTo} de cambio`,
      amount: calculatedResult,
      currency: convertTo,
      category: 'Ingresos',
      date: new Date().toISOString().split('T')[0]
    };

    setTransactions([fromTx, toTx, ...transactions]);
    
    // Quick success notification
    alert(`¡Conversión simulada exitosamente! Se descontaron ${convertAmount} ${convertFrom} y se agregaron ${calculatedResult.toFixed(2)} ${convertTo} al historial.`);
  };

  // Trigger AI Forecast
  const handleGetForecast = async () => {
    setLoadingForecast(true);
    setForecastError(null);
    try {
      const res = await fetch('/api/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: convertFrom, to: convertTo })
      });
      if (!res.ok) throw new Error('Error al conectar con la IA de predicción.');
      const data = await res.json();
      setForecast(data);
    } catch (err: any) {
      setForecastError(err.message || 'Error desconocido.');
    } finally {
      setLoadingForecast(false);
    }
  };

  // Trigger AI Natural Language Parser
  const handleExtractText = async () => {
    if (!naturalText.trim()) return;
    setLoadingExtract(true);
    setExtractError(null);
    setExtractedResult(null);
    try {
      const res = await fetch('/api/extract-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: naturalText })
      });
      if (!res.ok) throw new Error('Error al procesar la entrada de lenguaje natural.');
      const data = await res.json();
      setExtractedResult(data);
    } catch (err: any) {
      setExtractError(err.message || 'Error desconocido.');
    } finally {
      setLoadingExtract(false);
    }
  };

  // Accept parsed AI transaction and log it
  const handleAcceptExtracted = () => {
    if (!extractedResult) return;
    const newTx: Transaction = {
      id: 'ai-' + Date.now(),
      type: extractedResult.type,
      description: extractedResult.description,
      amount: extractedResult.amount,
      currency: extractedResult.currency,
      category: extractedResult.category,
      date: new Date().toISOString().split('T')[0]
    };

    setTransactions([newTx, ...transactions]);
    setExtractedResult(null);
    setNaturalText('');
  };

  // Trigger AI Financial Coaching Advice
  const triggerAiAdvice = async () => {
    setLoadingAdvice(true);
    try {
      const res = await fetch('/api/advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions, budgets })
      });
      if (res.ok) {
        const data = await res.json();
        setAdvice(data);
      }
    } catch (err) {
      console.error('Failed to fetch advice:', err);
    } finally {
      setLoadingAdvice(false);
    }
  };

  // Update Budget limit
  const handleSaveBudgetLimit = (category: string) => {
    const limitNum = parseFloat(tempBudgetLimit);
    if (!isNaN(limitNum) && limitNum >= 0) {
      setBudgets(budgets.map(b => b.category === category ? { ...b, limit: limitNum } : b));
    }
    setEditingBudgetCategory(null);
    setTempBudgetLimit('');
  };

  return (
    <div className="min-h-screen bg-[#05070A] text-white selection:bg-[#00FF94] selection:text-black p-4 sm:p-6 md:p-8 flex flex-col font-sans">
      
      {/* HEADER / NAVIGATION BENTO BOX */}
      <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-white/8 bg-[#0F1218] p-5 rounded-[20px] transition-all duration-300 hover:border-white/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00FF94] to-[#38BDF8] flex items-center justify-center font-black text-black text-lg shadow-lg shadow-[#00FF94]/10">
            V
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xl tracking-tight text-white">VORTEX</span>
              <span className="text-[#00FF94] font-medium text-xs px-1.5 py-0.5 rounded bg-[#00FF94]/10 border border-[#00FF94]/20 tracking-widest uppercase">FINANZAS</span>
            </div>
            <p className="text-xs text-[#94A3B8] mt-0.5">Gestión de Divisas e Inteligencia de Gastos</p>
          </div>
        </div>

        {/* Global Stats / Settings */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm">
          {/* User Profile Badge */}
          <div className="flex items-center gap-2 bg-white/[0.02] border border-white/5 py-1.5 px-3.5 rounded-full text-xs">
            <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#38BDF8] to-[#00FF94] flex items-center justify-center text-[9px] font-black text-black">
              GC
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[#94A3B8]">Usuario:</span>
              <span className="font-bold text-white">Germán Crespo</span>
            </div>
          </div>

          {/* Active stats */}
          <div className="hidden sm:flex items-center gap-3 bg-white/[0.02] border border-white/5 py-1.5 px-3.5 rounded-full text-xs">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00FF94] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00FF94]"></span>
            </span>
            <span className="text-[#94A3B8]">IA Motor Activo:</span>
            <span className="font-mono text-white">Gemini 3.5 Flash</span>
          </div>

          {/* Display Currency Selection */}
          <div className="flex items-center gap-2">
            <span className="text-[#94A3B8] text-xs font-semibold uppercase tracking-wider">Visualizar en:</span>
            <select
              value={displayCurrency}
              onChange={(e) => setDisplayCurrency(e.target.value)}
              className="bg-[#1A1F29] border border-white/10 rounded-lg px-2.5 py-1 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-[#00FF94] cursor-pointer"
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="MXN">MXN (Mex$)</option>
              <option value="ARS">ARS (Arg$)</option>
              <option value="COP">COP (Col$)</option>
              <option value="BRL">BRL (R$)</option>
              <option value="PEN">PEN (S/.)</option>
              <option value="CLP">CLP (CLP$)</option>
            </select>
          </div>

          {/* Quick Manual Add Trigger */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 bg-[#00FF94] text-black hover:bg-[#00FF94]/80 transition-colors font-semibold px-4 py-1.5 rounded-xl text-xs cursor-pointer shadow-lg shadow-[#00FF94]/10"
          >
            <Plus className="w-3.5 h-3.5" /> Nueva Transacción
          </button>
        </div>
      </header>

      {/* MAIN BENTO GRID */}
      <main className="grid grid-cols-1 md:grid-cols-12 gap-5 flex-1 items-start">
        
        {/* CARD 1: MAIN PORTFOLIO SUMMARY & TRENDS (SPAN 8) */}
        <section className="col-span-1 md:col-span-12 lg:col-span-8 grid grid-cols-1 md:grid-cols-12 gap-5">
          
          {/* Subcard A: Balances metrics (Span 12 inside Span 8) */}
          <div className="col-span-12 border border-white/8 bg-[#0F1218] p-6 rounded-[20px] transition-all duration-300 hover:border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs uppercase tracking-wider text-[#94A3B8] font-semibold">Patrimonio Neto Estimado</span>
                <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mt-1">
                  {displayCurrency === 'USD' ? '$' : displayCurrency === 'EUR' ? '€' : ''}{' '}
                  {netBalance.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                  <span className="text-xs font-mono text-[#94A3B8]">{displayCurrency}</span>
                </h2>
              </div>
              <div className="flex gap-4">
                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-bold">Ingresos</span>
                  <p className="text-sm font-semibold text-[#00FF94] mt-0.5">
                    +{totalIncomes.toLocaleString('es-ES', { maximumFractionDigits: 1 })}
                  </p>
                </div>
                <div className="text-right border-l border-white/5 pl-4">
                  <span className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-bold">Gastos</span>
                  <p className="text-sm font-semibold text-red-400 mt-0.5">
                    -{totalExpenses.toLocaleString('es-ES', { maximumFractionDigits: 1 })}
                  </p>
                </div>
              </div>
            </div>

            {/* CHART CONTAINER: Trend history */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00FF94]"></span>
                  <span className="text-xs font-semibold text-white">Histórico del Par {convertFrom} / {convertTo}</span>
                </div>
                <div className="flex gap-1.5 bg-white/[0.02] p-1 rounded-lg border border-white/5">
                  {[7, 30, 90].map((days) => (
                    <button
                      key={days}
                      onClick={() => setHistoryDays(days)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded cursor-pointer transition-all ${
                        historyDays === days
                          ? 'bg-[#00FF94] text-black'
                          : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {days}d
                    </button>
                  ))}
                </div>
              </div>

              {loadingHistory ? (
                <div className="h-56 flex flex-col items-center justify-center text-[#94A3B8]">
                  <Loader2 className="w-8 h-8 animate-spin text-[#00FF94] mb-2" />
                  <p className="text-xs">Cargando datos históricos...</p>
                </div>
              ) : historyData.length > 0 ? (
                <div className="h-56 w-full -ml-4 pr-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={historyData}>
                      <defs>
                        <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00FF94" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#00FF94" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                      <XAxis
                        dataKey="date"
                        stroke="#4b5563"
                        fontSize={9}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(str) => {
                          const date = new Date(str);
                          return date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
                        }}
                      />
                      <YAxis
                        stroke="#4b5563"
                        fontSize={9}
                        tickLine={false}
                        axisLine={false}
                        domain={['auto', 'auto']}
                        tickFormatter={(val) => val.toFixed(2)}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F1218',
                          borderColor: 'rgba(255,255,255,0.1)',
                          borderRadius: '10px',
                          fontSize: '11px',
                          color: '#fff'
                        }}
                        labelFormatter={(label) => `Fecha: ${label}`}
                        formatter={(value: any) => [`1 ${convertFrom} = ${value} ${convertTo}`, 'Cambio']}
                      />
                      <Area
                        type="monotone"
                        dataKey="rate"
                        stroke="#00FF94"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorRate)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-56 flex items-center justify-center text-xs text-[#94A3B8] bg-white/[0.01] rounded-lg border border-dashed border-white/5">
                  No hay datos históricos disponibles
                </div>
              )}
            </div>
          </div>

          {/* Subcard B: Budgets and Limits (Span 12 inside Span 8) */}
          <div className="col-span-12 border border-white/8 bg-[#0F1218] p-6 rounded-[20px] transition-all duration-300 hover:border-white/20">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold tracking-tight flex items-center gap-1.5">
                  <PiggyBank className="w-4 h-4 text-[#38BDF8]" /> Límites Mensuales y Presupuesto
                </h3>
                <p className="text-xs text-[#94A3B8] mt-0.5">Control de gastos por categoría. Los montos se unifican en USD.</p>
              </div>
              <span className="text-[10px] text-amber-300/90 font-mono bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                Autocalculado
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {budgets.map((b) => {
                const percent = Math.min(Math.round((b.spent / b.limit) * 100), 100) || 0;
                const isOver = b.spent > b.limit;
                return (
                  <div key={b.category} className="bg-white/[0.02] border border-white/5 p-3 rounded-xl hover:bg-white/[0.04] transition-all relative group">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs font-bold">{b.category}</span>
                      <div className="flex items-center gap-1">
                        {editingBudgetCategory === b.category ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              className="w-16 bg-[#1A1F29] border border-[#00FF94] rounded text-xs px-1 text-white focus:outline-none font-bold font-mono"
                              value={tempBudgetLimit}
                              placeholder="Lim"
                              onChange={(e) => setTempBudgetLimit(e.target.value)}
                              onBlur={() => handleSaveBudgetLimit(b.category)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveBudgetLimit(b.category)}
                              autoFocus
                            />
                            <Check className="w-3 h-3 text-[#00FF94] cursor-pointer" onClick={() => handleSaveBudgetLimit(b.category)} />
                          </div>
                        ) : (
                          <span
                            onClick={() => {
                              setEditingBudgetCategory(b.category);
                              setTempBudgetLimit(b.limit.toString());
                            }}
                            className="text-[10px] text-[#38BDF8] hover:underline cursor-pointer font-mono"
                            title="Haz clic para modificar límite"
                          >
                            Límite: ${b.limit}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mb-1">
                      <div
                        className={`h-full transition-all duration-500 ${isOver ? 'bg-red-500' : 'bg-[#00FF94]'}`}
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>

                    <div className="flex justify-between items-center text-[10px]">
                      <span className={`${isOver ? 'text-red-400 font-bold' : 'text-[#94A3B8]'}`}>
                        Gastado: ${b.spent.toLocaleString()}
                      </span>
                      <span className={`font-mono ${isOver ? 'text-red-400 font-bold' : 'text-white'}`}>
                        {percent}%
                      </span>
                    </div>

                    {isOver && (
                      <span className="absolute -top-1.5 -right-1.5 bg-red-500/10 text-red-400 border border-red-500/20 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" /> Límite Excedido
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Subcard C: Recent Activity (Span 12 inside Span 8) */}
          <div className="col-span-12 border border-white/8 bg-[#0F1218] p-6 rounded-[20px] transition-all duration-300 hover:border-white/20">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold tracking-tight">Registro de Transacciones</h3>
                <p className="text-xs text-[#94A3B8] mt-0.5">Historial completo con soporte para múltiples divisas.</p>
              </div>
              <button
                onClick={() => setTransactions([])}
                className="text-[10px] text-red-400 hover:underline cursor-pointer border border-red-500/20 bg-red-500/5 px-2 py-1 rounded"
              >
                Limpiar Historial
              </button>
            </div>

            {transactions.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#94A3B8] border border-dashed border-white/5 rounded-xl">
                No hay transacciones registradas. ¡Prueba añadir un gasto mediante el parser de IA en la derecha!
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {transactions.map((t) => {
                  const symbol = currencies.find(c => c.code === t.currency)?.symbol || '$';
                  const isIncome = t.type === 'income';
                  
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between bg-white/[0.01] border border-white/5 p-3 rounded-xl hover:bg-white/[0.03] transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                          isIncome
                            ? 'bg-[#00FF94]/10 text-[#00FF94] border border-[#00FF94]/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {isIncome ? '↑' : '↓'}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white max-w-[200px] sm:max-w-xs md:max-w-md truncate" title={t.description}>
                            {t.description}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#94A3B8]">
                            <span className="font-mono bg-white/5 px-1.5 py-0.2 rounded text-white">{t.category}</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-2.5 h-2.5" /> {t.date}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-right">
                        <div>
                          <div className={`text-xs font-bold font-mono ${isIncome ? 'text-[#00FF94]' : 'text-white'}`}>
                            {isIncome ? '+' : '-'}{symbol}{t.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                          </div>
                          {t.currency !== displayCurrency && (
                            <div className="text-[9px] text-[#94A3B8] font-mono">
                              ≈ {displayCurrency === 'USD' ? '$' : displayCurrency === 'EUR' ? '€' : ''}{' '}
                              {getAmountInDisplay(t.amount, t.currency).toLocaleString('es-ES', { maximumFractionDigits: 2 })} {displayCurrency}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteTransaction(t.id)}
                          className="p-1 hover:bg-red-500/10 rounded text-[#94A3B8] hover:text-red-400 cursor-pointer transition-colors"
                          title="Eliminar registro"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </section>

        {/* SIDEBAR CONTAINER (SPAN 4 ON DESKTOP) */}
        <section className="col-span-1 md:col-span-12 lg:col-span-4 flex flex-col gap-5">
          
          {/* CARD 2: LIVE RATES LIST */}
          <div className="border border-white/8 bg-[#0F1218] p-5 rounded-[20px] transition-all duration-300 hover:border-white/20">
            <h3 className="text-xs uppercase tracking-wider text-[#94A3B8] font-semibold mb-3 flex items-center justify-between">
              <span>Cotización en Vivo (Base USD)</span>
              <span className="text-[10px] text-[#00FF94] lowercase font-normal flex items-center gap-1 font-mono">
                <RefreshCw className="w-2.5 h-2.5 animate-spin" /> en vivo
              </span>
            </h3>

            {loadingCurrencies ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#00FF94]" />
              </div>
            ) : (
              <div className="space-y-1 bg-black/10 rounded-xl p-2 max-h-56 overflow-y-auto">
                {currencies
                  .filter(c => c.code !== 'USD')
                  .map((c) => {
                    // Generate realistic variations
                    const randomPct = (Math.sin(c.code.charCodeAt(0) * 123) * 0.4).toFixed(2);
                    const isPositive = parseFloat(randomPct) >= 0;
                    
                    return (
                      <div
                        key={c.code}
                        onClick={() => {
                          setConvertFrom('USD');
                          setConvertTo(c.code);
                        }}
                        className="flex items-center justify-between py-2 px-3 hover:bg-white/[0.04] rounded-lg cursor-pointer transition-all border border-transparent hover:border-white/5 active:scale-[0.98]"
                        title={`Clic para graficar y convertir ${c.code}`}
                      >
                        <div>
                          <div className="text-xs font-bold flex items-center gap-1.5">
                            <span>USD / {c.code}</span>
                            <span className="text-[9px] font-normal text-[#94A3B8]">{c.name}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-semibold font-mono">{c.rateVsUsd.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
                          <span className={`text-[10px] font-mono block ${isPositive ? 'text-[#00FF94]' : 'text-red-400'}`}>
                            {isPositive ? '+' : ''}{randomPct}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
            <p className="text-[9px] text-[#94A3B8] mt-2 text-center italic">Tip: Haz clic en cualquier fila para configurar el gráfico e IA.</p>
          </div>

          {/* CARD 3: CALCULATOR & IA PREDICTION */}
          <div className="border border-white/8 bg-[#0F1218] p-5 rounded-[20px] transition-all duration-300 hover:border-white/20">
            <h3 className="text-xs uppercase tracking-wider text-[#94A3B8] font-semibold mb-4 flex items-center gap-1.5">
              <ArrowRightLeft className="w-4 h-4 text-[#00FF94]" /> Calculadora e IA de Cambio
            </h3>

            {/* Input From */}
            <div className="bg-white/[0.02] border border-white/5 p-3 rounded-xl mb-3">
              <span className="text-[10px] uppercase text-[#94A3B8] font-semibold tracking-wide">Tú entregas</span>
              <div className="flex items-center justify-between mt-1 gap-2">
                <input
                  type="number"
                  value={convertAmount || ''}
                  onChange={(e) => setConvertAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="bg-transparent border-none text-xl font-extrabold text-white w-full focus:outline-none font-mono"
                  placeholder="0.00"
                />
                <select
                  value={convertFrom}
                  onChange={(e) => setConvertFrom(e.target.value)}
                  className="bg-[#1A1F29] border border-white/10 rounded-lg px-2.5 py-1 text-xs font-bold text-white focus:outline-none cursor-pointer"
                >
                  {currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                </select>
              </div>
            </div>

            {/* Swap Button */}
            <div className="flex justify-center -my-1.5 relative z-10">
              <button
                onClick={() => {
                  setConvertFrom(convertTo);
                  setConvertTo(convertFrom);
                }}
                className="w-7 h-7 bg-[#1A1F29] border border-white/10 text-[#00FF94] hover:text-white rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all cursor-pointer"
                title="Invertir Monedas"
              >
                ⇄
              </button>
            </div>

            {/* Input To */}
            <div className="bg-white/[0.02] border border-white/5 p-3 rounded-xl mb-4">
              <span className="text-[10px] uppercase text-[#94A3B8] font-semibold tracking-wide">Tú recibes</span>
              <div className="flex items-center justify-between mt-1 gap-2">
                <div className="text-xl font-extrabold text-white font-mono truncate">
                  {calculatedResult.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                </div>
                <select
                  value={convertTo}
                  onChange={(e) => setConvertTo(e.target.value)}
                  className="bg-[#1A1F29] border border-white/10 rounded-lg px-2.5 py-1 text-xs font-bold text-white focus:outline-none cursor-pointer"
                >
                  {currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                </select>
              </div>
              <div className="text-[10px] text-[#94A3B8] mt-1 text-right font-mono">
                1 {convertFrom} = {exchangeRate.toFixed(4)} {convertTo}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleExecuteExchange}
                className="w-full bg-[#1A1F29] border border-white/10 hover:border-white/20 hover:bg-white/[0.04] text-white font-bold py-2.5 px-3 rounded-xl text-xs transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Wallet className="w-3.5 h-3.5 text-[#38BDF8]" /> Guardar Cambio
              </button>
              
              <button
                type="button"
                onClick={handleGetForecast}
                disabled={loadingForecast}
                className="w-full bg-[#00FF94] text-black hover:bg-[#00FF94]/85 font-extrabold py-2.5 px-3 rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50 active:scale-95 flex items-center justify-center gap-1"
              >
                {loadingForecast ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                Predecir con IA
              </button>
            </div>

            {/* AI PREDICTION OUTCOME */}
            {forecastError && (
              <div className="mt-3 text-xs bg-red-500/10 border border-red-500/20 p-3 rounded-xl text-red-400">
                {forecastError}
              </div>
            )}

            {forecast && (
              <div className="mt-4 border border-white/10 bg-white/[0.02] p-4 rounded-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#00FF94]/5 blur-3xl -z-10 rounded-full"></div>
                
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-bold">Pronóstico IA a 4 Semanas</span>
                  <button type="button" onClick={() => setForecast(null)} className="text-[#94A3B8] hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  {forecast.prediction === 'up' ? (
                    <span className="bg-[#00FF94]/10 text-[#00FF94] border border-[#00FF94]/20 text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5" /> ALZA (UP)
                    </span>
                  ) : forecast.prediction === 'down' ? (
                    <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1">
                      <TrendingDown className="w-3.5 h-3.5" /> BAJA (DOWN)
                    </span>
                  ) : (
                    <span className="bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/20 text-xs font-bold px-2 py-0.5 rounded">
                      ESTABLE (LATERAL)
                    </span>
                  )}
                  <span className="text-[10px] text-white bg-white/10 px-2 py-0.5 rounded font-mono">
                    Rango: {forecast.expectedRange}
                  </span>
                  <span className="text-[10px] text-[#00FF94] ml-auto font-bold font-mono">
                    Confianza: {forecast.confidence}%
                  </span>
                </div>

                <div className="text-[11px] text-[#94A3B8] leading-relaxed border-t border-white/5 pt-2.5 space-y-2">
                  <p className="whitespace-pre-line">{forecast.analysis}</p>
                  <div className="bg-[#00FF94]/5 p-2 rounded border border-[#00FF94]/10 text-[#00FF94] mt-2">
                    <strong className="block text-xs mb-0.5">Sugerencia:</strong>
                    {forecast.recommendation}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CARD 4: IA NATURAL LANGUAGE TRANSACTION EXTRACTOR */}
          <div className="border border-white/8 bg-[#0F1218] p-5 rounded-[20px] transition-all duration-300 hover:border-white/20">
            <h3 className="text-xs uppercase tracking-wider text-[#94A3B8] font-semibold mb-2.5 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#38BDF8]" /> Registro de Gastos por IA
            </h3>
            <p className="text-xs text-[#94A3B8] mb-3">
              Escribe con tus propias palabras lo que gastaste o ganaste para guardarlo automáticamente.
            </p>

            <div className="space-y-3">
              <textarea
                value={naturalText}
                onChange={(e) => setNaturalText(e.target.value)}
                placeholder="Ej: 'Ayer gasté 450 pesos mexicanos en comida en el restaurante' o 'Recibí un depósito de 1500 USD por mi salario'"
                className="w-full h-20 bg-white/[0.02] border border-white/10 rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#38BDF8] text-white placeholder-white/30 resize-none font-sans"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNaturalText('Gasté 45 USD en transporte hoy por la mañana')}
                  className="bg-white/5 border border-white/10 text-[9px] hover:bg-white/10 px-2 py-1 rounded-lg text-[#94A3B8] cursor-pointer"
                >
                  Ejemplo: Gasto
                </button>
                <button
                  type="button"
                  onClick={() => setNaturalText('Hoy me depositaron 1200 EUR de mi salario')}
                  className="bg-white/5 border border-white/10 text-[9px] hover:bg-white/10 px-2 py-1 rounded-lg text-[#94A3B8] cursor-pointer"
                >
                  Ejemplo: Ingreso
                </button>
              </div>

              <button
                type="button"
                onClick={handleExtractText}
                disabled={loadingExtract || !naturalText.trim()}
                className="w-full bg-[#38BDF8] hover:bg-[#38BDF8]/85 text-black font-extrabold py-2 px-3 rounded-xl text-xs transition-all cursor-pointer disabled:opacity-40 active:scale-95 flex items-center justify-center gap-1.5"
              >
                {loadingExtract ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                Procesar Gasto con IA
              </button>
            </div>

            {extractError && (
              <div className="mt-3 text-xs bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl text-red-400">
                {extractError}
              </div>
            )}

            {/* EXTRACTED AI PREVIEW BOX */}
            {extractedResult && (
              <div className="mt-4 border border-[#38BDF8]/25 bg-[#38BDF8]/5 p-3.5 rounded-xl text-xs">
                <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-white/5">
                  <span className="font-bold text-[#38BDF8] uppercase tracking-wider text-[10px]">Verificación de IA</span>
                  <button type="button" onClick={() => setExtractedResult(null)} className="text-[#94A3B8] hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-1.5 mb-3 font-mono">
                  <div className="flex justify-between">
                    <span className="text-[#94A3B8]">Tipo:</span>
                    <span className={`font-bold ${extractedResult.type === 'income' ? 'text-[#00FF94]' : 'text-red-400'}`}>
                      {extractedResult.type === 'income' ? 'Ingreso' : 'Gasto'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#94A3B8]">Descripción:</span>
                    <span className="text-white font-sans">{extractedResult.description}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#94A3B8]">Monto:</span>
                    <span className="text-white font-bold">{extractedResult.amount} {extractedResult.currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#94A3B8]">Categoría:</span>
                    <span className="text-white bg-white/10 px-1.5 rounded">{extractedResult.category}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAcceptExtracted}
                  className="w-full bg-[#00FF94] text-black font-extrabold py-1.5 px-3 rounded-lg text-xs hover:bg-[#00FF94]/85 transition-colors cursor-pointer active:scale-95 flex items-center justify-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" /> Confirmar y Añadir
                </button>
              </div>
            )}
          </div>

          {/* CARD 5: FINANCIAL COACH ADVISORY SCORE */}
          <div className="border border-white/8 bg-[#0F1218] p-5 rounded-[20px] transition-all duration-300 hover:border-white/20 relative overflow-hidden">
            <h3 className="text-xs uppercase tracking-wider text-[#94A3B8] font-semibold mb-3 flex items-center justify-between">
              <span>Smart Advisor - Consejero IA</span>
              <button
                type="button"
                onClick={triggerAiAdvice}
                disabled={loadingAdvice}
                className="text-[10px] text-[#38BDF8] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${loadingAdvice ? 'animate-spin' : ''}`} /> Actualizar
              </button>
            </h3>

            {loadingAdvice ? (
              <div className="py-8 flex flex-col items-center justify-center text-[#94A3B8]">
                <Loader2 className="w-6 h-6 animate-spin text-[#00FF94] mb-2" />
                <p className="text-[10px]">Analizando hábitos de gasto...</p>
              </div>
            ) : advice ? (
              <div className="space-y-4">
                {/* Score Circle & Intro */}
                <div className="flex items-center gap-4 bg-white/[0.01] border border-white/5 p-3 rounded-xl">
                  <div className="relative flex items-center justify-center w-14 h-14 bg-black/30 rounded-full border border-white/10">
                    {/* SVG Progress Circle */}
                    <svg className="absolute w-full h-full transform -rotate-90">
                      <circle
                        cx="28"
                        cy="28"
                        r="24"
                        stroke="rgba(255,255,255,0.05)"
                        strokeWidth="3.5"
                        fill="transparent"
                      />
                      <circle
                        cx="28"
                        cy="28"
                        r="24"
                        stroke={advice.score > 70 ? "#00FF94" : advice.score > 40 ? "#38BDF8" : "#f87171"}
                        strokeWidth="3.5"
                        fill="transparent"
                        strokeDasharray={150.7}
                        strokeDashoffset={150.7 - (150.7 * advice.score) / 100}
                      />
                    </svg>
                    <span className="text-sm font-extrabold font-mono">{advice.score}</span>
                  </div>
                  <div className="flex-1">
                    <span className="text-[9px] uppercase tracking-wider text-[#94A3B8] font-bold">Salud Financiera</span>
                    <p className="text-[11px] text-white leading-snug mt-0.5">{advice.generalFeedback}</p>
                  </div>
                </div>

                {/* Warnings */}
                {advice.warnings && advice.warnings.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Alertas
                    </span>
                    <ul className="text-[10px] text-[#94A3B8] space-y-1 pl-1">
                      {advice.warnings.map((w, i) => (
                        <li key={i} className="flex items-start gap-1">
                          <span className="text-amber-400 font-bold">•</span>
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Tips */}
                {advice.tips && advice.tips.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-white/5">
                    <span className="text-[10px] font-bold text-[#00FF94] flex items-center gap-1">
                      <Lightbulb className="w-3 h-3 text-[#00FF94]" /> Recomendaciones de IA
                    </span>
                    <ul className="text-[10px] text-[#94A3B8] space-y-1.5 pl-1">
                      {advice.tips.map((t, i) => (
                        <li key={i} className="flex items-start gap-1">
                          <span className="text-[#00FF94] font-bold">•</span>
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-[#94A3B8] text-center py-6 border border-dashed border-white/5 rounded-xl bg-white/[0.01]">
                Crea transacciones o haz clic en Actualizar para recibir consejos personalizados de la IA de Gemini.
              </div>
            )}
          </div>

        </section>
      </main>

      {/* FOOTER */}
      <footer className="mt-8 border-t border-white/5 pt-4 flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#94A3B8] gap-2">
        <p>© 2026 Vortex Finanzas. Hecho con inteligencia y elegancia en Bento Grid.</p>
        <p className="font-mono">Local Time: {new Date().toLocaleDateString('es-ES')} - San Francisco, CA</p>
      </footer>

      {/* --- TRANSACTION CREATION MODAL --- */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F1218] border border-white/10 rounded-[24px] w-full max-w-md p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#00FF94]/5 blur-3xl -z-10 rounded-full"></div>
            
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-[#94A3B8] hover:text-white p-1 hover:bg-white/5 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold mb-1">Nueva Transacción</h3>
            <p className="text-xs text-[#94A3B8] mb-5">Agrega manualmente un ingreso o gasto al historial.</p>

            <form onSubmit={handleAddTransaction} className="space-y-4">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 border border-white/5 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setNewType('expense');
                    setNewCategory('Comida');
                  }}
                  className={`py-2 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                    newType === 'expense'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : 'text-[#94A3B8]'
                  }`}
                >
                  Gasto (Egresos)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewType('income');
                    setNewCategory('Ingresos');
                  }}
                  className={`py-2 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                    newType === 'income'
                      ? 'bg-[#00FF94]/10 text-[#00FF94] border border-[#00FF94]/20'
                      : 'text-[#94A3B8]'
                  }`}
                >
                  Ingreso
                </button>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-[#94A3B8] block">Descripción</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Súper semanal, Venta de Laptop"
                  className="w-full bg-[#1A1F29] border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#00FF94]"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>

              {/* Amount and Currency */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] uppercase font-bold text-[#94A3B8] block">Monto</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    className="w-full bg-[#1A1F29] border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#00FF94]"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-[#94A3B8] block">Moneda</label>
                  <select
                    className="w-full bg-[#1A1F29] border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#00FF94] cursor-pointer"
                    value={newCurrency}
                    onChange={(e) => setNewCurrency(e.target.value)}
                  >
                    {currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </select>
                </div>
              </div>

              {/* Category & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-[#94A3B8] block">Categoría</label>
                  {newType === 'income' ? (
                    <input
                      type="text"
                      disabled
                      className="w-full bg-[#1A1F29]/50 border border-white/5 rounded-xl p-3 text-xs text-[#94A3B8]"
                      value="Ingresos"
                    />
                  ) : (
                    <select
                      className="w-full bg-[#1A1F29] border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#00FF94] cursor-pointer"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                    >
                      <option value="Comida">Comida</option>
                      <option value="Transporte">Transporte</option>
                      <option value="Vivienda">Vivienda</option>
                      <option value="Entretenimiento">Entretenimiento</option>
                      <option value="Servicios">Servicios</option>
                      <option value="Salud">Salud</option>
                      <option value="Educación">Educación</option>
                      <option value="Otros">Otros</option>
                    </select>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-[#94A3B8] block">Fecha</label>
                  <input
                    type="date"
                    required
                    className="w-full bg-[#1A1F29] border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#00FF94]"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-full bg-[#00FF94] hover:bg-[#00FF94]/85 text-black font-extrabold py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer"
                >
                  Agregar Transacción
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
