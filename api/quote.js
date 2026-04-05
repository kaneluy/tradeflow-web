// api/quote.js
// 适配 ES Module 规范，采用最高兼容性的模块解包逻辑
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
        /**
         * 🛠️ 终极模块解包逻辑：
         * 针对 Vercel/Node ESM 环境下可能出现的各种嵌套结构进行清理
         */
        let yf = yahooFinance;

        // 逐层检查并剥离 .default
        for (let i = 0; i < 3; i++) {
            if (yf && !yf.quote && yf.default) {
                yf = yf.default;
            }
        }

        // 如果还是找不到，尝试检查它是否被打包成了具有特定属性的对象
        if (!yf || typeof yf.quote !== 'function') {
            console.error("[API Error] 模块探测失败。当前对象结构:", JSON.stringify(Object.keys(yf || {})));
            throw new Error("无法初始化数据引擎。请尝试重新部署或联系支持。");
        }

        console.log(`[Vercel API] 引擎就绪，正在抓取: ${symbol}`);

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
            source: 'Vercel Serverless (Cloud)',
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
        console.error(`[Vercel API] 严重错误 ${symbol}:`, error.message);
        
        // 针对没有权限的错误进行专门提示
        const errorMsg = error.message.includes('permission') ? "无行情权限，请检查代码名" : "数据抓取失败";
        
        return res.status(500).json({ 
            error: errorMsg, 
            details: error.message 
        });
    }
}