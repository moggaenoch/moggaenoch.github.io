// assets/js/admin.js
(function () {
  "use strict";

  const el = (id) => document.getElementById(id);

  const BASE = window.APP_CONFIG?.API_BASE_URL || "https://juba-homez-backend.onrender.com";
  const apiUrl = (path) =>
    window.APP_CONFIG?.utils?.apiUrl
      ? window.APP_CONFIG.utils.apiUrl(path)
      : `${BASE}/api/v1${path}`;

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function rowMessage(tbodyId, msg, isError = false, colspan = 5) {
    const tb = el(tbodyId);
    if (!tb) return;
    tb.innerHTML = `
      <tr>
        <td class="px-6 py-4 ${isError ? "text-red-600" : "text-slate-500"} font-bold" colspan="${colspan}">
          ${escapeHtml(msg)}
        </td>
      </tr>`;
  }

  async function request(method, path, body) {
    const token = localStorage.getItem("jh_access_token");
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(apiUrl(path), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}

    if (!res.ok) {
      const msg = json?.error?.message || json?.message || `${res.status} ${res.statusText}`;
      const err = new Error(msg);
      err.status = res.status;
      err.payload = json;
      throw err;
    }

    return json;
  }

  function renderUsers(users) {
    const tbody = el("usersTbody");
    if (!tbody) return;

    if (!users || !users.length) {
      rowMessage("usersTbody", "No pending users found.", false, 5);
      return;
    }

    tbody.innerHTML = users
      .map((u) => {
        const name = escapeHtml(u.name || "—");
        const email = escapeHtml(u.email || "—");
        const phone = escapeHtml(u.phone || "—");
        const role = escapeHtml(u.role || "—");
        const status = escapeHtml(u.status || "—");
        const created = escapeHtml(u.created_at || "—");

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
            <td class="px-6 py-4 text-sm font-bold text-slate-700">${status}</td>
            <td class="px-6 py-4 text-xs text-slate-500">${created}</td>
            <td class="px-6 py-4 text-right whitespace-nowrap">
              <button class="btn btn-blue" data-action="approve" data-id="${u.id}">Approve</button>
              <button class="btn btn-ghost" data-action="reject" data-id="${u.id}">Reject</button>
              <button class="btn btn-red" data-action="delete" data-id="${u.id}">Delete</button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  async function loadUsers(opts = {}) {
    const token = localStorage.getItem("jh_access_token");
    if (!token) {
      rowMessage("usersTbody", "No admin token found. Login as admin first (jh_access_token missing).", true, 5);
      return;
    }

    const status = (opts.status ?? el("userFilterStatus")?.value ?? "pending").toString().trim() || "pending";
    const role = (opts.role ?? el("userFilterRole")?.value ?? "").toString().trim();

    const qs = new URLSearchParams();
    qs.set("status", status);
    if (role) qs.set("role", role);

    try {
      const res = await request("GET", `/admin/users?${qs.toString()}`);
      const users = res?.data?.users || [];

      // Default show only broker/owner/photographer needing approval
      const filtered =
        role || status.toLowerCase() !== "pending"
          ? users
          : users.filter((u) => ["broker", "owner", "photographer"].includes(String(u.role).toLowerCase()));

      renderUsers(filtered);

      if (el("kpiPendingUsers") && status.toLowerCase() === "pending") {
        el("kpiPendingUsers").textContent = String(filtered.length);
      }
      if (el("usersMeta")) el("usersMeta").textContent = `${filtered.length} shown`;
    } catch (err) {
      if (err.status === 401) {
        rowMessage("usersTbody", "401 Unauthorized: token missing/expired. Login again and refresh.", true, 5);
      } else if (err.status === 403) {
        rowMessage("usersTbody", "403 Forbidden: you are not an admin. Login with an admin account.", true, 5);
      } else {
        rowMessage("usersTbody", `Failed to load users: ${err.message}`, true, 5);
      }
    }
  }

  async function approveUser(id) {
    await request("PATCH", `/admin/users/${id}/approve`);
    await loadUsers({ status: "pending" });
  }

  async function rejectUser(id) {
    const reason = prompt("Reason for rejection (required):");
    if (!reason || reason.trim().length < 3) return alert("Reason must be at least 3 characters.");
    await request("PATCH", `/admin/users/${id}/reject`, { reason: reason.trim() });
    await loadUsers({ status: "pending" });
  }

  async function deleteUser(id) {
    // NOTE: your current backend might NOT have DELETE endpoint yet.
    // If it returns 404, you need to add the backend route.
    if (!confirm("Delete this user?")) return;
    try {
      await request("DELETE", `/admin/users/${id}`);
      await loadUsers({ status: "pending" });
    } catch (err) {
      alert(`Delete failed: ${err.message}\nIf you see 404, the backend delete endpoint is not implemented yet.`);
    }
  }

  function wireUserActions() {
    const tbody = el("usersTbody");
    if (!tbody) return;

    tbody.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;

      const action = btn.dataset.action;
      const id = Number(btn.dataset.id);
      if (!id) return;

      btn.disabled = true;
      try {
        if (action === "approve") await approveUser(id);
        if (action === "reject") await rejectUser(id);
        if (action === "delete") await deleteUser(id);
      } finally {
        btn.disabled = false;
      }
    });
  }

  // Expose to your HTML button wiring
  window.Admin = window.Admin || {};
  window.Admin.loadUsers = loadUsers;

  document.addEventListener("DOMContentLoaded", () => {
    wireUserActions();

    // Load button
    el("btnLoadUsers")?.addEventListener("click", () => loadUsers({}));

    // Auto load pending approvals
    loadUsers({ status: "pending" });
  });
})();


