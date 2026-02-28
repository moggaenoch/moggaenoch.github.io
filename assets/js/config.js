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

  // ✅ Base URL WITHOUT /api/v1 (important)
  const DEV_API_BASE_URL = "http://localhost:5000";
  const PROD_API_BASE_URL = "https://juba-homez-backend.onrender.com";

  const API_BASE_URL = isLocal ? DEV_API_BASE_URL : PROD_API_BASE_URL;

  window.APP_CONFIG = {
    REQUEST: { TIMEOUT_MS: 60000 },

    // ✅ Base only
    API_BASE_URL,

    // ✅ Prefix added once here (so no duplication)
    API_PREFIX: "/api/v1",

    // Auth path
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

      // ✅ builds: https://... + /api/v1 + /path
      apiUrl(path = "") {
        const base = String(API_BASE_URL || "").replace(/\/+$/, "");
        const prefix = String(window.APP_CONFIG.API_PREFIX || "").replace(/\/+$/, "");
        const p = String(path || "");

        const joined = `${base}${prefix}`;
        if (!p) return joined;
        return p.startsWith("/") ? `${joined}${p}` : `${joined}/${p}`;
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

  try {
    // Validate base URL only (prefix is path)
    new URL(window.APP_CONFIG.API_BASE_URL);
    if (window.APP_CONFIG.FEATURES.DEBUG_LOGS) {
      console.log("APP_CONFIG loaded:", window.APP_CONFIG);
      console.log("API root:", window.APP_CONFIG.utils.apiUrl("")); // should show .../api/v1
    }
  } catch {
    console.error(
      "APP_CONFIG.API_BASE_URL is invalid or missing:",
      window.APP_CONFIG.API_BASE_URL
    );
  }
})();
