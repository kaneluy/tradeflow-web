// api/quote.js
// 适配 ES Module 规范，彻底修复 Object.keys 拼写错误及导入兼容性
import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
    // 允许跨域
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 获取股票代码并清洗
    let symbol = req.query.code || 'TSLA';
    symbol = symbol.replace('US.', '');

    try {
        console.log(`[Vercel API] 尝试获取数据: ${symbol}`);
        
        /**
         * 🛠️ 深度兼容性探测 (修正版)：
         * 解决 Vercel 编译环境下 CommonJS 与 ESM 混用的导入问题
         */
        let yf = yahooFinance;
        
        // 探测逻辑：如果当前对象没有 quote，尝试进入 .default 层
        if (yf && !yf.quote && yf.default) {
            yf = yf.default;
        }
        
        // 二次探测：有些打包工具会嵌套两层 .default
        if (yf && !yf.quote && yf.default) {
            yf = yf.default;
        }

        // 最终检查 (此处已修正 JSON.keys -> Object.keys)
        if (!yf || typeof yf.quote !== 'function') {
            console.error("[API Error] 无法识别模块结构，可用键名为:", Object.keys(yf || {}));
            throw new Error("yahoo-finance2 库尚未就绪，请稍后刷新重试。");
        }

        // 并发获取实时行情和历史数据
        const [quote, history] = await Promise.all([
            yf.quote(symbol),
            yf.historical(symbol, { 
                period1: '2024-01-01', 
                interval: '1d' 
            })
        ]);

        if (!quote) {
            throw new Error(`未找到股票代码 ${symbol} 的数据。`);
        }

        // 构造前端需要的标准格式
        const formattedData = {
            symbol: symbol,
            price: quote.regularMarketPrice,
            changePercent: quote.regularMarketChangePercent,
            prevClose: quote.regularMarketPreviousClose,
            dayOpen: quote.regularMarketOpen,
            dayHigh: quote.regularMarketDayHigh,
            dayLow: quote.regularMarketDayLow,
            source: 'Vercel Serverless (Yahoo)',
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
        console.error(`[Vercel API] 错误 ${symbol}:`, error.message);
        return res.status(500).json({ 
            error: "数据抓取失败", 
            details: error.message 
        });
    }
}