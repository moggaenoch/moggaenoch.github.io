// assets/js/listings.js
document.addEventListener("DOMContentLoaded", () => {
  const filterSection = document.getElementById("filter-section");
  if (!filterSection) return;

  const form = filterSection.querySelector("form");
  const locationEl = document.getElementById("location-filter");
  const priceEl = document.getElementById("price-filter");
  const bedsEl = document.getElementById("bedrooms-filter");
  const applyBtn = document.getElementById("btnApplyFilters");

  const scroller = document.getElementById("hottestScroll");

  if (!form || !locationEl || !priceEl || !bedsEl || !scroller) {
    console.warn("Filter init failed: missing elements");
    return;
  }

  const getItems = () => Array.from(scroller.querySelectorAll(".hottest-item"));
  const norm = (s) => String(s || "").trim().toLowerCase();

  const LOCS = [
    "munuki", "gudele", "hai amarat", "hai-amarat", "serikat",
    "tongping", "jebel", "nyakuron", "kator"
  ];

  function parsePrice(item) {
    const badge = item.querySelector(".badge");
    const txt = norm(badge?.textContent);
    const m = txt.match(/\$([\d,]+)/);
    if (!m) return null;
    return Number(m[1].replace(/,/g, ""));
  }

  function parseBedrooms(item) {
    const p = item.querySelector(".text-muted.small");
    const txt = norm(p?.textContent);
    const m = txt.match(/(\d+)\s*bed/);
    if (!m) return null;
    return Number(m[1]);
  }

  function parseLocation(item) {
    const title = norm(item.querySelector("h3")?.textContent);

    for (const loc of LOCS) {
      const token = loc.replace("-", " ");
      if (title.includes(token) || title.includes(loc)) {
        return loc.includes(" ") ? loc.replace(" ", "-") : loc;
      }
    }

    const text = norm(item.textContent);
    for (const loc of LOCS) {
      const token = loc.replace("-", " ");
      if (text.includes(token) || text.includes(loc)) {
        return loc.includes(" ") ? loc.replace(" ", "-") : loc;
      }
    }

    return "";
  }

  function matchPriceRange(price, rangeVal) {
    if (!rangeVal) return true;
    if (price == null) return false;

    if (rangeVal.includes("+")) {
      const min = Number(rangeVal.replace("+", ""));
      return price >= min;
    }

    const [minS, maxS] = rangeVal.split("-");
    const min = Number(minS);
    const max = Number(maxS);
    return price >= min && price <= max;
  }

  function matchBeds(beds, bedsVal) {
    if (!bedsVal) return true;
    if (beds == null) return false;

    if (bedsVal.includes("+")) {
      const min = Number(bedsVal.replace("+", ""));
      return beds >= min;
    }
    return beds === Number(bedsVal);
  }

  function applyFilters() {
    const selectedLoc = norm(locationEl.value);
    const selectedPrice = norm(priceEl.value);
    const selectedBeds = norm(bedsEl.value);

    const items = getItems();
    let shown = 0;

    items.forEach((item) => {
      const loc = norm(parseLocation(item));
      const price = parsePrice(item);
      const beds = parseBedrooms(item);

      const ok =
        (!selectedLoc || loc === selectedLoc) &&
        matchPriceRange(price, selectedPrice) &&
        matchBeds(beds, selectedBeds);

      item.style.display = ok ? "" : "none";
      if (ok) shown++;
    });

    // optional "no results" message
    let msg = document.getElementById("filterNoResults");
    if (!msg) {
      msg = document.createElement("div");
      msg.id = "filterNoResults";
      msg.className = "alert alert-warning mt-3";
      msg.style.display = "none";
      msg.textContent = "No properties match your filters.";
      scroller.parentElement?.appendChild(msg);
    }
    msg.style.display = shown === 0 ? "block" : "none";
  }

  // ✅ Apply button click (most reliable)
  applyBtn?.addEventListener("click", () => applyFilters());

  // ✅ Prevent Enter key from submitting/reloading
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    applyFilters();
  });

  // ✅ Reset button re-shows everything
  form.addEventListener("reset", () => {
    setTimeout(applyFilters, 0);
  });

  // Optional: live filtering on change
  [locationEl, priceEl, bedsEl].forEach((el) => el.addEventListener("change", applyFilters));

  applyFilters();
});
