// api/quote.js
// 适配 ES Module 规范，采用“深度剥壳”算法确保库函数可用
import yahooFinance from 'yahoo-finance2';

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
        /**
         * 🛠️ 终极递归解包逻辑：
         * Vercel 的打包器有时会把 ESM 模块包裹在 2-3 层 .default 下。
         * 我们直接寻找含有 'quote' 属性的对象。
         */
        let yf = yahooFinance;
        let depth = 0;
        
        // 如果当前对象没有 quote，尝试深入寻找，最多找 5 层
        while (yf && typeof yf.quote !== 'function' && yf.default && depth < 5) {
            yf = yf.default;
            depth++;
        }

        // 最终检查：如果还是找不到 quote 函数，输出诊断信息
        if (!yf || typeof yf.quote !== 'function') {
            const keys = Object.keys(yf || {});
            console.error(`[API Error] 模块解包失败。深度: ${depth}, 可用键名:`, keys);
            return res.status(500).json({ 
                error: "数据引擎初始化失败", 
                debug: {
                    hasDefault: !!(yahooFinance && yahooFinance.default),
                    detectedKeys: keys,
                    resolveDepth: depth
                },
                suggestion: "请在 Vercel 控制台点击 'Redeploy' 并勾选 'Clean Cache'"
            });
        }

        console.log(`[Vercel API] 引擎就绪 (深度:${depth})，正在抓取: ${symbol}`);

        // 并发获取实时行情和历史数据
        const [quote, history] = await Promise.all([
            yf.quote(symbol),
            yf.historical(symbol, { 
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
            source: 'Vercel Cloud Engine',
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
        console.error(`[Vercel API] 运行异常 ${symbol}:`, error.message);
        return res.status(500).json({ 
            error: "行情抓取异常", 
            details: error.message 
        });
    }
}