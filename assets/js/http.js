// assets/js/http.js
// Simple fetch wrapper that works with your config.js (API_BASE_URL + STORAGE_KEYS)
(function () {
  "use strict";

  const DEFAULT_TIMEOUT_MS = 20000;

  function getApiBase() {
    const base = window.APP_CONFIG?.API_BASE_URL;
    if (!base) throw new Error("APP_CONFIG.API_BASE_URL missing. Load config.js before http.js.");
    return String(base).replace(/\/+$/, ""); // remove trailing slash
  }

  function getToken() {
    try {
      const key = window.APP_CONFIG?.STORAGE_KEYS?.ACCESS_TOKEN || "jh_access_token";
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function buildHeaders(extra = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(window.APP_CONFIG?.DEFAULT_HEADERS || {}),
      ...extra,
    };

    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    return headers;
  }

  async function request(path, options = {}) {
    const base = getApiBase();

    const p = String(path || "");
    const url = p.startsWith("http") ? p : `${base}${p.startsWith("/") ? "" : "/"}${p}`;

    const controller = new AbortController();
    const timeoutMs = Number(window.APP_CONFIG?.REQUEST?.TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        headers: buildHeaders(options.headers || {}),
        signal: controller.signal,
      });

      const contentType = res.headers.get("content-type") || "";
      const isJson = contentType.includes("application/json");
      const payload = isJson ? await res.json().catch(() => ({})) : await res.text().catch(() => "");

      if (!res.ok) {
        const msg =
          (payload && (payload.message || payload.error)) ||
          (typeof payload === "string" && payload) ||
          `Request failed (${res.status})`;
        const err = new Error(msg);
        err.status = res.status;
        err.payload = payload;
        throw err;
      }

      return payload;
    } finally {
      clearTimeout(t);
    }
  }

  window.http = {
    get: (path) => request(path, { method: "GET" }),
    post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body || {}) }),
    put: (path, body) => request(path, { method: "PUT", body: JSON.stringify(body || {}) }),
    patch: (path, body) => request(path, { method: "PATCH", body: JSON.stringify(body || {}) }),
    del: (path) => request(path, { method: "DELETE" }),
    request,
    getToken,
  };
})();
