const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../database');
const router = express.Router();

const SECRET_KEY = 'lerndex_secret_key_1337'; // In production, use env variable

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Forbidden' });
        req.user = user;
        next();
    });
};

// Register
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });

    try {
        const hash = await bcrypt.hash(password, 10);
        const stmt = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)');
        const result = stmt.run(name, email, hash);
        res.status(201).json({ id: result.lastInsertRowid, message: 'User registered' });
    } catch (err) {
        if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Email already exists' });
        res.status(500).json({ error: 'Server error' });
    }
});

// Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, name: user.name, role: user.role, email: user.email }, SECRET_KEY, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, name: user.name, role: user.role, classroom_id: user.classroom_id } });
});

// Get current user
router.get('/me', authenticateToken, (req, res) => {
    const user = db.prepare('SELECT id, name, email, role, classroom_id FROM users WHERE id = ?').get(req.user.id);
    res.json(user);
});

// Join a classroom (for students, teachers, admins)
router.post('/join-classroom', authenticateToken, (req, res) => {
    const { classroom_id } = req.body;
    if (!classroom_id) return res.status(400).json({ error: 'Missing classroom_id' });

    try {
        // Find current user role to decide whether to demote to student
        const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id);
        const newRole = (user.role === 'admin' || user.role === 'teacher') ? user.role : 'student';

        db.prepare('UPDATE users SET role = ?, classroom_id = ? WHERE id = ?')
            .run(newRole, classroom_id, req.user.id);
        res.json({ message: 'Successfully joined classroom', role: newRole });
    } catch (err) {
        res.status(500).json({ error: 'Failed to join classroom' });
    }
});

module.exports = router;
module.exports.authenticateToken = authenticateToken;
