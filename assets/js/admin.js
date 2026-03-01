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
    if (st === "active") return `<span class="badge badge-active"><span class="badge-dot"></span>active</span>`;
    if (st === "pending") return `<span class="badge badge-pending"><span class="badge-dot"></span>pending</span>`;
    if (st === "suspended") return `<span class="badge badge-suspended"><span class="badge-dot"></span>suspended</span>`;
    if (st === "rejected") return `<span class="badge badge-rejected"><span class="badge-dot"></span>rejected</span>`;
    return `<span class="badge badge-rejected"><span class="badge-dot"></span>${escapeHtml(st || "unknown")}</span>`;
  }

  function getErrMessage(err) {
    // Your backend errors are { error: { message } } :contentReference[oaicite:2]{index=2}
    const msg =
      err?.payload?.error?.message ||
      err?.payload?.message ||
      err?.message;
    return String(msg || "Request failed");
  }

  function ensureAuthOrExplain(tbodyId) {
    const token =
      window.http?.getToken?.() ||
      window.APP_CONFIG?.utils?.getAccessToken?.() ||
      localStorage.getItem("jh_access_token");

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

  function apiUrl(path) {
    // ✅ Adds /api/v1 automatically using config.js :contentReference[oaicite:3]{index=3}
    return window.APP_CONFIG?.utils?.apiUrl?.(path) || path;
  }

  async function apiGet(path) {
    return await window.http.get(apiUrl(path));
  }
  async function apiPatch(path, body) {
    return await window.http.patch(apiUrl(path), body || {});
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
              <button class="btn btn-blue" data-action="approve-user" data-id="${u.id}">Approve</button>
              <button class="btn btn-ghost" data-action="reject-user" data-id="${u.id}">Reject</button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  async function loadUsers(opts = {}) {
    if (!ensureAuthOrExplain("usersTbody")) return;

    const status = String(opts.status ?? el("userFilterStatus")?.value ?? "pending").trim() || "pending";
    const role = String(opts.role ?? el("userFilterRole")?.value ?? "").trim();

    const qs = new URLSearchParams();
    qs.set("status", status);
    if (role) qs.set("role", role);

    try {
      // ✅ Correct endpoint: /api/v1/admin/users :contentReference[oaicite:4]{index=4}
      const res = await apiGet(`/admin/users?${qs.toString()}`);

      // ✅ Correct response shape: { data: { users } } :contentReference[oaicite:5]{index=5}
      const users = res?.data?.users || [];

      // if no role filter, show only approvals-needed roles
      const filtered = role
        ? users
        : users.filter((u) => ["broker", "owner", "photographer"].includes(String(u.role).toLowerCase()));

      renderUsers(filtered);

      if (el("kpiPendingUsers") && status.toLowerCase() === "pending") {
        el("kpiPendingUsers").textContent = String(filtered.length);
      }
      if (el("usersMeta")) el("usersMeta").textContent = `${filtered.length} shown`;
    } catch (err) {
      const tbody = el("usersTbody") || el("usersTableBody");
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td class="px-6 py-4 text-red-600 font-bold" colspan="5">
              Failed to load pending users: ${escapeHtml(getErrMessage(err))}
              <div class="text-xs text-slate-500 mt-1">
                Make sure you are logged in as an <b>admin</b> (otherwise backend returns "Forbidden: insufficient role"). 
              </div>
            </td>
          </tr>`;
      }
    }
  }

  async function approveUser(id) {
    // ✅ PATCH /api/v1/admin/users/:id/approve :contentReference[oaicite:6]{index=6}
    await apiPatch(`/admin/users/${id}/approve`);
    await loadUsers({ status: el("userFilterStatus")?.value || "pending", role: el("userFilterRole")?.value || "" });
  }

  async function rejectUser(id) {
    const reason = prompt("Reason for rejection (required):");
    if (!reason || reason.trim().length < 3) {
      alert("Rejection reason must be at least 3 characters.");
      return;
    }
    // ✅ PATCH /api/v1/admin/users/:id/reject with {reason} :contentReference[oaicite:7]{index=7}
    await apiPatch(`/admin/users/${id}/reject`, { reason: reason.trim() });
    await loadUsers({ status: el("userFilterStatus")?.value || "pending", role: el("userFilterRole")?.value || "" });
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
        alert(getErrMessage(err));
      } finally {
        btn.disabled = false;
      }
    });
  }

  // Expose API used by your HTML
  window.Admin = window.Admin || {};
  window.Admin.loadUsers = loadUsers;                 // ✅ HTML expects this
  window.Admin.loadPendingApprovals = loadUsers;      // ✅ keep your old name too
  window.Admin.wireComingSoon = window.Admin.wireComingSoon || function () {};
  window.Admin.loadBadges = window.Admin.loadBadges || function () {};
  window.Admin.loadPendingCounts = window.Admin.loadPendingCounts || function () {};

  document.addEventListener("DOMContentLoaded", () => {
    wireUserActions();

    el("btnLoadUsers")?.addEventListener("click", () => loadUsers({}));

    // Default to pending so approvals show immediately
    const st = el("userFilterStatus");
    if (st && !st.value) st.value = "pending";

    // Auto load approvals
    loadUsers({ status: "pending" });
  });
})();
