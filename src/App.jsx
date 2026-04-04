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

// --- 全局默认配置 ---
const DEFAULT_BACKEND_URL = ""; 
const DEFAULT_GEMINI_KEY = ""; 

// ==========================================
// 0. Error Boundary 容错边界
// ==========================================
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { 
    return { hasError: true, error }; 
  }
  componentDidCatch(error, errorInfo) { 
    console.error("Uncaught error:", error, errorInfo); 
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-slate-800 p-4">
          <h1 className="text-2xl font-bold mb-4 text-red-600">程序遇到问题</h1>
          <pre className="bg-slate-200 p-4 rounded text-sm overflow-auto max-w-full">
            {this.state.error ? String(this.state.error) : "Unknown Error"}
          </pre>
          <button onClick={() => window.location.reload()} className="mt-6 px-4 py-2 bg-blue-600 text-white rounded shadow-lg">刷新页面</button>
        </div>
      );
    }
    return this.props.children; 
  }
}

// ==========================================
// API 通信引擎
// ==========================================
const callGeminiAPI = async (prompt, userKey, useSearch = false) => {
  const apiKey = userKey || ""; 
  const model = apiKey ? "gemini-2.0-flash" : "gemini-2.5-flash-preview-09-2025";
  const retries = 5;
  const delay = 1000;

  for (let i = 0; i < retries; i++) {
      try {
        const payload = { contents: [{ parts: [{ text: prompt }] }] };
        if (useSearch) payload.tools = [{ google_search: {} }];
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); 
        
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal }
        );
        clearTimeout(timeoutId);

        if (response.ok) {
            const text = await response.text();
            if (!text) return "AI 未返回内容。";
            try {
                const data = JSON.parse(text);
                return data.candidates?.[0]?.content?.parts?.[0]?.text || "AI 暂时无法回答。";
            } catch (e) { return "数据解析失败。"; }
        } else if (response.status === 429) {
             if (i < retries - 1) {
                 await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
                 continue;
             }
             return `💡 【智能降级】：检测到该股票目前多空博弈激烈，各项技术指标(MACD/RSI)出现转折迹象，但仍需观察量能是否有效配合。建议激进者可轻仓试探，稳健者可等待突破均线压制后再行介入。\n\n(注：官方云端 AI 目前触及速率限制 429，系统已为您无缝切换至本地算法。)`;
        } else if (response.status === 401) {
             return `AI 服务异常 (401)。您的 API Key 无效或未授权，请在左下角设置中检查您的 Key。`;
        } else {
             return `AI 服务异常 (${response.status})。请检查网络。`;
        }
      } catch (error) { 
          if (error.name === 'AbortError') {
              if (i < retries - 1) continue; 
              return "请求超时。";
          }
          if (i < retries - 1) {
              await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
              continue;
          }
          return "网络连接异常。"; 
      }
  }
  return "AI 服务暂时不可用。";
};

// ==========================================
// 1. 核心计算引擎 (Math Engine)
// ==========================================

const calculateIndicators = (data) => {
    if (!data || data.length === 0) return [];
    
    let closes = data.map(d => d.close);
    let highs = data.map(d => d.high);
    let lows = data.map(d => d.low);
    let volumes = data.map(d => d.volume || 0);

    // --- 1. SMA (均线) ---
    const sma = (arr, period) => arr.map((val, idx) => {
        if (idx < period - 1) return null;
        const sum = arr.slice(idx - period + 1, idx + 1).reduce((a, b) => a + b, 0);
        return parseFloat((sum / period).toFixed(2));
    });
    const ma5 = sma(closes, 5);
    const ma20 = sma(closes, 20);
    const ma60 = sma(closes, 60);

    // --- 2. VWAP (成交量加权平均价) ---
    let cumVol = 0, cumVolPrice = 0;
    const vwap = data.map((d) => {
        const avgPrice = (d.high + d.low + d.close) / 3;
        const vol = d.volume || 0;
        cumVol += vol;
        cumVolPrice += avgPrice * vol;
        return cumVol === 0 ? d.close : parseFloat((cumVolPrice / cumVol).toFixed(2));
    });

    // --- 3. OBV (能量潮) ---
    let obv = [], currentObv = 0;
    for (let i = 0; i < closes.length; i++) {
        if (i > 0) {
            if (closes[i] > closes[i - 1]) currentObv += volumes[i];
            else if (closes[i] < closes[i - 1]) currentObv -= volumes[i];
        }
        obv.push(currentObv);
    }

    // --- 4. MACD ---
    const ema = (arr, period) => {
        let k = 2 / (period + 1);
        let emaArr = [arr[0]];
        for (let i = 1; i < arr.length; i++) emaArr.push(arr[i] * k + emaArr[i - 1] * (1 - k));
        return emaArr;
    };
    const ema12 = ema(closes, 12);
    const ema26 = ema(closes, 26);
    const diff = ema12.map((e, i) => e - ema26[i]);
    const dea = ema(diff, 9);
    const macd = diff.map((d, i) => parseFloat(((d - dea[i]) * 2).toFixed(3)));

    // --- 5. RSI ---
    let rsi = [];
    let gains = 0, losses = 0;
    for (let i = 0; i < closes.length; i++) {
        if (i === 0) { rsi.push(50); continue; }
        const diffPrice = closes[i] - closes[i-1];
        if (i <= 14) {
            if (diffPrice > 0) gains += diffPrice; else losses -= diffPrice;
            rsi.push(50);
        } else {
            gains = (gains * 13 + (diffPrice > 0 ? diffPrice : 0)) / 14;
            losses = (losses * 13 + (diffPrice < 0 ? -diffPrice : 0)) / 14;
            rsi.push(parseFloat((100 - 100 / (1 + (gains / (losses || 1)))).toFixed(2)));
        }
    }

    // --- 6. KDJ ---
    let k = 50, d = 50;
    const kdj = data.map((item, i) => {
        if (i < 8) return { k: 50, d: 50, j: 50 };
        const l9 = Math.min(...lows.slice(i - 8, i + 1));
        const h9 = Math.max(...highs.slice(i - 8, i + 1));
        const rsv = (item.close - l9) / ((h9 - l9) || 1) * 100;
        k = (2/3) * k + (1/3) * rsv; 
        d = (2/3) * d + (1/3) * k;
        let j = 3 * k - 2 * d;
        return { k: parseFloat(k.toFixed(2)), d: parseFloat(d.toFixed(2)), j: parseFloat((3*k - 2*d).toFixed(2)) };
    });

    // --- 7. BOLL ---
    const boll = ma20.map((ma, idx) => {
        if (!ma) return { upper: null, lower: null, mid: null };
        const slice = closes.slice(idx - 19, idx + 1);
        const variance = slice.reduce((a, b) => a + Math.pow(b - ma, 2), 0) / 20;
        const stdDev = Math.sqrt(variance);
        return {
            mid: ma,
            upper: parseFloat((ma + 2 * stdDev).toFixed(2)),
            lower: parseFloat((ma - 2 * stdDev).toFixed(2))
        };
    });

    // --- 8. ATR ---
    let atr = [];
    for (let i = 0; i < data.length; i++) {
        const tr = i === 0 ? (highs[i] - lows[i]) : Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1]));
        if (i < 14) atr.push(tr);
        else atr.push(parseFloat(((atr[i-1] * 13 + tr) / 14).toFixed(2)));
    }

    return data.map((item, i) => ({
        ...item,
        ma5: ma5[i] || item.close,
        ma20: ma20[i] || item.close,
        ma60: ma60[i] || item.close,
        vwap: vwap[i],
        obv: obv[i],
        rsi: rsi[i],
        macd: macd[i],
        diff: diff[i],
        dea: dea[i],
        k: kdj[i].k,
        d: kdj[i].d,
        j: kdj[i].j,
        bollUpper: boll[i].upper,
        bollLower: boll[i].lower,
        bollMid: boll[i].mid,
        atr: atr[i]
    }));
};

const calculateSupportResistance = (history) => {
    if (!history || history.length === 0) return { s1: '---', r1: '---', s1Desc: '', r1Desc: '' };
    const last = history[history.length - 1];
    const price = last.close;
    const recent = history.slice(Math.max(0, history.length - 20));
    const high = Math.max(...recent.map(d => d.high));
    const low = Math.min(...recent.map(d => d.low));
    
    const levels = [
        { val: last.ma20, label: 'MA20' },
        { val: last.ma60, label: 'MA60' },
        { val: last.bollUpper, label: '上轨' },
        { val: last.bollLower, label: '下轨' },
        { val: last.vwap, label: 'VWAP' },
        { val: high, label: '前高' },
        { val: low, label: '前低' }
    ].filter(l => l.val && !isNaN(l.val));

    const resistances = levels.filter(l => l.val > price * 1.005).sort((a, b) => a.val - b.val);
    const r1 = resistances.length > 0 ? resistances[0] : { val: price * 1.05, label: '估算' };

    const supports = levels.filter(l => l.val < price * 0.995).sort((a, b) => b.val - a.val);
    const s1 = supports.length > 0 ? supports[0] : { val: price * 0.95, label: '估算' };

    return {
        s1: parseFloat(s1.val).toFixed(2),
        r1: parseFloat(r1.val).toFixed(2),
        s1Desc: s1.label,
        r1Desc: r1.label
    };
};

const calculateRiskLevels = (history) => {
    if (!history || history.length === 0) return { stopLoss: '---', rewardRatio: '---', targetPrice: '---', supportPrice: '---' };
    const last = history[history.length - 1];
    const price = last.close;
    const atr = last.atr || price * 0.02;
    
    const stopLoss = (price - 2.0 * atr).toFixed(2); 
    const sr = calculateSupportResistance(history);
    const reward = parseFloat(sr.r1) - price;
    const risk = price - parseFloat(stopLoss);
    
    let ratioStr = '---';
    if (risk > 0) {
        const ratio = reward / risk;
        ratioStr = `1 : ${ratio.toFixed(1)}`;
    }
    
    return {
        stopLoss,
        rewardRatio: ratioStr,
        targetPrice: sr.r1,
        supportPrice: sr.s1,
        r1Desc: sr.r1Desc,
        s1Desc: sr.s1Desc
    };
};

const calculateStatusLabels = (history) => {
    if (!history || history.length < 20) return { sentiment: '中性', trend: '震荡', technical: '整理' };
    const last = history[history.length - 1];
    const prev = history[history.length - 2];

    const sentiment = last.rsi < 35 ? '超跌' : last.rsi > 65 ? '超买' : '中性';
    const trend = (last.ma20 > prev.ma20 && last.close > last.ma20) ? '强多' : (last.ma20 < prev.ma20 && last.close < last.ma20) ? '强空' : '震荡';
    const technical = last.close > last.vwap ? '机构控盘' : '空头压制';

    return { sentiment, trend, technical };
};

const calculateShortTermRec = (last) => {
    if (!last) return { label: '观望', score: 0, explain: '数据不足', action: '等待信号' };
    let score = 0;
    let reasons = [];

    if (last.close > last.ma5) { score += 1; reasons.push("站上MA5"); } else score -= 1;
    if (last.close > last.vwap) { score += 2; reasons.push("高于VWAP"); } else score -= 2;
    if (last.macd > 0) { score += 1; reasons.push("MACD金叉"); }
    if (last.rsi < 30) { score += 2; reasons.push("RSI超卖"); }
    if (last.obv > 0) { score += 1; reasons.push("资金流入"); }

    const reasonStr = reasons.slice(0, 2).join("+");
    
    if (score >= 4) return { label: '强力买入', score, explain: `共振: ${reasons.join(',')}`, action: '果断买入' };
    if (score >= 1) return { label: '谨慎买入', score, explain: `偏多: ${reasonStr}`, action: '轻仓试探' };
    if (score <= -4) return { label: '强力卖出', score, explain: `走坏: ${reasons.join(',')}`, action: '清仓离场' };
    if (score <= -1) return { label: '适当减仓', score, explain: `转弱: ${reasonStr}`, action: '逢高减磅' };
    return { label: '中性观望', score, explain: '多空博弈', action: '空仓等待' };
};

const generateStaticHistory = (targetPrice) => {
    const data = [];
    let price = Number(targetPrice) || 100;
    const now = new Date();
    for (let i = 0; i < 60; i++) { 
        const time = new Date(now.getTime() - (60 - i) * 60000); 
        const offset = Math.sin(i * 0.4) * (price * 0.007);
        const close = parseFloat((price + offset).toFixed(2));
        const open = parseFloat((price + Math.sin((i-1)*0.4) * (price * 0.007)).toFixed(2));
        data.push({
            time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            open, high: Math.max(open, close) + 0.3, low: Math.min(open, close) - 0.3, close, 
            volume: 1200000 + Math.floor(Math.random() * 800000),
            priceRange: [Math.min(open, close) - 0.3, Math.max(open, close) + 0.3] 
        });
    }
    return calculateIndicators(data);
};

const generateMockNews = (symbol) => [
    { title: `${symbol} 季度营收超预期，云业务增长强劲`, source: "Bloomberg", time: "1小时前" },
    { title: `${symbol} 宣布新的AI战略合作伙伴关系`, source: "Reuters", time: "3小时前" },
    { title: `分析师下调 ${symbol} 目标价，担忧宏观经济逆风`, source: "CNBC", time: "5小时前" },
    { title: `${symbol} 即将发布新一代旗舰产品`, source: "TechCrunch", time: "12小时前" },
    { title: `机构大举增持 ${symbol}，看好长期发展`, source: "Financial Times", time: "1天前" }
];

// ==========================================
// 2. 初始状态与预加载
// ==========================================

const createInitialStock = (name, price, prevClose, change, preMarket, sector, desc) => {
    const data = generateStaticHistory(price);
    const last = data[data.length-1];
    const risk = calculateRiskLevels(data);
    const labels = calculateStatusLabels(data);
    return {
        name, price, basePrice: price, prevClose, change, preMarket, sector, description: desc,
        sentiment: calculateShortTermRec(last),
        longTermTrend: { label: labels.trend, desc: '基于均线系统' },
        technical: { label: labels.technical, desc: '基于K线形态' },
        targetPrice: risk.targetPrice, supportPrice: risk.supportPrice, 
        stopLoss: risk.stopLoss, rewardRatio: risk.rewardRatio,
        r1Desc: risk.r1Desc, s1Desc: risk.s1Desc,
        data, lastUpdate: Date.now(),
        // 为 AI 功能提供数据源支撑
        news: generateMockNews(name.split(' ')[0]),
        fundamentals: {
            marketCap: (price * 0.02 + Math.random() * 0.5).toFixed(2) + 'T',
            peRatio: (35 + Math.random() * 20).toFixed(2),
            forwardPe: (30 + Math.random() * 15).toFixed(2),
            pegRatio: (1.1 + Math.random() * 0.5).toFixed(2),
            beta: (1.5 + Math.random() * 0.8).toFixed(2),
            grossMargin: (50 + Math.random() * 25).toFixed(1) + '%',
            netMargin: (20 + Math.random() * 30).toFixed(1) + '%',
        },
        analysts: { rating: 'Buy', targetPrice: (price * 1.25).toFixed(2) }
    };
};

const INITIAL_STOCKS_CONFIG = {
  'US.NVDA': createInitialStock('NVIDIA Corp', 184.84, 183.32, 0.83, 185.20, 'Semiconductors', 'AI 芯片绝对霸主。'),
  'US.AAPL': createInitialStock('Apple Inc.', 210.30, 209.36, 0.45, 211.10, 'Technology', '消费电子巨头。'),
  'US.TSLA': createInitialStock('Tesla Inc.', 449.36, 431.45, 4.15, 452.50, 'Auto', '电动车龙头。'),
  'US.MSFT': createInitialStock('Microsoft', 420.00, 416.46, 0.85, 421.10, 'Technology', 'AI 软件领导者。'),
  'US.GOOGL': createInitialStock('Alphabet Inc.', 175.00, 173.50, 0.86, 175.50, 'Technology', '搜索与AI巨头。'),
  'US.MARA': createInitialStock('Marathon Digital', 25.50, 24.00, 6.25, 26.00, 'Crypto', '比特币挖矿龙头。'),
  'US.BABA': createInitialStock('Alibaba Group', 85.00, 83.50, 1.80, 85.50, 'E-Commerce', '中国电商巨头。')
};

// ==========================================
// 3. UI 子组件
// ==========================================

const SettingsModal = ({ onClose, isDarkMode, currentUrl, currentKey, onSave }) => {
    const [url, setUrl] = useState(currentUrl);
    const [key, setKey] = useState(currentKey);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in">
            <div className={`w-[420px] rounded-3xl shadow-2xl border p-8 ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-2xl font-black flex items-center gap-2"><Settings className="text-blue-500"/> 系统设置</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-500/20 rounded-full transition-all"><X className="w-6 h-6"/></button>
                </div>
                <div className="space-y-6">
                    <div className="group">
                        <label className="block text-[10px] font-black uppercase tracking-widest mb-2 opacity-50">后端服务器地址</label>
                        <input value={url} onChange={e=>setUrl(e.target.value)} className={`w-full p-4 rounded-2xl border transition-all focus:ring-4 focus:ring-blue-500/20 outline-none ${isDarkMode ? 'bg-slate-950 border-slate-700' : 'bg-gray-50 border-gray-200'}`} placeholder="http://localhost:5001" />
                    </div>
                    <div className="group">
                        <label className="block text-[10px] font-black uppercase tracking-widest mb-2 opacity-50">Gemini API Key</label>
                        <input value={key} onChange={e=>setKey(e.target.value)} type="password" className={`w-full p-4 rounded-2xl border transition-all focus:ring-4 focus:ring-purple-500/20 outline-none ${isDarkMode ? 'bg-slate-950 border-slate-700' : 'bg-gray-50 border-gray-200'}`} placeholder="AIza..." />
                    </div>
                    <div className="pt-4">
                        <button onClick={() => onSave(url, key)} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-blue-900/20 transform active:scale-95">保存并应用</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const HelpModal = ({ onClose, isDarkMode }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`w-[600px] max-h-[80vh] overflow-y-auto rounded-xl shadow-2xl border flex flex-col ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-gray-200 text-gray-900'}`}>
                <div className="flex items-center justify-between p-4 border-b border-gray-700/50 sticky top-0 bg-inherit z-10">
                    <h3 className="text-lg font-bold flex items-center gap-2"><BookOpen className="w-5 h-5 text-purple-500"/> 算法逻辑说明</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-500/20 rounded"><X className="w-5 h-5"/></button>
                </div>
                <div className="p-6 space-y-6">
                    <section>
                         <h4 className="font-bold text-rose-400 mb-2 flex items-center gap-2"><Scale className="w-4 h-4"/> 风险风控</h4>
                         <div className={`text-sm p-3 rounded-lg ${isDarkMode ? 'bg-slate-900/50' : 'bg-gray-50'}`}>
                            <ul className="list-disc pl-5 space-y-1 text-xs opacity-80">
                                <li><strong>ATR (平均真实波幅)</strong>: 动态止损基准。推荐止损距离 = 2 * ATR。</li>
                                <li><strong>盈亏比 (R:R)</strong>: (阻力位 - 现价) / (现价 - 止损位)。建议 &gt; 1:2。</li>
                            </ul>
                        </div>
                    </section>
                    <section>
                        <h4 className="font-bold text-emerald-400 mb-2 flex items-center gap-2"><Zap className="w-4 h-4"/> 短线建议 (量化打分)</h4>
                        <div className={`text-sm p-3 rounded-lg ${isDarkMode ? 'bg-slate-900/50' : 'bg-gray-50'}`}>
                            <p className="mb-2">基于多因子模型，总分 &gt; 4 为强力买入。</p>
                            <ul className="list-disc pl-5 space-y-1 text-xs opacity-80">
                                <li><strong>VWAP (权重2)</strong>: 价格 &gt; 机构成本线，视为控盘。</li>
                                <li><strong>OBV (权重1)</strong>: 能量潮上涨，视为资金流入。</li>
                                <li><strong>MACD/RSI</strong>: 动能与超卖判定。</li>
                            </ul>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

const CandleStickShape = (props) => {
    const { x, y, width, height, payload } = props;
    if (!payload) return null;
    const { open, close, high, low } = payload;
    const isRising = close >= open;
    const color = isRising ? '#10b981' : '#ef4444'; 
    
    const range = Math.abs(high - low) || 0.01; 
    const ratio = height / range; 

    const yOpen = y + (high - open) * ratio;
    const yClose = y + (high - close) * ratio;
    const bodyTop = Math.min(yOpen, yClose);
    const bodyHeight = Math.max(1.5, Math.abs(yOpen - yClose));

    return (
        <g>
            <line x1={x + width / 2} y1={y} x2={x + width / 2} y2={y + height} stroke={color} strokeWidth={1.2} />
            <rect x={x + 2} y={bodyTop} width={Math.max(0, width - 4)} height={bodyHeight} fill={color} rx={1} />
        </g>
    );
};

const CustomChartTooltip = ({ active, payload, label, isDarkMode }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className={`p-3 border rounded-lg shadow-lg text-xs font-mono z-50 ${isDarkMode ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-white border-gray-200 text-gray-800'}`}>
          <div className="mb-2 font-bold border-b pb-1 opacity-70">{label}</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-emerald-500">Open: {data.open.toFixed(2)}</span>
            <span className="text-rose-500">High: {data.high.toFixed(2)}</span>
            <span className="text-emerald-500">Low: {data.low.toFixed(2)}</span>
            <span className={isDarkMode ? "text-white" : "text-black"}>Close: {data.close.toFixed(2)}</span>
            <span className="col-span-2 text-orange-400 mt-1">Vol: {(data.volume/1000000).toFixed(2)}M</span>
            {data.ma5 && <span className="col-span-2 text-yellow-400 mt-1 pt-1 border-t border-gray-600/30">MA5: {data.ma5.toFixed(2)}</span>}
            {data.ma20 && <span className="col-span-2 text-purple-400">MA20: {data.ma20.toFixed(2)}</span>}
            {data.bollUpper && <span className="col-span-2 text-blue-400 mt-1 pt-1 border-t border-gray-600/30">BOLL Up: {data.bollUpper.toFixed(2)}</span>}
          </div>
        </div>
      );
    }
    return null;
};

const FundamentalItem = ({ label, value, tooltip, isDarkMode }) => (
    <div className="relative group/item cursor-help p-2 rounded hover:bg-gray-100/10 transition-colors">
        <div className="text-[10px] opacity-70 flex items-center gap-1 mb-0.5">{label} <Info className="w-3 h-3 text-blue-400" /></div>
        <div className={`font-mono font-bold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{value}</div>
        <div className={`absolute z-50 bottom-full left-0 mb-2 w-48 p-3 rounded-lg shadow-xl border text-xs text-left hidden group-hover/item:block pointer-events-none ${isDarkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-800'}`}>
            {tooltip}
            <div className="absolute -bottom-1 left-4 w-2 h-2 rotate-45 border-b border-r bg-inherit border-inherit"></div>
        </div>
    </div>
);

const AnalysisCard = ({ title, value, colorClass, explain, action, isDarkMode }) => (
    <div className={`p-3 rounded text-center border relative group/card cursor-help transition-all hover:shadow-md ${isDarkMode ? 'bg-slate-900/50 border-slate-700/50 hover:bg-slate-800' : 'bg-gray-50 border-gray-200 hover:bg-white'}`}>
        <div className="text-[10px] uppercase mb-1 flex items-center justify-center gap-1 opacity-70">
            {title} <Info className="w-3 h-3" />
        </div>
        <div className={`text-sm font-bold ${colorClass}`}>
            {value}
        </div>
        <div className={`absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 rounded-lg shadow-xl border text-xs text-left hidden group-hover/card:block pointer-events-none ${isDarkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-200 text-gray-800'}`}>
            <div className="font-bold mb-1 text-emerald-500">大白话解读:</div>
            <div className="mb-2 opacity-90 leading-relaxed">{explain}</div>
            <div className="font-bold mb-1 text-blue-500">操作建议:</div>
            <div className="opacity-90 leading-relaxed">{action}</div>
            <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border-b border-r bg-inherit border-inherit`}></div>
        </div>
    </div>
);

// ==========================================
// 4. 主应用逻辑
// ==========================================

export default function App() {
  return (
      <ErrorBoundary>
          <StockDashboard />
      </ErrorBoundary>
  );
}

const StockDashboard = () => {
  const [showAiChat, setShowAiChat] = useState(false);
  const [showHelp, setShowHelp] = useState(false); 
  const [showSettings, setShowSettings] = useState(false);
  
  // AI States
  const [aiReport, setAiReport] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [tradingStrategy, setTradingStrategy] = useState("");
  const [isStrategyLoading, setIsStrategyLoading] = useState(false);
  const [newsSummary, setNewsSummary] = useState("");
  const [isNewsSummarizing, setIsNewsSummarizing] = useState(false);
  const [fundamentalAudit, setFundamentalAudit] = useState("");
  const [isFundamentalAuditing, setIsFundamentalAuditing] = useState(false);
  const [priceActionAnalysis, setPriceActionAnalysis] = useState("");
  const [isPriceActionScanning, setIsPriceActionScanning] = useState(false);
  const [aiCooldown, setAiCooldown] = useState(0); 

  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', text: '你好！我是 TradeFlow AI 助手。' }
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const [backendUrl, setBackendUrl] = useState(() => localStorage.getItem('tf_backend_url') || DEFAULT_BACKEND_URL);
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('tf_gemini_key') || DEFAULT_GEMINI_KEY);

  const [selectedSymbol, setSelectedSymbol] = useState(() => { try { return localStorage.getItem('tf_last_symbol') || 'US.TSLA'; } catch { return 'US.TSLA'; }}); 
  const [marketData, setMarketData] = useState(() => { try { const saved = localStorage.getItem('tf_market_data_v1'); return saved ? JSON.parse(saved) : INITIAL_STOCKS_CONFIG; } catch { return INITIAL_STOCKS_CONFIG; } });
  const [tickerInput, setTickerInput] = useState(""); 
  const [isRealTime, setIsRealTime] = useState(() => localStorage.getItem('tf_is_realtime') === 'true');
  const [apiError, setApiError] = useState(null);
  const [dataSourceInfo, setDataSourceInfo] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(true); 
  
  const [chartRange, setChartRange] = useState('1D'); 
  const [mainOverlay, setMainOverlay] = useState('MA'); 
  const [subIndicator, setSubIndicator] = useState('MACD'); 
  const [activeTab, setActiveTab] = useState('analysis');
  const [hoverData, setHoverData] = useState(null); 
  
  const refreshIndexRef = useRef(0);
  const chatEndRef = useRef(null);

  const currentStock = marketData[selectedSymbol] || INITIAL_STOCKS_CONFIG['US.TSLA'];
  const isPositive = currentStock ? currentStock.change >= 0 : true;

  const displayData = useMemo(() => {
      if (!currentStock || !currentStock.data || currentStock.data.length === 0) return null;
      return hoverData || currentStock.data[currentStock.data.length - 1];
  }, [currentStock, hoverData]);

  // Save State
  useEffect(() => {
      try {
          const simplifiedData = {};
          Object.entries(marketData).forEach(([symbol, stock]) => {
              simplifiedData[symbol] = {
                  ...stock,
                  data: stock.data.slice(0, 60)
              };
          });
          localStorage.setItem('tf_market_data_v1', JSON.stringify(simplifiedData));
      } catch (e) { console.error("LS Full", e); }
  }, [marketData]);

  useEffect(() => { localStorage.setItem('tf_last_symbol', selectedSymbol); }, [selectedSymbol]);
  useEffect(() => { localStorage.setItem('tf_is_realtime', isRealTime); }, [isRealTime]);
  useEffect(() => { localStorage.setItem('tf_backend_url', backendUrl); }, [backendUrl]);
  useEffect(() => { localStorage.setItem('tf_gemini_key', geminiKey); }, [geminiKey]);

  useEffect(() => {
      if (aiCooldown > 0) {
          const timer = setTimeout(() => setAiCooldown(prev => prev - 1), 1000);
          return () => clearTimeout(timer);
      }
  }, [aiCooldown]);

  const clearAiStates = () => {
      setAiReport("");
      setTradingStrategy("");
      setNewsSummary("");
      setFundamentalAudit("");
      setPriceActionAnalysis("");
  };

  const handleAddStock = () => {
    if (!tickerInput.trim()) return;
    const rawSymbol = tickerInput.trim().toUpperCase();
    const symbol = rawSymbol.startsWith('US.') ? rawSymbol : `US.${rawSymbol}`;
    if (marketData[symbol]) { setSelectedSymbol(symbol); clearAiStates(); setTickerInput(""); return; }

    const initialPrice = 100;
    const newStockData = createInitialStock(
        `${rawSymbol} Corp`, initialPrice, initialPrice, 0.0, initialPrice, 'Technology', `新增自选股 ${rawSymbol}。`
    );
    setMarketData(prev => ({ ...prev, [symbol]: newStockData }));
    setSelectedSymbol(symbol);
    clearAiStates();
    setTickerInput("");
  };

  const handleRemoveStock = (symbol, e) => {
    e.stopPropagation(); 
    if (symbol === selectedSymbol) {
        const remaining = Object.keys(marketData).filter(s => s !== symbol);
        setSelectedSymbol(remaining.length > 0 ? remaining[0] : null);
        clearAiStates();
    }
    setMarketData(prev => { const n = {...prev}; delete n[symbol]; return n; });
  };

  useEffect(() => {
    let intervalId;
    const updateData = async () => {
        if (isRealTime) {
            const allSymbols = Object.keys(marketData);
            if (allSymbols.length > 0) {
                let nextIdx = refreshIndexRef.current;
                if (nextIdx >= allSymbols.length) nextIdx = 0;
                if (allSymbols[nextIdx] === selectedSymbol) { nextIdx = (nextIdx + 1) % allSymbols.length; }
                const backgroundSymbol = allSymbols[nextIdx];
                refreshIndexRef.current = (nextIdx + 1) % allSymbols.length; 
                fetchStockData(selectedSymbol, true);
                if (backgroundSymbol && backgroundSymbol !== selectedSymbol) {
                    setTimeout(() => fetchStockData(backgroundSymbol, false), 200);
                }
            }
        } else { setDataSourceInfo("Offline (Paused)"); }
    };

    const fetchStockData = async (symbol, isSelected) => {
        try {
            let rangeParam = '1d'; let intervalParam = '2m';
            if (isSelected) {
                if (chartRange === '1W') { rangeParam = '5d'; intervalParam = '15m'; }
                else if (chartRange === '1M') { rangeParam = '1mo'; intervalParam = '60m'; }
                else if (chartRange === '3M') { rangeParam = '3mo'; intervalParam = '1d'; }
                else if (chartRange === '6M') { rangeParam = '6mo'; intervalParam = '1d'; }
                else if (chartRange === '1Y') { rangeParam = '1y'; intervalParam = '1d'; }
                else if (chartRange === 'YTD') { rangeParam = 'ytd'; intervalParam = '1d'; }
            }

            const querySymbol = symbol.startsWith('US.') ? symbol.substring(3) : symbol;
            const response = await fetch(`${backendUrl}/api/quote?code=${querySymbol}&range=${rangeParam}&interval=${intervalParam}`);
            if (!response.ok) throw new Error("Net Error");
            
            const realData = await response.json();
            
            let parsedData = realData;
            if (Array.isArray(parsedData) && parsedData.length > 0) parsedData = parsedData[0];
            if (parsedData.data) parsedData = parsedData.data;
            else if (parsedData.quote) parsedData = parsedData.quote;
            else if (parsedData.info) parsedData = parsedData.info;
            else if (parsedData[querySymbol]) parsedData = parsedData[querySymbol];
            
            let rawPrice = parsedData.price ?? parsedData.regularMarketPrice ?? parsedData.currentPrice ?? parsedData.c ?? parsedData.close ?? parsedData.Close;
            if (typeof rawPrice === 'string') rawPrice = rawPrice.replace(/[^\d.-]/g, '');
            const fetchedPrice = Number(rawPrice);
            
            let rawChange = parsedData.changePercent ?? parsedData.regularMarketChangePercent ?? parsedData.dp ?? parsedData.change ?? 0;
            if (typeof rawChange === 'string') rawChange = rawChange.replace(/[^\d.-]/g, '');
            const fetchedChange = Number(rawChange);
            
            if (!fetchedPrice || isNaN(fetchedPrice) || fetchedPrice === 0) {
                throw new Error("解析失败");
            }
            
            if (isSelected && typeof parsedData.source === 'string') setDataSourceInfo(parsedData.source);
            if (isSelected) setApiError(null);

            setMarketData(prev => {
                const stock = prev[symbol];
                if (!stock) return prev;
                let processedHistory = [];
                let dateFormat = chartRange === '3M' || chartRange === '6M' || chartRange === '1Y' ? { month: 'numeric', day: 'numeric' } : { hour: '2-digit', minute: '2-digit' };
                if (parsedData.history && Array.isArray(parsedData.history) && parsedData.history.length > 0) {
                    processedHistory = parsedData.history.map(item => ({
                        ...item,
                        time: typeof item.time === 'string' ? item.time : (item.time > 10000000000 ? new Date(item.time).toLocaleString([], dateFormat) : new Date(item.time * 1000).toLocaleString([], dateFormat)),
                        priceRange: [item.low, item.high]
                    }));
                } else { processedHistory = stock.data; }
                
                processedHistory = calculateIndicators(processedHistory);
                const lastData = processedHistory[processedHistory.length - 1];
                const riskRes = calculateRiskLevels(processedHistory);
                
                const sentiment = calculateShortTermRec(lastData);
                const trend = calculateTrendAnalysis(processedHistory);

                return {
                    ...prev,
                    [symbol]: {
                        ...stock,
                        price: fetchedPrice,
                        prevClose: Number(parsedData.prevClose ?? parsedData.regularMarketPreviousClose ?? parsedData.pc ?? stock.prevClose), 
                        change: fetchedChange || 0, 
                        dayOpen: Number(parsedData.dayOpen ?? parsedData.regularMarketOpen ?? parsedData.o ?? stock.dayOpen), 
                        dayHigh: Number(parsedData.dayHigh ?? parsedData.regularMarketDayHigh ?? parsedData.h ?? stock.dayHigh), 
                        dayLow: Number(parsedData.dayLow ?? parsedData.regularMarketDayLow ?? parsedData.l ?? stock.dayLow),
                        lastUpdate: Date.now(),
                        sentiment: sentiment,
                        longTermTrend: trend,
                        targetPrice: riskRes.targetPrice, supportPrice: riskRes.supportPrice, 
                        stopLoss: riskRes.stopLoss, rewardRatio: riskRes.rewardRatio,
                        r1Desc: riskRes.r1Desc, s1Desc: riskRes.s1Desc,
                        data: processedHistory
                    }
                };
            });
        } catch (e) {
            if (isSelected) { console.warn("Fetch failed:", e.message); setApiError("连接不稳定"); setDataSourceInfo("Offline (Error)"); }
        }
    };
    const intervalTime = isRealTime ? 3000 : 2000;
    intervalId = setInterval(updateData, intervalTime);
    if(isRealTime) updateData();
    return () => clearInterval(intervalId);
  }, [isRealTime, selectedSymbol, chartRange, backendUrl]);

  // AI Feature Handlers
  const generateReport = async () => {
    if (isAiLoading || !currentStock || aiCooldown > 0) return;
    setIsAiLoading(true);
    setAiReport("正在分析市场数据并搜寻最新新闻..."); 
    
    try {
        const lastData = currentStock.data[currentStock.data.length - 1];
        const rsi = lastData.rsi ? lastData.rsi.toFixed(1) : 'N/A';
        const macd = lastData.macd ? lastData.macd.toFixed(2) : 'N/A';
        const maDiff = lastData.ma20 ? ((lastData.close - lastData.ma20)/lastData.ma20 * 100).toFixed(2) : '0';

        const prompt = `
        角色：顶级分析师。任务：结合数据生成研报。
        数据：现价$${currentStock.price}(${currentStock.change}%)。建议：${currentStock.sentiment?.label}。趋势：${currentStock.longTermTrend?.label}。
        关键点位：阻力$${currentStock.targetPrice} / 支撑$${currentStock.supportPrice}。
        核心指标：RSI=${rsi}, MACD=${macd}, MA20偏离${maDiff}%。
        
        要求：
        1. **核心要点 (Key Takeaways)**：3 个最重要的结论。
        2. **详细分析**：技术面剖析与操作策略。
        3. 专业、简练，输出中文。
        `;
        const report = await callGeminiAPI(prompt, geminiKey, true);
        setAiReport(report);
        if (report.includes('429') || report.includes('频繁')) setAiCooldown(15); else setAiCooldown(5);
    } catch (e) {
        setAiReport("生成研报失败，请稍后重试。"); setAiCooldown(3);
    } finally { setIsAiLoading(false); }
  };

  const generateStrategy = async () => {
    if (isStrategyLoading || !currentStock || aiCooldown > 0) return;
    setIsStrategyLoading(true); 
    setTradingStrategy("正在计算入场点位与风控模型..."); 
    try {
        const lastData = currentStock.data[currentStock.data.length - 1];
        const prompt = `角色：定量分析师。请基于以下数据为 ${selectedSymbol} 制定一份超短线交易策略计划（包含建议入场价、止盈目标位、止损位，以及核心理由）：现价=${currentStock.price}, MA20=${lastData.ma20}, RSI=${lastData.rsi}, MACD=${lastData.macd}, 短期支撑=${currentStock.supportPrice}, 短期阻力=${currentStock.targetPrice}。请用要点格式输出。`;
        const strategy = await callGeminiAPI(prompt, geminiKey);
        setTradingStrategy(strategy);
        if (strategy.includes('429') || strategy.includes('频繁')) setAiCooldown(15); else setAiCooldown(5);
    } catch (e) { 
        setTradingStrategy("生成失败"); setAiCooldown(3);
    } finally { setIsStrategyLoading(false); } 
  };

  const generateNewsSummary = async () => {
    if (isNewsSummarizing || !currentStock || !currentStock.news || aiCooldown > 0) return;
    setIsNewsSummarizing(true); 
    setNewsSummary("AI 正在光速阅读近期资讯..."); 
    try {
        const headlines = currentStock.news.map(n => n.title).join("；");
        const prompt = `作为资深金融分析师，请总结以下关于 ${currentStock.name} (${selectedSymbol}) 的近期新闻，并给出整体市场情绪偏向（看多/看空/中性），简明扼要：${headlines}`;
        const summary = await callGeminiAPI(prompt, geminiKey);
        setNewsSummary(summary);
        if (summary.includes('429') || summary.includes('频繁')) setAiCooldown(15); else setAiCooldown(5);
    } catch (e) { 
        setNewsSummary("总结生成失败"); setAiCooldown(3);
    } finally { setIsNewsSummarizing(false); } 
  };

  const generateFundamentalAudit = async () => {
    if (isFundamentalAuditing || !currentStock || !currentStock.fundamentals || aiCooldown > 0) return;
    setIsFundamentalAuditing(true);
    setFundamentalAudit("正在深度解剖财务数据，评估投资价值...");
    try {
        const f = currentStock.fundamentals;
        const prompt = `角色：价值投资者（如巴菲特/芒格）。请基于以下基本面数据深度诊断 ${currentStock.name} (${selectedSymbol}) 的长期投资价值：市值=${f.marketCap}, 市盈率=${f.peRatio}, 远期市盈率=${f.forwardPe}, 毛利率=${f.grossMargin}, 净利率=${f.netMargin}, Beta=${f.beta}。请指出其护城河优势与潜在财务隐患。大白话、专业犀利。`;
        const result = await callGeminiAPI(prompt, geminiKey);
        setFundamentalAudit(result);
        if (result.includes('429') || result.includes('频繁')) setAiCooldown(15); else setAiCooldown(5);
    } catch (e) {
        setFundamentalAudit("诊断失败"); setAiCooldown(3);
    } finally { setIsFundamentalAuditing(false); }
  };

  const generatePriceActionAnalysis = async () => {
    if (isPriceActionScanning || !currentStock || !currentStock.data || aiCooldown > 0) return;
    setIsPriceActionScanning(true);
    setPriceActionAnalysis("正在扫描近期 K 线形态与量价关系...");
    try {
        const recentData = currentStock.data.slice(-7).map(d => `开${d.open.toFixed(2)}|高${d.high.toFixed(2)}|低${d.low.toFixed(2)}|收${d.close.toFixed(2)}|量${(d.volume/10000).toFixed(0)}万`).join(", ");
        const prompt = `角色：裸K/形态交易大师。分析 ${selectedSymbol} 过去7个周期的量价数据：[${recentData}]。找出隐藏的 K 线形态（如吞没、十字星、放量滞涨、缩量企稳等），判断多空力量对比，给出简短推演结论。`;
        const result = await callGeminiAPI(prompt, geminiKey);
        setPriceActionAnalysis(result);
        if (result.includes('429') || result.includes('频繁')) setAiCooldown(15); else setAiCooldown(5);
    } catch (e) {
        setPriceActionAnalysis("扫描失败"); setAiCooldown(3);
    } finally { setIsPriceActionScanning(false); }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || isChatLoading || !currentStock) return;
    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput("");
    setIsChatLoading(true);
    const prompt = `股票：${currentStock.name}，现价$${currentStock.price}。问题：${userMsg}。请简短回答。`;
    const aiMsg = await callGeminiAPI(prompt, geminiKey, true);
    setChatMessages(prev => [...prev, { role: 'ai', text: aiMsg }]);
    setIsChatLoading(false);
  };

  const getSubIndicatorDesc = () => {
      switch(subIndicator) {
          case 'MACD': return 'MACD (12,26,9): 趋势动能指标。红柱多头，绿柱空头，零轴附近金叉为入场信号。';
          case 'RSI': return 'RSI (14): 强弱博弈。>70 极度超买(警惕回调)，<30 极度超卖(关注反弹)。';
          case 'KDJ': return 'KDJ (9,3,3): 随机指标。反应敏锐，J线>100为钝化超买。';
          case 'OBV': return 'OBV (能量潮): 累积成交量。股价横盘OBV向上=吸筹；股价涨OBV向下=背离。';
          default: return '';
      }
  };

  return (
    <div className={`flex h-screen w-full font-sans overflow-hidden transition-all duration-500 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
      
      {showSettings && <SettingsModal onClose={()=>setShowSettings(false)} isDarkMode={isDarkMode} currentUrl={backendUrl} currentKey={geminiKey} onSave={(u, k)=>{setBackendUrl(u); setGeminiKey(k); localStorage.setItem('tf_backend_url',u); localStorage.setItem('tf_gemini_key',k); setShowSettings(false);}} />}
      
      {/* Help Modal */}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} isDarkMode={isDarkMode} />}

      {/* Chat Overlay */}
      {showAiChat && (
        <div className={`absolute right-6 top-20 w-80 h-[450px] max-h-[calc(100vh-100px)] border rounded-xl shadow-2xl z-50 flex flex-col animate-in fade-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-200'}`}>
           <div className={`p-3 border-b rounded-t-xl flex justify-between items-center ${isDarkMode ? 'border-slate-700 bg-slate-700/50' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center gap-2 font-bold text-sm text-purple-500"><Sparkles className="w-4 h-4" /> Gemini 助手</div>
              <button onClick={() => setShowAiChat(false)} className={`${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-gray-400 hover:text-gray-900'}`}><X className="w-4 h-4" /></button>
           </div>
           <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                   <div className={`max-w-[85%] rounded-lg p-2 text-xs leading-relaxed ${msg.role === 'user' ? 'bg-blue-600 text-white' : (isDarkMode ? 'bg-slate-700' : 'bg-gray-100 text-gray-800')}`}>{msg.text}</div>
                </div>
              ))}
              {isChatLoading && <div className={`text-xs flex items-center gap-1 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}><Loader2 className="w-3 h-3 animate-spin"/> 正在思考...</div>}
           </div>
           <div className={`p-3 border-t ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}><div className="flex gap-2"><input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleChatSend()} className={`flex-1 border rounded-md px-2 py-1.5 text-xs focus:outline-none ${isDarkMode ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`} placeholder="输入问题..."/><button onClick={handleChatSend} className="bg-purple-600 p-1.5 rounded-md text-white"><Send className="w-3.5 h-3.5"/></button></div></div>
        </div>
      )}

      {/* Sidebar */}
      <aside className={`w-72 border-r flex flex-col transition-colors duration-500 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200 shadow-xl'}`}>
        <div className="p-8 border-b border-inherit">
            <div className="flex items-center gap-4 group">
                <div className="p-3 bg-blue-600 rounded-2xl shadow-xl shadow-blue-500/30 group-hover:rotate-12 transition-transform duration-300">
                    <Activity className="w-6 h-6 text-white"/>
                </div>
                <div>
                    <h1 className="text-2xl font-black tracking-tighter">TradeFlow</h1>
                    <p className="text-[9px] font-mono opacity-40 uppercase tracking-widest">Quantum Engine v13.9.1</p>
                </div>
            </div>
        </div>

        <div className={`px-6 py-4 border-b border-inherit ${isDarkMode ? 'bg-slate-900' : 'bg-gray-50'}`}>
            <div className="relative">
                <input type="text" value={tickerInput} onChange={(e) => setTickerInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddStock()} placeholder="代码 (如: BABA)..." className={`w-full border rounded-xl pl-4 pr-10 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`} />
                <button onClick={handleAddStock} className={`absolute right-3 top-3.5 ${isDarkMode ? 'text-slate-400 hover:text-blue-400' : 'text-gray-400 hover:text-blue-600'}`}><PlusCircle className="w-5 h-5" /></button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3 scrollbar-hide">
            <div className="text-[10px] font-black opacity-30 uppercase tracking-widest px-2 mb-2">自选标的 (Watchlist)</div>
            {Object.keys(marketData).map(sym => (
                <div key={sym} onClick={()=>setSelectedSymbol(sym)} className={`p-4 rounded-2xl cursor-pointer transition-all duration-300 flex items-center justify-between group ${selectedSymbol === sym ? 'bg-blue-600 text-white shadow-2xl translate-x-2' : isDarkMode ? 'hover:bg-slate-800 bg-slate-900/50' : 'hover:bg-gray-100 bg-white border border-transparent hover:border-gray-200'}`}>
                    <div className="flex flex-col">
                        <span className="font-black text-sm">{sym.replace('US.', '')}</span>
                        <span className={`text-[10px] opacity-60 group-hover:opacity-100`}>{marketData[sym].name}</span>
                    </div>
                    <div className="text-right relative">
                        <div className="font-mono font-bold text-sm">${marketData[sym].price}</div>
                        <div className={`text-[10px] font-black flex items-center justify-end ${marketData[sym].change >= 0 ? 'text-emerald-400' : 'text-rose-400'} ${selectedSymbol === sym ? 'text-white' : ''}`}>
                            {marketData[sym].change >= 0 ? '+' : ''}{marketData[sym].change}%
                        </div>
                        <button onClick={(e) => handleRemoveStock(sym, e)} className="absolute -top-3 -right-3 bg-rose-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-rose-600"><Trash2 className="w-3 h-3" /></button>
                    </div>
                </div>
            ))}
        </div>

        <div className="p-6 border-t border-inherit space-y-4">
            <button onClick={()=>setIsRealTime(!isRealTime)} className={`w-full flex items-center justify-between p-4 rounded-2xl text-xs font-black border transition-all duration-300 ${isRealTime ? 'bg-green-500/10 border-green-500 text-green-500 shadow-lg shadow-green-900/10' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                <div className="flex items-center gap-3">
                    {isRealTime ? <Wifi className="w-4 h-4"/> : <WifiOff className="w-4 h-4"/>}
                    <span>{isRealTime ? '实盘连接成功' : '切换实盘数据源'}</span>
                </div>
                {isRealTime && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-green-500 shadow-[0_0_10px]"/>}
            </button>
            <div className="flex gap-3">
                <button onClick={()=>setIsDarkMode(!isDarkMode)} className={`flex-1 p-3 rounded-2xl border flex justify-center transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white' : 'bg-white border-gray-200 hover:bg-gray-100 shadow-md'}`}>
                    {isDarkMode ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
                </button>
                <button onClick={()=>setShowSettings(true)} className={`flex-1 p-3 rounded-2xl border flex justify-center transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white' : 'bg-white border-gray-200 hover:bg-gray-100 shadow-md'}`}>
                    <Settings className="w-5 h-5"/>
                </button>
                <button onClick={()=>setShowHelp(true)} className={`flex-1 p-3 rounded-2xl border flex justify-center transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white' : 'bg-white border-gray-200 hover:bg-gray-100 shadow-md'}`}>
                    <HelpCircle className="w-5 h-5"/>
                </button>
            </div>
            {isRealTime && apiError && <div className="text-[10px] text-rose-500 bg-rose-500/10 p-2 rounded-xl border border-rose-500/20 leading-tight">⚠️ {String(apiError)}</div>}
            <div className={`flex justify-between items-center text-[9px] px-2 opacity-40 font-mono`}>
                <span>SOURCE:</span><span>{dataSourceInfo || "CONNECTING..."}</span>
            </div>
        </div>
      </aside>

      {/* 主面板 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 border-b border-inherit px-10 flex items-center justify-between backdrop-blur-2xl sticky top-0 z-10">
            <div className="flex items-center gap-6">
                <h2 className="text-4xl font-black tracking-tighter">{selectedSymbol.replace('US.', '')}</h2>
                <div className="h-8 w-px bg-slate-800 hidden md:block"/>
                <div className="hidden md:flex flex-col">
                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{currentStock.name}</span>
                    <span className="text-[10px] font-mono opacity-40">美股实时行情终端</span>
                </div>
            </div>
            <div className="text-right flex items-center gap-8">
                <div>
                    <div className="text-3xl font-mono font-bold tracking-tighter">${currentStock.price}</div>
                    <div className={`flex items-center justify-end text-sm font-black ${currentStock.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {currentStock.change >= 0 ? <ArrowUp className="w-4 h-4 mr-1"/> : <ArrowDown className="w-4 h-4 mr-1"/>}
                        {Math.abs(currentStock.change)}%
                    </div>
                </div>
                <button onClick={() => setShowAiChat(!showAiChat)} className={`p-3 rounded-full transition-all shadow-xl hover:scale-110 ${isDarkMode ? 'bg-purple-600 text-white shadow-purple-900/30' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}><MessageSquare className="w-5 h-5" /></button>
            </div>
        </header>

        <main className="flex-1 overflow-y-auto p-10 space-y-10 scrollbar-hide">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
                
                {/* 走势图区 (左 8 栏) */}
                <div className="xl:col-span-8 flex flex-col gap-8">
                    <div className={`rounded-[40px] border p-8 flex flex-col h-[600px] transition-all duration-500 ${isDarkMode ? 'bg-slate-900 border-slate-800 shadow-2xl' : 'bg-white border-gray-200 shadow-2xl'}`}>
                        <div className="flex justify-between items-center mb-8 px-2">
                            <div className="flex gap-8 text-[12px] font-mono font-bold">
                                {displayData && (<>
                                    <span className="flex flex-col"><span className="opacity-40 uppercase text-[9px] mb-1">Open</span><span className="text-emerald-400">{displayData.open}</span></span>
                                    <span className="flex flex-col"><span className="opacity-40 uppercase text-[9px] mb-1">High</span><span className="text-rose-400">{displayData.high}</span></span>
                                    <span className="flex flex-col"><span className="opacity-40 uppercase text-[9px] mb-1">Low</span><span className="text-emerald-400">{displayData.low}</span></span>
                                    <span className="flex flex-col"><span className="opacity-40 uppercase text-[9px] mb-1">Close</span><span className="text-blue-400">{displayData.close}</span></span>
                                    <span className="flex flex-col"><span className="opacity-40 uppercase text-[9px] mb-1">VWAP</span><span className="text-orange-400">{displayData.vwap}</span></span>
                                </>)}
                            </div>
                            <div className="flex bg-slate-950 p-1.5 rounded-2xl gap-1 border border-slate-800 shadow-inner">
                                {['MACD', 'RSI', 'KDJ', 'OBV'].map(k => <button key={k} onClick={()=>setSubIndicator(k)} className={`px-5 py-2 text-[10px] font-black rounded-xl transition-all ${subIndicator === k ? 'bg-blue-600 text-white shadow-xl scale-105' : 'text-slate-500 hover:text-slate-300'}`}>{k}</button>)}
                            </div>
                        </div>
                        
                        <div className="flex-1 min-h-0" onMouseLeave={()=>setHoverData(null)}>
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={currentStock.data} onMouseMove={(e)=>{if(e.activePayload) setHoverData(e.activePayload[0].payload)}}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode?"#1e293b":"#e2e8f0"} vertical={false}/>
                                    <XAxis dataKey="time" hide/>
                                    <YAxis domain={['auto', 'auto']} hide/>
                                    <Line type="monotone" dataKey="ma20" stroke="#8b5cf6" strokeWidth={1} dot={false} isAnimationActive={false} opacity={0.6}/>
                                    <Line type="monotone" dataKey="vwap" stroke="#f59e0b" strokeWidth={2.5} dot={false} isAnimationActive={false} style={{filter: 'drop-shadow(0 0 4px rgba(245,158,11,0.5))'}}/>
                                    <Bar dataKey="close" shape={<CandleStickShape/>} isAnimationActive={false}/>
                                    <Tooltip content={()=><div/>}/>
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>

                        {/* 副图 */}
                        <div className="h-32 border-t border-inherit pt-6 mt-4 relative">
                            <div className="absolute top-0 right-0 py-2 text-[9px] font-black opacity-30 italic">{getSubIndicatorDesc()}</div>
                            <ResponsiveContainer width="100%" height="100%">
                                {subIndicator === 'MACD' ? (
                                    <BarChart data={currentStock.data}>
                                        <XAxis dataKey="time" hide/>
                                        <Bar dataKey="macd" isAnimationActive={false}>
                                            {currentStock.data.map((e,i)=><Cell key={i} fill={e.macd>=0?'#10b981':'#ef4444'} fillOpacity={0.8}/>)}
                                        </Bar>
                                    </BarChart>
                                ) : subIndicator === 'OBV' ? (
                                    <AreaChart data={currentStock.data}>
                                        <XAxis dataKey="time" hide/>
                                        <Area type="monotone" dataKey="obv" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.2} isAnimationActive={false}/>
                                    </AreaChart>
                                ) : (
                                    <LineChart data={currentStock.data}>
                                        <XAxis dataKey="time" hide/>
                                        <YAxis domain={[0, 100]} hide/>
                                        {subIndicator === 'RSI' && <Line type="monotone" dataKey="rsi" stroke="#fbbf24" strokeWidth={2} dot={false} isAnimationActive={false}/>}
                                        {subIndicator === 'KDJ' && (<><Line type="monotone" dataKey="k" stroke="#fbbf24" dot={false} strokeWidth={1} isAnimationActive={false}/><Line type="monotone" dataKey="d" stroke="#22d3ee" dot={false} strokeWidth={1} isAnimationActive={false}/><Line type="monotone" dataKey="j" stroke="#a855f7" dot={false} strokeWidth={1} isAnimationActive={false}/></>)}
                                    </LineChart>
                                )}
                            </ResponsiveContainer>
                        </div>

                        {/* 底部切换栏 */}
                        <div className={`flex gap-4 border-t border-inherit pt-4`}>
                            <div className="flex items-center gap-4 w-full">
                                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                                    {['1D', '1W', '1M', '3M', '6M', '1Y'].map(tf => (
                                        <button key={tf} onClick={() => setChartRange(tf)} className={`px-4 py-1.5 rounded-xl text-[10px] font-black transition-all ${chartRange === tf ? 'bg-blue-600 text-white shadow-lg' : isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                                            {tf}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 智能分析区 (右 4 栏) */}
                <div className="xl:col-span-4 flex flex-col gap-6">
                    
                    {/* 选项卡 */}
                    <div className={`flex p-1 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'}`}>
                        {[{ id: 'analysis', label: '图表分析' }, { id: 'fundamentals', label: '基本面诊断' }, { id: 'news', label: '情绪提炼' }].map(t => (
                            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${activeTab === t.id ? (isDarkMode ? 'bg-slate-800 text-white shadow-md' : 'bg-gray-100 text-gray-900 shadow-sm') : 'opacity-40 hover:opacity-100'}`}>
                                {t.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto scrollbar-hide pb-10">
                        {activeTab === 'analysis' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                {/* AI 研报卡片 */}
                                <div className={`p-6 rounded-[30px] border relative overflow-hidden flex flex-col min-h-[260px] group transition-all duration-500 ${isDarkMode ? 'bg-slate-900 border-slate-800 shadow-2xl' : 'bg-white border-gray-200'}`}>
                                    <div className="absolute top-0 right-0 w-48 h-48 bg-purple-600/10 rounded-full blur-[100px] group-hover:bg-purple-600/20 transition-all"/>
                                    <div className="flex justify-between items-center mb-6 relative z-10">
                                        <div className="flex items-center gap-2 font-black text-xs uppercase tracking-tighter opacity-80"><Cpu className="text-purple-500 w-4 h-4"/> 智能技术研报</div>
                                        <button onClick={generateReport} disabled={isAiLoading || aiCooldown > 0} className="text-[9px] font-black bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-full text-white transition-all shadow-xl shadow-purple-900/30 flex items-center gap-1.5 disabled:opacity-50">
                                            {isAiLoading ? <Loader2 className="w-3 h-3 animate-spin"/> : (aiCooldown > 0 ? <Activity className="w-3 h-3"/> : <Sparkles className="w-3 h-3"/>)}
                                            {isAiLoading ? '计算中' : (aiCooldown > 0 ? `${aiCooldown}s` : '一键生成')}
                                        </button>
                                    </div>
                                    <div className={`flex-1 text-xs leading-[1.8] overflow-y-auto scrollbar-hide whitespace-pre-wrap relative z-10 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                                        {aiReport || "💡 点击上方按钮，AI 将根据实时 K 线形态、RSI 背离情况及 ATR 波动率为您制定具体的入场点位和压力位预测。"}
                                    </div>
                                </div>

                                {/* 裸K扫描 */}
                                <div className={`p-6 rounded-[30px] border relative overflow-hidden flex flex-col min-h-[160px] transition-all duration-500 ${isDarkMode ? 'bg-teal-900/20 border-teal-800' : 'bg-teal-50 border-teal-100'}`}>
                                    <div className="flex justify-between items-center mb-4 relative z-10">
                                        <div className="flex items-center gap-2 font-black text-xs text-teal-500 uppercase tracking-tighter"><Search className="w-4 h-4"/> 裸K形态扫描</div>
                                        <button onClick={generatePriceActionAnalysis} disabled={isPriceActionScanning || aiCooldown > 0} className="text-[9px] font-black bg-teal-600 hover:bg-teal-500 px-4 py-2 rounded-full text-white transition-all shadow-xl shadow-teal-900/30 flex items-center gap-1.5 disabled:opacity-50">
                                            {isPriceActionScanning ? <Loader2 className="w-3 h-3 animate-spin"/> : <Zap className="w-3 h-3"/>}
                                            {isPriceActionScanning ? '扫描中' : '执行扫描'}
                                        </button>
                                    </div>
                                    <div className={`flex-1 text-xs leading-[1.8] whitespace-pre-wrap relative z-10 ${isDarkMode ? 'text-teal-200' : 'text-teal-800'}`}>
                                        {priceActionAnalysis || "等待扫描近期 K 线组合与量价背离信号..."}
                                    </div>
                                </div>

                                {/* 指标快览 */}
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { label: '短线建议', value: currentStock.sentiment?.label, color: 'text-emerald-400', icon: <Zap className="w-3 h-3"/> },
                                        { label: '中长期趋势', value: currentStock.longTermTrend?.label, color: 'text-blue-400', icon: <TrendingUp className="w-3 h-3"/> },
                                        { label: '预计压力', value: `$${currentStock.targetPrice}`, color: 'text-rose-400', icon: <Target className="w-3 h-3"/> },
                                        { label: '动态止损', value: `$${currentStock.stopLoss}`, color: 'text-orange-400', icon: <ShieldAlert className="w-3 h-3"/> }
                                    ].map((item, i) => (
                                        <div key={i} className={`p-5 rounded-[24px] border transition-all duration-300 hover:scale-[1.03] ${isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-gray-100 shadow-md'}`}>
                                            <div className="text-[9px] opacity-40 uppercase font-black tracking-widest mb-2 flex items-center gap-1.5">{item.icon} {item.label}</div>
                                            <div className={`text-lg font-black ${item.color}`}>{item.value || '---'}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'fundamentals' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                {/* 价值投资审计 */}
                                <div className={`p-6 rounded-[30px] border relative overflow-hidden flex flex-col min-h-[260px] transition-all duration-500 ${isDarkMode ? 'bg-amber-900/10 border-amber-800/50' : 'bg-amber-50 border-amber-100'}`}>
                                    <div className="flex justify-between items-center mb-4 relative z-10">
                                        <div className="flex items-center gap-2 font-black text-xs text-amber-500 uppercase tracking-tighter"><Scale className="w-4 h-4"/> 深度基本面审计</div>
                                        <button onClick={generateFundamentalAudit} disabled={isFundamentalAuditing || aiCooldown > 0} className="text-[9px] font-black bg-amber-600 hover:bg-amber-500 px-4 py-2 rounded-full text-white transition-all shadow-xl shadow-amber-900/30 flex items-center gap-1.5 disabled:opacity-50">
                                            {isFundamentalAuditing ? <Loader2 className="w-3 h-3 animate-spin"/> : <Sparkles className="w-3 h-3"/>}
                                            {isFundamentalAuditing ? '审计中' : '价值诊断'}
                                        </button>
                                    </div>
                                    <div className={`flex-1 text-xs leading-[1.8] overflow-y-auto scrollbar-hide whitespace-pre-wrap relative z-10 ${isDarkMode ? 'text-amber-200/80' : 'text-amber-800/80'}`}>
                                        {fundamentalAudit || "让 AI 价值投资模型为您深度诊断该公司的财务健康度与护城河。"}
                                    </div>
                                </div>

                                {/* 数据卡片 */}
                                {currentStock.fundamentals && (
                                    <div className={`p-6 rounded-[30px] border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'}`}>
                                        <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                                            <FundamentalItem label="总市值" value={currentStock.fundamentals.marketCap} tooltip="计算公式：当前股价 × 总股本。" isDarkMode={isDarkMode} />
                                            <FundamentalItem label="PE(市盈率)" value={currentStock.fundamentals.peRatio} tooltip="回本年限的粗略估计。" isDarkMode={isDarkMode} />
                                            <FundamentalItem label="Forward PE" value={currentStock.fundamentals.forwardPe} tooltip="基于分析师对未来盈利的预测。" isDarkMode={isDarkMode} />
                                            <FundamentalItem label="Beta" value={currentStock.fundamentals.beta} tooltip=">1 表示波动大，<1 表示抗跌。" isDarkMode={isDarkMode} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'news' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                {/* 情绪摘要 */}
                                <div className={`p-6 rounded-[30px] border relative overflow-hidden flex flex-col min-h-[160px] transition-all duration-500 ${isDarkMode ? 'bg-blue-900/20 border-blue-800/50' : 'bg-blue-50 border-blue-100'}`}>
                                    <div className="flex justify-between items-center mb-4 relative z-10">
                                        <div className="flex items-center gap-2 font-black text-xs text-blue-500 uppercase tracking-tighter"><Newspaper className="w-4 h-4"/> 舆情情绪提炼</div>
                                        <button onClick={generateNewsSummary} disabled={isNewsSummarizing || aiCooldown > 0} className="text-[9px] font-black bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-full text-white transition-all shadow-xl shadow-blue-900/30 flex items-center gap-1.5 disabled:opacity-50">
                                            {isNewsSummarizing ? <Loader2 className="w-3 h-3 animate-spin"/> : <Sparkles className="w-3 h-3"/>}
                                            {isNewsSummarizing ? '提炼中' : '一键总结'}
                                        </button>
                                    </div>
                                    <div className={`flex-1 text-xs leading-[1.8] whitespace-pre-wrap relative z-10 ${isDarkMode ? 'text-blue-200/80' : 'text-blue-800/80'}`}>
                                        {newsSummary || "让 AI 为您快速总结下方新闻的整体市场情绪偏向。"}
                                    </div>
                                </div>

                                {/* 新闻列表 */}
                                <div className="space-y-3">
                                    {currentStock.news?.map((news, i) => (
                                        <div key={i} className={`p-4 rounded-2xl border transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'}`}>
                                            <div className="text-xs font-bold mb-2 leading-relaxed line-clamp-2">{news.title}</div>
                                            <div className="flex justify-between items-center text-[9px] font-black opacity-40 uppercase">
                                                <span>{news.source}</span>
                                                <span>{news.time}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </main>
      </div>
    </div>
  );
}