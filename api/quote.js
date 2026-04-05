// api/quote.js
// 针对 Vercel 环境优化的自动版本探测逻辑 (支持 v2 和 v3)

// 1. 先尝试导入模块
import * as yfModule from 'yahoo-finance2';

/**
 * 🛠️ 核心自愈逻辑：
 * 自动识别 yahoo-finance2 的版本并进行初始化。
 */
let yf = null;

function initEngine() {
    if (yf) return yf;
    
    // 获取模块核心
    const mod = yfModule.default || yfModule;
    
    try {
        // 探测方式 A: 检查是否存在 YahooFinance 类 (v3 标志)
        if (yfModule.YahooFinance) {
            yf = new yfModule.YahooFinance();
            console.log("[API] 引擎以 v3 模式启动");
        } 
        // 探测方式 B: 检查模块本身是否包含核心函数 (v2 标志)
        else if (mod.quote || (mod.default && mod.default.quote)) {
            yf = mod.quote ? mod : mod.default;
            console.log("[API] 引擎以 v2 模式启动");
        }
        else {
            throw new Error("无法识别库结构");
        }
    } catch (e) {
        console.error("[API Init Error]", e.message);
    }
    return yf;
}

export default async function handler(req, res) {
    // 设置跨域头
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 初始化引擎
    const engine = initEngine();
    if (!engine || typeof engine.quote !== 'function') {
        return res.status(500).json({ 
            error: "引擎初始化失败", 
            details: "请在本地重新执行 npm install yahoo-finance2@latest 并重新部署" 
        });
    }

    // 解析股票代码
    let symbol = (req.query.code || 'TSLA').replace('US.', '');

    try {
        // 并发获取实时报价和历史数据
        // 注意：雅虎 API 有时会因为请求频率过快报错，这里加个保护
        const [quote, history] = await Promise.all([
            engine.quote(symbol),
            engine.historical(symbol, { 
                period1: '2024-01-01', 
                interval: '1d' 
            })
        ]).catch(e => {
            throw new Error(`雅虎接口返回错误: ${e.message}`);
        });

        if (!quote) throw new Error(`未找到代码 ${symbol} 的数据`);

        // 构造标准响应格式
        const formattedData = {
            symbol: symbol,
            price: quote.regularMarketPrice,
            changePercent: quote.regularMarketChangePercent,
            prevClose: quote.regularMarketPreviousClose,
            dayOpen: quote.regularMarketOpen,
            dayHigh: quote.regularMarketDayHigh,
            dayLow: quote.regularMarketDayLow,
            source: 'Vercel Cloud (Auto-Detected Engine)',
            history: (history || []).map(h => ({
                time: h.date instanceof Date ? h.date.toISOString().split('T')[0] : h.date,
                open: h.open,
                high: h.high,
                low: h.low,
                close: h.close,
                volume: h.volume,
                vwap: parseFloat(((h.open + h.high + h.low + h.close) / 4).toFixed(2))
            })).slice(-100)
        };

        return res.status(200).json(formattedData);

    } catch (error) {
        console.error(`[Vercel API] 异常:`, error.message);
        return res.status(500).json({ 
            error: "接口响应异常", 
            details: error.message 
        });
    }
}