// api/quote.js
// 适配 ES Module 规范，并解决 Vercel 环境下深度嵌套的导入问题
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
         * 🛠️ 深度兼容性探测：
         * 某些版本的打包工具会将 ESM 模块嵌套多层 .default。
         * 我们通过一个循环来解开这些嵌套，直到找到真正的功能对象。
         */
        let yf = yahooFinance;
        // 如果 yf 本身没有 quote，但有 default，就深入一层
        if (!yf.quote && yf.default) {
            yf = yf.default;
        }
        // 二次防御：如果还是没有，尝试检查是否有更深的嵌套
        if (!yf.quote && yf.default) {
            yf = yf.default;
        }

        // 最终检查
        if (typeof yf.quote !== 'function') {
            console.error("[API Error] 无法识别 yahooFinance 结构:", JSON.keys(yahooFinance));
            throw new Error("yahoo-finance2 库初始化失败，请检查依赖版本。");
        }

        // 使用解出的 yf 对象进行查询
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
        console.error(`[Vercel API] 失败 ${symbol}:`, error.message);
        return res.status(500).json({ 
            error: "无法获取股票数据", 
            details: error.message 
        });
    }
}