// assets/js/main.js
(function () {
  function el(selector, root = document) {
    return root.querySelector(selector);
  }

  function setAlert(container, message, type = "info") {
    if (!container) return;
    container.innerHTML = `
      <div class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${escapeHtml(message)}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `;
  }

  function clearAlert(container) {
    if (!container) return;
    container.innerHTML = "";
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setLoading(button, isLoading, loadingText = "Please wait...") {
    if (!button) return;
    if (isLoading) {
      button.dataset._oldText = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `
        <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
        ${escapeHtml(loadingText)}
      `;
    } else {
      button.disabled = false;
      if (button.dataset._oldText) button.innerHTML = button.dataset._oldText;
      delete button.dataset._oldText;
    }
  }

  window.ui = { el, setAlert, clearAlert, setLoading };
})();