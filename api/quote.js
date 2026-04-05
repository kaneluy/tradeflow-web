// api/quote.js
// 使用 Node.js 原生兼容加载器，彻底解决库导入为空对象的问题
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// 强行使用 CommonJS 方式加载
const yahooFinance = require('yahoo-finance2').default || require('yahoo-finance2');

export default async function handler(req, res) {
    // 允许跨域配置
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
        console.log(`[Vercel API] 尝试通过原生加载器获取: ${symbol}`);

        // 检查函数是否可用
        if (!yahooFinance || typeof yahooFinance.quote !== 'function') {
            throw new Error("数据引擎加载失败，库对象不可用。");
        }

        // 并发获取实时行情和历史数据
        // yahoo-finance2 v2 版本需要使用其内部方法
        const [quote, history] = await Promise.all([
            yahooFinance.quote(symbol),
            yahooFinance.historical(symbol, { 
                period1: '2024-01-01', 
                interval: '1d' 
            })
        ]);

        if (!quote) throw new Error(`未找到代码 ${symbol} 的数据。`);

        // 构造标准响应格式
        const formattedData = {
            symbol: symbol,
            price: quote.regularMarketPrice,
            changePercent: quote.regularMarketChangePercent,
            prevClose: quote.regularMarketPreviousClose,
            dayOpen: quote.regularMarketOpen,
            dayHigh: quote.regularMarketDayHigh,
            dayLow: quote.regularMarketDayLow,
            source: 'Vercel Cloud (Native Bridge)',
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
            error: "行情获取失败", 
            details: error.message,
            suggestion: "请确保 package.json 中 yahoo-finance2 版本正确"
        });
    }
}