// assets/js/auth.js
(function () {
  "use strict";

  const CONFIG = window.APP_CONFIG || {};

  // Base: https://.../api/v1/auth (uses your config.js builder)
  const AUTH_BASE = CONFIG?.utils?.apiUrl
    ? CONFIG.utils.apiUrl("/auth")
    : "/api/v1/auth";

  // ✅ DASHBOARD ROUTES (site-root paths)
  const DASHBOARD_BY_ROLE = {
    customer: "/customer/CustomerDashboard.html",
    broker: "/brokers/BrokersDashboard.html",
    owner: "/property-owner/PropertyOwnerDashboard.html",
    admin: "/Admin/AdminDashboard.html",
    photographer: "/photographer/PhotographersDashoard.html", // spelling is Dashoard
  };

  function redirectToDashboard(user) {
    const role = String(user?.role || "").toLowerCase();
    const target = DASHBOARD_BY_ROLE[role] || "/index.html";
    window.location.href = target;
  }

  // ---------- UI helpers ----------
  function alertBox() {
    return document.querySelector("[data-auth-alert]");
  }

  function normalizeMessage(x) {
    if (x == null) return "";
    if (typeof x === "string") return x;
    if (typeof x === "number" || typeof x === "boolean") return String(x);

    // backend error format: { error: { message, details: [] } }
    if (typeof x === "object") {
      if (x.error) return normalizeMessage(x.error);

      const msg = x.message || x.error || x.msg || "";
      const details = Array.isArray(x.details) ? x.details.join("\n") : "";
      return [msg, details].filter(Boolean).join("\n") || JSON.stringify(x);
    }

    return String(x);
  }

  function setAlert(box, msg, type = "danger") {
    if (!box) return;
    const text = normalizeMessage(msg) || "Something went wrong.";

    box.innerHTML = "";
    const div = document.createElement("div");
    div.className = `alert alert-${type}`;
    div.style.whiteSpace = "pre-line"; // allow \n from details
    div.textContent = text;
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

  // ---------- HTTP (fetch-only) ----------
  async function apiPost(path, payload) {
    const url = `${AUTH_BASE}${path.startsWith("/") ? path : `/${path}`}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const ct = res.headers.get("content-type") || "";
    const json = ct.includes("application/json") ? await res.json() : { raw: await res.text() };

    if (!res.ok) {
      // backend sends: { error: { message, details } }
      throw json;
    }

    // backend sends: { data: {...} }
    return json.data ?? json;
  }

  // ---------- SIGNUP ----------
  window.handleSignup = async function handleSignup(form) {
    const box = alertBox();
    clearAlert(box);

    const btn = form.querySelector('button[type="submit"]');
    setLoading(btn, true, "Creating...");

    let role = getVal(form, "role") || "customer";
    if (role === "client") role = "customer";

    // Backend allowed roles: customer, broker, owner, photographer (admin should be created by DB)
    if (role === "staff") {
      setLoading(btn, false);
      setAlert(
        box,
        "Staff accounts must be created/approved by Admin. Please choose Client, Broker, Owner, or Photographer.",
        "warning"
      );
      return;
    }

    const firstName = getVal(form, "firstName");
    const lastName = getVal(form, "lastName");
    const name = `${firstName} ${lastName}`.trim();

    const email = getVal(form, "email");
    const phone = getVal(form, "phone");
    const password = form.password?.value || "";

    if (!name || !email || !phone || !password) {
      setLoading(btn, false);
      setAlert(box, "Please fill in First Name, Last Name, Email, Phone, and Password.", "warning");
      return;
    }

    if (password.length < 8) {
      setLoading(btn, false);
      setAlert(box, "Password must be at least 8 characters.", "warning");
      return;
    }

    const payload = { role, name, email, phone, password };

    try {
      const out = await apiPost("/register", payload);

      if (out?.token) {
        saveAuth(out.token, out.user);
        setAlert(box, "Account created successfully. Redirecting…", "success");
        setTimeout(() => redirectToDashboard(out.user), 700);
      } else {
        setAlert(
          box,
          "Account submitted successfully and is pending admin approval. You will be able to log in after approval.",
          "success"
        );
        form.reset();
      }
    } catch (err) {
      setAlert(box, err, "danger");
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

    const email = getVal(form, "email") || getVal(form, "username");
    const password = form.password?.value || "";

    if (!email || !password) {
      setLoading(btn, false);
      setAlert(box, "Please enter your email and password.", "warning");
      return;
    }

    try {
      const out = await apiPost("/login", { email, password });

      if (!out?.token) throw { error: { message: "Login response missing token." } };

      saveAuth(out.token, out.user);
      setAlert(box, "Login successful. Redirecting…", "success");

      setTimeout(() => redirectToDashboard(out.user), 500);
    } catch (err) {
      setAlert(box, err, "danger");
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
      const out = await apiPost("/password/forgot", { email });
      setAlert(box, out?.message || "If the email exists, reset instructions were sent.", "success");
      form.reset();
    } catch (err) {
      setAlert(box, err, "danger");
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

    if (!newPassword || newPassword.length < 8) {
      setAlert(box, "Password must be at least 8 characters.", "warning");
      return;
    }
    if (newPassword !== confirmPassword) {
      setAlert(box, "Passwords do not match.", "warning");
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    setLoading(btn, true, "Resetting...");

    try {
      const out = await apiPost("/password/reset", { token, newPassword });
      setAlert(box, out?.message || "Password reset successful. You can now sign in.", "success");
      clearAuth();
      setTimeout(() => (window.location.href = "/auth/login.html"), 900);
    } catch (err) {
      setAlert(box, err, "danger");
      console.error("RESET ERROR:", err);
    } finally {
      setLoading(btn, false);
    }
  };

  // ---------- LOGOUT ----------
  window.logout = function logout(redirectTo = "/index.html") {
    clearAuth();
    window.location.href = redirectTo;
  };

  // Optional: expose redirect map (useful for debugging)
  window.JH_DASHBOARD_BY_ROLE = DASHBOARD_BY_ROLE;
})();
