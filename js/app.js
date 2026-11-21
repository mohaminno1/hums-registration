/**
 * ============================================================================
 * منطق رندرینگ و تعاملات راهنمای روز ثبت‌نام (app.js)
 * Zero-Dependency Vanilla JavaScript
 * ============================================================================
 */

(function () {
  "use strict";

  const DATA = window.GUIDE_DATA;
  if (!DATA) return;

  const STORAGE_KEYS = {
    checklist: `reg_guide_${DATA.storageVersion}_checklist`,
    steps: `reg_guide_${DATA.storageVersion}_steps`
  };

  // تبدیل تمام ارقام لاتین به ارقام فارسی
  function toFaDigits(input) {
    const fa = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
    return String(input).replace(/\d/g, (d) => fa[Number(d)]);
  }

  // خواندن و نوشتن ایمن در localStorage
  function loadStoredSet(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  }

  function saveStoredSet(key, setObj) {
    try {
      localStorage.setItem(key, JSON.stringify(Array.from(setObj)));
    } catch {
      // در حالت Private Browsing یا پر بودن حافظه خطا نادیده گرفته می‌شود
    }
  }

  // وضعیت برنامه
  const state = {
    checkedDocs: loadStoredSet(STORAGE_KEYS.checklist),
    doneSteps: loadStoredSet(STORAGE_KEYS.steps),
    checklistFilter: "all",
    faqQuery: "",
    zoom: 1
  };

  // آیکون‌های خطی Inline SVG (stroke-width="1.6")
  const ICONS = {
    alert: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    info: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
    mapPin: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
    check: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    copy: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
    external: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`,
    chevron: `<svg class="icon faq-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>`
  };

  // نمایش Toast
  let toastTimer = null;
  function showToast(message) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove("is-visible");
    }, 2500);
  }

  // کپی متن در کلیپ‌بورد با fallback
  async function copyToClipboard(text, successMsg) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const temp = document.createElement("textarea");
        temp.value = text;
        temp.style.position = "fixed";
        temp.style.opacity = "0";
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        document.body.removeChild(temp);
      }
      showToast(successMsg);
    } catch {
      showToast("کپی خودکار انجام نشد؛ لطفاً دستی کپی کنید.");
    }
  }

  // ==========================================================================
  // ۱. رندر هدر، فوتر و اشتراک‌گذاری
  // ==========================================================================
  function renderHeaderAndFooter() {
    document.getElementById("faculty-badge").textContent = DATA.meta.facultyBadge;
    document.getElementById("academic-term").textContent = toFaDigits(DATA.meta.academicTerm);
    document.getElementById("site-title").textContent = DATA.meta.title;
    document.getElementById("site-subtitle").textContent = DATA.meta.subtitle;
    document.getElementById("footer-note").textContent = DATA.meta.footerNote;

    const shareBtn = document.getElementById("share-btn");
    shareBtn.addEventListener("click", async () => {
      const shareData = {
        title: DATA.meta.title,
        text: `${DATA.meta.title} — ${DATA.meta.facultyBadge}`,
        url: window.location.href
      };
      if (navigator.share) {
        try {
          await navigator.share(shareData);
          return;
        } catch (err) {
          if (err && err.name === "AbortError") return;
        }
      }
      copyToClipboard(window.location.href, "لینک صفحه کپی شد.");
    });

    const printBtn = document.getElementById("print-btn");
    printBtn.addEventListener("click", () => window.print());
  }

  // ==========================================================================
  // ۲. نوار چسبان Scroll-Spy
  // ==========================================================================
  function initScrollSpy() {
    const sections = [
      "section-checklist",
      "section-stepper",
      "section-campus",
      "section-status-faq"
    ]
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    const navLinks = Array.from(document.querySelectorAll(".jump-link"));
    if (!sections.length || !navLinks.length) return;

    function setActiveLink(id) {
      navLinks.forEach((link) => {
        const match = link.dataset.target === id;
        link.classList.toggle("is-active", match);
        if (match) {
          link.setAttribute("aria-current", "location");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveLink(visible[0].target.id);
        }
      },
      {
        rootMargin: "-80px 0px -65% 0px",
        threshold: 0
      }
    );

    sections.forEach((sec) => observer.observe(sec));

    navLinks.forEach((link) => {
      link.addEventListener("click", () => {
        setActiveLink(link.dataset.target);
      });
    });
  }

  // ==========================================================================
  // ۳. بخش اول: چک‌لیست تعاملی مدارک
  // ==========================================================================
  function renderChecklist() {
    const listEl = document.getElementById("checklist-list");
    const emptyEl = document.getElementById("checklist-empty");
    const total = DATA.checklist.length;
    const completed = DATA.checklist.filter((item) => state.checkedDocs.has(item.id)).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    document.getElementById("checklist-progress-text").textContent =
      `${toFaDigits(completed)} از ${toFaDigits(total)} مورد آماده شده`;
    document.getElementById("checklist-progress-percent").textContent = `${toFaDigits(percent)}٪`;
    document.getElementById("checklist-progress-fill").style.width = `${percent}%`;
    document.getElementById("checklist-progressbar").setAttribute("aria-valuenow", String(percent));

    const filtered = DATA.checklist.filter((item) => {
      if (state.checklistFilter === "remaining") {
        return !state.checkedDocs.has(item.id);
      }
      return true;
    });

    listEl.innerHTML = "";
    emptyEl.classList.toggle("hidden", filtered.length > 0);

    filtered.forEach((item) => {
      const checked = state.checkedDocs.has(item.id);
      const li = document.createElement("li");
      li.className = `checklist-item${checked ? " is-checked" : ""}`;

      li.innerHTML = `
        <label class="checklist-label">
          <input type="checkbox" class="checklist-checkbox" data-doc-id="${item.id}" ${checked ? "checked" : ""} />
          <div class="checklist-body">
            <div class="checklist-title-row">
              <span class="checklist-title">${toFaDigits(item.title)}</span>
              ${item.qty ? `<span class="checklist-qty">${toFaDigits(item.qty)}</span>` : ""}
            </div>
            ${item.subNote ? `<p class="checklist-subnote">${toFaDigits(item.subNote)}</p>` : ""}
            ${
              item.warning
                ? `<div class="alert-callout" role="note">${ICONS.alert}<span>${toFaDigits(item.warning)}</span></div>`
                : ""
            }
          </div>
        </label>
      `;

      const checkbox = li.querySelector(".checklist-checkbox");
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          state.checkedDocs.add(item.id);
        } else {
          state.checkedDocs.delete(item.id);
        }
        saveStoredSet(STORAGE_KEYS.checklist, state.checkedDocs);
        renderChecklist();
      });

      listEl.appendChild(li);
    });
  }

  function initChecklistControls() {
    const filterButtons = document.querySelectorAll("[data-checklist-filter]");
    filterButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        state.checklistFilter = btn.dataset.checklistFilter;
        filterButtons.forEach((b) => b.classList.toggle("is-active", b === btn));
        renderChecklist();
      });
    });

    document.getElementById("checklist-reset-btn").addEventListener("click", () => {
      if (state.checkedDocs.size === 0) {
        showToast("چک‌لیست همین الان خالی است.");
        return;
      }
      state.checkedDocs.clear();
      saveStoredSet(STORAGE_KEYS.checklist, state.checkedDocs);
      renderChecklist();
      showToast("تیک‌های چک‌لیست پاک شد.");
    });
  }

  // ==========================================================================
  // ۴. بخش دوم: مسیر مرحله‌به‌مرحله + اتصال به نقشه
  // ==========================================================================
  let highlightTimer = null;
  function highlightMapPin(pinId, scrollTarget = "map") {
    const legendItem = document.getElementById(`legend-${pinId}`);
    const mapPreview = document.getElementById("map-preview-shell");
    const pinMarkers = document.querySelectorAll(`.map-pin-marker[data-pin-id="${pinId}"]`);

    document.querySelectorAll(".legend-item.is-highlighted, .map-pin-marker.is-highlighted").forEach((el) => {
      el.classList.remove("is-highlighted");
    });

    if (legendItem) legendItem.classList.add("is-highlighted");
    pinMarkers.forEach((el) => el.classList.add("is-highlighted"));

    if (scrollTarget === "map" && mapPreview) {
      mapPreview.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (scrollTarget === "legend" && legendItem) {
      legendItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    clearTimeout(highlightTimer);
    highlightTimer = setTimeout(() => {
      if (legendItem) legendItem.classList.remove("is-highlighted");
      pinMarkers.forEach((el) => el.classList.remove("is-highlighted"));
    }, 2600);
  }

  function renderStepper() {
    const listEl = document.getElementById("stepper-list");
    const total = DATA.steps.length;
    const doneCount = DATA.steps.filter((s) => state.doneSteps.has(s.id)).length;
    document.getElementById("stepper-progress-text").textContent =
      `${toFaDigits(doneCount)} از ${toFaDigits(total)} مرحله انجام شده`;

    listEl.innerHTML = "";

    DATA.steps.forEach((step, idx) => {
      const isDone = state.doneSteps.has(step.id);
      const li = document.createElement("li");
      li.className = `step-item${isDone ? " is-done" : ""}`;

      li.innerHTML = `
        <div class="step-node" aria-hidden="true">
          ${isDone ? ICONS.check : toFaDigits(idx + 1)}
        </div>
        <article class="card step-card">
          <div class="step-card-header">
            <div>
              <div class="step-kicker">مرحله ${toFaDigits(idx + 1)}</div>
              <h3 class="step-title">${toFaDigits(step.title)}</h3>
              <div class="step-location">
                ${ICONS.mapPin}
                <span>${toFaDigits(step.location)}</span>
              </div>
            </div>
          </div>

          <ul class="step-meta-list">
            <li class="step-meta-row">
              <span class="step-meta-key">مدارک این مرحله:</span>
              <span>${toFaDigits(step.docs)}</span>
            </li>
          </ul>

          ${step.tip ? `<div class="step-tip">نکته: ${toFaDigits(step.tip)}</div>` : ""}

          <div class="step-actions">
            <button type="button" class="btn-step-done" data-step-id="${step.id}" aria-pressed="${isDone}">
              ${ICONS.check}
              <span>${isDone ? "انجام شد" : "انجام دادم"}</span>
            </button>
            ${
              step.mapPinId
                ? `<button type="button" class="btn-map-jump" data-pin-id="${step.mapPinId}">
                    ${ICONS.mapPin}
                    <span>نمایش روی نقشه</span>
                  </button>`
                : ""
            }
          </div>
        </article>
      `;

      li.querySelector(".btn-step-done").addEventListener("click", () => {
        if (state.doneSteps.has(step.id)) {
          state.doneSteps.delete(step.id);
        } else {
          state.doneSteps.add(step.id);
        }
        saveStoredSet(STORAGE_KEYS.steps, state.doneSteps);
        renderStepper();
      });

      const jumpBtn = li.querySelector(".btn-map-jump");
      if (jumpBtn) {
        jumpBtn.addEventListener("click", () => highlightMapPin(step.mapPinId, "map"));
      }

      listEl.appendChild(li);
    });
  }

  // ==========================================================================
  // ۵. بخش سوم: نقشه دانشگاه (Lightbox + Zoom/Pan) و کانال‌ها
  // ==========================================================================
  function renderPinsLayer(containerEl, isLightbox) {
    if (!containerEl) return;
    containerEl.innerHTML = "";

    DATA.map.pins.forEach((pin) => {
      if (typeof pin.x !== "number" || typeof pin.y !== "number") return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "map-pin-marker";
      btn.dataset.pinId = pin.id;
      btn.style.left = `${pin.x}%`;
      btn.style.top = `${pin.y}%`;
      btn.setAttribute("aria-label", `${toFaDigits(pin.number)} — ${pin.name}`);
      btn.innerHTML = `
        <span class="map-pin-dot">${toFaDigits(pin.number)}</span>
        <span class="map-pin-label">${toFaDigits(pin.name)}</span>
      `;

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        highlightMapPin(pin.id, isLightbox ? "none" : "legend");
        showToast(`${toFaDigits(pin.number)}. ${pin.name}`);
      });

      containerEl.appendChild(btn);
    });
  }

  function renderMapAndLegend() {
    document.getElementById("map-title").textContent = DATA.map.title;
    document.getElementById("map-subtitle").textContent = toFaDigits(DATA.map.subtitle);

    const extNote = document.getElementById("campus-external-note");
    if (DATA.map.externalNoteText) {
      extNote.classList.remove("hidden");
      extNote.innerHTML = `
        ${ICONS.info}
        <div>
          <strong>${DATA.map.externalNoteTitle}:</strong>
          <span>${toFaDigits(DATA.map.externalNoteText)}</span>
        </div>
      `;
    }

    const previewImg = document.getElementById("campus-map-img");
    const lightboxImg = document.getElementById("lightbox-map-img");

    function applySrc(img) {
      img.src = DATA.map.imageUrl;
      img.onerror = () => {
        if (img.src.indexOf(DATA.map.fallbackUrl) === -1) {
          img.src = DATA.map.fallbackUrl;
        }
      };
    }

    applySrc(previewImg);
    applySrc(lightboxImg);

    renderPinsLayer(document.getElementById("map-pins-layer"), false);
    renderPinsLayer(document.getElementById("lightbox-pins-layer"), true);

    const legendList = document.getElementById("map-legend-list");
    legendList.innerHTML = "";

    DATA.map.pins.forEach((pin) => {
      const li = document.createElement("li");
      li.className = "legend-item";
      li.id = `legend-${pin.id}`;
      li.tabIndex = 0;
      li.setAttribute("role", "button");
      li.innerHTML = `
        <span class="legend-pin">${toFaDigits(pin.number)}</span>
        <div>
          <div class="legend-name">${toFaDigits(pin.name)}</div>
          <div class="legend-desc">${toFaDigits(pin.desc)}</div>
        </div>
      `;

      const selectPin = () => highlightMapPin(pin.id, "map");
      li.addEventListener("click", selectPin);
      li.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectPin();
        }
      });

      legendList.appendChild(li);
    });
  }

  function initLightbox() {
    const lightbox = document.getElementById("map-lightbox");
    const openBtn = document.getElementById("open-lightbox-btn");
    const previewTrigger = document.getElementById("map-preview-trigger");
    const closeBtn = document.getElementById("lightbox-close-btn");
    const zoomInBtn = document.getElementById("zoom-in-btn");
    const zoomOutBtn = document.getElementById("zoom-out-btn");
    const zoomResetBtn = document.getElementById("zoom-reset-btn");
    const zoomText = document.getElementById("zoom-level-text");
    const viewport = document.getElementById("lightbox-viewport");
    const stage = document.getElementById("lightbox-stage");

    function updateZoom() {
      const pct = Math.round(state.zoom * 100);
      zoomText.textContent = `${toFaDigits(pct)}٪`;
      stage.style.width = `${pct}%`;
      stage.style.maxWidth = state.zoom > 1 ? "none" : "1100px";
    }

    function openLightbox() {
      state.zoom = 1;
      updateZoom();
      lightbox.hidden = false;
      document.body.style.overflow = "hidden";
      closeBtn.focus();
    }

    function closeLightbox() {
      lightbox.hidden = true;
      document.body.style.overflow = "";
      openBtn.focus();
    }

    openBtn.addEventListener("click", openLightbox);
    previewTrigger.addEventListener("click", openLightbox);
    previewTrigger.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openLightbox();
      }
    });
    closeBtn.addEventListener("click", closeLightbox);

    zoomInBtn.addEventListener("click", () => {
      state.zoom = Math.min(3, +(state.zoom + 0.35).toFixed(2));
      updateZoom();
    });

    zoomOutBtn.addEventListener("click", () => {
      state.zoom = Math.max(0.8, +(state.zoom - 0.35).toFixed(2));
      updateZoom();
    });

    zoomResetBtn.addEventListener("click", () => {
      state.zoom = 1;
      updateZoom();
      viewport.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !lightbox.hidden) {
        closeLightbox();
      }
    });

    // جابه‌جایی نقشه با کشیدن ماوس (Pan)
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let scrollLeft = 0;
    let scrollTop = 0;

    viewport.addEventListener("mousedown", (e) => {
      isDragging = true;
      viewport.classList.add("is-dragging");
      startX = e.pageX - viewport.offsetLeft;
      startY = e.pageY - viewport.offsetTop;
      scrollLeft = viewport.scrollLeft;
      scrollTop = viewport.scrollTop;
    });

    viewport.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      e.preventDefault();
      const x = e.pageX - viewport.offsetLeft;
      const y = e.pageY - viewport.offsetTop;
      viewport.scrollLeft = scrollLeft - (x - startX);
      viewport.scrollTop = scrollTop - (y - startY);
    });

    const stopDrag = () => {
      isDragging = false;
      viewport.classList.remove("is-dragging");
    };
    viewport.addEventListener("mouseup", stopDrag);
    viewport.addEventListener("mouseleave", stopDrag);
  }

  function renderAssociations() {
    const gridEl = document.getElementById("associations-grid");
    gridEl.innerHTML = "";

    DATA.associations.forEach((assoc) => {
      const isPlaceholder = assoc.url.startsWith("#");
      const card = document.createElement("article");
      card.className = `card assoc-card${isPlaceholder ? " is-placeholder" : ""}`;
      card.innerHTML = `
        <div>
          <div class="assoc-top">
            <h4 class="assoc-name">${toFaDigits(assoc.name)}</h4>
            ${assoc.platform ? `<span class="assoc-cat-tag">${assoc.platform}</span>` : ""}
          </div>
          <p class="assoc-desc">${toFaDigits(assoc.desc)}</p>
        </div>
        <div class="assoc-actions">
          <button type="button" class="assoc-btn assoc-btn-copy" data-handle="${assoc.handle}">
            ${ICONS.copy}
            <span>کپی آیدی</span>
          </button>
          <a href="${assoc.url}" ${isPlaceholder ? "" : 'target="_blank" rel="noopener noreferrer"'} class="assoc-btn assoc-btn-link">
            ${ICONS.external}
            <span>ورود به کانال</span>
          </a>
        </div>
      `;

      card.querySelector(".assoc-btn-copy").addEventListener("click", () => {
        if (isPlaceholder) {
          showToast("این بخش فعلاً موقت است و به‌زودی تکمیل می‌شود.");
          return;
        }
        copyToClipboard(assoc.handle, `آیدی ${assoc.handle} کپی شد.`);
      });

      if (isPlaceholder) {
        card.querySelector(".assoc-btn-link").addEventListener("click", (e) => {
          e.preventDefault();
          showToast("لینک این بخش هنوز اضافه نشده است.");
        });
      }

      gridEl.appendChild(card);
    });
  }

  // ==========================================================================
  // ۶. بخش چهارم: تابلوی وضعیت و سوالات متداول
  // ==========================================================================
  function renderStatusBoard() {
    document.getElementById("status-last-updated").textContent =
      `آخرین به‌روزرسانی: ${toFaDigits(DATA.statusBoard.lastUpdated)}`;

    const gridEl = document.getElementById("status-grid");
    gridEl.innerHTML = "";

    DATA.statusBoard.items.forEach((item) => {
      const stateClass =
        item.state === "confirmed"
          ? "status-confirmed"
          : item.state === "pending"
          ? "status-pending"
          : "status-unknown";

      const card = document.createElement("article");
      card.className = "card status-card";
      card.innerHTML = `
        <div class="status-card-top">
          <h4 class="status-title">${toFaDigits(item.title)}</h4>
          <span class="status-badge ${stateClass}">${toFaDigits(item.badgeText)}</span>
        </div>
        <p class="status-detail">${toFaDigits(item.detail)}</p>
      `;
      gridEl.appendChild(card);
    });
  }

  function renderFaqs() {
    const listEl = document.getElementById("faq-list");
    const emptyEl = document.getElementById("faq-empty");
    const q = state.faqQuery.trim().toLowerCase();

    const filtered = DATA.faqs.filter((item) => {
      if (!q) return true;
      return item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q);
    });

    listEl.innerHTML = "";
    emptyEl.classList.toggle("hidden", filtered.length > 0);

    filtered.forEach((item, index) => {
      const wrapper = document.createElement("article");
      wrapper.className = "card faq-item";
      const panelId = `faq-panel-${index}`;

      wrapper.innerHTML = `
        <button type="button" class="faq-trigger" aria-expanded="false" aria-controls="${panelId}">
          <span>${toFaDigits(item.q)}</span>
          ${ICONS.chevron}
        </button>
        <div class="faq-panel" id="${panelId}">
          <div class="faq-panel-inner">
            <p class="faq-answer">${toFaDigits(item.a)}</p>
          </div>
        </div>
      `;

      const btn = wrapper.querySelector(".faq-trigger");
      btn.addEventListener("click", () => {
        const isOpen = wrapper.classList.toggle("is-open");
        btn.setAttribute("aria-expanded", String(isOpen));
      });

      listEl.appendChild(wrapper);
    });
  }

  function initFaqSearch() {
    const input = document.getElementById("faq-search-input");
    const clearBtn = document.getElementById("faq-search-clear");

    input.addEventListener("input", () => {
      state.faqQuery = input.value;
      clearBtn.classList.toggle("hidden", !input.value);
      renderFaqs();
    });

    clearBtn.addEventListener("click", () => {
      input.value = "";
      state.faqQuery = "";
      clearBtn.classList.add("hidden");
      renderFaqs();
      input.focus();
    });
  }

  // ==========================================================================
  // راه‌اندازی اولیه
  // ==========================================================================
  function init() {
    renderHeaderAndFooter();
    initChecklistControls();
    renderChecklist();
    renderStepper();
    renderMapAndLegend();
    initLightbox();
    renderAssociations();
    renderStatusBoard();
    initFaqSearch();
    renderFaqs();
    initScrollSpy();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
