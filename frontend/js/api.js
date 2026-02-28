// ─── API utility — fetch wrapper, auth helpers, toasts, badges ───

const API_BASE = "http://127.0.0.1:8000";

function getToken() { return localStorage.getItem("scms_token"); }
function getUser() {
    try { return JSON.parse(localStorage.getItem("scms_user")); }
    catch { return null; }
}
function setAuth(token, user) {
    localStorage.setItem("scms_token", token);
    localStorage.setItem("scms_user", JSON.stringify(user));
}
function clearAuth() {
    localStorage.removeItem("scms_token");
    localStorage.removeItem("scms_user");
}

async function apiFetch(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;

    // Only set JSON Content-Type for requests that have a body and aren't FormData
    if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }

    let res;
    try {
        res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    } catch (networkErr) {
        throw new Error("Cannot reach server. Is the backend running?");
    }

    if (res.status === 401) {
        clearAuth();
        // Redirect to appropriate login page based on URL context
        const dest = window.location.pathname.includes("admin") ? "/app/admin-login.html" : "/app/student-auth.html";
        window.location.href = dest;
        return;
    }

    if (res.status === 403) {
        throw new Error("You do not have permission to perform this action.");
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || `Server error (${res.status}). Please try again.`);
    return data;
}

// ── Date formatting ──────────────────────────────────────
function formatDate(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-GB", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

// ── Status badge ─────────────────────────────────────────
function statusBadge(status) {
    const map = {
        "Pending": "badge-pending",
        "In Progress": "badge-inprogress",
        "Resolved": "badge-resolved",
    };
    return `<span class="badge ${map[status] || ''}">${status}</span>`;
}

// ── Toast notifications ──────────────────────────────────
function showToast(message, type = "success") {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ── Campus buildings list ────────────────────────────────
const CAMPUS_BUILDINGS = [
    "Xavier Block",
    "Alphonso Block",
    "Administration Block",
    "Canteen",
    "Hostel",
];
