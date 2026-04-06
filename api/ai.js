export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { prompt, key } = req.body;

    // 💡 稳定版模型池：使用正式的 v1 路径
    const models = [
        "gemini-1.5-flash", // 优先使用 1.5 极速版
        "gemini-pro"        // 如果 1.5 没有权限，无缝降级到基础版（所有 Key 都有权限）
    ];

    let lastError = "";

    for (const model of models) {
        try {
            // ⚠️ 核心修复：将 v1beta 替换为了正式版 v1
            const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${key}`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            const data = await response.json();

            // 如果成功，立刻返回文本给前端
            if (response.ok && data.candidates) {
                return res.status(200).json({ text: data.candidates[0].content.parts[0].text });
            }
            
            // 如果报错，记录真实的错误原因，继续循环试下一个模型
            if (data.error) {
                lastError = data.error.message;
            }
        } catch (err) {
            lastError = err.message;
        }
    }

    // 所有模型都失败了才抛出异常
    res.status(400).json({ error: `模型权限受限。最后报错: ${lastError}` });
}