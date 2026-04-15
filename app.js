const app = {
    token: localStorage.getItem('lerndex_token'),
    user: null,
    currentView: 'home',
    adminTab: 'settings',
    activeClassroom: null,
    historyInterval: null,

    async init() {
        console.log('🚀 Lerndex init...');
        if (this.token) {
            await this.onLoginSuccess();
        } else {
            this.showAuth();
        }
        this.setupEventListeners();
    },

    showAuth() {
        document.getElementById('auth-view').classList.remove('hidden');
        document.getElementById('app-shell').classList.add('hidden');
        document.getElementById('lock-view').classList.add('hidden');
    },

    async onLoginSuccess() {
        // Fetch user data
        const respData = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        if (!respData.ok) {
            this.logout();
            return;
        }
        this.user = await respData.json();

        // Handle classroom join logic
        const pendingJoin = localStorage.getItem('lerndex_pending_join');
        if (pendingJoin) {
            try {
                const resp = await fetch('/api/auth/join-classroom', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.token}`
                    },
                    body: JSON.stringify({ classroom_id: pendingJoin })
                });
                if (resp.ok) {
                    localStorage.removeItem('lerndex_pending_join');
                    const userResp = await fetch('/api/auth/me', {
                        headers: { 'Authorization': `Bearer ${this.token}` }
                    });
                    this.user = await userResp.json();
                }
            } catch (err) {
                console.error('Auto-join failed', err);
            }
        }

        document.getElementById('auth-view').classList.add('hidden');

        // Handle student lock
        const isStudentLocked = this.user.role === 'student' && this.user.classroom_id;

        if (isStudentLocked) {
            document.getElementById('app-shell').classList.add('hidden');
            document.getElementById('lock-view').classList.remove('hidden');
            this.openChat();
        } else {
            document.getElementById('app-shell').classList.remove('hidden');
            document.getElementById('lock-view').classList.add('hidden');

            // Show/Hide nav items based on role
            document.getElementById('nav-admin').classList.toggle('hidden', this.user.role !== 'admin');
            document.getElementById('nav-teacher').classList.toggle('hidden', this.user.role !== 'teacher' && this.user.role !== 'admin');

            this.navigate('home');
            if (this.user.classroom_id) {
                this.openChat(); // Open chat automatically even for teachers/admins if assigned
            }
        }
    },

    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('lerndex_token');
        this.showAuth();
    },

    openChat() {
        window.open('chat.html', 'lerndex_chat');
    },

    async navigate(viewId) {
        this.currentView = viewId;
        document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
        document.getElementById(`view-${viewId}`).classList.remove('hidden');

        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewId);
        });

        if (viewId === 'home') this.renderTopics();
        if (viewId === 'admin') this.renderAdmin();
        if (viewId !== 'teacher' && this.historyInterval) clearInterval(this.historyInterval);
    },

    // --- TOPICS ---
    async loadTopics() {
        try {
            const resp = await fetch('topics.json');
            return await resp.json();
        } catch (e) {
            console.error('Error loading topics', e);
            return [];
        }
    },

    async renderTopics() {
        const topics = await this.loadTopics();
        const grid = document.getElementById('topic-grid');
        const filter = document.querySelector('.filter-btn.active').dataset.category;
        const search = document.getElementById('topic-search').value.toLowerCase();

        grid.innerHTML = '';
        topics.forEach(t => {
            if (filter !== 'all' && t.category !== filter) return;
            if (search && !t.title.toLowerCase().includes(search) && !t.description.toLowerCase().includes(search)) return;

            const card = document.createElement('div');
            card.className = 'topic-card';
            card.innerHTML = `
                <h3>${t.title}</h3>
                <p style="color: var(--text-muted); font-size: 0.9rem">${t.description}</p>
            `;
            card.onclick = () => this.showTopic(t);
            grid.appendChild(card);
        });
    },

    showTopic(topic) {
        const content = document.getElementById('topic-content');
        content.innerHTML = `
            <h2>${topic.title}</h2>
            <div style="margin: 1.5rem 0; line-height: 1.6">
                ${this.parseMarkdown(topic.content)}
            </div>
        `;
        this.navigate('topic-detail');
    },

    parseMarkdown(text) {
        // Simple markdown parser
        return text
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
            .replace(/^- (.*$)/gim, '<li>$1</li>')
            .replace(/\n/gim, '<br>');
    },

    // --- ADMIN ---
    async setAdminTab(tab) {
        this.adminTab = tab;
        this.renderAdmin();
    },

    async renderAdmin() {
        const container = document.getElementById('admin-content');
        document.querySelectorAll('.admin-sidebar button').forEach(b => {
            b.classList.toggle('active', b.textContent.toLowerCase().includes(this.adminTab));
        });

        if (this.adminTab === 'settings') {
            const resp = await fetch('/api/admin/settings', { headers: { 'Authorization': `Bearer ${this.token}` } });
            const settings = await resp.json();
            container.innerHTML = `
                <h3>API Einstellungen</h3>
                <p style="color: var(--text-muted); margin-bottom: 2rem">Konfiguriere den globalen KI Zugriff.</p>
                <div class="auth-card" style="max-width: 100%; border-style: dashed">
                    <label>OpenAI API Key</label>
                    <input type="password" id="set-api-key" value="${settings.api_key || ''}" placeholder="sk-...">
                    <label>Base URL</label>
                    <input type="text" id="set-base-url" value="${settings.base_url}">
                    <label>Modell</label>
                    <input type="text" id="set-model" value="${settings.model}">
                    <label>KI Provider</label>
                    <select id="set-ai-provider" style="width: 100%; padding: 0.75rem; border-radius: var(--radius); border: 1px solid var(--border); margin-bottom: 1.5rem">
                        <option value="internal" ${settings.ai_provider === 'internal' ? 'selected' : ''}>Intern (OpenAI Proxy)</option>
                        <option value="external" ${settings.ai_provider === 'external' ? 'selected' : ''}>Extern (telli.schule Embed)</option>
                    </select>
                    <button class="btn btn-primary" onclick="app.saveSettings()">Speichern</button>
                </div>
            `;
        } else if (this.adminTab === 'classrooms') {
            const resp = await fetch('/api/admin/classrooms', { headers: { 'Authorization': `Bearer ${this.token}` } });
            const classes = await resp.json();
            container.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem">
                    <h3>Klassenzimmer</h3>
                    <button class="btn btn-primary" onclick="app.showClassroomModal()">+ Neu</button>
                </div>
                <div class="table-container">
                    <table>
                        <thead><tr><th>Name</th><th>Beschreibung</th><th>Beitritts-Link</th><th>Aktionen</th></tr></thead>
                        <tbody>${classes.map(c => `
                            <tr>
                                <td>${c.name}</td>
                                <td>${c.description}</td>
                                <td><code style="font-size: 0.8rem">${window.location.origin}/?join=${c.id}</code></td>
                                <td>
                                    <button class="btn btn-ghost" onclick="app.deleteClassroom(${c.id})" style="color: #ef4444">Löschen</button>
                                </td>
                            </tr>
                        `).join('')}</tbody>
                    </table>
                </div>
            `;
        } else if (this.adminTab === 'users') {
            const resp = await fetch('/api/admin/users', { headers: { 'Authorization': `Bearer ${this.token}` } });
            const users = await resp.json();
            container.innerHTML = `
                <h3>Nutzerverwaltung</h3>
                <div class="table-container">
                    <table>
                        <thead><tr><th>Name</th><th>Email</th><th>Rolle</th><th>Klasse ID</th></tr></thead>
                        <tbody>${users.map(u => `
                            <tr>
                                <td>${u.name}</td>
                                <td>${u.email}</td>
                                <td>${u.role}</td>
                                <td>${u.classroom_id || '-'}</td>
                            </tr>
                        `).join('')}</tbody>
                    </table>
                </div>
            `;
        }
    },

    async saveSettings() {
        const body = {
            api_key: document.getElementById('set-api-key').value,
            base_url: document.getElementById('set-base-url').value,
            model: document.getElementById('set-model').value,
            ai_provider: document.getElementById('set-ai-provider').value
        };
        const resp = await fetch('/api/admin/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            },
            body: JSON.stringify(body)
        });
        if (resp.ok) {
            this.showToast('Einstellungen gespeichert');
        }
    },

    async deleteClassroom(id) {
        if (!confirm('Klassenzimmer wirklich löschen?')) return;
        await fetch(`/api/admin/classrooms/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        this.renderAdmin();
    },

    showClassroomModal() {
        const name = prompt('Name des Klassenzimmers:');
        if (!name) return;
        const desc = prompt('Beschreibung:');
        fetch('/api/admin/classrooms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            },
            body: JSON.stringify({ name, description: desc })
        }).then(() => this.renderAdmin());
    },

    // --- GAMES ---
    startGame(type) {
        const container = document.getElementById('game-container');
        document.getElementById('view-games').querySelectorAll('.topic-grid').forEach(g => g.classList.add('hidden'));
        container.classList.remove('hidden');
        container.innerHTML = `<h3>${type.toUpperCase()} - Coming Soon</h3><button class="btn btn-ghost" onclick="app.navigate('games')">Beenden</button>`;
    },

    // --- TEACHER ---
    async initTeacherView() {
        const resp = await fetch('/api/admin/classrooms', { headers: { 'Authorization': `Bearer ${this.token}` } });
        const classes = await resp.json();
        const list = document.getElementById('teacher-classroom-list');
        list.innerHTML = classes.map(c => `
            <button onclick="app.loadTeacherHistory(${c.id}, this)">${c.name}</button>
        `).join('');
    },

    async loadTeacherHistory(classId, btn) {
        document.querySelectorAll('#teacher-classroom-list button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (this.historyInterval) clearInterval(this.historyInterval);

        const fetchHistory = async () => {
            const resp = await fetch(`/api/admin/classrooms/${classId}/history`, { headers: { 'Authorization': `Bearer ${this.token}` } });
            const messages = await resp.json();
            const content = document.getElementById('teacher-history-content');
            content.innerHTML = messages.map(m => `
                <div class="message ${m.role}" style="margin-bottom: 1rem; opacity: 0.9">
                    <small style="display: block; color: var(--text-muted); margin-bottom: 0.25rem">${m.user_name} (${m.role}):</small>
                    ${m.content}
                </div>
            `).join('');
        };

        fetchHistory();
        this.historyInterval = setInterval(fetchHistory, 5000);
    },

    // --- UTILS ---
    setupEventListeners() {
        // Auth Toggle
        document.getElementById('toggle-auth').onclick = () => {
            const isReg = document.getElementById('auth-title').textContent === 'Registrieren';
            this.setAuthType(isReg ? 'login' : 'register');
        };

        // Auth Submit
        document.getElementById('auth-form').onsubmit = async (e) => {
            e.preventDefault();
            const type = document.getElementById('auth-title').textContent === 'Registrieren' ? 'register' : 'login';
            const email = document.getElementById('auth-email').value;
            const password = document.getElementById('auth-password').value;
            const name = document.getElementById('auth-name').value;

            const url = type === 'register' ? '/api/auth/register' : '/api/auth/login';
            const body = type === 'register' ? { name, email, password } : { email, password };

            try {
                const resp = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const data = await resp.json();
                if (data.token) {
                    this.token = data.token;
                    localStorage.setItem('lerndex_token', this.token);
                    await this.onLoginSuccess();
                } else {
                    alert(data.error || 'Fehler beim Login');
                }
            } catch (err) {
                alert('Server-Fehler');
            }
        };

        // Logout
        document.getElementById('logout-btn').onclick = () => this.logout();

        // Nav
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.onclick = () => {
                const viewId = btn.dataset.view;
                if (!viewId) return;
                if (viewId === 'teacher') this.initTeacherView();
                this.navigate(viewId);
            };
        });

        // Search & Filter
        document.getElementById('topic-search').oninput = () => this.renderTopics();
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.renderTopics();
            };
        });
    },

    setAuthType(type) {
        const title = document.getElementById('auth-title');
        const subtitle = document.getElementById('auth-subtitle');
        const nameInput = document.getElementById('auth-name');
        const submitBtn = document.getElementById('auth-submit');
        const toggleBtn = document.getElementById('toggle-auth');

        if (type === 'register') {
            title.textContent = 'Registrieren';
            subtitle.textContent = 'Erstelle ein kostenloses Konto.';
            nameInput.classList.remove('hidden');
            submitBtn.textContent = 'Registrieren';
            toggleBtn.textContent = 'Bereits ein Konto? Anmelden';
        } else {
            title.textContent = 'Anmelden';
            subtitle.textContent = 'Willkommen zurück bei Lerndex.';
            nameInput.classList.add('hidden');
            submitBtn.textContent = 'Anmelden';
            toggleBtn.textContent = 'Noch kein Konto? Registrieren';
        }
    },

    showToast(msg) {
        const t = document.getElementById('toast');
        t.textContent = msg;
        t.classList.remove('hidden');
        setTimeout(() => t.classList.add('hidden'), 3000);
    }
};

app.init();
