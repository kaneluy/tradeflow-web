export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { prompt, key } = req.body;

    // 💡 智能模型备用池：按优先级自动降级尝试
    const models = [
        "gemini-2.0-flash",         // 优先级1：最新主力模型
        "gemini-1.5-pro-latest",    // 优先级2：1.5 增强版
        "gemini-1.5-flash",         // 优先级3：基础版
        "gemini-pro"                // 优先级4：最基础、100%兼容的初代模型
    ];

    let lastErrorMsg = "";

    for (const model of models) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            const data = await response.json();

            // 如果请求成功，提取文字并立刻返回前端，中断循环
            if (response.ok && data.candidates) {
                const text = data.candidates[0].content.parts[0].text;
                return res.status(200).json({ text });
            }

            // 记录当前模型的报错信息，继续尝试下一个模型
            if (data.error) {
                lastErrorMsg = data.error.message;
            }

        } catch (error) {
            lastErrorMsg = error.message;
        }
    }

    // 如果把上面 4 个模型全试了一遍都不行，再给前端报错
    res.status(400).json({ error: `尝试了所有可用模型均被拒绝。请检查 Key 权限。最后报错: ${lastErrorMsg}` });
}