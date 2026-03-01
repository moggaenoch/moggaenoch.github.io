/* assets/js/customer.js
   Minimal Customer module for Juba Homez (Favorites + Viewings)
   - No dependency on http.js (uses fetch)
   - Tries multiple endpoints (so it works with different backend route styles)
*/
(function () {
  "use strict";

  const Customer = {};
  window.Customer = Customer;

  // -------- Config helpers --------
  function getApiBase() {
    // Try common config locations
    return (
      window.API_BASE_URL ||
      window.CONFIG?.API_BASE_URL ||
      window.CONFIG?.apiBaseUrl ||
      window.AppConfig?.apiBaseUrl ||
      window.APP_CONFIG?.apiBaseUrl ||
      "" // same-origin if empty
    );
  }

  function getToken() {
    const keys = [
      "accessToken",
      "token",
      "jwt",
      "jubahomez_token",
      "jubaHomezToken",
      "authToken",
    ];
    for (const k of keys) {
      const v = localStorage.getItem(k);
      if (v && String(v).trim()) return String(v).trim();
    }
    return "";
  }

  async function request(path, opts = {}) {
    const base = getApiBase();
    const url = path.startsWith("http") ? path : `${base}${path}`;

    const token = getToken();
    const headers = {
      ...(opts.headers || {}),
    };

    // Only set JSON header when body is JSON
    if (opts.body && !(opts.body instanceof FormData) && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    if (token && !headers.Authorization) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      credentials: "include",
      ...opts,
      headers,
    });

    const ct = res.headers.get("content-type") || "";
    const isJson = ct.includes("application/json");

    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const data = isJson ? await res.json() : await res.text();
        msg = data?.message || data?.error || msg;
      } catch (_) {}
      throw new Error(msg);
    }

    return isJson ? res.json() : res.text();
  }

  async function tryMany(urls, opts) {
    let lastErr = null;
    for (const u of urls) {
      try {
        return await request(u, opts);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("No endpoint matched.");
  }

  function asArray(data) {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== "object") return [];
    return data.items || data.viewings || data.favorites || data.data || [];
  }

  // -------- LocalStorage fallback --------
  const LS = {
    viewings: [
      "jubahomez:viewings",
      "juba_homez_viewings",
      "jubaHomezViewings",
      "viewings",
      "customerViewings",
    ],
    favorites: [
      "jubahomez:favorites",
      "juba_homez_favorites",
      "jubaHomezFavorites",
      "favorites",
      "customerFavorites",
    ],
  };

  function readLS(keys) {
    for (const k of keys) {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return { key: k, items: parsed };
        if (parsed && Array.isArray(parsed.items)) return { key: k, items: parsed.items };
      } catch (_) {}
    }
    return { key: keys[0], items: [] };
  }

  function writeLS(key, items) {
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch (_) {}
  }

  // =========================
  // VIEWINGS API
  // =========================
  Customer.getViewings = async function () {
    const urls = [
      "/api/viewings/me",
      "/api/viewings/my",
      "/api/customers/me/viewings",
      "/api/viewings",
    ];

    try {
      const data = await tryMany(urls, { method: "GET" });
      return asArray(data);
    } catch (e) {
      // fallback to localStorage so UI still works
      return readLS(LS.viewings).items;
    }
  };

  Customer.rescheduleViewing = async function (viewingId, payload) {
    const id = encodeURIComponent(viewingId);
    const body = JSON.stringify(payload || {});
    const urls = [
      `/api/viewings/${id}/reschedule`, // POST
      `/api/viewings/${id}`,            // PATCH fallback
    ];

    try {
      return await request(urls[0], { method: "POST", body });
    } catch (_) {
      return await request(urls[1], { method: "PATCH", body: JSON.stringify({ ...payload, action: "reschedule" }) });
    }
  };

  Customer.cancelViewing = async function (viewingId, payload) {
    const id = encodeURIComponent(viewingId);
    const body = JSON.stringify(payload || {});
    const urls = [
      `/api/viewings/${id}/cancel`, // POST
      `/api/viewings/${id}`,        // PATCH fallback
    ];

    try {
      return await request(urls[0], { method: "POST", body });
    } catch (_) {
      return await request(urls[1], { method: "PATCH", body: JSON.stringify({ ...payload, action: "cancel" }) });
    }
  };

  // Notify customer + owner about an approaching deadline (backend must implement this)
  Customer.notifyViewingDeadline = async function (viewingId, withinHours = 24) {
    const id = encodeURIComponent(viewingId);
    return await request(`/api/viewings/${id}/notify-deadline`, {
      method: "POST",
      body: JSON.stringify({ withinHours }),
    });
  };

  // =========================
  // FAVORITES API
  // =========================
  Customer.getFavorites = async function () {
    const urls = [
      "/api/favorites",
      "/api/favourites",
      "/api/customers/me/favorites",
      "/api/customers/me/favourites",
    ];

    try {
      const data = await tryMany(urls, { method: "GET" });
      return asArray(data);
    } catch (e) {
      return readLS(LS.favorites).items;
    }
  };

  // =========================
  // UI RENDERERS (for your pages)
  // =========================
  function normalize(s) {
    return String(s || "").trim();
  }

  function toDate(v) {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function formatDT(v) {
    const d = toDate(v);
    return d ? d.toLocaleString() : String(v || "");
  }

  function getViewingId(v) {
    return v.id ?? v.viewingId ?? v._id ?? "";
  }

  function getViewingDT(v) {
    return v.dateTime ?? v.scheduledAt ?? v.viewingDate ?? v.date ?? v.startTime ?? "";
  }

  function getViewingStatus(v) {
    return v.status ?? v.state ?? "Pending";
  }

  function isUpcoming(v) {
    const d = toDate(getViewingDT(v));
    return d ? d.getTime() > Date.now() : true;
  }

  function withinHours(v, hours) {
    const d = toDate(getViewingDT(v));
    if (!d) return false;
    const diffH = (d.getTime() - Date.now()) / 36e5;
    return diffH >= 0 && diffH <= hours;
  }

  function viewingItemHTML(v) {
    const id = getViewingId(v);
    const title = v.propertyTitle ?? v.title ?? v.property?.title ?? "Viewing";
    const loc = v.location ?? v.property?.location ?? v.area ?? v.city ?? "";
    const dt = getViewingDT(v);
    const status = getViewingStatus(v);

    const actionable =
      isUpcoming(v) && !String(status).toLowerCase().includes("cancel") && !String(status).toLowerCase().includes("complete");

    const soon = actionable && withinHours(v, 24);

    return `
      <li class="list-group-item d-flex flex-column gap-2" data-viewing-id="${normalize(id)}">
        <div class="d-flex justify-content-between align-items-start gap-3">
          <div>
            <div class="fw-semibold">${normalize(title)}</div>
            <div class="text-muted small">${loc ? "📍 " + normalize(loc) : ""}</div>
            <div class="small mt-1"><span class="text-muted">When:</span> <span class="fw-semibold">${formatDT(dt)}</span></div>
            <div class="small"><span class="text-muted">Status:</span> <span class="fw-semibold">${normalize(status)}</span></div>
            ${soon ? `<div class="mt-2 small text-warning fw-semibold">⏰ Deadline approaching — reschedule or cancel if needed.</div>` : ``}
          </div>

          <div class="d-flex flex-column gap-2 align-items-end">
            <button class="btn btn-sm btn-outline-primary" data-action="reschedule" ${actionable ? "" : "disabled"}>
              Reschedule
            </button>
            <button class="btn btn-sm btn-outline-danger" data-action="cancel" ${actionable ? "" : "disabled"}>
              Cancel
            </button>
          </div>
        </div>
      </li>
    `;
  }

  function favoriteItemHTML(f) {
    const id = f.id ?? f.propertyId ?? f._id ?? "";
    const title = f.title ?? f.propertyTitle ?? f.name ?? "Saved property";
    const loc = f.location ?? f.area ?? f.city ?? "";
    const price = f.price ?? f.amount ?? "";
    const url = f.url ?? f.link ?? (id ? `../properties/property-details.html?id=${encodeURIComponent(id)}` : "#");
    return `
      <li class="list-group-item d-flex justify-content-between align-items-start gap-3">
        <div>
          <div class="fw-semibold">${normalize(title)}</div>
          <div class="text-muted small">${loc ? "📍 " + normalize(loc) : ""}</div>
          ${price ? `<div class="small"><span class="text-muted">Price:</span> <span class="fw-semibold">${normalize(price)}</span></div>` : ``}
        </div>
        <a class="btn btn-sm btn-primary" href="${url}">View</a>
      </li>
    `;
  }

  // Your placeholder pages call these:
  Customer.loadViewings = async function (target) {
    const el = target || document.querySelector("#viewingsList") || document.querySelector("ul");
    if (!el) return;

    try {
      const viewings = await Customer.getViewings();
      if (!viewings.length) {
        el.innerHTML = `<li class="list-group-item text-muted">No viewings found.</li>`;
        return;
      }

      // Render as a Bootstrap list-group if it's a UL
      if (el.tagName === "UL") el.classList.add("list-group");
      el.innerHTML = viewings.map(viewingItemHTML).join("");

      // Attach actions
      el.addEventListener("click", async (e) => {
        const btn = e.target.closest("[data-action]");
        if (!btn) return;

        const li = e.target.closest("[data-viewing-id]");
        if (!li) return;

        const id = li.getAttribute("data-viewing-id");
        const action = btn.getAttribute("data-action");

        if (action === "cancel") {
          const reason = prompt("Reason for cancellation (optional):") || "";
          if (!confirm("Cancel this viewing?")) return;

          try {
            await Customer.cancelViewing(id, { reason });
            // Update UI quickly
            li.querySelectorAll(".fw-semibold").forEach(() => {});
            li.insertAdjacentHTML("beforeend", `<div class="small text-success mt-2">Cancelled.</div>`);
            btn.closest("div")?.querySelectorAll("button")?.forEach(b => (b.disabled = true));
          } catch (err) {
            alert("Cancel failed: " + (err.message || err));
          }
        }

        if (action === "reschedule") {
          const newDateTime = prompt("Enter new date/time (e.g. 2026-03-02 14:00):");
          if (!newDateTime) return;
          const reason = prompt("Reason (optional):") || "";

          try {
            await Customer.rescheduleViewing(id, { newDateTime, reason });
            li.insertAdjacentHTML("beforeend", `<div class="small text-success mt-2">Reschedule request sent.</div>`);
          } catch (err) {
            alert("Reschedule failed: " + (err.message || err));
          }
        }
      }, { once: true });

    } catch (e) {
      el.innerHTML = `<li class="list-group-item text-danger">Failed to load viewings: ${normalize(e.message || e)}</li>`;
    }
  };

  Customer.loadFavorites = async function (target) {
    const el = target || document.querySelector("#favoritesList") || document.querySelector("ul");
    if (!el) return;

    try {
      const favs = await Customer.getFavorites();
      if (!favs.length) {
        el.innerHTML = `<li class="list-group-item text-muted">No favorites yet.</li>`;
        return;
      }
      if (el.tagName === "UL") el.classList.add("list-group");
      el.innerHTML = favs.map(favoriteItemHTML).join("");
    } catch (e) {
      el.innerHTML = `<li class="list-group-item text-danger">Failed to load favorites: ${normalize(e.message || e)}</li>`;
    }
  };
})();