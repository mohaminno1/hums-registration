/**
 * ============================================================================
 * منطق رندرینگ و تعاملات راهنمای روز ثبت‌نام (app.js)
 * Zero-Dependency Vanilla JavaScript — Single Source of Truth State
 * ============================================================================
 */

(function () {
  "use strict";

  const DATA = window.GUIDE_DATA;
  if (!DATA) return;

  const STORAGE_KEYS = {
    checklist: `reg_guide_${DATA.storageVersion}_checklist`,
    conditions: `reg_guide_${DATA.storageVersion}_conditions`,
    major: `reg_guide_${DATA.storageVersion}_major`,
    steps: `reg_guide_${DATA.storageVersion}_steps`,
    faculty: `reg_guide_${DATA.storageVersion}_faculty`
  };

  // تبدیل تمام ارقام لاتین به ارقام فارسی (برای متن ساده)
  function toFaDigits(input) {
    const fa = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
    return String(input).replace(/\d/g, (d) => fa[Number(d)]);
  }

  // تبدیل ارقام به فارسی فقط در متن خارج از تگ‌های HTML (حفظ کامل href، tel: و کلاس‌ها)
  function toFaDigitsHtml(html) {
    return String(html).replace(/(<[^>]+>)|([^<]+)/g, (match, tag, text) => {
      if (tag) return tag;
      return toFaDigits(text);
    });
  }

  // نرمال‌سازی متن فارسی برای جستجوی دقیق در سوالات متداول
  function normalizeFa(text) {
    const faDigits = "۰۱۲۳۴۵۶۷۸۹";
    return String(text)
      .replace(/<[^>]+>/g, " ")
      .replace(/ي/g, "ی")
      .replace(/ك/g, "ک")
      .replace(/[\u200c\u200f\u064b-\u065f]/g, "")
      .replace(/[۰-۹]/g, (d) => String(faDigits.indexOf(d)))
      .toLowerCase()
      .trim();
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
      // ignore storage errors in private mode
    }
  }

  function loadStoredConditions() {
    const validIds = new Set((DATA.checklistConditions || []).map((c) => c.id));
    const saved = loadStoredSet(STORAGE_KEYS.conditions);
    return new Set(Array.from(saved).filter((id) => validIds.has(id)));
  }

  function loadStoredMajor() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.major);
      if (saved && DATA.majors && DATA.majors.some((m) => m.id === saved)) {
        return saved;
      }
    } catch {
      // ignore
    }
    return null;
  }

  function loadStoredFaculty(majorId) {
    if (majorId && DATA.majors) {
      const m = DATA.majors.find((item) => item.id === majorId);
      if (m) return m.facultyId;
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.faculty);
      if (saved && DATA.faculties && DATA.faculties.some((f) => f.id === saved)) {
        return saved;
      }
    } catch {
      // ignore
    }
    return DATA.faculties && DATA.faculties.length ? DATA.faculties[0].id : null;
  }

  const initialMajorId = loadStoredMajor();

  // وضعیت مشترک سطح بالا (Single Source of Truth)
  const state = {
    checkedDocs: loadStoredSet(STORAGE_KEYS.checklist),
    selectedConditions: loadStoredConditions(),
    selectedMajorId: initialMajorId,
    selectedFacultyId: loadStoredFaculty(initialMajorId),
    doneSteps: loadStoredSet(STORAGE_KEYS.steps),
    statusFilter: "all",
    expandedDocs: new Set(), // پیش‌فرض همه جمع (Collapsed)
    tuitionTableOpen: false,
    faqQuery: "",
    activePinId: null
  };

  // آیکون‌های خطی Inline SVG
  const ICONS = {
    alert: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    info: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
    mapPin: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
    check: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    plus: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
    lock: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`,
    close: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    copy: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
    external: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`,
    chevron: `<svg class="icon faq-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
    phone: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`,
    mail: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`,
    calendar: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
    userCheck: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><polyline points="17 11 19 13 23 9"></polyline></svg>`,
    key: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>`,
    table: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line></svg>`,
    sparkle: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z"></path></svg>`,
    compass: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>`,
    listCheck: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>`
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
  // توابع مرکزی Single Source of Truth (محاسبه چک‌لیست + همگام‌سازی سراسری)
  // ==========================================================================
  function getActiveMajor() {
    if (!state.selectedMajorId || !DATA.majors) return null;
    return DATA.majors.find((m) => m.id === state.selectedMajorId) || null;
  }

  function getChecklistStats() {
    const selectedConditions = Array.from(state.selectedConditions);

    // ۱. فقط آیتم‌هایی که مربوط به شرایط انتخاب‌شده همین کاربر هستند:
    const applicableItems = DATA.checklist.filter((item) => {
      const isExcluded = (item.excludeWhen || []).some((cond) => selectedConditions.includes(cond));
      if (isExcluded) return false;
      return item.condition === "mandatory" || selectedConditions.includes(item.condition);
    });

    // ۲. تعداد تیک‌خورده‌ها حتماً باید اشتراک (Intersection) با applicableItems باشد:
    const applicableCompletedCount = applicableItems.filter((item) =>
      state.checkedDocs.has(item.id)
    ).length;

    const applicableTotalCount = applicableItems.length;
    const remainingCount = Math.max(0, applicableTotalCount - applicableCompletedCount);
    const progressPercent =
      applicableTotalCount === 0
        ? 0
        : Math.round((applicableCompletedCount / applicableTotalCount) * 100);

    // ۳. فیلتر نمایش (همه / باقیمانده / آماده‌شده) فقط روی displayedItems اعمال می‌شود:
    const displayedItems = applicableItems.filter((item) => {
      if (state.statusFilter === "remaining") return !state.checkedDocs.has(item.id);
      if (state.statusFilter === "completed") return state.checkedDocs.has(item.id);
      return true;
    });

    return {
      applicableItems,
      applicableCompletedCount,
      applicableTotalCount,
      remainingCount,
      progressPercent,
      displayedItems
    };
  }

  function toggleCondition(condId) {
    if (state.selectedConditions.has(condId)) {
      state.selectedConditions.delete(condId);
    } else {
      state.selectedConditions.add(condId);
    }
    saveStoredSet(STORAGE_KEYS.conditions, state.selectedConditions);
    syncAllViews();
  }

  function selectMajor(majorId) {
    state.selectedMajorId = majorId || null;
    try {
      if (state.selectedMajorId) {
        localStorage.setItem(STORAGE_KEYS.major, state.selectedMajorId);
      } else {
        localStorage.removeItem(STORAGE_KEYS.major);
      }
    } catch {
      // ignore
    }

    const major = getActiveMajor();
    if (major) {
      state.selectedFacultyId = major.facultyId;
      try {
        localStorage.setItem(STORAGE_KEYS.faculty, major.facultyId);
      } catch {
        // ignore
      }
    }

    renderMyPathCard();
    renderFacultySelector();
    renderStepper();
    updateMapDestinationHighlight();
    if (state.activePinId) {
      renderFloatingPinCard(state.activePinId);
    }
  }

  function updateBottomNavBadge() {
    const badge = document.getElementById("bottom-nav-checklist-badge");
    if (!badge) return;
    const { remainingCount } = getChecklistStats();
    if (remainingCount > 0) {
      badge.textContent = toFaDigits(remainingCount);
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }

  function syncAllViews() {
    renderMyPathCard();
    renderProfileBuilder();
    renderChecklist();
    updateBottomNavBadge();
  }

  // ==========================================================================
  // ۱. رندر هدر، فوتر و اشتراک‌گذاری
  // ==========================================================================
  function renderHeaderAndFooter() {
    document.getElementById("faculty-badge").textContent = DATA.meta.facultyBadge;
    document.getElementById("academic-term").textContent = toFaDigits(DATA.meta.academicTerm);

    const creatorBadgeText = document.getElementById("creator-hero-badge-text");
    if (creatorBadgeText && DATA.meta.creatorBadge) {
      creatorBadgeText.textContent = DATA.meta.creatorBadge;
    }

    document.getElementById("site-title").textContent = DATA.meta.title;
    document.getElementById("site-subtitle").textContent = toFaDigits(DATA.meta.subtitle);

    const authorEl = document.getElementById("footer-author");
    const orgEl = document.getElementById("footer-org");
    const taglineEl = document.getElementById("footer-tagline");
    const channelBtn = document.getElementById("footer-channel-btn");

    if (authorEl) authorEl.textContent = DATA.meta.footerAuthor;
    if (orgEl) orgEl.textContent = DATA.meta.footerOrg;
    if (taglineEl) taglineEl.textContent = toFaDigits(DATA.meta.footerTagline);
    if (channelBtn && DATA.meta.footerChannelUrl) {
      channelBtn.href = DATA.meta.footerChannelUrl;
    }

    document.getElementById("footer-note").textContent = toFaDigits(DATA.meta.footerNote);

    const shareBtn = document.getElementById("share-btn");
    shareBtn.addEventListener("click", async () => {
      const shareData = {
        title: DATA.meta.shareTitle || DATA.meta.title,
        text: DATA.meta.shareText || `${DATA.meta.title} — ${DATA.meta.facultyBadge}`,
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
      const clipboardPayload = `${shareData.text}\n${shareData.url}`;
      copyToClipboard(clipboardPayload, "متن معرفی و لینک راهنما کپی شد.");
    });

    const printBtn = document.getElementById("print-btn");
    printBtn.addEventListener("click", () => window.print());
  }

  // ==========================================================================
  // ۱-الف. کارت «مسیر اختصاصی من» در بالای صفحه (Single Source of Truth)
  // ==========================================================================
  function renderMyPathCard() {
    const card = document.getElementById("my-path-card");
    if (!card || !DATA.majors) return;

    const activeMajor = getActiveMajor();
    const { applicableCompletedCount, applicableTotalCount, progressPercent } = getChecklistStats();

    // گروه‌بندی ۲۰ رشته برای <optgroup>
    const groupsOrder = [];
    const grouped = new Map();
    DATA.majors.forEach((m) => {
      if (!grouped.has(m.group)) {
        grouped.set(m.group, []);
        groupsOrder.push(m.group);
      }
      grouped.get(m.group).push(m);
    });

    const optionsHtml = groupsOrder
      .map((groupName) => {
        const opts = grouped
          .get(groupName)
          .map(
            (m) =>
              `<option value="${m.id}"${state.selectedMajorId === m.id ? " selected" : ""}>${toFaDigits(m.label)}</option>`
          )
          .join("");
        return `<optgroup label="${toFaDigits(groupName)}">${opts}</optgroup>`;
      })
      .join("");

    const quickChipsHtml = (DATA.checklistConditions || [])
      .map((cond) => {
        const isActive = state.selectedConditions.has(cond.id);
        return `
          <button
            type="button"
            class="mypath-cond-chip${isActive ? " is-active" : ""}"
            data-mypath-cond="${cond.id}"
            aria-pressed="${isActive}"
          >
            ${isActive ? ICONS.check : ICONS.plus}
            <span>${toFaDigits(cond.label.split("(")[0].trim())}</span>
          </button>
        `;
      })
      .join("");

    const resultHtml = activeMajor
      ? `
        <div class="mypath-result">
          ${
            activeMajor.warningBanner
              ? `<div class="mypath-warning-banner" role="alert">${ICONS.alert}<span>${toFaDigits(activeMajor.warningBanner)}</span></div>`
              : ""
          }
          <div class="mypath-result-grid">
            <div class="mypath-result-item">
              <span class="mypath-result-kicker">${ICONS.calendar}<span>روز مراجعه حضوری شما</span></span>
              <strong class="mypath-result-value">${toFaDigits(activeMajor.date)}</strong>
              <span class="mypath-result-sub">ثبت‌نام آنلاین هم‌آوا: ۲ تا ۵ آذر ۱۴۰۵ (حضور شخص پذیرفته‌شده الزامی است)</span>
            </div>
            <div class="mypath-result-item">
              <span class="mypath-result-kicker">${ICONS.mapPin}<span>ساختمان و نشانی دقیق</span></span>
              <strong class="mypath-result-value">${toFaDigits(activeMajor.building)}</strong>
              <span class="mypath-result-sub">${toFaDigits(activeMajor.address)}</span>
            </div>
          </div>

          <div class="mypath-footer-row">
            <div class="mypath-progress-pill${progressPercent === 100 && applicableTotalCount > 0 ? " is-complete" : ""}">
              ${ICONS.listCheck}
              <span>${toFaDigits(applicableCompletedCount)} از ${toFaDigits(applicableTotalCount)} مدرک آماده است (${toFaDigits(progressPercent)}٪)</span>
            </div>
            <div class="mypath-cta-row">
              <button type="button" class="mypath-btn-primary" id="mypath-go-checklist">
                ${ICONS.listCheck}
                <span>رفتن به چک‌لیست من</span>
              </button>
              <button type="button" class="mypath-btn-secondary" id="mypath-go-map">
                ${ICONS.mapPin}
                <span>مشاهده ساختمان روی نقشه</span>
              </button>
            </div>
          </div>
        </div>
      `
      : `
        <div class="mypath-placeholder">
          <span>با انتخاب رشته و نیمسال قبولی، تاریخ دقیق مراجعه حضوری، ساختمان ثبت‌نام و مقصد شما روی نقشه فوراً مشخص می‌شود.</span>
          <div class="mypath-progress-pill${progressPercent === 100 && applicableTotalCount > 0 ? " is-complete" : ""}">
            ${ICONS.listCheck}
            <span>چک‌لیست شما: ${toFaDigits(applicableCompletedCount)} از ${toFaDigits(applicableTotalCount)} مدرک آماده است (${toFaDigits(progressPercent)}٪)</span>
          </div>
        </div>
      `;

    card.innerHTML = `
      <div class="mypath-header">
        <div class="mypath-title-wrap">
          <span class="mypath-icon-badge">${ICONS.compass}</span>
          <div>
            <h2 class="mypath-title" id="heading-my-path">مسیر اختصاصی من (تاریخ و مکان دقیق شما)</h2>
            <p class="mypath-subtitle">رشته و شرایط خود را مشخص کنید تا کل راهنما، چک‌لیست و نقشه برایتان شخصی‌سازی شود.</p>
          </div>
        </div>
      </div>

      <div class="mypath-field-group">
        <label for="my-path-major-select" class="mypath-field-label">۱. رشته و نیمسال قبولی:</label>
        <div class="mypath-select-wrap">
          <select id="my-path-major-select" class="mypath-select">
            <option value="">— انتخاب رشته و نیمسال قبولی —</option>
            ${optionsHtml}
          </select>
        </div>
      </div>

      <div class="mypath-field-group">
        <span class="mypath-field-label">۲. شرایط ویژه شما (اختیاری — چندانتخابی):</span>
        <div class="mypath-cond-chips" role="group" aria-label="انتخاب سریع شرایط پذیرش">
          ${quickChipsHtml}
        </div>
      </div>

      ${resultHtml}
    `;

    const selectEl = card.querySelector("#my-path-major-select");
    selectEl.addEventListener("change", (e) => {
      selectMajor(e.target.value);
    });

    card.querySelectorAll("[data-mypath-cond]").forEach((btn) => {
      btn.addEventListener("click", () => {
        toggleCondition(btn.dataset.mypathCond);
      });
    });

    const goChecklistBtn = card.querySelector("#mypath-go-checklist");
    if (goChecklistBtn) {
      goChecklistBtn.addEventListener("click", () => {
        const target = document.getElementById("section-checklist");
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    const goMapBtn = card.querySelector("#mypath-go-map");
    if (goMapBtn && activeMajor) {
      goMapBtn.addEventListener("click", () => {
        focusMapPin(activeMajor.mapPinId, true);
      });
    }
  }

  // ==========================================================================
  // ۱-ب. بخش تقویم و تایملاین جامع ثبت‌نام
  // ==========================================================================
  function renderTimeline() {
    const listEl = document.getElementById("registration-timeline-list");
    const noticeEl = document.getElementById("registration-timeline-notice");
    const tl = DATA.timeline;
    if (!listEl || !tl) return;

    listEl.innerHTML = tl.stages
      .map(
        (stage) => `
        <li class="timeline-stage">
          <div class="timeline-stage-head">
            <span class="timeline-step-num">${toFaDigits(stage.step)}</span>
            <span class="timeline-date-pill">${ICONS.calendar}<span>${toFaDigits(stage.date)}</span></span>
          </div>
          <h3 class="timeline-stage-title">${toFaDigits(stage.title)}</h3>
          ${stage.note ? `<p class="timeline-stage-note">${toFaDigits(stage.note)}</p>` : ""}
        </li>
      `
      )
      .join("");

    if (noticeEl && tl.noticeText) {
      noticeEl.innerHTML = `
        ${ICONS.info}
        <div>
          <strong>${toFaDigits(tl.noticeTitle)}</strong>
          <span>${toFaDigits(tl.noticeText)}</span>
        </div>
      `;
    }
  }

  // ==========================================================================
  // ۲. Scroll-Spy هوشمند برای هر دو نوار ناوبری (دسکتاپ بالا + موبایل پایین)
  // ==========================================================================
  function initScrollSpy() {
    const sectionIds = [
      "section-my-path",
      "section-timeline",
      "section-checklist",
      "section-stepper",
      "section-campus",
      "section-status-faq"
    ];

    const sections = sectionIds.map((id) => document.getElementById(id)).filter(Boolean);
    const desktopLinks = Array.from(document.querySelectorAll(".jump-link"));
    const mobileTabs = Array.from(document.querySelectorAll(".bottom-tab"));

    function setActiveSection(id) {
      desktopLinks.forEach((link) => {
        const match = link.dataset.target === id;
        link.classList.toggle("is-active", match);
        if (match) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });

      // در نوار موبایل، تقویم و مسیر من هر دو روی «مسیر من» یا نزدیک‌ترین تب مپ می‌شوند
      const mobileTarget = id === "section-timeline" ? "section-my-path" : id;
      mobileTabs.forEach((tab) => {
        const match = tab.dataset.target === mobileTarget;
        tab.classList.toggle("is-active", match);
        if (match) tab.setAttribute("aria-current", "location");
        else tab.removeAttribute("aria-current");
      });
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveSection(visible[0].target.id);
        }
      },
      {
        rootMargin: "-15% 0px -65% 0px",
        threshold: 0
      }
    );

    sections.forEach((sec) => observer.observe(sec));

    [...desktopLinks, ...mobileTabs].forEach((link) => {
      link.addEventListener("click", () => {
        setActiveSection(link.dataset.target);
      });
    });
  }

  // ==========================================================================
  // ۳. بخش اول: چک‌لیست هوشمند (Progressive Disclosure + تاییدیه بازنشانی)
  // ==========================================================================
  function renderOfficialNotice() {
    const box = document.getElementById("official-notice-box");
    const notice = DATA.officialNotice;
    if (!box || !notice) return;

    const linksHtml = (notice.links || [])
      .map(
        (lnk, i) =>
          `<a href="${lnk.url}" target="_blank" rel="noopener noreferrer" class="official-link-btn${i > 0 ? " is-secondary" : ""}">${ICONS.external}<span>${toFaDigits(lnk.label)}</span></a>`
      )
      .join("");

    box.innerHTML = `
      <div class="official-notice-card">
        <p class="official-notice-text">${toFaDigits(notice.text)}</p>
        <div class="official-notice-links">${linksHtml}</div>
      </div>
      ${
        notice.withdrawalWarning
          ? `<div class="alert-callout" role="note">${ICONS.alert}<span>${toFaDigits(notice.withdrawalWarning)}</span></div>`
          : ""
      }
    `;
  }

  function renderPhoneChips(phones, ext) {
    const chips = (phones || [])
      .map(
        (p) =>
          `<a href="${p.href}" class="phone-link-chip" dir="ltr">${ICONS.phone}<span>${p.display}</span></a>`
      )
      .join("");
    const extHtml = ext ? `<span class="phone-ext-note">(${toFaDigits(ext)})</span>` : "";
    return `<div class="phone-links-wrap">${chips}${extHtml}</div>`;
  }

  function buildTuitionCollapsibleElement() {
    const tData = DATA.tuitionTable;
    if (!tData || !tData.rows || !tData.rows.length) return null;

    const wrap = document.createElement("div");
    wrap.className = "checklist-tuition-inline";

    const isOpen = state.tuitionTableOpen;

    const desktopRows = tData.rows
      .map(
        (r) => `
        <tr>
          <td class="tuition-major-cell">${toFaDigits(r.major)}</td>
          <td><span class="tuition-amount-tag">${toFaDigits(r.tuition)}</span></td>
          <td><span class="promissory-amount-tag">${toFaDigits(r.promissory)}</span></td>
          <td>
            ${r.contactPerson ? `<div class="tuition-contact-person">${toFaDigits(r.contactPerson)}</div>` : ""}
            ${renderPhoneChips(r.phones, r.ext)}
          </td>
        </tr>
      `
      )
      .join("");

    const mobileCards = tData.rows
      .map(
        (r) => `
        <div class="tuition-mobile-card">
          <div class="tuition-mobile-title">${toFaDigits(r.major)}</div>
          <div class="tuition-mobile-amounts">
            <div class="tuition-mobile-metric">
              <span class="metric-label">شهریه علی‌الحساب</span>
              <span class="tuition-amount-tag">${toFaDigits(r.tuition)}</span>
            </div>
            <div class="tuition-mobile-metric">
              <span class="metric-label">مبلغ سفته</span>
              <span class="promissory-amount-tag">${toFaDigits(r.promissory)}</span>
            </div>
          </div>
          <div class="tuition-mobile-contact">
            <span class="metric-label">پیگیری${r.contactPerson ? ` (${toFaDigits(r.contactPerson)})` : ""}:</span>
            ${renderPhoneChips(r.phones, r.ext)}
          </div>
        </div>
      `
      )
      .join("");

    const notesHtml = (tData.notes || [])
      .map((n) => `<li>${toFaDigits(n)}</li>`)
      .join("");

    wrap.innerHTML = `
      <div class="tuition-accordion${isOpen ? " is-open" : ""}">
        <button type="button" class="tuition-accordion-trigger" aria-expanded="${isOpen}" aria-controls="tuition-table-panel">
          <span class="tuition-trigger-title">
            ${ICONS.table}
            <span>${toFaDigits(tData.buttonTitle)}</span>
          </span>
          ${ICONS.chevron}
        </button>
        <div class="tuition-accordion-panel" id="tuition-table-panel">
          <div class="tuition-accordion-inner">
            <div class="tuition-table-scroll">
              <table class="tuition-table">
                <thead>
                  <tr>
                    <th>رشته</th>
                    <th>شهریه علی‌الحساب</th>
                    <th>میزان سفته</th>
                    <th>مسئول و شماره پیگیری</th>
                  </tr>
                </thead>
                <tbody>${desktopRows}</tbody>
              </table>
            </div>
            <div class="tuition-mobile-list">${mobileCards}</div>
            ${notesHtml ? `<ul class="tuition-notes-list">${notesHtml}</ul>` : ""}
          </div>
        </div>
      </div>
    `;

    const trigger = wrap.querySelector(".tuition-accordion-trigger");
    const acc = wrap.querySelector(".tuition-accordion");
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      state.tuitionTableOpen = !state.tuitionTableOpen;
      acc.classList.toggle("is-open", state.tuitionTableOpen);
      trigger.setAttribute("aria-expanded", String(state.tuitionTableOpen));
    });

    return wrap;
  }

  function getConditionAddedCount(condId) {
    const selected = Array.from(state.selectedConditions);
    return DATA.checklist.filter((item) => {
      if (item.condition !== condId) return false;
      const isExcluded = (item.excludeWhen || []).some((c) => selected.includes(c));
      return !isExcluded;
    }).length;
  }

  function getMandatoryActiveCount() {
    const selected = Array.from(state.selectedConditions);
    return DATA.checklist.filter((item) => {
      if (item.condition !== "mandatory") return false;
      const isExcluded = (item.excludeWhen || []).some((c) => selected.includes(c));
      return !isExcluded;
    }).length;
  }

  function itemHasDetails(item) {
    return Boolean(
      item.highlightBox ||
        item.subNote ||
        item.subNoteHtml ||
        item.fieldsGuide ||
        (item.links && item.links.length) ||
        item.linkUrl ||
        item.warning ||
        item.attachTuitionTable
    );
  }

  function updateToggleAllButton(displayedItems) {
    const btn = document.getElementById("checklist-toggle-all-btn");
    const label = document.getElementById("checklist-toggle-all-label");
    if (!btn || !label) return;
    const expandableIds = displayedItems.filter(itemHasDetails).map((i) => i.id);
    if (expandableIds.length === 0) {
      btn.classList.add("hidden");
      return;
    }
    btn.classList.remove("hidden");
    const allOpen = expandableIds.every((id) => state.expandedDocs.has(id));
    label.textContent = allOpen ? "بستن همه جزئیات" : "باز کردن همه جزئیات";
    btn.classList.toggle("is-all-open", allOpen);
  }

  function renderProfileBuilder() {
    const container = document.getElementById("checklist-profile-builder");
    if (!container || !DATA.checklistConditions) return;

    const mandatoryCount = getMandatoryActiveCount();

    const chipsHtml = DATA.checklistConditions
      .map((cond) => {
        const isActive = state.selectedConditions.has(cond.id);
        const count = getConditionAddedCount(cond.id);
        return `
          <button
            type="button"
            class="profile-chip${isActive ? " is-active" : ""}"
            data-condition-id="${cond.id}"
            aria-pressed="${isActive}"
          >
            <span class="profile-chip-top">
              <span class="profile-chip-status-icon">${isActive ? ICONS.check : ICONS.plus}</span>
              <span class="profile-chip-label">${toFaDigits(cond.label)}</span>
              <span class="profile-chip-count">+${toFaDigits(count)} مدرک</span>
            </span>
            ${cond.hint ? `<span class="profile-chip-hint">${toFaDigits(cond.hint)}</span>` : ""}
          </button>
        `;
      })
      .join("");

    container.innerHTML = `
      <div class="profile-builder-head">
        <h3 class="profile-builder-title">۱. شرایط خود را انتخاب کنید (امکان انتخاب چند گزینه همزمان):</h3>
        <p class="profile-builder-subtitle">
          مدارک الزامی پایه به صورت خودکار برای همه فعال است. اگر هر یک از شرایط زیر را دارید، رویش کلیک کنید تا مدارکش به چک‌لیست شما اضافه شود:
        </p>
      </div>

      <div class="profile-mandatory-row">
        <span class="profile-mandatory-badge">
          ${ICONS.lock}
          <span>مدارک پایه برای همه فعال است</span>
          <span class="profile-mandatory-count">${toFaDigits(mandatoryCount)} مدرک</span>
        </span>
      </div>

      <div class="profile-chips-grid" role="group" aria-label="شرایط پذیرش من">
        ${chipsHtml}
      </div>
    `;

    container.querySelectorAll("[data-condition-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        toggleCondition(btn.dataset.conditionId);
      });
    });
  }

  function renderChecklist() {
    const listEl = document.getElementById("checklist-list");
    const emptyEl = document.getElementById("checklist-empty");
    const progressBlock = document.getElementById("checklist-progress-block");
    const celebrationEl = document.getElementById("checklist-celebration");

    const {
      applicableCompletedCount,
      applicableTotalCount,
      progressPercent,
      displayedItems
    } = getChecklistStats();

    // به‌روزرسانی نوار پیشرفت و پیام تبریک ۱۰۰٪
    document.getElementById("checklist-progress-text").textContent =
      `${toFaDigits(applicableCompletedCount)} از ${toFaDigits(applicableTotalCount)} مدرک مربوط به شما آماده است (${toFaDigits(progressPercent)}٪)`;
    document.getElementById("checklist-progress-percent").textContent = `${toFaDigits(progressPercent)}٪`;
    document.getElementById("checklist-progress-fill").style.width = `${progressPercent}%`;
    document.getElementById("checklist-progressbar").setAttribute("aria-valuenow", String(progressPercent));

    const isComplete = applicableTotalCount > 0 && progressPercent === 100;
    if (progressBlock) progressBlock.classList.toggle("is-complete", isComplete);
    if (celebrationEl) celebrationEl.classList.toggle("hidden", !isComplete);

    updateToggleAllButton(displayedItems);

    listEl.innerHTML = "";
    if (displayedItems.length === 0) {
      if (state.statusFilter === "remaining") {
        emptyEl.textContent = "عالیه! هیچ مدرک باقیمانده‌ای ندارید 🎉";
      } else if (state.statusFilter === "completed") {
        emptyEl.textContent = "هنوز هیچ مدرکی را به عنوان آماده‌شده تیک نزده‌اید.";
      } else {
        emptyEl.textContent = "موردی برای نمایش وجود ندارد.";
      }
      emptyEl.classList.remove("hidden");
    } else {
      emptyEl.classList.add("hidden");
    }

    let lastGroup = null;
    displayedItems.forEach((item) => {
      if (item.group && item.group !== lastGroup) {
        lastGroup = item.group;
        const groupLi = document.createElement("li");
        groupLi.className = "checklist-group-header";
        const isExtraGroup = item.condition !== "mandatory";
        groupLi.innerHTML = `
          <span>${toFaDigits(item.group)}</span>
          ${isExtraGroup ? `<span class="checklist-group-optional">بر اساس شرایط انتخابی شما</span>` : `<span class="checklist-group-core">الزامی پایه</span>`}
        `;
        listEl.appendChild(groupLi);
      }

      const checked = state.checkedDocs.has(item.id);
      const hasDetails = itemHasDetails(item);
      const isExpanded = hasDetails && state.expandedDocs.has(item.id);

      const li = document.createElement("li");
      li.className = `checklist-item${checked ? " is-checked" : ""}${isExpanded ? " is-expanded" : ""}`;

      const badgeText = item.guide || item.qty || "";

      const highlightHtml = item.highlightBox
        ? `<div class="highlight-callout" role="note">${ICONS.key}<span>${toFaDigits(item.highlightBox)}</span></div>`
        : "";

      const subNoteContent = item.subNoteHtml
        ? `<div class="checklist-subnote">${toFaDigitsHtml(item.subNoteHtml)}</div>`
        : item.subNote
        ? `<p class="checklist-subnote">${toFaDigits(item.subNote)}</p>`
        : "";

      const fieldsGuideHtml = item.fieldsGuide
        ? `
          <div class="fields-guide-box" role="note">
            <div class="fields-guide-title">${toFaDigits(item.fieldsGuide.title)}</div>
            <dl class="fields-guide-list">
              ${item.fieldsGuide.rows
                .map(
                  (row) => `
                  <div class="fields-guide-row">
                    <dt>${toFaDigits(row.label)}:</dt>
                    <dd>
                      <strong>${toFaDigits(row.value)}</strong>
                      ${row.emphasis ? `<span class="fields-guide-emphasis">(${toFaDigits(row.emphasis)})</span>` : ""}
                    </dd>
                  </div>
                `
                )
                .join("")}
            </dl>
          </div>
        `
        : "";

      const linkItems = item.links
        ? item.links
        : item.linkUrl
        ? [{ label: item.linkText || item.linkUrl, url: item.linkUrl, ltr: true }]
        : [];

      const linksHtml = linkItems.length
        ? `<div class="checklist-links-row">${linkItems
            .map(
              (lnk) =>
                `<a href="${lnk.url}" target="_blank" rel="noopener noreferrer" class="checklist-link${lnk.ltr ? " is-ltr" : ""}">${ICONS.external}<span>${toFaDigits(lnk.label)}</span></a>`
            )
            .join("")}</div>`
        : "";

      const panelId = `doc-details-${item.id}`;

      li.innerHTML = `
        <div class="checklist-row-head">
          <label class="checklist-check-area">
            <input type="checkbox" class="checklist-checkbox" data-doc-id="${item.id}" ${checked ? "checked" : ""} />
            <div class="checklist-title-wrap">
              <span class="checklist-title">${toFaDigits(item.title)}</span>
              ${badgeText ? `<span class="checklist-qty">${toFaDigits(badgeText)}</span>` : ""}
            </div>
          </label>
          ${
            hasDetails
              ? `<button type="button" class="checklist-detail-toggle" aria-expanded="${isExpanded}" aria-controls="${panelId}">
                  <span>جزئیات</span>
                  ${ICONS.chevron}
                </button>`
              : ""
          }
        </div>
        ${
          hasDetails
            ? `
          <div class="checklist-details-panel" id="${panelId}">
            <div class="checklist-details-inner">
              <div class="checklist-details-body">
                ${highlightHtml}
                ${subNoteContent}
                ${fieldsGuideHtml}
                ${linksHtml}
                ${
                  item.warning
                    ? `<div class="alert-callout" role="note">${ICONS.alert}<span>${toFaDigits(item.warning)}</span></div>`
                    : ""
                }
              </div>
            </div>
          </div>
        `
            : ""
        }
      `;

      // اتصال جدول شهریه داخل بخش جزئیات آیتم مربوطه
      if (item.attachTuitionTable) {
        const detailsBody = li.querySelector(".checklist-details-body");
        const tuitionEl = buildTuitionCollapsibleElement();
        if (detailsBody && tuitionEl) detailsBody.appendChild(tuitionEl);
      }

      // تفکیک کامل کلیک: چک‌باکس فقط تیک می‌زند + هنگام تیک زدن جزئیات خودکار جمع می‌شود
      const checkbox = li.querySelector(".checklist-checkbox");
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          state.checkedDocs.add(item.id);
          state.expandedDocs.delete(item.id);
        } else {
          state.checkedDocs.delete(item.id);
        }
        saveStoredSet(STORAGE_KEYS.checklist, state.checkedDocs);
        renderChecklist();
        renderMyPathCard();
        updateBottomNavBadge();
      });

      // دکمه جزئیات فقط بخش توضیحات را با انیمیشن نرم باز/بسته می‌کند
      const detailBtn = li.querySelector(".checklist-detail-toggle");
      if (detailBtn) {
        detailBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const nowOpen = !state.expandedDocs.has(item.id);
          if (nowOpen) state.expandedDocs.add(item.id);
          else state.expandedDocs.delete(item.id);
          li.classList.toggle("is-expanded", nowOpen);
          detailBtn.setAttribute("aria-expanded", String(nowOpen));
          updateToggleAllButton(getChecklistStats().displayedItems);
        });
      }

      listEl.appendChild(li);
    });
  }

  function initChecklistControls() {
    const filterButtons = document.querySelectorAll("[data-checklist-filter]");
    filterButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        state.statusFilter = btn.dataset.checklistFilter;
        filterButtons.forEach((b) => b.classList.toggle("is-active", b === btn));
        renderChecklist();
      });
    });

    // باز کردن / بستن همه جزئیات
    const toggleAllBtn = document.getElementById("checklist-toggle-all-btn");
    if (toggleAllBtn) {
      toggleAllBtn.addEventListener("click", () => {
        const { displayedItems } = getChecklistStats();
        const expandableIds = displayedItems.filter(itemHasDetails).map((i) => i.id);
        const allOpen = expandableIds.every((id) => state.expandedDocs.has(id));
        if (allOpen) {
          expandableIds.forEach((id) => state.expandedDocs.delete(id));
        } else {
          expandableIds.forEach((id) => state.expandedDocs.add(id));
        }
        renderChecklist();
      });
    }

    // تاییدیه دو مرحله‌ای درون‌صفحه‌ای برای بازنشانی (بدون window.confirm)
    const resetBtn = document.getElementById("checklist-reset-btn");
    const confirmBar = document.getElementById("checklist-reset-confirm");
    const confirmYes = document.getElementById("checklist-reset-confirm-yes");
    const confirmNo = document.getElementById("checklist-reset-confirm-no");

    resetBtn.addEventListener("click", () => {
      if (state.checkedDocs.size === 0 && state.selectedConditions.size === 0 && state.statusFilter === "all") {
        showToast("چک‌لیست همین الان در حالت پیش‌فرض است.");
        return;
      }
      confirmBar.classList.remove("hidden");
    });

    confirmNo.addEventListener("click", () => {
      confirmBar.classList.add("hidden");
    });

    confirmYes.addEventListener("click", () => {
      state.checkedDocs.clear();
      state.selectedConditions.clear();
      state.expandedDocs.clear();
      state.statusFilter = "all";
      filterButtons.forEach((b) => b.classList.toggle("is-active", b.dataset.checklistFilter === "all"));
      saveStoredSet(STORAGE_KEYS.checklist, state.checkedDocs);
      saveStoredSet(STORAGE_KEYS.conditions, state.selectedConditions);
      confirmBar.classList.add("hidden");
      syncAllViews();
      showToast("همه تیک‌ها و شرایط انتخاب‌شده پاک شد.");
    });
  }

  // ==========================================================================
  // ۴. بخش دوم: مسیر مرحله‌به‌مرحله + برنامه هر دانشکده + اتصال به نقشه
  // ==========================================================================
  function getActiveFaculty() {
    if (!DATA.faculties || !DATA.faculties.length) return null;
    return DATA.faculties.find((f) => f.id === state.selectedFacultyId) || DATA.faculties[0];
  }

  function renderFacultySelector() {
    const box = document.getElementById("faculty-selector-box");
    if (!box || !DATA.faculties || !DATA.faculties.length) return;
    const active = getActiveFaculty();

    const scheduleHtml = (active.schedule || [])
      .map(
        (row) => `
        <li class="faculty-schedule-row">
          <span class="faculty-schedule-program">${toFaDigits(row.program)}</span>
          <span class="faculty-schedule-date">${ICONS.calendar}<span>${toFaDigits(row.date)}</span></span>
        </li>
      `
      )
      .join("");

    box.innerHTML = `
      ${
        DATA.facultyCommonNote
          ? `<div class="faculty-common-note" role="note">${ICONS.info}<span>${toFaDigits(DATA.facultyCommonNote)}</span></div>`
          : ""
      }
      <div class="faculty-selector-label">رشته / دانشکده قبولی خود را انتخاب کنید تا روز، تاریخ و نشانی دقیق ثبت‌نام حضوری نمایش داده شود:</div>
      <div class="faculty-chips-row" role="group" aria-label="انتخاب دانشکده">
        ${DATA.faculties
          .map(
            (f) =>
              `<button type="button" class="chip-btn${f.id === active.id ? " is-active" : ""}" data-faculty-id="${f.id}">${f.label}</button>`
          )
          .join("")}
      </div>

      <div class="faculty-details-panel">
        <div class="faculty-details-top">
          ${
            active.venueAlertTag
              ? `<span class="faculty-alert-tag">${ICONS.alert}<span>${toFaDigits(active.venueAlertTag)}</span></span>`
              : ""
          }
          <div class="faculty-venue-note${active.venueWarning ? " is-warning" : ""}">
            ${active.venueWarning ? ICONS.alert : ICONS.mapPin}
            <div>
              <strong>نشانی دقیق محل ثبت‌نام (${active.label}):</strong> ${toFaDigits(active.venueNote)}
            </div>
          </div>
          ${
            active.attendanceBadge
              ? `<span class="attendance-required-badge">${ICONS.userCheck}<span>${toFaDigits(active.attendanceBadge)}</span></span>`
              : ""
          }
        </div>

        ${
          scheduleHtml
            ? `
          <div class="faculty-schedule-block">
            <div class="faculty-schedule-heading">برنامه دقیق روز و تاریخ مراجعه (${active.label}):</div>
            <ul class="faculty-schedule-list">${scheduleHtml}</ul>
          </div>
        `
            : ""
        }
      </div>
    `;

    box.querySelectorAll("[data-faculty-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.selectedFacultyId = btn.dataset.facultyId;
        try {
          localStorage.setItem(STORAGE_KEYS.faculty, state.selectedFacultyId);
        } catch {
          // ignore
        }
        renderFacultySelector();
        renderStepper();
      });
    });
  }

  function renderStepper() {
    const listEl = document.getElementById("stepper-list");
    const total = DATA.steps.length;
    const doneCount = DATA.steps.filter((s) => state.doneSteps.has(s.id)).length;
    document.getElementById("stepper-progress-text").textContent =
      `${toFaDigits(doneCount)} از ${toFaDigits(total)} مرحله انجام شده`;

    const activeFaculty = getActiveFaculty();
    listEl.innerHTML = "";

    DATA.steps.forEach((step, idx) => {
      const isDone = state.doneSteps.has(step.id);
      const li = document.createElement("li");
      li.className = `step-item${isDone ? " is-done" : ""}`;

      let resolvedLocation = step.location || "";
      let resolvedPinId = step.mapPinId || null;
      if (activeFaculty && step.useFacultyVenue === "step1") {
        resolvedLocation = activeFaculty.step1Location;
        resolvedPinId = activeFaculty.mapPinId;
      } else if (activeFaculty && step.useFacultyVenue === "step2") {
        resolvedLocation = activeFaculty.step2Location;
        resolvedPinId = activeFaculty.mapPinId;
      }

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
                <span>${toFaDigits(resolvedLocation)}</span>
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
              resolvedPinId
                ? `<button type="button" class="btn-map-jump" data-pin-id="${resolvedPinId}">
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
      if (jumpBtn && resolvedPinId) {
        jumpBtn.addEventListener("click", () => focusMapPin(resolvedPinId, true));
      }

      listEl.appendChild(li);
    });
  }

  // ==========================================================================
  // ۵. بخش سوم: نقشه دانشگاه (کارت شناور پین + Pinch-to-Zoom امن بدون تله‌اسکرول)
  // ==========================================================================
  function updateMapDestinationHighlight() {
    const activeMajor = getActiveMajor();
    const destPinId = activeMajor ? activeMajor.mapPinId : null;

    document.querySelectorAll(".map-pin-marker").forEach((el) => {
      el.classList.toggle("is-destination", Boolean(destPinId && el.dataset.pinId === destPinId));
    });

    document.querySelectorAll(".legend-item").forEach((el) => {
      el.classList.toggle("is-destination", Boolean(destPinId && el.id === `legend-${destPinId}`));
    });
  }

  function renderFloatingPinCard(pinId) {
    const pin = DATA.map.pins.find((p) => p.id === pinId);
    const inlineCard = document.getElementById("map-floating-card");
    const lightboxCard = document.getElementById("lightbox-floating-card");
    const cards = [inlineCard, lightboxCard].filter(Boolean);

    if (!pin) {
      state.activePinId = null;
      cards.forEach((c) => c.classList.add("hidden"));
      document.querySelectorAll(".map-pin-marker.is-highlighted, .legend-item.is-highlighted").forEach((el) => {
        el.classList.remove("is-highlighted");
      });
      return;
    }

    state.activePinId = pin.id;
    const activeMajor = getActiveMajor();
    const isUserDestination = Boolean(activeMajor && activeMajor.mapPinId === pin.id);

    // تعیین دانشکده هدف برای دکمه «مشاهده برنامه این دانشکده»
    let targetFacultyId = pin.facultyId || null;
    if (activeMajor && pin.relatedFaculties && pin.relatedFaculties.includes(activeMajor.facultyId)) {
      targetFacultyId = activeMajor.facultyId;
    }

    document.querySelectorAll(".map-pin-marker").forEach((el) => {
      el.classList.toggle("is-highlighted", el.dataset.pinId === pin.id);
    });
    document.querySelectorAll(".legend-item").forEach((el) => {
      el.classList.toggle("is-highlighted", el.id === `legend-${pin.id}`);
    });

    const cardMarkup = `
      <div class="floating-card-head">
        <div class="floating-card-title-row">
          <span class="floating-pin-num">${toFaDigits(pin.number)}</span>
          <h4 class="floating-card-name">${toFaDigits(pin.name)}</h4>
          ${isUserDestination ? `<span class="floating-dest-badge">مقصد ثبت‌نام شما</span>` : ""}
        </div>
        <button type="button" class="floating-card-close" aria-label="بستن اطلاعات ساختمان">${ICONS.close}</button>
      </div>
      ${pin.address ? `<p class="floating-card-address">${ICONS.mapPin}<span>${toFaDigits(pin.address)}</span></p>` : ""}
      <p class="floating-card-desc">${toFaDigits(pin.desc)}</p>
      ${
        targetFacultyId
          ? `
        <div class="floating-card-actions">
          <button type="button" class="floating-faculty-btn" data-jump-faculty="${targetFacultyId}">
            ${ICONS.calendar}
            <span>مشاهده برنامه این دانشکده</span>
          </button>
        </div>
      `
          : ""
      }
    `;

    cards.forEach((c) => {
      c.innerHTML = cardMarkup;
      c.classList.remove("hidden");

      const closeBtn = c.querySelector(".floating-card-close");
      if (closeBtn) {
        closeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          renderFloatingPinCard(null);
        });
      }

      const facBtn = c.querySelector("[data-jump-faculty]");
      if (facBtn) {
        facBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const facId = facBtn.dataset.jumpFaculty;
          state.selectedFacultyId = facId;
          try {
            localStorage.setItem(STORAGE_KEYS.faculty, facId);
          } catch {
            // ignore
          }
          renderFacultySelector();
          renderStepper();

          // اگر لایت‌باکس باز بود ابتدا بسته شود
          const lb = document.getElementById("map-lightbox");
          if (lb && !lb.hidden) {
            lb.hidden = true;
            document.body.style.overflow = "";
          }

          const stepperSec = document.getElementById("section-stepper");
          if (stepperSec) stepperSec.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    });
  }

  function focusMapPin(pinId, scrollToMap) {
    renderFloatingPinCard(pinId);
    if (scrollToMap) {
      const mapPreview = document.getElementById("map-preview-shell");
      if (mapPreview) {
        mapPreview.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }

  function renderPinsLayer(containerEl) {
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
        renderFloatingPinCard(pin.id);
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

    renderPinsLayer(document.getElementById("map-pins-layer"));
    renderPinsLayer(document.getElementById("lightbox-pins-layer"));

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

      const selectPin = () => focusMapPin(pin.id, true);
      li.addEventListener("click", selectPin);
      li.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectPin();
        }
      });

      legendList.appendChild(li);
    });

    updateMapDestinationHighlight();
  }

  // کنترلر Pinch-to-Zoom و Pan امن (در scale === 1 اسکرول عمودی صفحه هرگز گیر نمی‌کند)
  function createMapController(viewportEl, stageEl, options) {
    const isFullscreen = Boolean(options && options.isFullscreen);
    const onZoomChange = options && options.onZoomChange;
    let scale = 1;
    let tx = 0;
    let ty = 0;

    function clampTranslation() {
      if (scale <= 1) {
        tx = 0;
        ty = 0;
        return;
      }
      const vw = viewportEl.clientWidth || 1;
      const vh = viewportEl.clientHeight || 1;
      const maxX = Math.max(0, (vw * (scale - 1)) / 2 + 24);
      const maxY = Math.max(0, (vh * (scale - 1)) / 2 + 24);
      tx = Math.max(-maxX, Math.min(maxX, tx));
      ty = Math.max(-maxY, Math.min(maxY, ty));
    }

    function applyTransform() {
      clampTranslation();
      stageEl.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
      // مقیاس معکوس برای جلوگیری از غول‌پیکر شدن پین‌ها هنگام زوم
      stageEl.style.setProperty("--map-pin-scale", String(+(1 / Math.sqrt(scale)).toFixed(3)));
      viewportEl.classList.toggle("is-zoomed", scale > 1 || isFullscreen);
      if (onZoomChange) onZoomChange(scale);
    }

    function setScale(nextScale) {
      scale = Math.max(1, Math.min(3, +nextScale.toFixed(2)));
      if (scale <= 1.02) {
        scale = 1;
        tx = 0;
        ty = 0;
      }
      applyTransform();
    }

    function reset() {
      scale = 1;
      tx = 0;
      ty = 0;
      applyTransform();
    }

    // Pinch-to-Zoom دو انگشتی + Drag تک‌انگشتی فقط وقتی scale > 1 یا Fullscreen است
    let pinchStartDist = 0;
    let pinchStartScale = 1;
    let panStartX = 0;
    let panStartY = 0;
    let panOriginTx = 0;
    let panOriginTy = 0;
    let isTouchPanning = false;
    let lastTapTime = 0;

    function getTouchDist(t1, t2) {
      return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    }

    viewportEl.addEventListener(
      "touchstart",
      (e) => {
        if (e.target.closest(".map-pin-marker") || e.target.closest(".map-floating-card")) return;

        if (e.touches.length === 2) {
          e.preventDefault();
          isTouchPanning = false;
          pinchStartDist = getTouchDist(e.touches[0], e.touches[1]);
          pinchStartScale = scale;
        } else if (e.touches.length === 1) {
          const now = Date.now();
          if (now - lastTapTime < 280) {
            e.preventDefault();
            setScale(scale > 1 ? 1 : 2);
            lastTapTime = 0;
            return;
          }
          lastTapTime = now;

          // فقط وقتی زوم شده یا تمام‌صفحه است، Drag تک‌انگشتی فعال شود (جلوگیری از تله اسکرول)
          if (scale > 1 || isFullscreen) {
            isTouchPanning = true;
            panStartX = e.touches[0].clientX;
            panStartY = e.touches[0].clientY;
            panOriginTx = tx;
            panOriginTy = ty;
          }
        }
      },
      { passive: false }
    );

    viewportEl.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length === 2 && pinchStartDist > 0) {
          e.preventDefault();
          const dist = getTouchDist(e.touches[0], e.touches[1]);
          setScale(pinchStartScale * (dist / pinchStartDist));
        } else if (e.touches.length === 1 && isTouchPanning && (scale > 1 || isFullscreen)) {
          e.preventDefault();
          tx = panOriginTx + (e.touches[0].clientX - panStartX);
          ty = panOriginTy + (e.touches[0].clientY - panStartY);
          applyTransform();
        }
      },
      { passive: false }
    );

    viewportEl.addEventListener("touchend", (e) => {
      if (e.touches.length < 2) pinchStartDist = 0;
      if (e.touches.length === 0) isTouchPanning = false;
    });

    // کشیدن با ماوس روی دسکتاپ وقتی زوم شده یا تمام‌صفحه است
    let isMousePanning = false;
    viewportEl.addEventListener("mousedown", (e) => {
      if (e.target.closest(".map-pin-marker") || e.target.closest(".map-floating-card")) return;
      if (scale <= 1 && !isFullscreen) return;
      isMousePanning = true;
      viewportEl.classList.add("is-dragging");
      panStartX = e.clientX;
      panStartY = e.clientY;
      panOriginTx = tx;
      panOriginTy = ty;
    });

    window.addEventListener("mousemove", (e) => {
      if (!isMousePanning) return;
      e.preventDefault();
      tx = panOriginTx + (e.clientX - panStartX);
      ty = panOriginTy + (e.clientY - panStartY);
      applyTransform();
    });

    window.addEventListener("mouseup", () => {
      if (!isMousePanning) return;
      isMousePanning = false;
      viewportEl.classList.remove("is-dragging");
    });

    applyTransform();

    return {
      zoomIn: () => setScale(scale + 0.4),
      zoomOut: () => setScale(scale - 0.4),
      reset,
      getScale: () => scale
    };
  }

  function initInteractiveMaps() {
    const inlineViewport = document.getElementById("inline-map-viewport");
    const inlineStage = document.getElementById("inline-map-stage");
    const inlineResetBtn = document.getElementById("inline-zoom-reset-btn");
    const tapHint = document.getElementById("map-tap-hint");

    const inlineCtrl = createMapController(inlineViewport, inlineStage, {
      isFullscreen: false,
      onZoomChange: (s) => {
        if (inlineResetBtn) inlineResetBtn.classList.toggle("hidden", s <= 1);
        if (tapHint) tapHint.classList.toggle("hidden", s > 1);
      }
    });

    document.getElementById("inline-zoom-in-btn").addEventListener("click", () => inlineCtrl.zoomIn());
    document.getElementById("inline-zoom-out-btn").addEventListener("click", () => inlineCtrl.zoomOut());
    document.getElementById("inline-zoom-reset-btn").addEventListener("click", () => inlineCtrl.reset());

    // لایت‌باکس تمام‌صفحه
    const lightbox = document.getElementById("map-lightbox");
    const openBtn = document.getElementById("open-lightbox-btn");
    const inlineFsBtn = document.getElementById("inline-fullscreen-btn");
    const closeBtn = document.getElementById("lightbox-close-btn");
    const zoomText = document.getElementById("zoom-level-text");
    const lbViewport = document.getElementById("lightbox-viewport");
    const lbStage = document.getElementById("lightbox-stage");

    const lbCtrl = createMapController(lbViewport, lbStage, {
      isFullscreen: true,
      onZoomChange: (s) => {
        if (zoomText) zoomText.textContent = `${toFaDigits(Math.round(s * 100))}٪`;
      }
    });

    function openLightbox() {
      lbCtrl.reset();
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
    if (inlineFsBtn) inlineFsBtn.addEventListener("click", openLightbox);
    closeBtn.addEventListener("click", closeLightbox);

    document.getElementById("zoom-in-btn").addEventListener("click", () => lbCtrl.zoomIn());
    document.getElementById("zoom-out-btn").addEventListener("click", () => lbCtrl.zoomOut());
    document.getElementById("zoom-reset-btn").addEventListener("click", () => lbCtrl.reset());

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !lightbox.hidden) {
        closeLightbox();
      }
    });
  }

  function renderExtraAddresses() {
    const container = document.getElementById("campus-extra-addresses");
    if (!container || !DATA.extraAddresses || !DATA.extraAddresses.length) return;

    const cardsHtml = DATA.extraAddresses
      .map((item) => {
        const metaChips = [];
        if (item.postalCode) {
          metaChips.push(`<span class="extra-meta-pill">کدپستی: <strong dir="ltr">${toFaDigits(item.postalCode)}</strong></span>`);
        }
        if (item.phone) {
          metaChips.push(
            `<a href="${item.phone.href}" class="phone-link-chip" dir="ltr">${ICONS.phone}<span>${item.phone.display}</span></a>`
          );
        }
        if (item.email) {
          metaChips.push(
            `<a href="mailto:${item.email}" class="phone-link-chip" dir="ltr">${ICONS.mail}<span>${item.email}</span></a>`
          );
        }

        return `
          <article class="card extra-address-card">
            <h4 class="extra-address-title">${ICONS.mapPin}<span>${toFaDigits(item.title)}</span></h4>
            <p class="extra-address-text">${toFaDigits(item.address)}</p>
            ${metaChips.length ? `<div class="extra-address-meta">${metaChips.join("")}</div>` : ""}
          </article>
        `;
      })
      .join("");

    container.innerHTML = `
      <div class="subsection-header">
        <h3 class="subsection-title">نشانی‌های تکمیلی و اطلاعات تماس</h3>
        <p class="subsection-desc">نشانی مراکز اداری و حقوقی خارج از پردیس برای پیگیری امور ثبت‌نام و ایثارگران.</p>
      </div>
      <div class="extra-addresses-grid">${cardsHtml}</div>
    `;
  }

  function renderAssociations() {
    const gridEl = document.getElementById("associations-grid");
    gridEl.innerHTML = "";

    DATA.associations.forEach((assoc) => {
      const isPlaceholder = assoc.url.startsWith("#");
      const card = document.createElement("article");
      card.className = `card assoc-card${assoc.featured ? " is-featured" : ""}${isPlaceholder ? " is-placeholder" : ""}`;
      card.innerHTML = `
        <div>
          ${
            assoc.featuredTag
              ? `<div class="assoc-featured-ribbon">${ICONS.sparkle}<span>${toFaDigits(assoc.featuredTag)}</span></div>`
              : ""
          }
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
          : item.state === "info"
          ? "status-info"
          : "status-unknown";

      const linksHtml = (item.links || [])
        .map(
          (lnk) =>
            `<a href="${lnk.url}" target="_blank" rel="noopener noreferrer" class="status-link-btn">${ICONS.external}<span>${toFaDigits(lnk.label)}</span></a>`
        )
        .join("");

      const phonesHtml = (item.phones || [])
        .map(
          (p) => `
          <a href="${p.href}" class="status-phone-row">
            <span class="status-phone-label">${ICONS.phone}<span>${toFaDigits(p.label)}</span></span>
            <span class="status-phone-num" dir="ltr">${p.display}</span>
          </a>
        `
        )
        .join("");

      const card = document.createElement("article");
      card.className = "card status-card";
      card.innerHTML = `
        <div class="status-card-top">
          <h4 class="status-title">${toFaDigits(item.title)}</h4>
          <span class="status-badge ${stateClass}">${toFaDigits(item.badgeText)}</span>
        </div>
        <p class="status-detail">${toFaDigits(item.detail)}</p>
        ${linksHtml ? `<div class="status-links-wrap">${linksHtml}</div>` : ""}
        ${phonesHtml ? `<div class="status-phones-list">${phonesHtml}</div>` : ""}
      `;
      gridEl.appendChild(card);
    });
  }

  function renderFaqs() {
    const listEl = document.getElementById("faq-list");
    const emptyEl = document.getElementById("faq-empty");
    const q = normalizeFa(state.faqQuery);

    const filtered = DATA.faqs.filter((item) => {
      if (!q) return true;
      return normalizeFa(item.q).includes(q) || normalizeFa(item.a).includes(q);
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
            <div class="faq-answer">${toFaDigitsHtml(item.a)}</div>
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
    renderMyPathCard();
    renderTimeline();
    renderOfficialNotice();
    renderProfileBuilder();
    initChecklistControls();
    renderChecklist();
    updateBottomNavBadge();
    renderFacultySelector();
    renderStepper();
    renderMapAndLegend();
    renderExtraAddresses();
    initInteractiveMaps();
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
