// assets/js/nav-areas.js
(function () {
  const areas = [
    { name: "Gudele", href: "../propertyManagement/Gudele.html" },
    { name: "Muniki", href: "../propertyManagement/Muniki.html" },
    { name: "Jebel", href: "../propertyManagement/Jebel.html" },
    { name: "Joppa", href: "../propertyManagement/Joppa.html" },
    { name: "Kator", href: "../propertyManagement/Kator.html" },
    { name: "Lemongaba", href: "../propertyManagement/Lemongaba.html" },
    { name: "Nyakuron", href: "../propertyManagement/Nyakuron.html" },
    { name: "Rock City", href: "../propertyManagement/RockCity.html" },
    { name: "Gurei", href: "../propertyManagement/Gurei.html" },
  ];

  function findMenu() {
    const byId = document.getElementById("areasMenu");
    if (byId) return byId;

    // fallback: find the AREAS WE COVER dropdown menu by matching the trigger text
    const links = Array.from(document.querySelectorAll(".nav-item.dropdown > a.nav-link"));
    const trigger = links.find(a => (a.textContent || "").trim().toUpperCase().includes("AREAS WE COVER"));
    if (!trigger) return null;

    const li = trigger.closest(".nav-item.dropdown");
    return li ? li.querySelector(".dropdown-menu") : null;
  }

  function build() {
    const menu = findMenu();
    if (!menu) return;

    // don’t duplicate if already filled
    if (menu.children.length > 0) return;

    menu.innerHTML = areas
      .map(a => `<li><a class="dropdown-item" href="${a.href}">${a.name}</a></li>`)
      .join("");
  }

  document.addEventListener("DOMContentLoaded", build);
})();