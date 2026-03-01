// assets/js/customer-listings.js
(function () {
  "use strict";

  const el = (id) => document.getElementById(id);
  const api = (path) => APP_CONFIG.utils.apiUrl(path);

  const state = {
    savedIds: new Set(),
    page: 1,
    limit: 24,
  };

  function money(n) {
    if (n == null) return "—";
    return Number(n).toLocaleString();
  }

  function card(p) {
    const saved = state.savedIds.has(p.id);
    return `
      <div class="hottest-item bg-white border border-slate-100 rounded-3xl p-4 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-sm font-black text-slate-900">${p.title || "Untitled"}</div>
            <div class="text-xs text-slate-500">${p.area || ""} • ${p.location || ""}</div>
          </div>
          <button class="btn btn-ghost" data-action="toggle-save" data-id="${p.id}">
            ${saved ? "Saved" : "Save"}
          </button>
        </div>

        <div class="mt-3 flex items-center justify-between">
          <div class="text-lg font-black">SSP ${money(p.price)}</div>
          <div class="text-xs text-slate-500">${p.rooms || 0} beds • ${p.bathrooms || 0} baths</div>
        </div>
      </div>
    `;
  }

  async function loadSavedIds() {
    try {
      const res = await http.get(api("/saved"));
      const saved = res?.data?.saved || [];
      state.savedIds = new Set(saved.map((x) => x.id));
    } catch {
      // if not logged in, ignore (saving will prompt/login on your side)
      state.savedIds = new Set();
    }
  }

  function readFilters() {
    return {
      q: el("searchQ")?.value?.trim() || "",
      area: el("searchArea")?.value || "",
      min_price: el("minPrice")?.value || "",
      max_price: el("maxPrice")?.value || "",
      rooms: el("minRooms")?.value || "",
      bathrooms: el("minBaths")?.value || "",
      type: el("searchType")?.value || "",
    };
  }

  async function loadProperties() {
    const filters = readFilters();
    const qs = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && qs.set(k, v));
    qs.set("page", String(state.page));
    qs.set("limit", String(state.limit));

    const res = await fetch(api("/properties?" + qs.toString()));
    const json = await res.json();

    if (!res.ok) {
      console.error(json);
      alert(json?.error?.message || "Failed to load properties");
      return;
    }

    const props = json?.data?.properties || [];
    const list = el("propertiesGrid");
    if (!list) return;

    list.innerHTML = props.map(card).join("") || `<div class="text-slate-500">No results found.</div>`;
  }

  async function toggleSave(propertyId) {
    // requires login token in localStorage; http.js adds Authorization automatically
    try {
      if (state.savedIds.has(propertyId)) {
        await http.del(api(`/saved/${propertyId}`));
        state.savedIds.delete(propertyId);
      } else {
        await http.post(api(`/saved/${propertyId}`), {});
        state.savedIds.add(propertyId);
      }
      await loadProperties();
    } catch (e) {
      alert(e?.message || "Save failed. Please login first.");
    }
  }

  function wireActions() {
    el("btnSearch")?.addEventListener("click", async () => {
      state.page = 1;
      await loadSavedIds();
      await loadProperties();
    });

    el("propertiesGrid")?.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action='toggle-save']");
      if (!btn) return;
      const id = Number(btn.dataset.id);
      if (!id) return;
      await toggleSave(id);
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    wireActions();
    await loadSavedIds();
    await loadProperties();
  });
})();