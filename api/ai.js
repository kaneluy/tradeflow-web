export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { prompt, key } = req.body;

    try {
        // ⚔️ 第一步：听从 Google 的建议，先调用 ListModels 查可用白名单
        const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
        const listRes = await fetch(listUrl);
        const listData = await listRes.json();

        if (!listRes.ok) {
            return res.status(400).json({ error: `无法获取模型白名单: ${listData.error?.message || listRes.statusText}` });
        }

        // 过滤出支持生成文本 (generateContent) 且带有 gemini 名字的模型
        const availableModels = listData.models.filter(m => 
            m.supportedGenerationMethods.includes("generateContent") && 
            m.name.includes("gemini")
        );

        if (availableModels.length === 0) {
            return res.status(400).json({ error: "您的账号中没有任何可用的 Gemini 文本生成模型。" });
        }

        // 🧠 第二步：智能选择。优先找 1.5-flash，找不到就拿官方列表里的第一个能用的
        const selectedModel = availableModels.find(m => m.name.includes("1.5-flash"))?.name 
                           || availableModels.find(m => m.name.includes("2.0-flash"))?.name 
                           || availableModels[0].name;

        // 注意：ListModels 返回的 selectedModel 已经自带 "models/" 前缀 (例如 "models/gemini-1.5-flash")
        // ⚔️ 第三步：拿着 100% 正确的官方名字，正式发起请求
        const generateUrl = `https://generativelanguage.googleapis.com/v1beta/${selectedModel}:generateContent?key=${key}`;
        
        const response = await fetch(generateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await response.json();

        // 成功：立刻返回文本
        if (response.ok && data.candidates) {
            return res.status(200).json({ text: data.candidates[0].content.parts[0].text });
        }

        // 如果还是失败，抛出死因
        return res.status(400).json({ error: `使用了官方认可的模型 (${selectedModel}) 依然失败: ${data.error?.message || response.statusText}` });

    } catch (error) {
        res.status(500).json({ error: "中转服务崩溃: " + error.message });
    }
}