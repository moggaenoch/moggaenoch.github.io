// assets/js/auth.js
(function () {
  function alertBox() {
    return document.querySelector("[data-auth-alert]");
  }

  // Use keys from config if present, otherwise fallback
  const TOKEN_KEY = window.APP_CONFIG?.STORAGE_KEYS?.ACCESS_TOKEN || "jh_access_token";
  const USER_KEY  = window.APP_CONFIG?.STORAGE_KEYS?.USER || "jh_user";

  function saveAuth(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
  }

  function clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  // Ensure we have a HTTP client
  function ensureHttp() {
    if (window.http && typeof window.http.post === "function") return;

    const baseURL = window.APP_CONFIG?.API_BASE_URL;
    if (!baseURL) throw new Error("APP_CONFIG.API_BASE_URL missing. Load config.js first.");

    // If axios is available, create http client using it
    if (window.axios) {
      window.http = {
        async post(path, data) {
          const res = await axios.post(`${baseURL}${path.startsWith("/") ? path : "/" + path}`, data, {
            headers: { "Content-Type": "application/json" },
            timeout: 20000,
          });
          return res.data;
        },
        async get(path) {
          const res = await axios.get(`${baseURL}${path.startsWith("/") ? path : "/" + path}`, {
            timeout: 20000,
          });
          return res.data;
        }
      };
      return;
    }

    // Fallback fetch client
    window.http = {
      async post(path, data) {
        const res = await fetch(`${baseURL}${path.startsWith("/") ? path : "/" + path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
        return json;
      },
      async get(path) {
        const res = await fetch(`${baseURL}${path.startsWith("/") ? path : "/" + path}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
        return json;
      }
    };
  }

  // ---------- SIGNUP ----------
  // Backend should implement: POST /auth/register
  window.handleSignup = async function handleSignup(form) {
    const box = alertBox();
    window.ui?.clearAlert(box);

    const btn = form.querySelector('button[type="submit"]');
    window.ui?.setLoading(btn, true, "Creating account...");

    const firstName = (form.firstName?.value || "").trim();
    const lastName  = (form.lastName?.value || "").trim();
    const role      = (form.role?.value || "customer").trim();
    const username  = (form.username?.value || "").trim(); // could be email
    const phone     = (form.phone?.value || "").trim();
    const password  = form.password?.value || "";

    if (!firstName || !lastName || !username || !phone || !password) {
      window.ui?.setLoading(btn, false);
      window.ui?.setAlert(box, "Please fill in all required fields.", "warning");
      return;
    }

    try {
      ensureHttp();

      const payload = { firstName, lastName, role, username, phone, password };

      const res = await window.http.post("/auth/register", payload);

      // Some APIs return { token, user }, others just { message }
      if (res?.token) {
        saveAuth(res.token, res.user);
        window.ui?.setAlert(box, "Account created. Redirecting...", "success");
        setTimeout(() => (window.location.href = "login.html"), 700);
      } else {
        window.ui?.setAlert(box, res?.message || "Account created. You can now sign in.", "success");
        form.reset();
        setTimeout(() => (window.location.href = "login.html"), 900);
      }
    } catch (err) {
      window.ui?.setAlert(box, err.message || "Sign up failed.", "danger");
    } finally {
      window.ui?.setLoading(btn, false);
    }
  };

  // ---------- LOGIN ----------
  window.handleLogin = async function handleLogin(form) {
    const box = alertBox();
    window.ui?.clearAlert(box);

    const btn = form.querySelector('button[type="submit"]');
    window.ui?.setLoading(btn, true, "Signing in...");

    const username = (form.username?.value || "").trim();
    const password = form.password?.value || "";

    if (!username || !password) {
      window.ui?.setLoading(btn, false);
      window.ui?.setAlert(box, "Please enter your username/email and password.", "warning");
      return;
    }

    try {
      ensureHttp();

      const res = await window.http.post("/auth/login", { username, password });

      if (!res?.token) throw new Error(res?.message || "Login response missing token.");

      saveAuth(res.token, res.user);
      window.ui?.setAlert(box, "Login successful. Redirecting...", "success");

      setTimeout(() => {
        window.location.href = "../index.html"; // from /auth/
      }, 600);
    } catch (err) {
      window.ui?.setAlert(box, err.message || "Login failed.", "danger");
    } finally {
      window.ui?.setLoading(btn, false);
    }
  };

  // ---------- FORGOT PASSWORD ----------
  window.handleForgot = async function handleForgot(form) {
    const box = alertBox();
    window.ui?.clearAlert(box);

    const btn = form.querySelector('button[type="submit"]');
    window.ui?.setLoading(btn, true, "Sending link...");

    const email = (form.email?.value || "").trim();
    if (!email) {
      window.ui?.setLoading(btn, false);
      window.ui?.setAlert(box, "Please enter your email address.", "warning");
      return;
    }

    try {
      ensureHttp();

      const res = await window.http.post("/auth/forgot-password", { email });

      window.ui?.setAlert(
        box,
        res?.message || "If the email exists, a reset link has been sent.",
        "success"
      );
      form.reset();
    } catch (err) {
      window.ui?.setAlert(box, err.message || "Could not send reset link.", "danger");
    } finally {
      window.ui?.setLoading(btn, false);
    }
  };

  // ---------- RESET PASSWORD ----------
  window.handleReset = async function handleReset(form) {
    const box = alertBox();
    window.ui?.clearAlert(box);

    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      window.ui?.setAlert(box, "Missing reset token in the URL.", "danger");
      return;
    }

    const newPassword = form.newPassword?.value || "";
    const confirmPassword = form.confirmPassword?.value || "";

    if (!newPassword || newPassword.length < 6) {
      window.ui?.setAlert(box, "Password must be at least 6 characters.", "warning");
      return;
    }
    if (newPassword !== confirmPassword) {
      window.ui?.setAlert(box, "Passwords do not match.", "warning");
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    window.ui?.setLoading(btn, true, "Resetting...");

    try {
      ensureHttp();

      const res = await window.http.post("/auth/reset-password", { token, newPassword });

      window.ui?.setAlert(box, res?.message || "Password reset successful. You can now sign in.", "success");
      clearAuth();

      setTimeout(() => {
        window.location.href = "login.html";
      }, 900);
    } catch (err) {
      window.ui?.setAlert(box, err.message || "Reset failed.", "danger");
    } finally {
      window.ui?.setLoading(btn, false);
    }
  };

  window.logout = function logout(redirectTo = "../index.html") {
    clearAuth();
    window.location.href = redirectTo;
  };
})();
