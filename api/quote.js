// api/quote.js
// 针对 yahoo-finance2 v3 版本优化的 ESM 导入与实例化逻辑
import { YahooFinance } from 'yahoo-finance2';

// 1. 创建引擎实例 (v3 强制要求)
const yf = new YahooFinance();

export default async function handler(req, res) {
    // 设置跨域头
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 解析股票代码
    let symbol = (req.query.code || 'TSLA').replace('US.', '');

    try {
        console.log(`[Vercel API] 引擎已实例化，正在抓取: ${symbol}`);

        // 2. 使用实例 yf 调用方法
        // 并发获取实时报价和历史数据
        const [quote, history] = await Promise.all([
            yf.quote(symbol),
            yf.historical(symbol, { 
                period1: '2024-01-01', 
                interval: '1d' 
            })
        ]);

        if (!quote) {
            throw new Error(`未找到代码 ${symbol} 的数据。`);
        }

        // 3. 构造标准响应格式
        const formattedData = {
            symbol: symbol,
            price: quote.regularMarketPrice,
            changePercent: quote.regularMarketChangePercent,
            prevClose: quote.regularMarketPreviousClose,
            dayOpen: quote.regularMarketOpen,
            dayHigh: quote.regularMarketDayHigh,
            dayLow: quote.regularMarketDayLow,
            source: 'Vercel Cloud (v3 Engine)',
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
        console.error(`[Vercel API] 捕获异常:`, error.message);
        
        // 如果是常见的频率限制错误
        if (error.message.includes('429')) {
            return res.status(429).json({ error: "请求过于频繁，请稍后再试" });
        }

        return res.status(500).json({ 
            error: "数据抓取异常", 
            details: error.message 
        });
    }
}