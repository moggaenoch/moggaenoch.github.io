// assets/js/auth.js
(function () {
  "use strict";

  // ---------- Config ----------
  const CONFIG = window.APP_CONFIG || {};

  // ✅ AUTH_BASE will be: https://.../api/v1/auth (no double /api/v1)
  const AUTH_BASE = CONFIG?.utils?.apiUrl
    ? CONFIG.utils.apiUrl("/auth")
    : ((CONFIG.API_BASE_URL || CONFIG.API_URL || "").replace(/\/+$/, "") +
       ((CONFIG.API_PREFIX || "/api/v1").replace(/\/+$/, "")) +
       ((CONFIG.AUTH_PATH || "/auth").replace(/\/+$/, "")));

  // ---------- UI helpers ----------
  function alertBox() {
    return document.querySelector("[data-auth-alert]");
  }

  function normalizeMessage(x) {
    if (x == null) return "";
    if (typeof x === "string") return x;
    if (typeof x === "number" || typeof x === "boolean") return String(x);
    if (Array.isArray(x)) return x.map(normalizeMessage).filter(Boolean).join(", ");
    if (typeof x === "object") {
      return (
        x.message ||
        x.error ||
        x.msg ||
        (x.errors && normalizeMessage(x.errors)) ||
        JSON.stringify(x)
      );
    }
    return String(x);
  }

  function setAlert(box, msg, type = "danger") {
    if (!box) return;
    const text = normalizeMessage(msg) || "Something went wrong.";
    box.innerHTML = "";
    const div = document.createElement("div");
    div.className = `alert alert-${type}`;
    div.textContent = text; // ✅ avoids [object Object] and prevents HTML injection
    box.appendChild(div);
  }

  function clearAlert(box) {
    if (!box) return;
    box.innerHTML = "";
  }

  function setLoading(btn, loading, text) {
    if (!btn) return;
    btn.disabled = !!loading;

    if (loading) {
      btn.dataset._oldText = btn.innerHTML;
      btn.innerHTML = text || "Loading...";
    } else if (btn.dataset._oldText) {
      btn.innerHTML = btn.dataset._oldText;
      delete btn.dataset._oldText;
    }
  }

  // ---------- Auth storage ----------
  const TOKEN_KEY = CONFIG?.STORAGE_KEYS?.ACCESS_TOKEN || "jh_access_token";
  const USER_KEY = CONFIG?.STORAGE_KEYS?.USER || "jh_user";

  function saveAuth(token, user) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
  }

  function clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function getVal(form, name) {
    return (form?.[name]?.value || "").trim();
  }

  function extractError(err, fallback) {
    return (
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      err?.data?.message ||
      err?.data?.error ||
      err?.message ||
      fallback
    );
  }

  // ---------- HTTP (fetch-only to avoid http.js duplicating /api/v1 or sending GET) ----------
  async function apiPost(path, payload) {
    // path example: "/register"  or "/password/forgot"
    // We always POST to AUTH_BASE + path
    const url = `${AUTH_BASE}${path.startsWith("/") ? path : `/${path}`}`;

    const res = await fetch(url, {
      method: "POST", // ✅ force POST
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const ct = res.headers.get("content-type") || "";
    const data = ct.includes("application/json") ? await res.json() : await res.text();

    if (!res.ok) {
      const err = new Error(normalizeMessage(data) || `Request failed (${res.status})`);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  // ---------- SIGNUP ----------
  window.handleSignup = async function handleSignup(form) {
    const box = alertBox();
    clearAlert(box);

    const btn = form.querySelector('button[type="submit"]');
    setLoading(btn, true, "Creating...");

    let role = getVal(form, "role") || "customer";
    if (role === "client") role = "customer";

    const email = getVal(form, "email");
    const phone = getVal(form, "phone");
    const password = form.password?.value || "";

    const firstName = getVal(form, "firstName");
    const lastName = getVal(form, "lastName");
    const sex = (getVal(form, "sex") || "").toLowerCase(); // "m" or "f"
    const dateOfBirth = getVal(form, "dateOfBirth"); // YYYY-MM-DD
    const address = getVal(form, "address");

    const location = getVal(form, "location");
    const branch = getVal(form, "branch");
    const position = getVal(form, "position");

    if (!firstName || !lastName || !sex || !dateOfBirth || !address || !email || !phone || !password) {
      setLoading(btn, false);
      setAlert(box, "Please fill in all required fields.", "warning");
      return;
    }

    if (!["m", "f"].includes(sex)) {
      setLoading(btn, false);
      setAlert(box, "Sex must be 'm' or 'f'.", "warning");
      return;
    }

    if (["broker", "owner", "photographer"].includes(role) && !location) {
      setLoading(btn, false);
      setAlert(box, "Location is required for Broker/Owner/Photographer.", "warning");
      return;
    }

    if (role === "staff" && (!branch || !position)) {
      setLoading(btn, false);
      setAlert(box, "Branch and Position are required for Staff.", "warning");
      return;
    }

    const payload = {
      role,
      email,
      phone,
      password,
      firstName,
      lastName,
      sex,
      dateOfBirth,
      address,
      location: location || null,
      branch: branch || null,
      position: position || null,
    };

    try {
      const res = await apiPost("/register", payload);

      if (res?.token) saveAuth(res.token, res.user);

      setAlert(box, res?.message || "Account created successfully. Redirecting…", "success");
      setTimeout(() => (window.location.href = "login.html"), 800);
    } catch (err) {
      setAlert(box, extractError(err, "Sign up failed."), "danger");
      console.error("SIGNUP ERROR:", err);
    } finally {
      setLoading(btn, false);
    }
  };

  // ---------- LOGIN ----------
  window.handleLogin = async function handleLogin(form) {
    const box = alertBox();
    clearAlert(box);

    const btn = form.querySelector('button[type="submit"]');
    setLoading(btn, true, "Signing in...");

    const usernameOrEmail = getVal(form, "username") || getVal(form, "email");
    const password = form.password?.value || "";

    if (!usernameOrEmail || !password) {
      setLoading(btn, false);
      setAlert(box, "Please enter your email and password.", "warning");
      return;
    }

    try {
      const res = await apiPost("/login", {
        username: usernameOrEmail,
        email: usernameOrEmail,
        password,
      });

      if (!res?.token) throw new Error(res?.message || "Login response missing token.");

      saveAuth(res.token, res.user);
      setAlert(box, "Login successful. Redirecting…", "success");
      setTimeout(() => (window.location.href = "../index.html"), 600);
    } catch (err) {
      setAlert(box, extractError(err, "Login failed."), "danger");
      console.error("LOGIN ERROR:", err);
    } finally {
      setLoading(btn, false);
    }
  };

  // ---------- FORGOT PASSWORD ----------
  window.handleForgot = async function handleForgot(form) {
    const box = alertBox();
    clearAlert(box);

    const btn = form.querySelector('button[type="submit"]');
    setLoading(btn, true, "Sending...");

    const email = getVal(form, "email");
    if (!email) {
      setLoading(btn, false);
      setAlert(box, "Please enter your email address.", "warning");
      return;
    }

    try {
      const res = await apiPost("/password/forgot", { email });
      setAlert(box, res?.message || "If the email exists, a reset link has been sent.", "success");
      form.reset();
    } catch (err) {
      setAlert(box, extractError(err, "Could not send reset link."), "danger");
      console.error("FORGOT ERROR:", err);
    } finally {
      setLoading(btn, false);
    }
  };

  // ---------- RESET PASSWORD ----------
  window.handleReset = async function handleReset(form) {
    const box = alertBox();
    clearAlert(box);

    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setAlert(box, "Missing reset token in the URL.", "danger");
      return;
    }

    const newPassword = form.newPassword?.value || "";
    const confirmPassword = form.confirmPassword?.value || "";

    if (!newPassword || newPassword.length < 6) {
      setAlert(box, "Password must be at least 6 characters.", "warning");
      return;
    }
    if (newPassword !== confirmPassword) {
      setAlert(box, "Passwords do not match.", "warning");
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    setLoading(btn, true, "Resetting...");

    try {
      const res = await apiPost("/password/reset", { token, newPassword });
      setAlert(box, res?.message || "Password reset successful. You can now sign in.", "success");
      clearAuth();
      setTimeout(() => (window.location.href = "login.html"), 900);
    } catch (err) {
      setAlert(box, extractError(err, "Reset failed."), "danger");
      console.error("RESET ERROR:", err);
    } finally {
      setLoading(btn, false);
    }
  };

  // ---------- LOGOUT ----------
  window.logout = function logout(redirectTo = "../index.html") {
    clearAuth();
    window.location.href = redirectTo;
  };

  // Optional debug
  if (CONFIG?.FEATURES?.DEBUG_LOGS) {
    console.log("AUTH_BASE =", AUTH_BASE);
  }
})();


