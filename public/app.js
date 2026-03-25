(function () {
    const TOKEN_KEY = 'token';

    function base64UrlToBase64(value) {
        return value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
    }

    function decodeToken(token) {
        const payload = token.split('.')[1];
        if (!payload) {
            throw new Error('Token inválido');
        }
        return JSON.parse(atob(base64UrlToBase64(payload)));
    }

    function getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    function getAuth() {
        const token = getToken();
        if (!token) {
            return null;
        }
        try {
            return { token, user: decodeToken(token) };
        } catch (err) {
            return null;
        }
    }

    function requireAuth(redirectTo = '/login.html') {
        const auth = getAuth();
        if (!auth) {
            window.location.href = redirectTo;
            return null;
        }
        return auth;
    }

    function logout(redirectTo = '/index.html') {
        localStorage.removeItem(TOKEN_KEY);
        window.location.href = redirectTo;
    }

    async function apiFetch(url, options = {}) {
        const auth = getAuth();
        const headers = new Headers(options.headers || {});
        if (auth) {
            headers.set('Authorization', `Bearer ${auth.token}`);
        }
        if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }
        const response = await fetch(url, { ...options, headers });
        if (response.status === 401) {
            logout('/login.html');
            throw new Error('Sessão expirada');
        }
        return response;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatDate(value) {
        if (!value) {
            return '-';
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            const [year, month, day] = value.split('-');
            return `${day}/${month}/${year}`;
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return value;
        }
        return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(date);
    }

    function formatCurrency(value) {
        const number = Number(value || 0);
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(Number.isNaN(number) ? 0 : number);
    }

    function setCompanyContext(elements = {}) {
        const auth = getAuth();
        if (!auth) {
            return;
        }
        const user = auth.user || {};
        if (elements.user) {
            elements.user.textContent = user.nome || 'Usuário';
        }
        if (elements.company) {
            elements.company.textContent = user.empresaNome || 'Empresa';
        }
    }

    window.App = {
        apiFetch,
        decodeToken,
        escapeHtml,
        formatCurrency,
        formatDate,
        getAuth,
        getToken,
        logout,
        requireAuth,
        setCompanyContext
    };
})();
