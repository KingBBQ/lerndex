const express = require('express');
const db = require('../database');
const { authenticateToken } = require('./auth');
const router = express.Router();

router.post('/', authenticateToken, async (req, res) => {
    const { messages, classroom_id } = req.body;

    // Get settings
    const settings = db.prepare('SELECT * FROM settings').all();
    const config = {};
    settings.forEach(s => config[s.key] = s.value);

    // Fallback for missing/empty base_url
    const baseUrl = config.base_url || 'https://api.openai.com/v1';

    if (!config.api_key) {
        return res.status(500).json({ error: 'API Key not configured by admin' });
    }

    // Determine system prompt
    let systemPrompt = "Du bist ein freundlicher Deutschlehrer. Hilf den Schülern bei ihrer Frage.";
    if (classroom_id) {
        const classroom = db.prepare('SELECT system_prompt FROM classrooms WHERE id = ?').get(classroom_id);
        if (classroom) systemPrompt = classroom.system_prompt;
    }

    const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...messages
    ];

    try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.api_key}`
            },
            body: JSON.stringify({
                model: config.model,
                messages: apiMessages
            })
        });

        const data = await response.json();
        const assistantMessage = data.choices[0].message.content;

        // Save last user message and assistant response to history
        const lastUserMessage = messages[messages.length - 1].content;

        if (classroom_id) {
            db.prepare('INSERT INTO messages (user_id, classroom_id, role, content) VALUES (?, ?, ?, ?)').run(
                req.user.id, classroom_id, 'user', lastUserMessage
            );
            db.prepare('INSERT INTO messages (user_id, classroom_id, role, content) VALUES (?, ?, ?, ?)').run(
                req.user.id, classroom_id, 'assistant', assistantMessage
            );
        }

        res.json(data);
    } catch (err) {
        console.error('Chat error:', err);
        res.status(500).json({ error: 'Failed to communicate with AI' });
    }
});

module.exports = router;
