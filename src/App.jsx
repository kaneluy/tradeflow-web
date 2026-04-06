import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ComposedChart, 
  Line, 
  LineChart, 
  BarChart,
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Area,
  AreaChart, 
  Cell,
  ReferenceLine,
  Brush 
} from 'recharts';
import { 
  ArrowUp, 
  ArrowDown, 
  Activity, 
  BarChart2, 
  Settings,
  Sparkles,
  MessageSquare,
  Send,
  X,
  Loader2,
  Cpu,
  Search,
  PlusCircle,
  Trash2,
  Globe, 
  Wifi,
  WifiOff,
  ShieldAlert,
  Moon, 
  Sun,
  Info,
  Newspaper,
  BookOpen,
  Target,
  Zap,
  TrendingUp,
  Layers,
  Scale,
  Server,
  RefreshCcw,
  HelpCircle,
  PieChart,   
  DollarSign,
  TrendingDown,
  Menu,
  PlayCircle,
  Maximize,
  Minimize
} from 'lucide-react';

// ==========================================
// 0. 错误边界 (ErrorBoundary)
// ==========================================
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white p-4 font-sans text-center">
          <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
          <h1 className="text-2xl font-black mb-4 text-red-500 tracking-tighter">终端崩溃</h1>
          <pre className="bg-slate-900 p-6 rounded-2xl text-xs overflow-auto max-w-full text-rose-300 border border-rose-900/30 font-mono mb-6 text-left">
            {this.state.error ? String(this.state.error) : "Unknown Kernel Panic"}
          </pre>
          <button onClick={() => window.location.reload()} className="px-8 py-3 bg-blue-600 text-white rounded-xl shadow-xl font-bold hover:bg-blue-500 transition-all active:scale-95">重新加载</button>
        </div>
      );
    }
    return this.props.children; 
  }
}

// ==========================================
// 1. API 通信与量化算法
// ==========================================

const callGeminiAPI = async (prompt, userKey, backendUrl = "") => {
  const cleanKey = (userKey || "").trim();
  if (!cleanKey) return "⚠️ 请在左下角设置中填入 Gemini API Key。";

  try {
    const proxyPath = backendUrl 
      ? (backendUrl.endsWith('/') ? `${backendUrl}api/ai` : `${backendUrl}/api/ai`) 
      : "/api/ai";

    const res = await fetch(proxyPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, key: cleanKey })
    });
    
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      return data.text || "AI 返回为空";
    } else {
      return `⚠️ Google 官方拒绝了请求:\n\n${data.error || res.statusText}\n\n📌 请确认您的 API Key 是在 aistudio.google.com 申请的，而不是 Google Cloud Console。`;
    }
  } catch (e) {
    return `🚫 代理服务器失联。请确保您已将 api/ai.js 成功推送到 Vercel。错误详情: ${e.message}`;
  }
};

const calculateIndicators = (data) => {
    if (!data || data.length === 0) return [];
    let closes = data.map(d => d.close), highs = data.map(d => d.high), lows = data.map(d => d.low);
    const sma = (arr, period) => arr.map((v, i) => i < period - 1 ? null : parseFloat((arr.slice(i-period+1, i+1).reduce((a, b) => a+b,0)/period).toFixed(2)));
    const ma20 = sma(closes, 20);
    const ema = (arr, period) => { let k = 2/(period+1), res = [arr[0]]; for(let i=1;i<arr.length;i++) res.push(arr[i]*k + res[i-1]*(1-k)); return res; };
    const ema12 = ema(closes, 12), ema26 = ema(closes, 26);
    const diff = ema12.map((e, i) => e - ema26[i]), dea = ema(diff, 9);
    const macd = diff.map((d, i) => parseFloat(((d - dea[i]) * 2).toFixed(3)));
    
    let cumVol = 0, cumVolPrice = 0;
    const vwap = data.map(d => {
        cumVol += (d.volume || 0); cumVolPrice += ((d.high + d.low + d.close) / 3) * (d.volume || 0);
        return cumVol === 0 ? d.close : parseFloat((cumVolPrice / cumVol).toFixed(2));
    });

    return data.map((item, i) => ({
        ...item, ma20: ma20[i] || item.close, vwap: vwap[i], macd: macd[i],
        bollUpper: ma20[i] ? parseFloat((ma20[i] * 1.05).toFixed(2)) : null,
        bollLower: ma20[i] ? parseFloat((ma20[i] * 0.95).toFixed(2)) : null
    }));
};

const calculateTrendAnalysis = (history) => {
    if (!history || history.length < 20) return { label: '数据积累', desc: '等待中' };
    const last = history[history.length - 1], prev = history[history.length - 10];
    if (last.close > last.ma20 && last.ma20 > prev?.ma20) return { label: '强多', desc: '主升浪' };
    if (last.close < last.ma20 && last.ma20 < prev?.ma20) return { label: '强空', desc: '主跌浪' };
    return { label: '震荡', desc: '箱体整理' };
};

const calculateRiskLevels = (history) => {
    if (!history || history.length === 0) return { stopLoss: '---', targetPrice: '---' };
    const last = history[history.length - 1];
    return { stopLoss: (last.close * 0.96).toFixed(2), targetPrice: (last.close * 1.08).toFixed(2) };
};

const generateStaticHistory = (p) => {
    let data = []; let price = Number(p) || 100;
    for (let i = 0; i < 60; i++) {
        price = price + (Math.random() - 0.5) * 2;
        data.push({ time: i, open: price-0.5, high: price+1, low: price-1, close: price, volume: 1000000 });
    }
    return calculateIndicators(data);
};

// ==========================================
// 2. UI 组件
// ==========================================

const MetricCard = ({ label, value, color, icon: Icon, isDarkMode }) => (
    <div className={`p-5 rounded-[24px] border transition-all duration-300 hover:scale-[1.03] ${isDarkMode ? 'bg-slate-900/40 border-slate-800 shadow-2xl' : 'bg-white border-gray-100 shadow-md'}`}>
        <div className="text-[9px] opacity-40 uppercase font-black tracking-widest mb-2 flex items-center gap-1.5">
            {Icon && <Icon className="w-3 h-3"/>} {label}
        </div>
        <div className={`text-lg font-black ${color || (isDarkMode ? 'text-white' : 'text-slate-900')}`}>{value}</div>
    </div>
);

const FundamentalItem = ({ label, value, isDarkMode }) => (
    <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800/40 border-slate-700/50' : 'bg-gray-50 border-gray-200 shadow-sm'}`}>
        <div className="text-[9px] opacity-40 uppercase font-black mb-1 flex items-center gap-1">
            <Info className="w-3 h-3 text-blue-400"/> {label}
        </div>
        <div className={`font-mono font-bold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{value}</div>
    </div>
);

const SettingsModal = ({ onClose, isDarkMode, currentUrl, currentKey, onSave }) => {
    const [url, setUrl] = useState(currentUrl);
    const [key, setKey] = useState(currentKey);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in">
            <div className={`w-[400px] rounded-3xl p-8 border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-200 text-gray-900 shadow-2xl'}`}>
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-xl font-black flex items-center gap-2"><Settings className="text-blue-500"/> 系统配置</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-500/10 rounded-full transition-all"><X/></button>
                </div>
                <div className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">后端服务器地址</label>
                        <input value={url} onChange={e=>setUrl(e.target.value)} className={`w-full p-4 rounded-2xl border outline-none ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-gray-100 text-gray-900'}`} placeholder="保持为空或填写 Vercel 域名" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Gemini API Key</label>
                        <input value={key} onChange={e=>setKey(e.target.value)} type="password" className={`w-full p-4 rounded-2xl border outline-none ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-gray-100 text-gray-900'}`} placeholder="AIza..." />
                    </div>
                    <button onClick={() => onSave(url, key)} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl shadow-xl transition-all transform active:scale-95">保存并应用</button>
                </div>
            </div>
        </div>
    );
};

// ==========================================
// 3. 主程序
// ==========================================

const StockDashboard = () => {
  const [selectedSymbol, setSelectedSymbol] = useState('US.TSLA');
  const [marketData, setMarketData] = useState({
      'US.NVDA': { name: 'NVIDIA Corp', price: 184.84, change: 0.83, data: generateStaticHistory(184), cap: '2.21T', pe: '75.2', beta: '1.8' },
      'US.AAPL': { name: 'Apple Inc.', price: 210.30, change: 0.45, data: generateStaticHistory(210), cap: '2.85T', pe: '29.4', beta: '1.1' },
      'US.TSLA': { name: 'Tesla Inc.', price: 449.36, change: 4.15, data: generateStaticHistory(449), cap: '9.27T', pe: '49.27', beta: '2.12' }
  });
  const [isRealTime, setIsRealTime] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState('analysis');
  const [mainOverlay, setMainOverlay] = useState('MA');
  const [tickerInput, setTickerInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  
  // AI 状态控制
  const [aiReport, setAiReport] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [priceAction, setPriceAction] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [fundamentalAudit, setFundamentalAudit] = useState("");
  const [isAuditing, setIsAuditing] = useState(false);
  const [newsSentiment, setNewsSentiment] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);

  // 初始化设置
  const [backendUrl, setBackendUrl] = useState(() => localStorage.getItem('tf_backend_url') || "");
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('tf_gemini_key') || "");

  const currentStock = marketData[selectedSymbol] || marketData['US.TSLA'];

  // 持久化存储
  useEffect(() => {
    localStorage.setItem('tf_backend_url', backendUrl);
    localStorage.setItem('tf_gemini_key', geminiKey);
  }, [backendUrl, geminiKey]);

  // 数据同步循环
  useEffect(() => {
    let intervalId;
    const fetchLoop = async () => {
        if (!isRealTime) return;
        try {
            const sym = selectedSymbol.replace('US.', '');
            const url = backendUrl ? (backendUrl.endsWith('/') ? `${backendUrl}api/quote?code=${sym}` : `${backendUrl}/api/quote?code=${sym}`) : `/api/quote?code=${sym}`;
            const response = await fetch(url);
            const res = await response.json();
            setMarketData(prev => {
                const stock = prev[selectedSymbol] || { name: sym, data: [] };
                let history = res.history ? res.history.map(h => ({ ...h, time: new Date(h.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })) : stock.data;
                history = calculateIndicators(history);
                const risk = calculateRiskLevels(history);
                const trend = calculateTrendAnalysis(history);
                return { ...prev, [selectedSymbol]: { ...stock, price: res.price, change: res.changePercent, stopLoss: risk.stopLoss, targetPrice: risk.targetPrice, longTermTrend: trend, data: history, cap: res.cap || stock.cap || '---', pe: res.pe || stock.pe || '---', beta: res.beta || stock.beta || '---' } };
            });
        } catch (e) { console.warn("数据同步暂缓"); }
    };
    if (isRealTime) { fetchLoop(); intervalId = setInterval(fetchLoop, 5000); }
    return () => clearInterval(intervalId);
  }, [isRealTime, selectedSymbol, backendUrl]);

  /**
   * 🛠️ handleAI
   */
  const handleAI = async (type) => {
      let prompt = "";
      if (type === 'report') {
          setIsAiLoading(true);
          prompt = `分析股票 ${selectedSymbol}，现价 $${currentStock.price}，趋势状态为 ${currentStock.longTermTrend?.label}。请提供简短的技术点评和操作建议。`;
          setAiReport(await callGeminiAPI(prompt, geminiKey, backendUrl));
          setIsAiLoading(false);
      } else if (type === 'scan') {
          setIsScanning(true);
          const recent = currentStock.data.slice(-7).map(d => `收:${d.close}`).join(', ');
          prompt = `基于最近数据 [${recent}] 扫描股票 ${selectedSymbol} 是否存在吞没或十字星等形态。`;
          setPriceAction(await callGeminiAPI(prompt, geminiKey, backendUrl));
          setIsScanning(false);
      } else if (type === 'audit') {
          setIsAuditing(true);
          prompt = `审计股票 ${selectedSymbol} 的估值风险。市值 ${currentStock.cap}，PE ${currentStock.pe}。`;
          setFundamentalAudit(await callGeminiAPI(prompt, geminiKey, backendUrl));
          setIsAuditing(false);
      } else if (type === 'news') {
          setIsSummarizing(true);
          prompt = `总结 ${selectedSymbol} 最近的市场情绪。`;
          setNewsSentiment(await callGeminiAPI(prompt, geminiKey, backendUrl));
          setIsSummarizing(false);
      }
  };

  const fibLevels = useMemo(() => {
    if (mainOverlay !== 'FIB' || !currentStock.data.length) return null;
    const h = Math.max(...currentStock.data.map(d=>d.high)), l = Math.min(...currentStock.data.map(d=>d.low)), d = h-l;
    return [{ p: l, l: '0%' }, { p: l+d*0.382, l: '38.2%' }, { p: l+d*0.5, l: '50%' }, { p: l+d*0.618, l: '61.8%' }, { p: h, l: '100%' }];
  }, [mainOverlay, currentStock.data]);

  return (
    <div className={`flex h-screen w-full transition-all duration-700 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      {showSettings && <SettingsModal onClose={()=>setShowSettings(false)} isDarkMode={isDarkMode} currentUrl={backendUrl} currentKey={geminiKey} onSave={(u, k)=>{setBackendUrl(u); setGeminiKey(k); setShowSettings(false);}} />}

      {/* 侧边栏 */}
      <aside className={`w-72 border-r flex flex-col transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xl'}`}>
        <div className="p-8 border-b border-inherit">
            <div className="flex items-center gap-4 group">
                <div className="p-3 bg-blue-600 rounded-2xl shadow-xl shadow-blue-500/30">
                    <Activity className="w-6 h-6 text-white"/>
                </div>
                <div>
                    <h1 className="text-2xl font-black tracking-tighter italic">TradeFlow</h1>
                    <p className="text-[10px] opacity-40 font-mono">QUANTUM ENGINE V15.4</p>
                </div>
            </div>
        </div>

        <div className="p-6 border-b border-inherit">
            <div className="relative">
                <input value={tickerInput} onChange={e=>setTickerInput(e.target.value)} onKeyDown={e=>e.key==='Enter' && (setSelectedSymbol(`US.${tickerInput.toUpperCase()}`), setTickerInput(""))} placeholder="搜索代码 (如: BABA)..." className={`w-full p-3 rounded-xl border text-sm font-bold focus:outline-none transition-all ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-100 text-gray-900'}`}/>
                <PlusCircle onClick={()=>{if(tickerInput){setSelectedSymbol(`US.${tickerInput.toUpperCase()}`); setTickerInput("");}}} className="absolute right-3 top-3 w-5 h-5 text-blue-500 cursor-pointer"/>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3 scrollbar-hide">
            <p className="text-[10px] font-black opacity-30 uppercase tracking-widest mb-4">自选标的 (WATCHLIST)</p>
            {Object.keys(marketData).map(sym => (
                <div key={sym} onClick={()=>setSelectedSymbol(sym)} className={`p-4 rounded-2xl cursor-pointer transition-all flex items-center justify-between group ${selectedSymbol === sym ? 'bg-blue-600 text-white shadow-2xl translate-x-2' : isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}>
                    <div>
                        <div className="font-black text-sm">{sym.replace('US.', '')}</div>
                        <div className="text-[10px] opacity-60">{marketData[sym].name}</div>
                    </div>
                    <div className="text-right">
                        <div className="font-bold text-sm">${marketData[sym].price}</div>
                        <div className={`text-[10px] font-bold ${marketData[sym].change >= 0 ? 'text-emerald-400' : 'text-rose-400'} ${selectedSymbol === sym ? 'text-white' : ''}`}>
                            {marketData[sym].change >= 0 ? '+' : ''}{marketData[sym].change}%
                        </div>
                    </div>
                </div>
            ))}
        </div>

        <div className="p-6 border-t border-inherit space-y-4">
            <button onClick={()=>setIsRealTime(!isRealTime)} className={`w-full p-4 rounded-2xl flex items-center justify-between text-xs font-black border transition-all ${isRealTime ? 'bg-green-500/10 border-green-500 text-green-500 shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                <div className="flex items-center gap-2">{isRealTime ? <Wifi className="w-4 h-4"/> : <WifiOff className="w-4 h-4"/>}<span>{isRealTime ? '实盘连接中' : '离线演示模式'}</span></div>
                {isRealTime && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]"/>}
            </button>
            <div className="flex gap-2">
                <button onClick={()=>setIsDarkMode(!isDarkMode)} className="flex-1 p-3 rounded-xl border border-inherit flex justify-center hover:bg-gray-500/10 transition-all">{isDarkMode ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}</button>
                <button onClick={()=>setShowSettings(true)} className="flex-1 p-3 rounded-xl border border-inherit flex justify-center hover:bg-gray-500/10 transition-all"><Settings className="w-5 h-5"/></button>
            </div>
        </div>
      </aside>

      {/* 主面板 */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-24 border-b border-inherit px-10 flex items-center justify-between bg-inherit/80 backdrop-blur-2xl sticky top-0 z-10">
            <div className="flex items-center gap-8">
                <h2 className="text-5xl font-black tracking-tighter italic">{selectedSymbol.replace('US.', '')}</h2>
                <div className="hidden md:flex flex-col border-l border-inherit pl-6 opacity-60">
                    <span className="text-xs font-black uppercase">{currentStock.name}</span>
                    <span className="text-[10px] font-mono text-blue-500 tracking-widest">REALTIME ENGINE ACTIVE</span>
                </div>
            </div>
            <div className="text-right">
                <div className="text-4xl font-mono font-bold tracking-tighter">${currentStock.price}</div>
                <div className={`text-sm font-black flex items-center justify-end ${currentStock.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {currentStock.change >= 0 ? <ArrowUp className="w-4 h-4 mr-1"/> : <ArrowDown className="w-4 h-4 mr-1"/>}
                    {Math.abs(currentStock.change)}%
                </div>
            </div>
        </header>

        <main className="flex-1 overflow-y-auto p-10 space-y-10 scrollbar-hide pb-32">
            <div className="grid grid-cols-12 gap-10">
                <div className="col-span-12 xl:col-span-8 flex flex-col gap-8">
                    <div className={`rounded-[40px] border p-10 h-[650px] flex flex-col transition-all relative shadow-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
                        <div className="flex justify-between items-center mb-10">
                            <div className="flex gap-2 p-1.5 bg-slate-950 rounded-2xl shadow-inner border border-slate-800/50">
                                {['MA', 'BOLL', 'FIB'].map(o => (
                                    <button key={o} onClick={()=>setMainOverlay(o)} className={`px-5 py-2 text-[10px] font-black rounded-xl transition-all ${mainOverlay === o ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>{o}</button>
                                ))}
                            </div>
                            <div className="flex gap-1">
                                {['1D', '1W', '1M', '1Y'].map(tf => <button key={tf} className={`px-4 py-1.5 text-[10px] font-black rounded-lg ${tf === '1D' ? 'bg-slate-800 text-white' : 'opacity-40'}`}>{tf}</button>)}
                            </div>
                        </div>

                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={currentStock.data}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode?"#1e293b":"#e2e8f0"} vertical={false}/>
                                    <XAxis dataKey="time" hide/>
                                    <YAxis domain={['auto', 'auto']} hide/>
                                    <Tooltip contentStyle={{backgroundColor:'#020617', border:'none', borderRadius:'20px', color:'white', fontSize:'11px'}}/>
                                    <Bar dataKey="close" fill="#10b981" radius={[3, 3, 0, 0]}/>
                                    {mainOverlay === 'MA' && <Line type="monotone" dataKey="ma20" stroke="#8b5cf6" strokeWidth={3} dot={false}/>}
                                    {mainOverlay === 'BOLL' && (<><Line type="monotone" dataKey="bollUpper" stroke="#38bdf8" strokeDasharray="5 5" dot={false}/><Line type="monotone" dataKey="bollLower" stroke="#38bdf8" strokeDasharray="5 5" dot={false}/></>)}
                                    {mainOverlay === 'FIB' && fibLevels?.map((f,i)=><ReferenceLine key={i} y={f.p} stroke="#f97316" strokeDasharray="3 3" label={{value:f.l, position:'right', fill:'#f97316', fontSize:9, fontWeight:'bold'}}/>)}
                                    <Line type="monotone" dataKey="vwap" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="8 4" opacity={0.7}/>
                                    <Brush dataKey="time" height={25} stroke="#1e293b" fill={isDarkMode?"#020617":"#f8fafc"} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="h-28 mt-6 pt-6 border-t border-inherit">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={currentStock.data}><Bar dataKey="macd">{currentStock.data.map((e,i)=><Cell key={i} fill={e.macd>=0?'#10b981':'#ef4444'}/>)}</Bar></BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        <MetricCard label="短线建议" value="适当减仓" color="text-emerald-500" icon={Zap} isDarkMode={isDarkMode}/>
                        <MetricCard label="中长期趋势" value={currentStock.longTermTrend?.label || '强空'} color="text-blue-500" icon={TrendingUp} isDarkMode={isDarkMode}/>
                        <MetricCard label="预计压力" value={`$${currentStock.targetPrice}`} color="text-rose-500" icon={Target} isDarkMode={isDarkMode}/>
                        <MetricCard label="动态止损" value={`$${currentStock.stopLoss}`} color="text-amber-500" icon={ShieldAlert} isDarkMode={isDarkMode}/>
                    </div>
                </div>

                <div className="col-span-12 xl:col-span-4 flex flex-col gap-8">
                    <div className={`p-2 rounded-2xl border flex gap-1 ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-gray-200 shadow-md'}`}>
                        {[{id:'analysis',l:'图表分析'},{id:'fundamentals',l:'基本面诊断'},{id:'news',l:'情绪提炼'}].map(t => (
                            <button key={t.id} onClick={()=>setActiveTab(t.id)} className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${activeTab === t.id ? 'bg-blue-600 text-white shadow-xl' : 'opacity-40 hover:opacity-100'}`}>{t.l}</button>
                        ))}
                    </div>

                    <div className="flex-1 space-y-8 overflow-y-auto scrollbar-hide">
                        {activeTab === 'analysis' && (
                            <div className="space-y-8 animate-in fade-in duration-500">
                                <div className={`p-8 rounded-[40px] border relative overflow-hidden flex flex-col min-h-[380px] shadow-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white shadow-xl'}`}>
                                    <div className="flex justify-between items-center mb-8 relative z-10">
                                        <div className="flex items-center gap-3"><Cpu className="text-purple-500 w-6 h-6"/><h3 className="text-xl font-black tracking-tighter">智能技术研报</h3></div>
                                        <button onClick={()=>handleAI('report')} disabled={isAiLoading} className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2.5 rounded-full text-xs font-black flex items-center gap-2 active:scale-95 disabled:opacity-50">
                                            {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4"/>} 一键生成
                                        </button>
                                    </div>
                                    <div className={`flex-1 text-[13px] leading-relaxed whitespace-pre-wrap relative z-10 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{aiReport || "💡 系统已全面启用智能路由轮询，点击即可自动适配最优大模型。"}</div>
                                </div>
                                <div className={`p-8 rounded-[35px] border flex flex-col gap-5 transition-all ${isDarkMode ? 'bg-teal-900/10 border-teal-800/40' : 'bg-teal-50 border-teal-100'}`}>
                                    <div className="flex items-center justify-between"><div className="flex items-center gap-3 text-teal-500"><Search className="w-6 h-6"/><span className="text-xs font-black uppercase">裸K形态扫描</span></div><button onClick={()=>handleAI('scan')} disabled={isScanning} className="bg-teal-600 px-4 py-2 rounded-full text-[10px] font-bold text-white disabled:opacity-50 transition-all active:scale-95">执行扫描</button></div>
                                    <p className={`text-xs font-medium leading-relaxed ${isDarkMode ? 'text-teal-200' : 'text-teal-900'}`}>{priceAction || "等待扫描信号..."}</p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'fundamentals' && (
                            <div className="space-y-6 animate-in fade-in duration-500">
                                <div className={`p-8 rounded-[40px] border flex flex-col min-h-[350px] shadow-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white shadow-xl'}`}>
                                    <div className="flex justify-between items-center mb-8"><div className="flex items-center gap-3 text-amber-500"><Scale className="w-6 h-6"/><h3 className="text-xl font-black tracking-tighter">深度基本面审计</h3></div><button onClick={()=>handleAI('audit')} disabled={isAuditing} className="bg-amber-600 text-white px-5 py-2 rounded-full text-[10px] font-black disabled:opacity-50 active:scale-95 transition-all">价值诊断</button></div>
                                    <div className={`flex-1 text-[13px] leading-relaxed whitespace-pre-wrap ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{fundamentalAudit || "让 AI 为您深度分析财务健康度。"}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FundamentalItem label="总市值" value={currentStock.cap} isDarkMode={isDarkMode}/>
                                    <FundamentalItem label="PE(市盈率)" value={currentStock.pe} isDarkMode={isDarkMode}/>
                                    <FundamentalItem label="Forward PE" value="32.88" isDarkMode={isDarkMode}/>
                                    <FundamentalItem label="Beta" value={currentStock.beta || '---'} isDarkMode={isDarkMode}/>
                                </div>
                            </div>
                        )}

                        {activeTab === 'news' && (
                            <div className="space-y-8 animate-in fade-in duration-500 pb-20">
                                <div className={`p-8 rounded-[40px] border flex flex-col min-h-[200px] ${isDarkMode ? 'bg-blue-900/10 border-blue-800/40' : 'bg-blue-50 border-blue-100'}`}>
                                    <div className="flex justify-between items-center mb-8"><div className="flex items-center gap-3 text-blue-500"><Newspaper className="w-6 h-6"/><h3 className="text-xl font-black tracking-tighter">舆情情绪提炼</h3></div><button onClick={()=>handleAI('news')} disabled={isSummarizing} className="bg-blue-600 text-white px-5 py-2 rounded-full text-[10px] font-black disabled:opacity-50 active:scale-95 transition-all">一键总结</button></div>
                                    <div className={`text-xs font-medium leading-relaxed ${isDarkMode ? 'text-blue-100' : 'text-blue-900'}`}>{newsSentiment || "快速提炼市场核心情绪。"}</div>
                                </div>
                                <div className="space-y-4">
                                    {[{ title: "季度交付数据超预期，市场信心回升", source: "REUTERS", time: "1h前" }, { title: "分析师看好其自动驾驶领先地位", source: "CNBC", time: "3h前" }].map((n, i) => (
                                        <div key={i} className={`p-5 rounded-2xl border transition-all ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-100 shadow-sm'}`}>
                                            <div className="text-sm font-black mb-3">{n.title}</div>
                                            <div className="flex justify-between text-[9px] opacity-40 font-black uppercase tracking-widest"><span>{n.source}</span><span>{n.time}</span></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
      </main>
    </div>
  );
}

export default function App() { return ( <ErrorBoundary> <StockDashboard /> </ErrorBoundary> ); }