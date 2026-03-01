// assets/js/admin.js
(function () {
  "use strict";

  const el = (id) => document.getElementById(id);

  // ---------- helpers ----------
  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  }

  function apiUrl(path) {
    // Builds BASE + /api/v1 + path
    return window.APP_CONFIG?.utils?.apiUrl?.(path) || path;
  }

  function tokenExists() {
    const token =
      window.http?.getToken?.() ||
      window.APP_CONFIG?.utils?.getAccessToken?.() ||
      localStorage.getItem("jh_access_token");
    return !!token;
  }

  function getErr(err) {
    // backend: { error: { message } } :contentReference[oaicite:2]{index=2}
    return (
      err?.payload?.error?.message ||
      err?.payload?.message ||
      err?.message ||
      "Request failed"
    );
  }

  function badgeStatus(status) {
    const st = String(status || "").toLowerCase();
    if (st === "active") return `<span class="badge badge-active"><span class="badge-dot"></span>active</span>`;
    if (st === "pending") return `<span class="badge badge-pending"><span class="badge-dot"></span>pending</span>`;
    if (st === "rejected") return `<span class="badge badge-rejected"><span class="badge-dot"></span>rejected</span>`;
    if (st === "suspended") return `<span class="badge badge-suspended"><span class="badge-dot"></span>suspended</span>`;
    return `<span class="badge badge-rejected"><span class="badge-dot"></span>${escapeHtml(st || "unknown")}</span>`;
  }

  function badgeApproval(approval) {
    const st = String(approval || "").toLowerCase();
    if (st === "approved") return `<span class="badge badge-approved"><span class="badge-dot"></span>approved</span>`;
    if (st === "pending") return `<span class="badge badge-pending"><span class="badge-dot"></span>pending</span>`;
    if (st === "rejected") return `<span class="badge badge-rejected"><span class="badge-dot"></span>rejected</span>`;
    return `<span class="badge badge-rejected"><span class="badge-dot"></span>${escapeHtml(st || "unknown")}</span>`;
  }

  function ensureAuthOrExplain(tbodyId) {
    if (tokenExists()) return true;

    const tb = el(tbodyId);
    if (tb) {
      tb.innerHTML = `
        <tr>
          <td class="px-6 py-4 text-slate-500" colspan="5">
            <b>No admin token found.</b> Login as ADMIN first, then refresh this page.
            <div class="text-xs text-slate-400 mt-1">
              Expected localStorage key: <code>jh_access_token</code>
            </div>
          </td>
        </tr>`;
    }
    return false;
  }

  async function apiGet(path) {
    return await window.http.get(apiUrl(path));
  }
  async function apiPatch(path, body) {
    return await window.http.patch(apiUrl(path), body || {});
  }
  async function apiPost(path, body) {
    return await window.http.post(apiUrl(path), body || {});
  }

  // ---------- USERS ----------
  function renderUsers(users) {
    const tbody = el("usersTbody");
    if (!tbody) return;

    if (!users || !users.length) {
      tbody.innerHTML = `
        <tr><td class="px-6 py-4 text-slate-500" colspan="5">No matching users found.</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map((u) => {
      const name = escapeHtml(u.name || "—");
      const email = escapeHtml(u.email || "—");
      const phone = escapeHtml(u.phone || "—");
      const role = escapeHtml(u.role || "—");
      const created = formatDate(u.created_at);

      return `
        <tr class="hover:bg-slate-50 transition">
          <td class="px-6 py-4">
            <div class="font-extrabold text-slate-900">${name}</div>
            <div class="text-xs text-slate-500">${email}</div>
            <div class="text-xs text-slate-400">${phone}</div>
          </td>
          <td class="px-6 py-4">
            <span class="text-xs font-black uppercase tracking-wider text-slate-700">${role}</span>
          </td>
          <td class="px-6 py-4">${badgeStatus(u.status)}</td>
          <td class="px-6 py-4 text-xs text-slate-500">${created}</td>
          <td class="px-6 py-4 text-right whitespace-nowrap">
            <button class="btn btn-blue" data-action="user-approve" data-id="${u.id}">Approve</button>
            <button class="btn btn-ghost" data-action="user-reject" data-id="${u.id}">Reject</button>
          </td>
        </tr>`;
    }).join("");
  }

  async function loadUsers(opts = {}) {
    if (!ensureAuthOrExplain("usersTbody")) return;

    const status = String(opts.status ?? el("userFilterStatus")?.value ?? "pending").trim() || "pending";
    const role = String(opts.role ?? el("userFilterRole")?.value ?? "").trim();
    const q = String(opts.q ?? el("userSearch")?.value ?? "").trim().toLowerCase();

    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    if (role) qs.set("role", role);

    // GET /api/v1/admin/users :contentReference[oaicite:3]{index=3}
    const res = await apiGet(`/admin/users?${qs.toString()}`);
    const users = res?.data?.users || []; // {data:{users}} :contentReference[oaicite:4]{index=4}

    // default: show approvals-needed roles
    let filtered = users;
    if (!role && status.toLowerCase() === "pending") {
      filtered = users.filter(u => ["broker","owner","photographer"].includes(String(u.role).toLowerCase()));
    }
    if (q) {
      filtered = filtered.filter(u => (`${u.name||""} ${u.email||""} ${u.phone||""} ${u.role||""}`).toLowerCase().includes(q));
    }

    renderUsers(filtered);

    if (el("kpiPendingUsers") && status.toLowerCase() === "pending") el("kpiPendingUsers").textContent = String(filtered.length);
    if (el("usersMeta")) el("usersMeta").textContent = `${filtered.length} shown`;
  }

  async function approveUser(id) {
    await apiPatch(`/admin/users/${id}/approve`);
    await loadUsers({});
  }

  async function rejectUser(id) {
    const reason = prompt("Reason for rejection (required):");
    if (!reason || reason.trim().length < 3) return alert("Rejection reason must be at least 3 characters.");
    await apiPatch(`/admin/users/${id}/reject`, { reason: reason.trim() });
    await loadUsers({});
  }

  function wireUsersTable() {
    const tbody = el("usersTbody");
    if (!tbody) return;
    tbody.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const id = Number(btn.dataset.id);
      const action = btn.dataset.action;

      btn.disabled = true;
      try {
        if (action === "user-approve") await approveUser(id);
        if (action === "user-reject") await rejectUser(id);
      } catch (err) {
        alert(getErr(err));
      } finally {
        btn.disabled = false;
      }
    });
  }

  // ---------- PROPERTIES ----------
  function renderProperties(items) {
    const tbody = el("propertiesTbody");
    if (!tbody) return;

    if (!items || !items.length) {
      tbody.innerHTML = `<tr><td class="px-6 py-4 text-slate-500" colspan="5">No listings found.</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map((p) => {
      const title = escapeHtml(p.title || "—");
      const location = escapeHtml(p.location || "—");
      const price = p.price != null ? escapeHtml(p.price) : "—";
      const approval = badgeApproval(p.approval_status);
      const created = formatDate(p.created_at);

      return `
        <tr class="hover:bg-slate-50 transition">
          <td class="px-6 py-4">
            <div class="font-extrabold text-slate-900">${title}</div>
            <div class="text-xs text-slate-500">${location}</div>
            <div class="text-xs text-slate-400">${created}</div>
          </td>
          <td class="px-6 py-4 text-slate-400">—</td>
          <td class="px-6 py-4">${approval}</td>
          <td class="px-6 py-4 font-bold">${price}</td>
          <td class="px-6 py-4 text-right whitespace-nowrap">
            <button class="btn btn-blue" data-action="prop-approve" data-id="${p.id}">Approve</button>
            <button class="btn btn-ghost" data-action="prop-reject" data-id="${p.id}">Reject</button>
          </td>
        </tr>`;
    }).join("");
  }

  function mapPropFilterToApprovalStatus(v) {
    const x = String(v || "").toLowerCase();
    if (x === "pending") return "pending";
    if (x === "rejected") return "rejected";
    if (x === "active") return "approved"; // UI "active" == approved
    return ""; // all / unsupported
  }

  async function loadProperties(opts = {}) {
    if (!ensureAuthOrExplain("propertiesTbody")) return;

    const raw = opts.status ?? el("propFilterStatus")?.value ?? "";
    const approval_status = mapPropFilterToApprovalStatus(raw);
    const q = String(opts.q ?? el("propSearch")?.value ?? "").trim().toLowerCase();

    const qs = new URLSearchParams();
    if (approval_status) qs.set("approval_status", approval_status);

    // GET /api/v1/admin/properties :contentReference[oaicite:5]{index=5}
    const res = await apiGet(`/admin/properties?${qs.toString()}`);
    let props = res?.data?.properties || [];

    if (q) {
      props = props.filter(p => (`${p.title||""} ${p.location||""} ${p.type||""}`).toLowerCase().includes(q));
    }

    renderProperties(props);

    // KPIs
    if (el("kpiPendingListings")) {
      const pendingCount = approval_status === "pending"
        ? props.length
        : (await apiGet(`/admin/properties?approval_status=pending`))?.data?.properties?.length || 0;
      el("kpiPendingListings").textContent = String(pendingCount);
    }
    if (el("propertiesMeta")) el("propertiesMeta").textContent = `${props.length} shown`;
  }

  async function approveProperty(id) {
    await apiPatch(`/admin/properties/${id}/approve`);
    await loadProperties({});
  }

  async function rejectProperty(id) {
    const reason = prompt("Reason for rejection (required):");
    if (!reason || reason.trim().length < 3) return alert("Rejection reason must be at least 3 characters.");
    await apiPatch(`/admin/properties/${id}/reject`, { reason: reason.trim() });
    await loadProperties({});
  }

  function wirePropertiesTable() {
    const tbody = el("propertiesTbody");
    if (!tbody) return;
    tbody.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const id = Number(btn.dataset.id);
      const action = btn.dataset.action;

      btn.disabled = true;
      try {
        if (action === "prop-approve") await approveProperty(id);
        if (action === "prop-reject") await rejectProperty(id);
      } catch (err) {
        alert(getErr(err));
      } finally {
        btn.disabled = false;
      }
    });
  }

  // ---------- AUDIT LOGS ----------
  function renderAudit(logs) {
    const tbody = el("auditTbody");
    if (!tbody) return;

    if (!logs || !logs.length) {
      tbody.innerHTML = `<tr><td class="px-6 py-4 text-slate-500" colspan="5">No audit entries found.</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map((l) => {
      const ts = formatDate(l.created_at);
      const actor = escapeHtml(l.actor_id);
      const action = escapeHtml(l.action);
      const target = `${escapeHtml(l.entity_type)} #${escapeHtml(l.entity_id)}`;
      const meta = escapeHtml(l.meta_json || "");
      return `
        <tr class="hover:bg-slate-50 transition">
          <td class="px-6 py-4 text-xs text-slate-500">${ts}</td>
          <td class="px-6 py-4 font-bold">${actor}</td>
          <td class="px-6 py-4 font-extrabold">${action}</td>
          <td class="px-6 py-4 text-slate-700">${target}</td>
          <td class="px-6 py-4 text-xs text-slate-500">${meta || "—"}</td>
        </tr>`;
    }).join("");
  }

  async function loadAudit(opts = {}) {
    if (!ensureAuthOrExplain("auditTbody")) return;

    const q = String(opts.q ?? el("auditSearch")?.value ?? "").trim().toLowerCase();

    // GET /api/v1/admin/audit-logs :contentReference[oaicite:6]{index=6}
    const res = await apiGet(`/admin/audit-logs`);
    let logs = res?.data?.logs || [];

    if (q) {
      logs = logs.filter(l => (`${l.action||""} ${l.entity_type||""} ${l.entity_id||""} ${l.actor_id||""} ${l.meta_json||""}`).toLowerCase().includes(q));
    }

    renderAudit(logs);
    if (el("auditMeta")) el("auditMeta").textContent = `${logs.length} shown`;
  }

  // ---------- CONTENT (Announcements only, because backend only has create) ----------
  async function createAnnouncement() {
    if (!tokenExists()) return alert("Login as admin first.");

    const title = prompt("Announcement title:");
    if (!title || title.trim().length < 3) return alert("Title must be at least 3 characters.");

    const message = prompt("Announcement message:");
    if (!message || message.trim().length < 5) return alert("Message must be at least 5 characters.");

    const audienceRaw = prompt('Audience (comma-separated): all, customer, broker, owner, photographer', "all");
    const audience = String(audienceRaw || "all")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    // POST /api/v1/admin/announcements :contentReference[oaicite:7]{index=7}
    await apiPost(`/admin/announcements`, { title: title.trim(), message: message.trim(), audience });

    alert("Announcement created!");
    // You can view it indirectly in Audit Log (ANNOUNCEMENT_CREATED)
    await loadAudit({});
  }

  function loadContent() {
    const tbody = el("contentTbody");
    if (!tbody) return;
    tbody.innerHTML = `
      <tr>
        <td class="px-6 py-4 text-slate-500" colspan="4">
          Content listing is not implemented in the backend yet.
          <div class="text-xs text-slate-400 mt-1">
            Currently supported: <b>Create Announcement</b> (button “New Content”).
          </div>
        </td>
      </tr>`;
    if (el("contentMeta")) el("contentMeta").textContent = "Backend: create announcements only";
  }

  // ---------- SETTINGS ----------
  function saveSettings(settings) {
    // No backend endpoint yet, so we store locally for now
    localStorage.setItem("jh_admin_settings", JSON.stringify(settings || {}));
    alert("Settings saved locally (backend endpoint not implemented yet).");
  }

  // ---------- KPIs ----------
  async function loadPendingCounts() {
    try {
      const u = await apiGet(`/admin/users?status=pending`);
      const pendingUsers = (u?.data?.users || []).filter(x => ["broker","owner","photographer"].includes(String(x.role).toLowerCase()));
      if (el("kpiPendingUsers")) el("kpiPendingUsers").textContent = String(pendingUsers.length);

      const p = await apiGet(`/admin/properties?approval_status=pending`);
      if (el("kpiPendingListings")) el("kpiPendingListings").textContent = String((p?.data?.properties || []).length);
    } catch {
      // ignore
    }
  }

  async function loadBadges() {
    try {
      const u = await apiGet(`/admin/users`);
      if (el("kpiTotalUsers")) el("kpiTotalUsers").textContent = String((u?.data?.users || []).length);

      const approved = await apiGet(`/admin/properties?approval_status=approved`);
      if (el("kpiActiveListings")) el("kpiActiveListings").textContent = String((approved?.data?.properties || []).length);
    } catch {
      // ignore
    }
  }

  function wireTables() {
    wireUsersTable();
    wirePropertiesTable();
  }

  // ---------- expose ----------
  window.Admin = window.Admin || {};
  window.Admin.wireComingSoon = window.Admin.wireComingSoon || function () {};

  window.Admin.loadUsers = loadUsers;
  window.Admin.loadProperties = loadProperties;
  window.Admin.loadAudit = loadAudit;
  window.Admin.loadContent = loadContent;
  window.Admin.saveSettings = saveSettings;

  window.Admin.loadBadges = loadBadges;
  window.Admin.loadPendingCounts = loadPendingCounts;

  // Optional helpers
  window.Admin.createAnnouncement = createAnnouncement;

  document.addEventListener("DOMContentLoaded", () => {
    wireTables();

    // Default: show pending approvals immediately
    if (el("userFilterStatus") && !el("userFilterStatus").value) el("userFilterStatus").value = "pending";

    // Auto-load sections
    loadUsers({ status: "pending" }).catch(() => {});
    loadBadges().catch(() => {});
    loadPendingCounts().catch(() => {});
  });

})();

