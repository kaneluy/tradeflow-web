export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { prompt, key } = req.body;

    // 💡 最新全系模型池：覆盖 Google 官方所有合规命名与后缀
    const endpoints = [
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${key}`,
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.0-pro:generateContent?key=${key}`,
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${key}`
    ];

    let lastError = "";

    for (const url of endpoints) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            const data = await response.json();

            // 如果成功：立刻返回文本，中断循环
            if (response.ok && data.candidates) {
                return res.status(200).json({ text: data.candidates[0].content.parts[0].text });
            }

            // 如果报错：记录当前的错误原因，然后静默尝试下一种模型
            if (data.error) {
                lastError = data.error.message;
            }
        } catch (error) {
            lastError = error.message;
        }
    }

    // 如果所有正确名字都被拒绝，抛出最后的遗言
    res.status(400).json({ error: `所有模型命名尝试均被拒绝。最后报错: ${lastError}` });
}