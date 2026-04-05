// api/quote.js
// 适配 ES Module 规范 (import/export)
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
        console.log(`[Vercel API] 正在获取数据: ${symbol}`);
        
        // 并发获取实时行情和历史数据
        const [quote, history] = await Promise.all([
            yahooFinance.quote(symbol),
            yahooFinance.historical(symbol, { 
                period1: '2024-01-01', // 获取较长一段历史
                interval: '1d' 
            })
        ]);

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
            history: history.map(h => ({
                time: h.date instanceof Date ? h.date.toISOString().split('T')[0] : h.date,
                open: h.open,
                high: h.high,
                low: h.low,
                close: h.close,
                volume: h.volume,
                vwap: parseFloat(((h.open + h.high + h.low + h.close) / 4).toFixed(2)) // 估算一个 VWAP
            })).slice(-100)
        };

        return res.status(200).json(formattedData);
        
    } catch (error) {
        console.error(`[Vercel API] 获取 ${symbol} 失败:`, error.message);
        return res.status(500).json({ 
            error: "无法获取股票数据", 
            details: error.message 
        });
    }
}