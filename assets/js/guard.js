// assets/js/guard.js
(function () {
  "use strict";

  const CONFIG = window.APP_CONFIG || {};
  const TOKEN_KEY = CONFIG?.STORAGE_KEYS?.ACCESS_TOKEN || "jh_access_token";
  const USER_KEY = CONFIG?.STORAGE_KEYS?.USER || "jh_user";

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || "{}");
    } catch {
      return {};
    }
  }

  // Call this on a dashboard page to protect it:
  // guardDashboard(["customer"]) or guardDashboard(["admin","staff"])
  window.guardDashboard = function guardDashboard(allowedRoles = []) {
    const token = getToken();
    const user = getUser();
    const role = (user?.role || "").toLowerCase();

    if (!token) {
      window.location.href = "../auth/login.html";
      return;
    }

    if (allowedRoles.length && !allowedRoles.map(r => r.toLowerCase()).includes(role)) {
      // logged in but wrong role
      window.location.href = "../index.html";
      return;
    }
  };

  // helper for showing username/email on dashboard
  window.getCurrentUser = function getCurrentUser() {
    return getUser();
  };
})();