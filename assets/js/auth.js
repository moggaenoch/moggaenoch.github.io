// assets/js/auth.js
(function () {
  function alertBox() {
    return document.querySelector("[data-auth-alert]");
  }

  function saveAuth(token, user) {
    localStorage.setItem(window.APP_CONFIG.AUTH_TOKEN_KEY, token);
    localStorage.setItem(window.APP_CONFIG.AUTH_USER_KEY, JSON.stringify(user || {}));
  }

  function clearAuth() {
    localStorage.removeItem(window.APP_CONFIG.AUTH_TOKEN_KEY);
    localStorage.removeItem(window.APP_CONFIG.AUTH_USER_KEY);
  }

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
      // Backend should implement: POST /auth/login { username, password }
      const res = await window.http.post("/auth/login", { username, password });

      // Expect { token, user } (common pattern)
      if (!res?.token) throw new Error("Login response missing token.");

      saveAuth(res.token, res.user);

      window.ui?.setAlert(box, "Login successful. Redirecting...", "success");

      // Change redirect if you have a dashboard page
      setTimeout(() => {
        window.location.href = "index.html";
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
      // Backend should implement: POST /auth/forgot-password { email }
      const res = await window.http.post("/auth/forgot-password", { email });

      // backend can return { message: "..." }
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

  // ---------- RESET PASSWORD (token-based) ----------
  // For a page like reset.html?token=XXXX with inputs: newPassword, confirmPassword
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
      // Backend should implement: POST /auth/reset-password { token, newPassword }
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

  // Optional helper if you want a logout button somewhere
  window.logout = function logout(redirectTo = "index.html") {
    clearAuth();
    window.location.href = redirectTo;
  };
})();