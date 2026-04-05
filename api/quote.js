// api/quote.js
// 针对 Vercel Serverless 环境优化的“防死锁”导入逻辑
import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
    // 1. 设置跨域头 (保持不变)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 2. 解析代码
    let symbol = (req.query.code || 'TSLA').replace('US.', '');

    try {
        console.log(`[Vercel API] 正在进行深度引擎探测...`);

        /**
         * 🛠️ 终极自愈逻辑 (Vercel 专用版)：
         * 解决 ESM 与 CommonJS 混用导致的 .default 嵌套及模块丢失问题
         */
        let yf = null;

        // 探测 A：尝试直接解包可能的嵌套
        const probe = (obj) => {
            if (!obj) return null;
            if (typeof obj.quote === 'function') return obj;
            if (obj.default && typeof obj.default.quote === 'function') return obj.default;
            return null;
        };

        yf = probe(yahooFinance);

        // 探测 B：如果 A 失败，尝试动态重新加载
        if (!yf) {
            try {
                const dynamic = await import('yahoo-finance2');
                yf = probe(dynamic);
            } catch (e) {
                console.error("动态加载尝试失败:", e.message);
            }
        }

        // 3. 最终拦截与诊断
        if (!yf || typeof yf.quote !== 'function') {
            // 如果走到这里，说明库的加载彻底失败，返回诊断 JSON 以便排查
            const debugInfo = {
                typeof_import: typeof yahooFinance,
                has_default: !!(yahooFinance && yahooFinance.default),
                available_keys: yahooFinance ? Object.keys(yahooFinance).slice(0, 10) : 'none'
            };
            
            console.error("[API ERROR] 引擎失效，诊断信息:", debugInfo);
            
            return res.status(500).json({ 
                error: "接口响应异常", 
                details: "数据引擎初始化失败：找不到核心函数。这通常是 Vercel 依赖编译错误。",
                diagnostics: debugInfo,
                suggestion: "请在终端执行 'npm install yahoo-finance2@latest' 后再次推送，并在 Vercel 控制台选择 'Clean Cache Redeploy'。"
            });
        }

        console.log(`[Vercel API] 引擎已唤醒，正在抓取: ${symbol}`);

        // 4. 执行数据抓取
        const [quote, history] = await Promise.all([
            yf.quote(symbol),
            yf.historical(symbol, { 
                period1: '2024-01-01', 
                interval: '1d' 
            })
        ]);

        if (!quote) throw new Error(`未找到代码 ${symbol} 的数据。`);

        // 5. 格式化并返回
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
            error: "数据抓取异常", 
            details: error.message 
        });
    }
}