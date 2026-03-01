// assets/js/admin.js
(function () {
  "use strict";

  const el = (id) => document.getElementById(id);

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

  function badge(status) {
    const st = String(status || "").toLowerCase();
    if (st === "active") return `<span class="badge b-active"><span class="dot"></span>active</span>`;
    if (st === "pending") return `<span class="badge b-pending"><span class="dot"></span>pending</span>`;
    if (st === "suspended") return `<span class="badge b-suspended"><span class="dot"></span>suspended</span>`;
    return `<span class="badge" style="background:#f1f5f9;color:#334155"><span class="dot" style="background:#94a3b8"></span>${escapeHtml(st || "unknown")}</span>`;
  }

  function ensureAuthOrExplain(tbodyId) {
    const token = window.http?.getToken?.() || window.APP_CONFIG?.utils?.getAccessToken?.();
    if (token) return true;

    const tb = el(tbodyId);
    if (tb) {
      tb.innerHTML = `
        <tr>
          <td class="px-6 py-4 text-slate-500" colspan="5">
            No admin token found. Please <b>login as ADMIN</b> first so we can load approvals.
            <div class="text-xs text-slate-400 mt-1">
              Expected localStorage key: <code>jh_access_token</code>
            </div>
          </td>
        </tr>`;
    }
    return false;
  }

  async function apiGet(path) {
    return await window.http.get(path);
  }
  async function apiPatch(path, body) {
    return await window.http.patch(path, body || {});
  }

  function renderUsers(users) {
    const tbody = el("usersTbody") || el("usersTableBody");
    if (!tbody) return;

    if (!users || !users.length) {
      tbody.innerHTML = `
        <tr>
          <td class="px-6 py-4 text-slate-500" colspan="5">
            No pending users found.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = users
      .map((u) => {
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

            <td class="px-6 py-4">${badge(u.status)}</td>

            <td class="px-6 py-4 text-xs text-slate-500">${created}</td>

            <td class="px-6 py-4 text-right whitespace-nowrap">
              <button class="btn btn-blue" data-action="approve-user" data-id="${u.id}">
                Approve
              </button>
              <button class="btn btn-ghost" data-action="reject-user" data-id="${u.id}">
                Reject
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  async function loadPendingApprovals() {
    // needs token
    if (!ensureAuthOrExplain("usersTbody")) return;

    const status = (el("userFilterStatus")?.value || "pending").trim();
    const role = (el("userFilterRole")?.value || "").trim();

    // pending broker/owner/photographer are what you want
    // if role filter is empty, we fetch pending and filter those roles client-side
    const qs = new URLSearchParams();
    qs.set("status", status || "pending");
    if (role) qs.set("role", role);

    try {
      const res = await apiGet(`/admin/users?${qs.toString()}`);
      const users = res?.users || [];

      const filtered = role
        ? users
        : users.filter((u) => ["broker", "owner", "photographer"].includes(String(u.role).toLowerCase()));

      renderUsers(filtered);

      // update a KPI if exists
      if (el("kpiPendingUsers")) el("kpiPendingUsers").textContent = String(filtered.length);
    } catch (err) {
      const tbody = el("usersTbody") || el("usersTableBody");
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td class="px-6 py-4 text-red-600 font-bold" colspan="5">
              Failed to load pending users: ${escapeHtml(err.message || "Unknown error")}
              <div class="text-xs text-slate-500 mt-1">
                Make sure you are logged in as an <b>admin</b>.
              </div>
            </td>
          </tr>`;
      }
    }
  }

  async function approveUser(id) {
    await apiPatch(`/admin/users/${id}/approve`);
    await loadPendingApprovals();
  }

  async function rejectUser(id) {
    const reason = prompt("Reason for rejection (required):");
    if (!reason || reason.trim().length < 3) {
      alert("Rejection reason must be at least 3 characters.");
      return;
    }
    await apiPatch(`/admin/users/${id}/reject`, { reason: reason.trim() });
    await loadPendingApprovals();
  }

  function wireUserActions() {
    const tbody = el("usersTbody") || el("usersTableBody");
    if (!tbody) return;

    tbody.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;

      const action = btn.dataset.action;
      const id = Number(btn.dataset.id);
      if (!id) return;

      btn.disabled = true;
      try {
        if (action === "approve-user") await approveUser(id);
        if (action === "reject-user") await rejectUser(id);
      } catch (err) {
        alert(err.message || "Action failed");
      } finally {
        btn.disabled = false;
      }
    });
  }

  // Public API used by your HTML
  window.Admin = window.Admin || {};
  window.Admin.loadPendingApprovals = loadPendingApprovals;

  // Backwards-safe methods your HTML calls (so it won't crash)
  window.Admin.wireComingSoon = window.Admin.wireComingSoon || function () {};
  window.Admin.loadBadges = window.Admin.loadBadges || function () {};
  window.Admin.loadPendingCounts = window.Admin.loadPendingCounts || function () {};

  document.addEventListener("DOMContentLoaded", () => {
    wireUserActions();

    // If you have a "Load Users" button, connect it
    el("btnLoadUsers")?.addEventListener("click", loadPendingApprovals);

    // Auto-load pending approvals on open
    loadPendingApprovals();
  });
})();