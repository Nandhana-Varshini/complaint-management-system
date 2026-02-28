// ─── Admin Dashboard Logic ───

let allComplaints = [];
let staffList = [];
let activeComplaintId = null;
let _searchQuery = "";

document.addEventListener("DOMContentLoaded", async () => {
  const user = getUser();
  if (!user || user.role !== "admin") { window.location.href = "admin-login.html"; return; }

  document.querySelectorAll(".user-name").forEach(el => el.textContent = user.name);

  setupNavigation();
  setupHamburger();
  setupLogout();
  setupSearch();
  await loadStaff();
  loadSection("dashboard");
});

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
    dashboard: ["Dashboard", "Overview of all campus complaints"],
    complaints: ["All Complaints", "Select a row to view and manage a complaint"],
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
  if (section === "dashboard") loadDashboard();
  if (section === "complaints") loadComplaints();
}

// ── Dashboard Stats ──────────────────────────────────────
async function loadDashboard() {
  try {
    const stats = await apiFetch("/api/admin/stats");
    document.getElementById("stat-total").textContent = stats.total;
    document.getElementById("stat-pending").textContent = stats.pending;
    document.getElementById("stat-inprogress").textContent = stats.in_progress;
    document.getElementById("stat-resolved").textContent = stats.resolved;

    const catDiv = document.getElementById("category-breakdown");
    const entries = Object.entries(stats.by_category);
    if (!entries.length) { catDiv.innerHTML = "<p style='color:var(--text-muted);font-size:.85rem;'>No data available.</p>"; return; }
    const max = Math.max(...entries.map(e => e[1]));
    catDiv.innerHTML = entries.map(([cat, count]) => `
      <div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:.825rem;">
          <span>${cat}</span><strong>${count}</strong>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${(count / max) * 100}%;background:var(--primary);"></div>
        </div>
      </div>
    `).join("");
  } catch (e) {
    showToast("Failed to load statistics: " + e.message, "error");
  }
}

// ── Complaints Table ─────────────────────────────────────
async function loadComplaints() {
  const tbody = document.getElementById("complaints-tbody");
  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:30px;"><div class="spinner" style="margin:0 auto;"></div></td></tr>`;
  try {
    allComplaints = await apiFetch("/api/complaints");
    renderComplaintsTable(allComplaints);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="8" class="no-data"><p>${e.message}</p></td></tr>`;
  }
}

function renderComplaintsTable(complaints) {
  const tbody = document.getElementById("complaints-tbody");
  // Apply client-side search
  let list = complaints;
  if (_searchQuery) {
    const q = _searchQuery.toLowerCase();
    list = complaints.filter(c =>
      c.ticket_id.toLowerCase().includes(q) ||
      c.student_name.toLowerCase().includes(q) ||
      c.student_email.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    );
  }
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="no-data"><p>No complaints found.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(c => `
    <tr class="clickable-row" onclick="openComplaintModal(${c.id})">
      <td><code style="font-size:.75rem;color:var(--primary-dark);font-family:monospace;">${c.ticket_id}</code></td>
      <td>
        <div style="font-weight:600;font-size:.875rem;">${c.student_name}</div>
        <div style="font-size:.75rem;color:var(--text-muted);">${c.student_email}</div>
      </td>
      <td>${c.category}</td>
      <td><span class="meta-chip">${c.building} &middot; Room ${c.room_number}</span></td>
      <td>${statusBadge(c.status)}</td>
      <td style="font-size:.825rem;">${c.assigned_to || '<span style="color:var(--text-muted)">Unassigned</span>'}</td>
      <td style="font-size:.75rem;color:var(--text-muted);">${formatDate(c.created_at)}</td>
    </tr>
  `).join("");
}

// ── Filters & Search ─────────────────────────────────────
function applyFilters() {
  const cat = document.getElementById("filter-category").value;
  const status = document.getElementById("filter-status").value;
  let filtered = allComplaints;
  if (cat) filtered = filtered.filter(c => c.category === cat);
  if (status) filtered = filtered.filter(c => c.status === status);
  renderComplaintsTable(filtered);
}

function setupSearch() {
  const input = document.getElementById("search-input");
  input?.addEventListener("input", () => {
    _searchQuery = input.value.trim();
    applyFilters();
  });
}

document.getElementById("filter-category")?.addEventListener("change", applyFilters);
document.getElementById("filter-status")?.addEventListener("change", applyFilters);
document.getElementById("clear-filters")?.addEventListener("click", () => {
  document.getElementById("filter-category").value = "";
  document.getElementById("filter-status").value = "";
  const inp = document.getElementById("search-input");
  if (inp) inp.value = "";
  _searchQuery = "";
  renderComplaintsTable(allComplaints);
});

// ── Complaint Modal ──────────────────────────────────────
async function openComplaintModal(id) {
  activeComplaintId = id;
  const overlay = document.getElementById("complaint-modal");
  const body = document.getElementById("modal-body");
  overlay.classList.add("open");
  body.innerHTML = '<div class="spinner"></div>';
  try {
    const c = await apiFetch(`/api/complaints/${id}`);
    renderComplaintModal(c);
  } catch (e) {
    body.innerHTML = `<div class="no-data"><p>${e.message}</p></div>`;
  }
}

function renderComplaintModal(c) {
  const body = document.getElementById("modal-body");
  const staffOptions = staffList.map(s => `<option value="${s}" ${c.assigned_to === s ? "selected" : ""}>${s}</option>`).join("");

  body.innerHTML = `
    <div class="modal-section">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <div class="complaint-cat-tag" style="width:52px;height:52px;border-radius:12px;font-size:.8rem;flex-shrink:0;">
          ${c.category.split(" ").map(w => w[0]).join("")}
        </div>
        <div>
          <h3>${c.category}</h3>
          <p style="color:var(--text-muted);font-size:.78rem;">
            <span style="font-family:monospace;background:var(--bg);padding:2px 8px;border-radius:4px;">${c.ticket_id}</span>
            &nbsp;&middot;&nbsp;Submitted by ${c.student_name} &middot; ${formatDate(c.created_at)}
          </p>
        </div>
        <div style="margin-left:auto;">${statusBadge(c.status)}</div>
      </div>
      <div class="detail-grid">
        <div class="detail-item"><div class="label">Building</div><div class="value">${c.building}</div></div>
        <div class="detail-item"><div class="label">Room</div><div class="value">${c.room_number}</div></div>
        <div class="detail-item"><div class="label">Student Email</div><div class="value">${c.student_email}</div></div>
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
        <img src="http://127.0.0.1:8000${c.image_url}" style="border-radius:var(--radius-sm);max-height:220px;object-fit:cover;width:100%;" />
      </div>` : ""}

    <div class="modal-section">
      <h4>Admin Actions</h4>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
        <div class="form-group" style="margin:0;">
          <label class="form-label">Update Status</label>
          <select id="action-status" class="form-control">
            <option value="Pending" ${c.status === "Pending" ? "selected" : ""}>Pending</option>
            <option value="In Progress" ${c.status === "In Progress" ? "selected" : ""}>In Progress</option>
            <option value="Resolved" ${c.status === "Resolved" ? "selected" : ""}>Resolved</option>
          </select>
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label">Assign To</label>
          <select id="action-assign" class="form-control">
            <option value="">-- Select Staff Member --</option>
            ${staffOptions}
          </select>
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:14px;">
        <button class="btn btn-primary btn-sm" onclick="saveActions()">Save Changes</button>
      </div>
    </div>

    <div class="modal-section">
      <h4>Comments (${c.comments.length})</h4>
      <div class="comments-list" id="comments-list">
        ${c.comments.length ? c.comments.map(cm => `
          <div class="comment-item">
            <div class="comment-meta">${cm.author} &middot; ${formatDate(cm.created_at)}</div>
            <div class="comment-text">${cm.text}</div>
          </div>
        `).join("") : '<p style="color:var(--text-muted);font-size:.85rem;margin-bottom:12px;">No comments yet.</p>'}
      </div>
      <div style="display:flex;gap:10px;margin-top:12px;">
        <input id="comment-input" class="form-control" placeholder="Add a comment..." style="flex:1;" />
        <button class="btn btn-secondary btn-sm" onclick="postComment()">Post</button>
      </div>
    </div>
  `;
}

async function saveActions() {
  const statusEl = document.getElementById("action-status");
  const assignEl = document.getElementById("action-assign");
  if (!statusEl) { showToast("Modal not ready. Please try again.", "error"); return; }

  const status = statusEl.value;
  const assignTo = assignEl ? assignEl.value : "";

  try {
    // Status update via JSON
    await apiFetch(`/api/complaints/${activeComplaintId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: status })
    });

    // Assign via JSON (only if selected)
    if (assignTo) {
      await apiFetch(`/api/complaints/${activeComplaintId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigned_to: assignTo })
      });
    }

    showToast("Complaint updated successfully.");
    await loadComplaints();
    await loadDashboard();
    openComplaintModal(activeComplaintId);
  } catch (e) {
    showToast(e.message, "error");
  }
}

async function postComment() {
  const input = document.getElementById("comment-input");
  const text = input.value.trim();
  if (!text) return;
  try {
    const updated = await apiFetch(`/api/complaints/${activeComplaintId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    input.value = "";
    renderComplaintModal(updated);
    showToast("Comment added.");
  } catch (e) {
    showToast(e.message, "error");
  }
}

document.getElementById("modal-close")?.addEventListener("click", () => {
  document.getElementById("complaint-modal").classList.remove("open");
});
document.getElementById("complaint-modal")?.addEventListener("click", e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove("open");
});

// ── Staff / Logout / Hamburger ───────────────────────────
async function loadStaff() {
  try {
    const data = await apiFetch("/api/admin/staff");
    staffList = data.staff;
  } catch (_) { staffList = []; }
}

function setupLogout() {
  document.getElementById("logout-btn")?.addEventListener("click", () => {
    clearAuth(); window.location.href = "index.html";
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
