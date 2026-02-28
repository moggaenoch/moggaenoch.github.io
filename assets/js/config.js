/* assets/js/config.js
   JUBA HOMEZ - Frontend App Config (Render + Local)
*/
(() => {
  "use strict";

  const hostname = window.location.hostname;
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local");

  // ✅ Base URL WITHOUT /api/v1
  const DEV_API_BASE_URL = "http://localhost:5000";
  const PROD_API_BASE_URL = "https://juba-homez-backend.onrender.com";

  const API_BASE_URL = isLocal ? DEV_API_BASE_URL : PROD_API_BASE_URL;

  window.APP_CONFIG = {
    REQUEST: { TIMEOUT_MS: 60000 },

    API_BASE_URL,
    API_PREFIX: "/api/v1",
    AUTH_PATH: "/auth",

    APP_NAME: "JUBA HOMEZ",
    VERSION: "1.0.0",

    STORAGE_KEYS: {
      ACCESS_TOKEN: "jh_access_token",
      REFRESH_TOKEN: "jh_refresh_token",
      USER: "jh_user",
    },

    FEATURES: {
      DEBUG_LOGS: isLocal,
    },

    utils: {
      isLocal,

      // ✅ builds base + prefix + path, but avoids double /api/v1
      apiUrl(path = "") {
        const base = String(API_BASE_URL || "").replace(/\/+$/, "");
        let prefix = String(window.APP_CONFIG.API_PREFIX || "").trim();
        let p = String(path || "").trim();

        // normalize prefix
        if (prefix && !prefix.startsWith("/")) prefix = "/" + prefix;
        prefix = prefix.replace(/\/+$/, "");

        // normalize path
        if (p && !p.startsWith("/")) p = "/" + p;

        // If path already begins with prefix, don't add prefix again
        if (prefix && p.startsWith(prefix + "/")) {
          return `${base}${p}`;
        }
        if (prefix && p === prefix) {
          return `${base}${p}`;
        }

        // return root or joined
        if (!p) return `${base}${prefix || ""}`;
        return `${base}${prefix || ""}${p}`;
      },

      getAccessToken() {
        return localStorage.getItem("jh_access_token");
      },

      setAccessToken(token) {
        if (!token) localStorage.removeItem("jh_access_token");
        else localStorage.setItem("jh_access_token", token);
      },

      clearAuth() {
        localStorage.removeItem("jh_access_token");
        localStorage.removeItem("jh_refresh_token");
        localStorage.removeItem("jh_user");
      },

      getAuthHeaders(extra = {}) {
        const token = localStorage.getItem("jh_access_token");
        const headers = { "Content-Type": "application/json", ...extra };
        if (token) headers.Authorization = `Bearer ${token}`;
        return headers;
      },
    },
  };

  if (window.APP_CONFIG.FEATURES.DEBUG_LOGS) {
    console.log("APP_CONFIG loaded:", window.APP_CONFIG);
    console.log("REGISTER URL =", window.APP_CONFIG.utils.apiUrl("/auth/register"));
  }
})();
