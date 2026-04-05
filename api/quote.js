// api/quote.js
// 采用 Vercel 推荐的 ESM 原生导入，并加入动态解析逻辑
import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
    // 1. 设置跨域头
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 2. 解析股票代码
    let symbol = (req.query.code || 'TSLA').replace('US.', '');

    try {
        console.log(`[Vercel API] 正在尝试解析引擎...`);

        /**
         * 🛠️ 核心修复逻辑：
         * 针对 Vercel 环境下 yahoo-finance2 导入结构不确定的问题进行“三级跳”探测
         */
        let yf = yahooFinance;

        // 第一级：标准导入
        if (!yf || (typeof yf.quote !== 'function' && yf.default)) {
            yf = yf.default;
        }

        // 第二级：如果还是不行，说明库加载可能出了断层，尝试动态重载
        if (!yf || typeof yf.quote !== 'function') {
            try {
                const dynamicImport = await import('yahoo-finance2');
                yf = dynamicImport.default || dynamicImport;
            } catch (e) {
                console.error("动态加载失败:", e.message);
            }
        }

        // 最终检查
        if (!yf || typeof yf.quote !== 'function') {
            throw new Error("数据引擎初始化失败：找不到核心函数。请检查依赖是否安装。");
        }

        console.log(`[Vercel API] 引擎就绪，正在抓取: ${symbol}`);

        // 3. 并发获取实时报价和历史数据
        const [quote, history] = await Promise.all([
            yf.quote(symbol),
            yf.historical(symbol, { 
                period1: '2024-01-01', 
                interval: '1d' 
            })
        ]);

        if (!quote) throw new Error(`未找到代码 ${symbol} 的数据。`);

        // 4. 格式化并返回
        const formattedData = {
            symbol: symbol,
            price: quote.regularMarketPrice,
            changePercent: quote.regularMarketChangePercent,
            prevClose: quote.regularMarketPreviousClose,
            dayOpen: quote.regularMarketOpen,
            dayHigh: quote.regularMarketDayHigh,
            dayLow: quote.regularMarketDayLow,
            source: 'Vercel Cloud (Unified Engine)',
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
        return res.status(500).json({ 
            error: "接口响应异常", 
            details: error.message,
            suggestion: "请确保 package.json 中已包含 'yahoo-finance2'"
        });
    }
}