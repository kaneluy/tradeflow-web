export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { prompt, key } = req.body;
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await response.json();
        // 提取文本并返回
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "AI 响应异常";
        res.status(200).json({ text });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}