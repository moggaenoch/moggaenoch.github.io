// assets/js/auth.js
(function () {
  "use strict";

  function alertBox() {
    return document.querySelector("[data-auth-alert]");
  }

  const TOKEN_KEY = window.APP_CONFIG?.STORAGE_KEYS?.ACCESS_TOKEN || "jh_access_token";
  const USER_KEY = window.APP_CONFIG?.STORAGE_KEYS?.USER || "jh_user";

  function saveAuth(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
  }

  function clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  // ✅ Auto-try /auth/* then fallback to /*
  async function postAuth(path, body) {
    try {
      return await window.http.post(`/auth${path}`, body);
    } catch (e) {
      return await window.http.post(path, body);
    }
  }

  // ---------- SIGNUP ----------
  window.handleSignup = async function handleSignup(form) {
    const box = alertBox();
    window.ui?.clearAlert(box);

    const btn = form.querySelector('button[type="submit"]');
    window.ui?.setLoading(btn, true, "Creating account...");

    const payload = {
      firstName: (form.firstName?.value || "").trim(),
      lastName: (form.lastName?.value || "").trim(),
      role: (form.role?.value || "customer").trim(),
      username: (form.username?.value || "").trim(),
      phone: (form.phone?.value || "").trim(),
      password: form.password?.value || "",
    };

    if (!payload.firstName || !payload.lastName || !payload.username || !payload.phone || !payload.password) {
      window.ui?.setLoading(btn, false);
      window.ui?.setAlert(box, "Please fill in all required fields.", "warning");
      return;
    }

    try {
      const res = await postAuth("/register", payload);

      if (res?.token) saveAuth(res.token, res.user);

      window.ui?.setAlert(box, res?.message || "Account created successfully.", "success");
      setTimeout(() => (window.location.href = "login.html"), 800);
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
      const res = await postAuth("/login", { username, password });

      if (!res?.token) throw new Error(res?.message || "Login response missing token.");

      saveAuth(res.token, res.user);
      window.ui?.setAlert(box, "Login successful. Redirecting...", "success");

      setTimeout(() => (window.location.href = "../index.html"), 600);
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
      const res = await postAuth("/password/forgot", { email });

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
      const res = await postAuth("/password/reset", { token, newPassword });

      window.ui?.setAlert(box, res?.message || "Password reset successful. You can now sign in.", "success");
      clearAuth();

      setTimeout(() => (window.location.href = "login.html"), 900);
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


