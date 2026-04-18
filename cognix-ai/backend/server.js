const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config({ path: './backend/.env' });
const { retainMemory, recallMemory } = require('./hindsight');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const sessions = {};

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

app.post('/chat', async (req, res) => {
    const { userId, message } = req.body;

    if (!userId || !message) {
        return res.status(400).json({ error: 'userId and message are required' });
    }

    try {
        const recalledMemories = await recallMemory(userId, message);
        const memoryContext = recalledMemories.length > 0
            ? recalledMemories.join('\n- ')
            : "No memory found yet";

        const systemPrompt = `You are Cognix AI, an adaptive agent with persistent memory.
- Always reference past context naturally using phrases like "I remember you mentioned..." or "Last time you said..."
- Never give generic answers. Always give specific steps, commands, or examples
- Go one level deeper than what was asked
- If the user is repeating a question, give a better answer than before
- Challenge wrong assumptions politely but directly
- If memory context is empty, say so and ask the user to tell you more
- Never show your thinking process, just give the final answer directly

=== PAST MEMORY CONTEXT ===
${memoryContext}
=========================`;

        if (!sessions[userId]) {
            sessions[userId] = [];
        }

        sessions[userId].push({ role: 'user', content: message });

        if (sessions[userId].length > 20) {
            sessions[userId] = sessions[userId].slice(-20);
        }

        console.log(`[Groq] Sending request for user ${userId}...`);
        const groqResponse = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: 'qwen/qwen3-32b',
            messages: [
                { role: 'system', content: systemPrompt },
                ...sessions[userId]
            ],
            temperature: 0.7,
            stream: false
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        let aiReply = groqResponse.data.choices[0].message.content;
        aiReply = aiReply.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

        sessions[userId].push({ role: 'assistant', content: aiReply });

        const summary = `User: ${message}\nCognix: ${aiReply}`;
        retainMemory(userId, summary);

        res.json({
            reply: aiReply,
            memoriesUsed: recalledMemories.length
        });

    } catch (error) {
        console.error('[Server Error]:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to process chat request' });
    }
});

app.listen(PORT, () => {
    console.log(`\n🚀 Cognix AI Backend running at http://localhost:${PORT}`);
    console.log(`📡 Health Check: http://localhost:${PORT}/health\n`);
});