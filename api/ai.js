export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { prompt, key } = req.body;

    // 💡 终极寻路池：覆盖所有版本和模型组合，只要 Key 是活的，总有一个能通！
    const endpoints = [
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
        `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${key}`,
        `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${key}`
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

            // 成功：立刻返回文本，中断循环
            if (response.ok && data.candidates) {
                return res.status(200).json({ text: data.candidates[0].content.parts[0].text });
            }

            // 失败：记录真实的报错原因，继续尝试下一条路
            if (data.error) {
                lastError = data.error.message;
            }
        } catch (error) {
            lastError = error.message;
        }
    }

    // 所有路径全部阵亡，把最后的遗言发给前端
    res.status(400).json({ error: lastError });
}