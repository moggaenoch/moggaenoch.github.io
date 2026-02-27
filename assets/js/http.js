// assets/js/http.js
(function () {
  function getToken() {
    try {
      return localStorage.getItem(window.APP_CONFIG.AUTH_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  function buildHeaders(extra = {}) {
    const headers = { ...(window.APP_CONFIG?.DEFAULT_HEADERS || {}), ...extra };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  async function request(path, options = {}) {
    const base = window.APP_CONFIG?.API_BASE_URL;
    if (!base) throw new Error("APP_CONFIG.API_BASE_URL missing. Check config.js load order.");

    const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;

    const res = await fetch(url, {
      ...options,
      headers: buildHeaders(options.headers || {}),
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
  }

  window.http = {
    get: (path) => request(path, { method: "GET" }),
    post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),
    put: (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) }),
    del: (path) => request(path, { method: "DELETE" }),
    request,
    getToken,
  };
})();