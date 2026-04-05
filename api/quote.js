// api/quote.js
// 针对 Vercel 环境优化的自动版本探测逻辑 (支持 v2 和 v3)

// 1. 先尝试导入模块
import * as yfModule from 'yahoo-finance2';

/**
 * 🛠️ 核心自愈逻辑：
 * 针对 yahoo-finance2 v3 强制实例化的要求进行优化。
 */
let yf = null;

function initEngine() {
    if (yf) return yf;
    
    try {
        // 获取模块核心
        const mod = yfModule.default || yfModule;
        
        /**
         * 探测方式 A: 寻找 YahooFinance 类并实例化 (v3 标准)
         * 雅虎库升级到 v3 后，如果不实例化直接调用 quote 会抛出错误。
         */
        let YahooFinanceClass = yfModule.YahooFinance || (mod && mod.YahooFinance) || (typeof mod === 'function' ? mod : null);

        if (YahooFinanceClass && typeof YahooFinanceClass === 'function') {
            yf = new YahooFinanceClass();
            console.log("[API] 引擎以 v3 实例模式成功启动");
        } 
        /**
         * 探测方式 B: 兼容 v2 或某些特殊的打包结构
         */
        else if (mod.quote || (mod.default && mod.default.quote)) {
            yf = mod.quote ? mod : mod.default;
            console.log("[API] 引擎以 v2/兼容模式启动");
        }
        else {
            throw new Error("无法识别库结构，所有探测均失效");
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
    
    // 安全检查
    if (!engine || typeof engine.quote !== 'function') {
        return res.status(500).json({ 
            error: "引擎初始化失败", 
            details: "无法定位 quote 函数。请确保依赖已正确安装。" 
        });
    }

    // 解析股票代码
    let symbol = (req.query.code || 'TSLA').replace('US.', '').toUpperCase();

    try {
        /**
         * 🛠️ 终极参数修复：
         * Vercel 环境下，Date 对象有时会发生序列化异常。
         * 我们直接使用 Unix 时间戳（秒），这是雅虎底层 API 最稳定的格式。
         */
        const startDate = Math.floor(new Date('2024-01-01').getTime() / 1000);
        const endDate = Math.floor(Date.now() / 1000);

        // 并发获取实时报价和历史数据
        const [quote, history] = await Promise.all([
            engine.quote(symbol),
            engine.historical(symbol, { 
                period1: startDate, 
                period2: endDate,
                interval: '1d' 
            }).catch(hErr => {
                console.warn("历史数据抓取微调:", hErr.message);
                return []; // 如果历史数据报错，不影响实时报价返回
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
            source: 'Vercel Cloud (Timestamp-Engine)',
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