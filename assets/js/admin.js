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
    // Builds BASE + /api/v1 + path (from config.js)
    return window.APP_CONFIG?.utils?.apiUrl?.(path) || path;
  }

  function tokenExists() {
    return !!localStorage.getItem("jh_access_token");
  }

  function getErr(err) {
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

  function badgeApproval(st) {
    const s = String(st || "").toLowerCase();
    if (s === "approved") return `<span class="badge badge-approved"><span class="badge-dot"></span>approved</span>`;
    if (s === "pending") return `<span class="badge badge-pending"><span class="badge-dot"></span>pending</span>`;
    if (s === "rejected") return `<span class="badge badge-rejected"><span class="badge-dot"></span>rejected</span>`;
    return `<span class="badge badge-rejected"><span class="badge-dot"></span>${escapeHtml(s || "unknown")}</span>`;
  }

  function ensureAuthOrExplain(tbodyId, colspan = 5) {
    if (tokenExists()) return true;
    const tb = el(tbodyId);
    if (tb) {
      tb.innerHTML = `
        <tr>
          <td class="px-6 py-4 text-slate-500" colspan="${colspan}">
            <b>No admin token found.</b> Save <code>jh_access_token</code> then refresh.
          </td>
        </tr>`;
    }
    return false;
  }

  async function GET(path) {
    return await window.http.get(apiUrl(path));
  }
  async function PATCH(path, body) {
    return await window.http.patch(apiUrl(path), body || {});
  }

  // ---------- USERS ----------
  function renderUsers(users) {
    const tbody = el("usersTbody");
    if (!tbody) return;

    if (!users?.length) {
      tbody.innerHTML = `<tr><td class="px-6 py-4 text-slate-500" colspan="5">No matching users found.</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map((u) => `
      <tr class="hover:bg-slate-50 transition">
        <td class="px-6 py-4">
          <div class="font-extrabold text-slate-900">${escapeHtml(u.name || "—")}</div>
          <div class="text-xs text-slate-500">${escapeHtml(u.email || "—")}</div>
          <div class="text-xs text-slate-400">${escapeHtml(u.phone || "—")}</div>
        </td>
        <td class="px-6 py-4">
          <span class="text-xs font-black uppercase tracking-wider text-slate-700">${escapeHtml(u.role || "—")}</span>
        </td>
        <td class="px-6 py-4">${badgeStatus(u.status)}</td>
        <td class="px-6 py-4 text-xs text-slate-500">${formatDate(u.created_at)}</td>
        <td class="px-6 py-4 text-right whitespace-nowrap">
          <button class="btn btn-blue" data-action="user-approve" data-id="${u.id}">Approve</button>
          <button class="btn btn-ghost" data-action="user-reject" data-id="${u.id}">Reject</button>
        </td>
      </tr>
    `).join("");
  }

  async function loadUsers(opts = {}) {
    if (!ensureAuthOrExplain("usersTbody", 5)) return;

    const status = String(opts.status ?? el("userFilterStatus")?.value ?? "pending").trim() || "pending";
    const role = String(opts.role ?? el("userFilterRole")?.value ?? "").trim();
    const q = String(opts.q ?? el("userSearch")?.value ?? "").trim().toLowerCase();

    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    if (role) qs.set("role", role);

    const res = await GET(`/admin/users?${qs.toString()}`);
    let users = res?.data?.users || [];

    // default: show only roles that require approval
    if (!role && status.toLowerCase() === "pending") {
      users = users.filter(u => ["broker","owner","photographer"].includes(String(u.role).toLowerCase()));
    }

    if (q) {
      users = users.filter(u => (`${u.name||""} ${u.email||""} ${u.phone||""} ${u.role||""}`).toLowerCase().includes(q));
    }

    renderUsers(users);
    if (el("kpiPendingUsers") && status.toLowerCase() === "pending") el("kpiPendingUsers").textContent = String(users.length);
    if (el("usersMeta")) el("usersMeta").textContent = `${users.length} shown`;
  }

  async function approveUser(id) {
    await PATCH(`/admin/users/${id}/approve`);
    await loadUsers({});
  }

  async function rejectUser(id) {
    const reason = prompt("Reason for rejection (required):");
    if (!reason || reason.trim().length < 3) return alert("Rejection reason must be at least 3 characters.");
    await PATCH(`/admin/users/${id}/reject`, { reason: reason.trim() });
    await loadUsers({});
  }

  function wireUsersTable() {
    const tbody = el("usersTbody");
    if (!tbody) return;
    tbody.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const id = Number(btn.dataset.id);
      btn.disabled = true;
      try {
        if (btn.dataset.action === "user-approve") await approveUser(id);
        if (btn.dataset.action === "user-reject") await rejectUser(id);
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

    if (!items?.length) {
      tbody.innerHTML = `<tr><td class="px-6 py-4 text-slate-500" colspan="5">No listings found.</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map((p) => `
      <tr class="hover:bg-slate-50 transition">
        <td class="px-6 py-4">
          <div class="font-extrabold text-slate-900">${escapeHtml(p.title || "—")}</div>
          <div class="text-xs text-slate-500">${escapeHtml(p.location || "—")}</div>
          <div class="text-xs text-slate-400">${formatDate(p.created_at)}</div>
        </td>
        <td class="px-6 py-4 text-slate-500">${escapeHtml(p.type || "—")}</td>
        <td class="px-6 py-4">${badgeApproval(p.approval_status)}</td>
        <td class="px-6 py-4 font-bold">${p.price == null ? "—" : escapeHtml(p.price)}</td>
        <td class="px-6 py-4 text-right whitespace-nowrap">
          <button class="btn btn-blue" data-action="prop-approve" data-id="${p.id}">Approve</button>
          <button class="btn btn-ghost" data-action="prop-reject" data-id="${p.id}">Reject</button>
        </td>
      </tr>
    `).join("");
  }

  async function loadProperties(opts = {}) {
    if (!ensureAuthOrExplain("propertiesTbody", 5)) return;

    const raw = String(opts.status ?? el("propFilterStatus")?.value ?? "").toLowerCase();
    const q = String(opts.q ?? el("propSearch")?.value ?? "").trim().toLowerCase();

    // backend expects approval_status = pending|approved|rejected
    let approval_status = "";
    if (raw === "pending") approval_status = "pending";
    if (raw === "active") approval_status = "approved";
    if (raw === "rejected") approval_status = "rejected";

    const qs = new URLSearchParams();
    if (approval_status) qs.set("approval_status", approval_status);

    const res = await GET(`/admin/properties?${qs.toString()}`);
    let props = res?.data?.properties || [];

    if (q) {
      props = props.filter(p => (`${p.title||""} ${p.location||""} ${p.type||""}`).toLowerCase().includes(q));
    }

    renderProperties(props);
    if (el("propertiesMeta")) el("propertiesMeta").textContent = `${props.length} shown`;
  }

  async function approveProperty(id) {
    await PATCH(`/admin/properties/${id}/approve`);
    await loadProperties({});
  }

  async function rejectProperty(id) {
    const reason = prompt("Reason for rejection (required):");
    if (!reason || reason.trim().length < 3) return alert("Rejection reason must be at least 3 characters.");
    await PATCH(`/admin/properties/${id}/reject`, { reason: reason.trim() });
    await loadProperties({});
  }

  function wirePropertiesTable() {
    const tbody = el("propertiesTbody");
    if (!tbody) return;
    tbody.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const id = Number(btn.dataset.id);
      btn.disabled = true;
      try {
        if (btn.dataset.action === "prop-approve") await approveProperty(id);
        if (btn.dataset.action === "prop-reject") await rejectProperty(id);
      } catch (err) {
        alert(getErr(err));
      } finally {
        btn.disabled = false;
      }
    });
  }

  // ---------- AUDIT ----------
  function renderAudit(logs) {
    const tbody = el("auditTbody");
    if (!tbody) return;

    if (!logs?.length) {
      tbody.innerHTML = `<tr><td class="px-6 py-4 text-slate-500" colspan="5">No audit entries found.</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map((l) => `
      <tr class="hover:bg-slate-50 transition">
        <td class="px-6 py-4 text-xs text-slate-500">${formatDate(l.created_at)}</td>
        <td class="px-6 py-4 font-bold">${escapeHtml(l.actor_id)}</td>
        <td class="px-6 py-4 font-extrabold">${escapeHtml(l.action)}</td>
        <td class="px-6 py-4">${escapeHtml(l.entity_type)} #${escapeHtml(l.entity_id)}</td>
        <td class="px-6 py-4 text-xs text-slate-500">${escapeHtml(l.meta_json || "—")}</td>
      </tr>
    `).join("");
  }

  async function loadAudit(opts = {}) {
    if (!ensureAuthOrExplain("auditTbody", 5)) return;

    const q = String(opts.q ?? el("auditSearch")?.value ?? "").trim().toLowerCase();

    const res = await GET(`/admin/audit-logs`);
    let logs = res?.data?.logs || [];

    if (q) {
      logs = logs.filter(l => (`${l.action||""} ${l.entity_type||""} ${l.entity_id||""} ${l.actor_id||""} ${l.meta_json||""}`).toLowerCase().includes(q));
    }

    renderAudit(logs);
    if (el("auditMeta")) el("auditMeta").textContent = `${logs.length} shown`;
  }

  // ---------- content/settings placeholders ----------
  function loadContent() {
    const tb = el("contentTbody");
    if (tb) {
      tb.innerHTML = `<tr><td class="px-6 py-4 text-slate-500" colspan="4">Content listing not implemented yet on backend. (You can add endpoints later.)</td></tr>`;
    }
  }
  function saveSettings(settings) {
    localStorage.setItem("jh_admin_settings", JSON.stringify(settings || {}));
    alert("Settings saved locally (backend endpoint not implemented yet).");
  }

  // ---------- expose for your HTML ----------
  window.Admin = window.Admin || {};
  window.Admin.loadUsers = loadUsers;
  window.Admin.loadProperties = loadProperties;
  window.Admin.loadAudit = loadAudit;
  window.Admin.loadContent = loadContent;
  window.Admin.saveSettings = saveSettings;

  // keep compatibility with your existing calls
  window.Admin.wireComingSoon = window.Admin.wireComingSoon || function () {};
  window.Admin.loadBadges = window.Admin.loadBadges || function () {};
  window.Admin.loadPendingCounts = window.Admin.loadPendingCounts || function () {};

  document.addEventListener("DOMContentLoaded", () => {
    wireUsersTable();
    wirePropertiesTable();

    // Auto-load pending approvals
    if (el("userFilterStatus") && !el("userFilterStatus").value) el("userFilterStatus").value = "pending";
    loadUsers({ status: "pending" }).catch(() => {});
  });
})();

