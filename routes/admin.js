const express = require('express');
const db = require('../database');
const { authenticateToken } = require('./auth');
const router = express.Router();

// Middleware to check if user is admin or teacher
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    next();
};

const isTeacherOrAdmin = (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
        return res.status(403).json({ error: 'Teacher or Admin access required' });
    }
    next();
};

// Admin Settings
router.get('/settings', authenticateToken, isAdmin, (req, res) => {
    const settings = db.prepare('SELECT * FROM settings').all();
    const result = {};
    settings.forEach(s => result[s.key] = s.value);
    res.json(result);
});

router.post('/settings', authenticateToken, isAdmin, (req, res) => {
    const { api_key, base_url, model, ai_provider } = req.body;
    const update = db.prepare('UPDATE settings SET value = ? WHERE key = ?');
    if (api_key !== undefined) update.run(api_key, 'api_key');
    if (base_url !== undefined) update.run(base_url, 'base_url');
    if (model !== undefined) update.run(model, 'model');
    if (ai_provider !== undefined) update.run(ai_provider, 'ai_provider');
    res.json({ message: 'Settings updated' });
});

// Classroom Management
router.get('/classrooms', authenticateToken, isTeacherOrAdmin, (req, res) => {
    const classrooms = db.prepare('SELECT * FROM classrooms').all();
    res.json(classrooms);
});

router.post('/classrooms', authenticateToken, isAdmin, (req, res) => {
    const { name, description, system_prompt } = req.body;
    const result = db.prepare('INSERT INTO classrooms (name, description, system_prompt) VALUES (?, ?, ?)')
        .run(name, description, system_prompt);
    res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/classrooms/:id', authenticateToken, isAdmin, (req, res) => {
    const { name, description, system_prompt } = req.body;
    db.prepare('UPDATE classrooms SET name = ?, description = ?, system_prompt = ? WHERE id = ?')
        .run(name, description, system_prompt, req.params.id);
    res.json({ message: 'Classroom updated' });
});

router.delete('/classrooms/:id', authenticateToken, isAdmin, (req, res) => {
    db.prepare('DELETE FROM classrooms WHERE id = ?').run(req.params.id);
    res.json({ message: 'Classroom deleted' });
});

// User Management (Admin only)
router.get('/users', authenticateToken, isAdmin, (req, res) => {
    const users = db.prepare('SELECT id, name, email, role, classroom_id FROM users').all();
    res.json(users);
});

router.put('/users/:id', authenticateToken, isAdmin, (req, res) => {
    const { role, classroom_id } = req.body;
    db.prepare('UPDATE users SET role = ?, classroom_id = ? WHERE id = ?')
        .run(role, classroom_id, req.params.id);
    res.json({ message: 'User updated' });
});

// Classroom History (for teachers/admins)
router.get('/classrooms/:id/history', authenticateToken, isTeacherOrAdmin, (req, res) => {
    const messages = db.prepare(`
        SELECT m.*, u.name as user_name 
        FROM messages m 
        JOIN users u ON m.user_id = u.id 
        WHERE m.classroom_id = ? 
        ORDER BY m.created_at DESC
    `).all(req.params.id);
    res.json(messages);
});

module.exports = router;
