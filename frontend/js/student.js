// ─── Student Dashboard Logic ───

let _allComplaints = [];  // cache for client-side filtering
let _statusFilter = "all";

document.addEventListener("DOMContentLoaded", () => {
  const user = getUser();
  if (!user) { window.location.href = "student-auth.html"; return; }

  document.querySelectorAll(".user-name").forEach(el => el.textContent = user.name);
  document.querySelectorAll(".user-email").forEach(el => el.textContent = user.email);
  document.querySelectorAll(".user-avatar-letter").forEach(el => el.textContent = user.name[0].toUpperCase());

  setupNavigation();
  setupHamburger();
  setupLogout();
  setupNotifications();
  loadSection("my-complaints");
});

// ── Navigation ──────────────────────────────────────────
function setupNavigation() {
  document.querySelectorAll(".nav-item[data-section]").forEach(item => {
    item.addEventListener("click", () => {
      loadSection(item.dataset.section);
      closeSidebar();
    });
  });
}

function loadSection(section) {
  const titles = {
    "my-complaints": ["My Complaints", "Track the status of your submitted complaints"],
    "submit": ["Submit Complaint", "Fill in the form below to report an issue"],
  };
  const [title, sub] = titles[section] || ["Dashboard", ""];
  document.getElementById("section-title").textContent = title;
  document.getElementById("section-subtitle").textContent = sub;

  document.querySelectorAll(".section").forEach(s => s.style.display = "none");
  const el = document.getElementById(`section-${section}`);
  if (el) el.style.display = "";

  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  const nav = document.querySelector(`.nav-item[data-section="${section}"]`);
  if (nav) nav.classList.add("active");

  if (section === "my-complaints") loadMyComplaints();
  if (section === "submit") setupSubmitForm();
}

// ── Status Filter Tabs ──────────────────────────────────
function setFilter(filter) {
  _statusFilter = filter;
  document.querySelectorAll(".filter-tab").forEach(t => {
    t.classList.toggle("active", t.dataset.filter === filter);
  });
  renderComplaints(_allComplaints);
}

// ── My Complaints ───────────────────────────────────────
async function loadMyComplaints() {
  const container = document.getElementById("complaints-list");
  container.innerHTML = '<div class="spinner"></div>';
  try {
    _allComplaints = await apiFetch("/api/complaints");
    renderComplaints(_allComplaints);
  } catch (e) {
    container.innerHTML = `<div class="no-data"><p>Failed to load complaints: ${e.message}</p></div>`;
  }
}

function renderComplaints(complaints) {
  const container = document.getElementById("complaints-list");
  let list = complaints;
  if (_statusFilter !== "all") {
    list = complaints.filter(c => c.status === _statusFilter);
  }
  if (!list.length) {
    container.innerHTML = `
        <div class="no-data">
          <div class="no-data-icon" style="font-size:2rem;color:var(--text-light);">—</div>
          <h3>No complaints found</h3>
          <p>${_statusFilter === "all" ? "Submit your first complaint using the sidebar." : `No complaints with status "${_statusFilter}".`}</p>
        </div>`;
    return;
  }
  container.innerHTML = list.map(c => `
      <div class="complaint-card" onclick="showComplaintDetail(${c.id})">
        <div class="complaint-cat-tag">${c.category.split(" ").map(w => w[0]).join("")}</div>
        <div class="complaint-card-body">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <h4>${c.category}</h4>
            <span style="font-size:.72rem;color:var(--text-muted);font-family:monospace;background:var(--bg);padding:2px 7px;border-radius:4px;">${c.ticket_id}</span>
          </div>
          <p>${c.description}</p>
          ${c.admin_comment ? `<div class="admin-comment-preview">Admin: ${c.admin_comment}</div>` : ""}
          <div class="complaint-card-meta">
            <span class="meta-chip">${c.building}</span>
            <span class="meta-chip">Room ${c.room_number}</span>
          </div>
        </div>
        <div class="complaint-card-right">
          ${statusBadge(c.status)}
          <div class="date">${formatDate(c.created_at)}</div>
        </div>
      </div>
    `).join("");
}

// ── Complaint Detail Modal ──────────────────────────────
async function showComplaintDetail(id) {
  const overlay = document.getElementById("complaint-modal");
  const body = document.getElementById("modal-body");
  overlay.classList.add("open");
  body.innerHTML = '<div class="spinner"></div>';

  try {
    const c = await apiFetch(`/api/complaints/${id}`);
    body.innerHTML = `
      <div class="modal-section">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
          <div class="complaint-cat-tag" style="width:48px;height:48px;border-radius:12px;font-size:.75rem;flex-shrink:0;">
            ${c.category.split(" ").map(w => w[0]).join("")}
          </div>
          <div>
            <h3>${c.category}</h3>
            <p style="color:var(--text-muted);font-size:.78rem;">
              <span style="font-family:monospace;background:var(--bg);padding:2px 8px;border-radius:4px;">${c.ticket_id}</span>
              &nbsp;&middot;&nbsp;Submitted on ${formatDate(c.created_at)}
            </p>
          </div>
          <div style="margin-left:auto;">${statusBadge(c.status)}</div>
        </div>
        <div class="detail-grid">
          <div class="detail-item"><div class="label">Building</div><div class="value">${c.building}</div></div>
          <div class="detail-item"><div class="label">Room</div><div class="value">${c.room_number}</div></div>
          <div class="detail-item"><div class="label">Assigned To</div><div class="value">${c.assigned_to || "Not yet assigned"}</div></div>
          <div class="detail-item"><div class="label">Last Updated</div><div class="value">${formatDate(c.updated_at)}</div></div>
        </div>
      </div>
      <div class="modal-section">
        <h4>Description</h4>
        <div class="complaint-description">${c.description}</div>
      </div>
      ${c.image_url ? `
        <div class="modal-section">
          <h4>Attached Image</h4>
          <img src="http://127.0.0.1:8000${c.image_url}" style="border-radius:var(--radius-sm);max-height:220px;object-fit:cover;" />
        </div>` : ""}
      <div class="modal-section">
        <h4>Admin Comments (${c.comments.length})</h4>
        ${c.comments.length ? `
          <div class="comments-list">
            ${c.comments.map(cm => `
              <div class="comment-item">
                <div class="comment-meta">${cm.author} &middot; ${formatDate(cm.created_at)}</div>
                <div class="comment-text">${cm.text}</div>
              </div>
            `).join("")}
          </div>
        ` : '<p style="color:var(--text-muted);font-size:.85rem;">No comments yet.</p>'}
      </div>
    `;
  } catch (e) {
    body.innerHTML = `<div class="no-data"><p>${e.message}</p></div>`;
  }
}

document.getElementById("modal-close")?.addEventListener("click", () => {
  document.getElementById("complaint-modal").classList.remove("open");
});
document.getElementById("complaint-modal")?.addEventListener("click", (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove("open");
});

// ── Submit Complaint Form ────────────────────────────────
function setupSubmitForm() {
  const form = document.getElementById("submit-form");
  if (!form || form.dataset.ready) return;
  form.dataset.ready = "1";

  // Populate building dropdown
  const buildingSelect = document.getElementById("building");
  if (buildingSelect) {
    buildingSelect.innerHTML = '<option value="">-- Select Building --</option>' +
      CAMPUS_BUILDINGS.map(b => `<option value="${b}">${b}</option>`).join("");
  }

  // Image preview
  const fileInput = document.getElementById("image-input");
  const preview = document.getElementById("image-preview");
  fileInput?.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = e => { preview.innerHTML = `<img src="${e.target.result}" alt="Preview" />`; };
      reader.readAsDataURL(file);
    }
  });

  const uploadArea = document.querySelector(".upload-area");
  uploadArea?.addEventListener("dragover", e => { e.preventDefault(); uploadArea.classList.add("dragover"); });
  uploadArea?.addEventListener("dragleave", () => uploadArea.classList.remove("dragover"));
  uploadArea?.addEventListener("drop", e => {
    e.preventDefault(); uploadArea.classList.remove("dragover");
    fileInput.files = e.dataTransfer.files;
    fileInput.dispatchEvent(new Event("change"));
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Submitting...";
    try {
      const fd = new FormData();
      fd.append("category", document.getElementById("category").value);
      fd.append("description", document.getElementById("description").value);
      fd.append("building", document.getElementById("building").value);
      fd.append("room_number", document.getElementById("room_number").value);
      const imgFile = document.getElementById("image-input").files[0];
      if (imgFile) fd.append("image", imgFile);

      const result = await apiFetch("/api/complaints", { method: "POST", body: fd });
      showToast(`Complaint submitted. Ticket ID: ${result.ticket_id}`);
      form.reset();
      preview.innerHTML = "";
      loadSection("my-complaints");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      btn.disabled = false; btn.textContent = "Submit Complaint";
    }
  });
}

// ── Notifications ────────────────────────────────────────
let _notifPollHandle = null;

async function setupNotifications() {
  await refreshNotifications();
  _notifPollHandle = setInterval(refreshNotifications, 30000);

  const bell = document.getElementById("notif-bell");
  const panel = document.getElementById("notif-panel");
  bell?.addEventListener("click", async () => {
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) {
      await apiFetch("/api/notifications/read-all", { method: "PATCH" });
      document.getElementById("notif-badge").style.display = "none";
      document.getElementById("notif-badge").textContent = "";
    }
  });

  document.addEventListener("click", e => {
    if (!bell?.contains(e.target) && !panel?.contains(e.target)) {
      panel?.classList.remove("open");
    }
  });
}

async function refreshNotifications() {
  try {
    const notifs = await apiFetch("/api/notifications");
    if (!notifs) return;
    const unread = notifs.filter(n => !n.is_read).length;
    const badge = document.getElementById("notif-badge");
    if (badge) {
      badge.textContent = unread > 0 ? (unread > 9 ? "9+" : unread) : "";
      badge.style.display = unread > 0 ? "flex" : "none";
    }
    renderNotifPanel(notifs);
  } catch (_) { }
}

function renderNotifPanel(notifs) {
  const list = document.getElementById("notif-list");
  if (!list) return;
  if (!notifs.length) {
    list.innerHTML = '<p style="padding:16px;color:var(--text-muted);font-size:.85rem;text-align:center;">No notifications yet.</p>';
    return;
  }
  list.innerHTML = notifs.map(n => `
        <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="showComplaintDetail(${n.complaint_id || 0})">
          <div class="notif-message">${n.message}</div>
          <div class="notif-time">${formatDate(n.created_at)}</div>
        </div>
    `).join("");
}

// ── Logout / Hamburger ───────────────────────────────────
function setupLogout() {
  document.getElementById("logout-btn")?.addEventListener("click", () => {
    clearInterval(_notifPollHandle);
    clearAuth();
    window.location.href = "index.html";
  });
}

function setupHamburger() {
  const hamburger = document.getElementById("hamburger");
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  hamburger?.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    overlay.classList.toggle("open");
  });
  overlay?.addEventListener("click", closeSidebar);
}

function closeSidebar() {
  document.querySelector(".sidebar")?.classList.remove("open");
  document.getElementById("sidebar-overlay")?.classList.remove("open");
}
