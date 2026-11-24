/**
 * ============================================================================
 * منطق راهنمای مینیمال و قدم‌به‌قدم روز ثبت‌نام (app.js)
 * Single-Page Guided Wizard + Hash Routing + Single Source of Truth State
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
    faculty: `reg_guide_${DATA.storageVersion}_faculty`,
    lastStep: `reg_guide_${DATA.storageVersion}_last_step`
  };

  // هماهنگ‌سازی همزمان صفت HTML hidden و کلاس hidden
  function setHidden(el, isHidden) {
    if (!el) return;
    el.hidden = Boolean(isHidden);
    el.classList.toggle("hidden", Boolean(isHidden));
  }

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
      // ignore storage errors
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

  function loadStoredLastStep() {
    try {
      const n = Number(localStorage.getItem(STORAGE_KEYS.lastStep));
      if (n >= 1 && n <= 5) return n;
    } catch {
      // ignore
    }
    return 1;
  }

  const initialMajorId = loadStoredMajor();

  // وضعیت مشترک سطح بالا (Single Source of Truth)
  const state = {
    currentRoute: "welcome", // "welcome" | 1 | 2 | 3 | 4 | 5
    lastStep: loadStoredLastStep(),
    checkedDocs: loadStoredSet(STORAGE_KEYS.checklist),
    selectedConditions: loadStoredConditions(),
    selectedMajorId: initialMajorId,
    selectedFacultyId: loadStoredFaculty(initialMajorId),
    doneSteps: loadStoredSet(STORAGE_KEYS.steps),
    statusFilter: "all",
    expandedDocs: new Set(),
    step3ConditionsOpen: false,
    tuitionTableOpen: false,
    faqQuery: "",
    activePinId: null,
    activeDrawer: null,
    savedScrollY: 0
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
    print: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>`,
    share: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>`,
    reset: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>`,
    fullscreen: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>`,
    send: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`,
    sliders: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>`
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

  async function triggerShare() {
    const shareData = {
      title: DATA.meta.shareTitle || DATA.meta.title,
      text: DATA.meta.shareText || DATA.meta.title,
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
    copyToClipboard(`${shareData.text}\n${shareData.url}`, "متن معرفی و لینک راهنما کپی شد.");
  }

  function triggerPrintChecklist() {
    renderPrintSheet();
    window.print();
  }

  // ==========================================================================
  // توابع مرکزی Single Source of Truth
  // ==========================================================================
  function getActiveMajor() {
    if (!state.selectedMajorId || !DATA.majors) return null;
    return DATA.majors.find((m) => m.id === state.selectedMajorId) || null;
  }

  function getActiveFaculty() {
    if (!DATA.faculties || !DATA.faculties.length) return null;
    return DATA.faculties.find((f) => f.id === state.selectedFacultyId) || DATA.faculties[0];
  }

  function getChecklistStats() {
    const selectedConditions = Array.from(state.selectedConditions);

    // ۱. فقط آیتم‌هایی که مربوط به شرایط انتخاب‌شده همین کاربر هستند:
    const applicableItems = DATA.checklist.filter((item) => {
      const isExcluded = (item.excludeWhen || []).some((cond) => selectedConditions.includes(cond));
      if (isExcluded) return false;
      return item.condition === "mandatory" || selectedConditions.includes(item.condition);
    });

    // ۲. تعداد تیک‌خورده‌ها حتماً اشتراک (Intersection) با applicableItems است:
    const applicableCompletedCount = applicableItems.filter((item) =>
      state.checkedDocs.has(item.id)
    ).length;

    const applicableTotalCount = applicableItems.length;
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
      progressPercent,
      displayedItems
    };
  }

  function getConditionAddedCount(condId) {
    const selected = Array.from(state.selectedConditions);
    return DATA.checklist.filter((item) => {
      if (item.condition !== condId) return false;
      const isExcluded = (item.excludeWhen || []).some((c) => selected.includes(c));
      return !isExcluded;
    }).length;
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

    syncAllViews();
  }

  function syncAllViews() {
    renderUtilityBar();
    renderWelcomeView();
    renderPrintSheet();
    if (state.currentRoute === 1) renderStep1();
    else if (state.currentRoute === 2) renderStep2();
    else if (state.currentRoute === 3) renderStep3();
    else if (state.currentRoute === 4) renderStep4();
    else if (state.currentRoute === 5) renderStep5();
    updateMapDestinationHighlight();
    if (state.activePinId) renderFloatingPinCard(state.activePinId);
  }

  // ==========================================================================
  // مسیریابی با URL Hash (#welcome, #step-1 .. #step-5)
  // ==========================================================================
  function parseHashRoute() {
    const hash = (window.location.hash || "").replace(/^#/, "").trim();
    const match = /^step-([1-5])$/.exec(hash);
    if (match) return Number(match[1]);
    return "welcome";
  }

  function navigateTo(route) {
    const nextHash = route === "welcome" ? "#welcome" : `#step-${route}`;
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    } else {
      applyRoute(route, true);
    }
  }

  function applyRoute(route, shouldScrollTop) {
    state.currentRoute = route;
    const welcomeEl = document.getElementById("view-welcome");
    const wizardEl = document.getElementById("view-wizard");

    if (route === "welcome") {
      setHidden(welcomeEl, false);
      setHidden(wizardEl, true);
      renderWelcomeView();
    } else {
      state.lastStep = route;
      try {
        localStorage.setItem(STORAGE_KEYS.lastStep, String(route));
      } catch {
        // ignore
      }

      setHidden(welcomeEl, true);
      setHidden(wizardEl, false);

      // به‌روزرسانی نوار ۵ قدم بالا
      document.querySelectorAll(".wstep-btn").forEach((btn) => {
        const s = Number(btn.dataset.step);
        btn.classList.toggle("is-active", s === route);
        btn.classList.toggle("is-done", s < route);
        if (s === route) btn.setAttribute("aria-current", "step");
        else btn.removeAttribute("aria-current");
      });

      // نمایش فقط پنل قدم فعال
      for (let i = 1; i <= 5; i++) {
        const panel = document.getElementById(`panel-step-${i}`);
        setHidden(panel, i !== route);
      }

      // رندر محتوای قدم فعال
      if (route === 1) renderStep1();
      else if (route === 2) renderStep2();
      else if (route === 3) renderStep3();
      else if (route === 4) renderStep4();
      else if (route === 5) renderStep5();

      // به‌روزرسانی نوار ناوبری پایین قدم
      const counterEl = document.getElementById("wizard-step-counter");
      const prevBtn = document.getElementById("wizard-prev-btn");
      const nextBtn = document.getElementById("wizard-next-btn");

      counterEl.textContent = `قدم ${toFaDigits(route)} از ۵`;
      prevBtn.textContent = route === 1 ? "صفحه شروع" : "مرحله قبل";
      nextBtn.textContent = route === 5 ? "بازگشت به خلاصه / شروع" : "مرحله بعد ←";
    }

    renderUtilityBar();
    if (shouldScrollTop) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // ==========================================================================
  // نوار بالای مینیمال (Sticky Quick-Utility Bar) و صفحه شروع (#welcome)
  // ==========================================================================
  function renderUtilityBar() {
    const subbar = document.getElementById("utility-subbar");
    const majorText = document.getElementById("utility-subbar-major");
    const major = getActiveMajor();
    const shouldShow = Boolean(major && state.currentRoute !== "welcome");
    if (shouldShow && majorText) {
      majorText.textContent = `رشته انتخابی: ${toFaDigits(major.label)}`;
      setHidden(subbar, false);
    } else {
      setHidden(subbar, true);
    }
  }

  function renderWelcomeView() {
    const cta = document.getElementById("welcome-primary-cta");
    const changeLink = document.getElementById("welcome-change-major-link");
    const major = getActiveMajor();

    if (major) {
      const targetStep = state.lastStep >= 1 && state.lastStep <= 5 ? state.lastStep : 2;
      const shortName = major.label.split("—")[0].split("(")[0].trim();
      cta.href = `#step-${targetStep}`;
      cta.innerHTML = `<span>ادامه مسیر (${toFaDigits(shortName)})</span><span aria-hidden="true">←</span>`;
      setHidden(changeLink, false);
    } else {
      cta.href = "#step-1";
      cta.innerHTML = `<span>شروع راهنمای قدم‌به‌قدم ثبت‌نام</span><span aria-hidden="true">←</span>`;
      setHidden(changeLink, true);
    }
  }

  // ==========================================================================
  // قدم ۱: «چه رشته‌ای قبول شدی؟»
  // ==========================================================================
  function renderStep1() {
    const panel = document.getElementById("panel-step-1");
    if (!panel) return;

    const { applicableTotalCount } = getChecklistStats();

    // گروه‌بندی ۲۰ رشته
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

    const chipsHtml = DATA.checklistConditions
      .map((cond) => {
        const isActive = state.selectedConditions.has(cond.id);
        const count = getConditionAddedCount(cond.id);
        return `
          <button
            type="button"
            class="profile-chip${isActive ? " is-active" : ""}"
            data-step1-cond="${cond.id}"
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

    panel.innerHTML = `
      <div class="card step-surface">
        <div class="step-surface-head">
          <span class="step-kicker-pill">قدم ۱ از ۵</span>
          <h2 class="step-surface-title">چه رشته‌ای قبول شدی؟</h2>
          <p class="step-surface-desc">رشته و شرایط پذیرشت را مشخص کن تا فقط تاریخ، مکان و مدارک مربوط به خودت نمایش داده شود.</p>
        </div>

        <div class="wizard-form-block">
          <label for="step1-major-select" class="wizard-field-label">۱. انتخاب رشته و نیمسال قبولی:</label>
          <select id="step1-major-select" class="mypath-select">
            <option value="">— رشته و نیمسال قبولی خود را انتخاب کنید —</option>
            ${optionsHtml}
          </select>
        </div>

        <div class="wizard-form-block">
          <div class="wizard-field-label-row">
            <span class="wizard-field-label">۲. شرایط پذیرش تو (اختیاری — چندانتخابی):</span>
            <span class="live-docs-badge">چک‌لیست اختصاصی شما: ${toFaDigits(applicableTotalCount)} مدرک</span>
          </div>
          <div class="profile-chips-grid" role="group" aria-label="شرایط پذیرش">
            ${chipsHtml}
          </div>
        </div>

        <div class="step1-cta-block">
          <button type="button" class="btn-primary-lg" id="step1-submit-btn">
            <span>ساخت مسیر اختصاصی من</span>
            <span aria-hidden="true">←</span>
          </button>
          ${
            !state.selectedMajorId
              ? `<button type="button" class="btn-skip-link" id="step1-skip-btn">رد کردن این قدم و ادامه بدون انتخاب رشته</button>`
              : ""
          }
        </div>
      </div>
    `;

    panel.querySelector("#step1-major-select").addEventListener("change", (e) => {
      selectMajor(e.target.value);
    });

    panel.querySelectorAll("[data-step1-cond]").forEach((btn) => {
      btn.addEventListener("click", () => toggleCondition(btn.dataset.step1Cond));
    });

    panel.querySelector("#step1-submit-btn").addEventListener("click", () => {
      navigateTo(2);
    });

    const skipBtn = panel.querySelector("#step1-skip-btn");
    if (skipBtn) {
      skipBtn.addEventListener("click", () => navigateTo(2));
    }
  }

  // ==========================================================================
  // قدم ۲: «زمان و مکان دقیق ثبت‌نام تو»
  // ==========================================================================
  function renderStep2() {
    const panel = document.getElementById("panel-step-2");
    if (!panel) return;

    const major = getActiveMajor();
    const isSecondSem = major && /نیمسال دوم/.test(major.label);

    let inPersonCardHtml = "";
    if (major) {
      inPersonCardHtml = `
        <article class="card step2-highlight-card">
          <div class="step2-card-kicker">${ICONS.calendar}<span>روز و محل مراجعه حضوری تو (${toFaDigits(major.label)})</span></div>
          ${
            major.warningBanner
              ? `<div class="mypath-warning-banner" role="alert">${ICONS.alert}<span>${toFaDigits(major.warningBanner)}</span></div>`
              : ""
          }
          <div class="step2-date-hero">${toFaDigits(major.date)}</div>
          <div class="step2-venue-block">
            <div class="step2-venue-name">${ICONS.mapPin}<span>${toFaDigits(major.building)}</span></div>
            <p class="step2-venue-address">${toFaDigits(major.address)}</p>
          </div>
          <div class="step2-card-actions">
            <span class="attendance-required-badge">${ICONS.userCheck}<span>حضور شخص پذیرفته‌شده الزامی است</span></span>
            <button type="button" class="mypath-btn-secondary" id="step2-show-map-btn">
              ${ICONS.mapPin}
              <span>نمایش ساختمان روی نقشه</span>
            </button>
          </div>
        </article>
      `;
    } else {
      const allMajorsRows = DATA.majors
        .map(
          (m) => `
          <li class="all-majors-row">
            <div>
              <div class="all-majors-name">${toFaDigits(m.label)}</div>
              <div class="all-majors-venue">${toFaDigits(m.building)}</div>
            </div>
            <span class="faculty-schedule-date">${toFaDigits(m.date)}</span>
          </li>
        `
        )
        .join("");

      inPersonCardHtml = `
        <article class="card step2-empty-major-card">
          <p class="step2-empty-major-text">هنوز رشته‌ای انتخاب نکرده‌اید تا تاریخ و نشانی دقیق فقط برای شما نمایش داده شود.</p>
          <button type="button" class="mypath-btn-primary" id="step2-pick-major-btn">انتخاب رشته در قدم ۱</button>

          <details class="all-majors-details">
            <summary class="all-majors-summary">مشاهده جدول کامل تاریخ و مکان همه ۲۰ رشته</summary>
            <ul class="all-majors-list">${allMajorsRows}</ul>
          </details>
        </article>
      `;
    }

    panel.innerHTML = `
      <div class="step-page-stack">
        <div class="step-surface-head">
          <span class="step-kicker-pill">قدم ۲ از ۵</span>
          <h2 class="step-surface-title">زمان و مکان دقیق ثبت‌نام تو</h2>
          <p class="step-surface-desc">ثبت‌نام در دو مرحله انجام می‌شود: ابتدا آنلاین در هم‌آوا، سپس حضوری در دانشکده.</p>
        </div>

        <!-- کارت ثبت‌نام آنلاین -->
        <article class="card step2-online-card">
          <div class="step2-card-kicker">${ICONS.external}<span>۱. ثبت‌نام الکترونیکی و رفع نواقص (هم‌آوا)</span></div>
          <div class="step2-date-hero">دوشنبه ۱۴۰۵/۰۹/۰۲ تا پنجشنبه ۱۴۰۵/۰۹/۰۵</div>
          <p class="step2-card-note">
            تمامی پذیرفته‌شدگان (مهر ۱۴۰۵، بهمن ۱۴۰۵ و نیمسال اول ۱۴۰۷–۱۴۰۶) باید در همین بازه مدارک را بارگذاری کنند و هر روز وضعیت تایید مدارک را چک نمایند.
          </p>
          <div class="step2-card-actions">
            <a href="${window.OFFICIAL_LINKS.HAMAVA_URL}" target="_blank" rel="noopener noreferrer" class="official-link-btn">
              ${ICONS.external}
              <span>ورود به سامانه جامع آموزشی هم‌آوا</span>
            </a>
          </div>
        </article>

        <!-- کارت مراجعه حضوری اختصاصی -->
        ${inPersonCardHtml}

        <!-- کارت خلاصه آزمون زبان و شروع کلاس‌ها -->
        <div class="step2-mini-grid">
          <article class="card step2-mini-card">
            <span class="step2-mini-label">آزمون تعیین سطح زبان</span>
            <strong class="step2-mini-value">${isSecondSem ? "بهمن‌ماه ۱۴۰۵" : "چهارشنبه ۱۴۰۵/۰۹/۱۱"}</strong>
            <span class="step2-mini-note">${isSecondSem ? "ویژه ورودی‌های نیمسال دوم پیش از انتخاب واحد بهمن" : "ویژه نیمسال اول (نیمسال دومی‌ها در بهمن‌ماه)"}</span>
          </article>
          <article class="card step2-mini-card">
            <span class="step2-mini-label">شروع کلاس‌ها</span>
            <strong class="step2-mini-value">${isSecondSem ? "بهمن‌ماه ۱۴۰۵" : "شنبه ۱۴۰۵/۰۹/۱۴"}</strong>
            <span class="step2-mini-note">"بجز ورودی های ۴۰۶"
            برنامه کلاسی پس از انتخاب واحد حضوری در هم‌آوا نمایش داده می‌شود.</span>
          </article>
        </div>
      </div>
    `;

    const showMapBtn = panel.querySelector("#step2-show-map-btn");
    if (showMapBtn && major) {
      showMapBtn.addEventListener("click", () => {
        openDrawer("map");
        renderFloatingPinCard(major.mapPinId);
      });
    }

    const pickBtn = panel.querySelector("#step2-pick-major-btn");
    if (pickBtn) {
      pickBtn.addEventListener("click", () => navigateTo(1));
    }
  }

  // ==========================================================================
  // قدم ۳: «آماده‌سازی مدارک اختصاصی تو» (چک‌لیست هوشمند با ریاضی دقیق)
  // ==========================================================================
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

    const notesHtml = (tData.notes || []).map((n) => `<li>${toFaDigits(n)}</li>`).join("");

    wrap.innerHTML = `
      <div class="tuition-accordion${isOpen ? " is-open" : ""}">
        <button type="button" class="tuition-accordion-trigger" aria-expanded="${isOpen}">
          <span class="tuition-trigger-title">${ICONS.table}<span>${toFaDigits(tData.buttonTitle)}</span></span>
          ${ICONS.chevron}
        </button>
        <div class="tuition-accordion-panel">
          <div class="tuition-accordion-inner">
            <div class="tuition-table-scroll">
              <table class="tuition-table">
                <thead>
                  <tr><th>رشته</th><th>شهریه علی‌الحساب</th><th>میزان سفته</th><th>مسئول و شماره پیگیری</th></tr>
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

  function renderStep3() {
    const panel = document.getElementById("panel-step-3");
    if (!panel) return;

    const {
      applicableCompletedCount,
      applicableTotalCount,
      progressPercent,
      displayedItems
    } = getChecklistStats();

    const isComplete = applicableTotalCount > 0 && progressPercent === 100;
    const expandableIds = displayedItems.filter(itemHasDetails).map((i) => i.id);
    const allOpen = expandableIds.length > 0 && expandableIds.every((id) => state.expandedDocs.has(id));

    const condChipsHtml = DATA.checklistConditions
      .map((cond) => {
        const isActive = state.selectedConditions.has(cond.id);
        const count = getConditionAddedCount(cond.id);
        return `
          <button type="button" class="mypath-cond-chip${isActive ? " is-active" : ""}" data-step3-cond="${cond.id}" aria-pressed="${isActive}">
            ${isActive ? ICONS.check : ICONS.plus}
            <span>${toFaDigits(cond.label.split("(")[0].trim())} (+${toFaDigits(count)})</span>
          </button>
        `;
      })
      .join("");

    panel.innerHTML = `
      <div class="step-page-stack">
        <div class="step-surface-head">
          <span class="step-kicker-pill">قدم ۳ از ۵</span>
          <h2 class="step-surface-title">آماده‌سازی مدارک اختصاصی تو</h2>
          <p class="step-surface-desc">فقط مدارک مربوط به شرایط خودت نمایش داده می‌شود؛ تیک‌ها در مرورگرت ذخیره می‌شوند.</p>
          <div style="margin-top: 12px; margin-bottom: 16px; padding: 10px 14px; border-radius: 12px; background: #fffbeb; border: 1px solid #fde68a; border-right: 4px solid #d97706; color: #78350f; font-size: 0.9rem; line-height: 1.7;">
            <strong>💡 یادآوری مهم:</strong> محض اطمینان از تمام مدارک و فرم‌های خود <strong>حداقل یک سری کپی اضافه</strong> همراه داشته باشید تا در روز ثبت‌نام معطل صف فتوکپی نشوید و در صورت نیاز بعدی به مشکل نخورید.
          </div>
        </div>

        <div class="card checklist-card">
          <!-- بخش جمع‌شونده ویرایش شرایط پذیرش -->
          <div class="step3-cond-bar">
            <button type="button" class="step3-cond-toggle" id="step3-cond-toggle" aria-expanded="${state.step3ConditionsOpen}">
              <span class="step3-cond-toggle-title">
                ${ICONS.sliders}
                <span>ویرایش شرایط پذیرش (شهریه‌پرداز، متعهد، ایثارگر، ...)</span>
              </span>
              ${ICONS.chevron}
            </button>
            <div class="step3-cond-panel${state.step3ConditionsOpen ? " is-open" : ""}" id="step3-cond-panel">
              <div class="step3-cond-panel-inner">
                <div class="mypath-cond-chips">${condChipsHtml}</div>
              </div>
            </div>
          </div>

          <!-- نوار پیشرفت دقیق + فیلتر وضعیت نمایش -->
          <div class="checklist-toolbar">
            <div class="progress-block${isComplete ? " is-complete" : ""}" id="step3-progress-block">
              <div class="progress-meta">
                <span class="progress-label">${toFaDigits(applicableCompletedCount)} از ${toFaDigits(applicableTotalCount)} مدرک مربوط به شما آماده است (${toFaDigits(progressPercent)}٪)</span>
                <span class="progress-percent">${toFaDigits(progressPercent)}٪</span>
              </div>
              <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progressPercent}">
                <div class="progress-fill" style="width: ${progressPercent}%"></div>
              </div>
              ${
                isComplete
                  ? `<div class="progress-celebration" role="status" aria-live="polite">عالیه! تمام مدارک مورد نیاز شما برای روز ثبت‌نام آماده است 🎉</div>`
                  : ""
              }
            </div>

            <div class="checklist-controls">
              <div class="filter-group" role="group" aria-label="فیلتر وضعیت نمایش مدارک">
                <button type="button" class="chip-btn${state.statusFilter === "all" ? " is-active" : ""}" data-s3-filter="all">همه</button>
                <button type="button" class="chip-btn${state.statusFilter === "remaining" ? " is-active" : ""}" data-s3-filter="remaining">باقیمانده</button>
                <button type="button" class="chip-btn${state.statusFilter === "completed" ? " is-active" : ""}" data-s3-filter="completed">آماده‌شده</button>
              </div>
              <div class="checklist-utility-actions">
                ${
                  expandableIds.length > 0
                    ? `<button type="button" class="btn-text-subtle${allOpen ? " is-all-open" : ""}" id="s3-toggle-all-btn">
                        ${ICONS.chevron}
                        <span>${allOpen ? "بستن همه جزئیات" : "باز کردن همه جزئیات"}</span>
                      </button>`
                    : ""
                }
                <button type="button" class="btn-text-subtle" id="s3-reset-btn">
                  ${ICONS.reset}
                  <span>بازنشانی</span>
                </button>
              </div>
            </div>

            <!-- تاییدیه دو مرحله‌ای درون‌صفحه‌ای -->
            <div class="reset-confirm-bar hidden" id="s3-reset-confirm" role="alertdialog" aria-live="polite" hidden>
              <span class="reset-confirm-text">همه تیک‌ها پاک شوند؟</span>
              <div class="reset-confirm-actions">
                <button type="button" class="btn-danger-sm" id="s3-reset-yes">بله، پاک کن</button>
                <button type="button" class="btn-neutral-sm" id="s3-reset-no">انصراف</button>
              </div>
            </div>
          </div>

          <ul class="checklist-list" id="s3-checklist-list"></ul>
          <p class="empty-state hidden" id="s3-checklist-empty" hidden></p>
        </div>

        <!-- دکمه چاپ + هشدار انصراف -->
        <div class="step3-footer-tools">
          <button type="button" class="mypath-btn-secondary" id="s3-print-btn">
            ${ICONS.print}
            <span>چاپ / PDF چک‌لیست من</span>
          </button>
          <a href="${window.OFFICIAL_LINKS.EDUV_OFFICIAL}" target="_blank" rel="noopener noreferrer" class="official-link-btn is-secondary">
            ${ICONS.external}
            <span>دانلود فایل فرم‌های رسمی دانشگاه</span>
          </a>
        </div>

        <div class="alert-callout" role="note">
          ${ICONS.alert}
          <span>${toFaDigits(DATA.officialNotice.withdrawalWarning)}</span>
        </div>
      </div>
    `;

    // رندر آیتم‌های چک‌لیست
    const listEl = panel.querySelector("#s3-checklist-list");
    const emptyEl = panel.querySelector("#s3-checklist-empty");

    if (displayedItems.length === 0) {
      emptyEl.textContent =
        state.statusFilter === "remaining"
          ? "عالیه! هیچ مدرک باقیمانده‌ای ندارید 🎉"
          : state.statusFilter === "completed"
          ? "هنوز هیچ مدرکی را تیک نزده‌اید."
          : "موردی برای نمایش وجود ندارد.";
      setHidden(emptyEl, false);
    } else {
      setHidden(emptyEl, true);
    }

    let lastGroup = null;
    displayedItems.forEach((item) => {
      if (item.group && item.group !== lastGroup) {
        lastGroup = item.group;
        const groupLi = document.createElement("li");
        groupLi.className = "checklist-group-header";
        const isExtra = item.condition !== "mandatory";
        groupLi.innerHTML = `
          <span>${toFaDigits(item.group)}</span>
          <span class="${isExtra ? "checklist-group-optional" : "checklist-group-core"}">${isExtra ? "شرایط انتخابی شما" : "الزامی پایه"}</span>
        `;
        listEl.appendChild(groupLi);
      }

      const checked = state.checkedDocs.has(item.id);
      const hasDetails = itemHasDetails(item);
      const isExpanded = hasDetails && state.expandedDocs.has(item.id);
      const li = document.createElement("li");
      li.className = `checklist-item${checked ? " is-checked" : ""}${isExpanded ? " is-expanded" : ""}`;

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
                    <dd><strong>${toFaDigits(row.value)}</strong>${row.emphasis ? `<span class="fields-guide-emphasis">(${toFaDigits(row.emphasis)})</span>` : ""}</dd>
                  </div>
                `
                )
                .join("")}
            </dl>
          </div>
        `
        : "";
      const linkItems = item.links || [];
      const linksHtml = linkItems.length
        ? `<div class="checklist-links-row">${linkItems
            .map(
              (lnk) =>
                `<a href="${lnk.url}" target="_blank" rel="noopener noreferrer" class="checklist-link${lnk.ltr ? " is-ltr" : ""}">${ICONS.external}<span>${toFaDigits(lnk.label)}</span></a>`
            )
            .join("")}</div>`
        : "";

      li.innerHTML = `
        <div class="checklist-row-head">
          <label class="checklist-check-area">
            <input type="checkbox" class="checklist-checkbox" data-doc-id="${item.id}" ${checked ? "checked" : ""} />
            <div class="checklist-title-wrap">
              <span class="checklist-title">${toFaDigits(item.title)}</span>
              ${item.guide ? `<span class="checklist-qty">${toFaDigits(item.guide)}</span>` : ""}
            </div>
          </label>
          ${
            hasDetails
              ? `<button type="button" class="checklist-detail-toggle" aria-expanded="${isExpanded}">
                  <span>جزئیات</span>
                  ${ICONS.chevron}
                </button>`
              : ""
          }
        </div>
        ${
          hasDetails
            ? `
          <div class="checklist-details-panel">
            <div class="checklist-details-inner">
              <div class="checklist-details-body">
                ${highlightHtml}
                ${subNoteContent}
                ${fieldsGuideHtml}
                ${linksHtml}
                ${item.warning ? `<div class="alert-callout" role="note">${ICONS.alert}<span>${toFaDigits(item.warning)}</span></div>` : ""}
              </div>
            </div>
          </div>
        `
            : ""
        }
      `;

      if (item.attachTuitionTable) {
        const body = li.querySelector(".checklist-details-body");
        const tEl = buildTuitionCollapsibleElement();
        if (body && tEl) body.appendChild(tEl);
      }

      const checkbox = li.querySelector(".checklist-checkbox");
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          state.checkedDocs.add(item.id);
          state.expandedDocs.delete(item.id);
        } else {
          state.checkedDocs.delete(item.id);
        }
        saveStoredSet(STORAGE_KEYS.checklist, state.checkedDocs);
        renderStep3();
        renderPrintSheet();
      });

      const detailBtn = li.querySelector(".checklist-detail-toggle");
      if (detailBtn) {
        detailBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const nowOpen = !state.expandedDocs.has(item.id);
          if (nowOpen) state.expandedDocs.add(item.id);
          else state.expandedDocs.delete(item.id);
          li.classList.toggle("is-expanded", nowOpen);
          detailBtn.setAttribute("aria-expanded", String(nowOpen));
        });
      }

      listEl.appendChild(li);
    });

    // رویدادهای بالای قدم ۳
    panel.querySelector("#step3-cond-toggle").addEventListener("click", () => {
      state.step3ConditionsOpen = !state.step3ConditionsOpen;
      renderStep3();
    });

    panel.querySelectorAll("[data-step3-cond]").forEach((btn) => {
      btn.addEventListener("click", () => toggleCondition(btn.dataset.step3Cond));
    });

    panel.querySelectorAll("[data-s3-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.statusFilter = btn.dataset.s3Filter;
        renderStep3();
      });
    });

    const toggleAllBtn = panel.querySelector("#s3-toggle-all-btn");
    if (toggleAllBtn) {
      toggleAllBtn.addEventListener("click", () => {
        if (allOpen) expandableIds.forEach((id) => state.expandedDocs.delete(id));
        else expandableIds.forEach((id) => state.expandedDocs.add(id));
        renderStep3();
      });
    }

    const resetBtn = panel.querySelector("#s3-reset-btn");
    const confirmBar = panel.querySelector("#s3-reset-confirm");
    resetBtn.addEventListener("click", () => {
      if (state.checkedDocs.size === 0) {
        showToast("هنوز هیچ تیکی نزده‌اید.");
        return;
      }
      setHidden(confirmBar, false);
    });
    panel.querySelector("#s3-reset-no").addEventListener("click", () => setHidden(confirmBar, true));
    panel.querySelector("#s3-reset-yes").addEventListener("click", () => {
      state.checkedDocs.clear();
      state.expandedDocs.clear();
      state.statusFilter = "all";
      saveStoredSet(STORAGE_KEYS.checklist, state.checkedDocs);
      renderStep3();
      renderPrintSheet();
      showToast("همه تیک‌های چک‌لیست پاک شد.");
    });

    panel.querySelector("#s3-print-btn").addEventListener("click", triggerPrintChecklist);
  }

  // ==========================================================================
  // قدم ۴: «روز ثبت‌نام حضوری و نقشه پردیس»
  // ==========================================================================
  let inlineMapCtrl = null;

  function renderStep4() {
    const panel = document.getElementById("panel-step-4");
    if (!panel) return;

    const faculty = getActiveFaculty();
    const major = getActiveMajor();
    const doneCount = DATA.steps.filter((s) => state.doneSteps.has(s.id)).length;

    const stepsHtml = DATA.steps
      .map((step, idx) => {
        const isDone = state.doneSteps.has(step.id);
        let loc = step.location || "";
        let pinId = step.mapPinId || null;
        if (faculty && step.useFacultyVenue === "step1") {
          loc = faculty.step1Location;
          pinId = faculty.mapPinId;
        } else if (faculty && step.useFacultyVenue === "step2") {
          loc = faculty.step2Location;
          pinId = faculty.mapPinId;
        }

        return `
          <li class="step-item${isDone ? " is-done" : ""}">
            <div class="step-node" aria-hidden="true">${isDone ? ICONS.check : toFaDigits(idx + 1)}</div>
            <article class="card step-card">
              <div class="step-kicker">مرحله ${toFaDigits(idx + 1)}</div>
              <h3 class="step-title">${toFaDigits(step.title)}</h3>
              <div class="step-location">${ICONS.mapPin}<span>${toFaDigits(loc)}</span></div>
              <p class="step-meta-row"><span class="step-meta-key">مدارک:</span> ${toFaDigits(step.docs)}</p>
              ${step.tip ? `<div class="step-tip">نکته: ${toFaDigits(step.tip)}</div>` : ""}
              <div class="step-actions">
                <button type="button" class="btn-step-done" data-s4-step="${step.id}" aria-pressed="${isDone}">
                  ${ICONS.check}
                  <span>${isDone ? "انجام شد" : "انجام دادم"}</span>
                </button>
                ${
                  pinId
                    ? `<button type="button" class="btn-map-jump" data-s4-pin="${pinId}">
                        ${ICONS.mapPin}
                        <span>نمایش روی نقشه</span>
                      </button>`
                    : ""
                }
              </div>
            </article>
          </li>
        `;
      })
      .join("");

    panel.innerHTML = `
      <div class="step-page-stack">
        <div class="step-surface-head">
          <div class="step-head-row">
            <span class="step-kicker-pill">قدم ۴ از ۵</span>
            <span class="stepper-counter">${toFaDigits(doneCount)} از ${toFaDigits(DATA.steps.length)} مرحله انجام شده</span>
          </div>
          <h2 class="step-surface-title">روز ثبت‌نام حضوری و نقشه پردیس</h2>
          <p class="step-surface-desc">
            ${major ? `مراحل مخصوص ${toFaDigits(major.label)} در ${toFaDigits(major.building)}` : "مراحل مراجعه حضوری داخل دانشکده و نقشه ساختمان‌های پردیس."}
          </p>
        </div>

        <!-- چک‌لیست ۲ خطی وسایل همراه -->
        <div class="carry-checklist-box" role="note">
          ${ICONS.userCheck}
          <div>
            <strong>وسایل ضروری همراه در روز حضوری:</strong>
            حضور شخص پذیرفته‌شده الزامی است • خودکار آبی، پوشه دکمه‌دار، کپی اضافه شناسنامه و کارت ملی و بطری آب همراه داشته باشید.
          </div>
        </div>

        <ol class="stepper-timeline">${stepsHtml}</ol>

        <!-- نقشه تعاملی پردیس -->
        <div class="card map-card">
          <div class="card-header-row">
            <div>
              <h3 class="card-title">${toFaDigits(DATA.map.title)}</h3>
              <p class="card-subtitle">${toFaDigits(DATA.map.subtitle)}</p>
            </div>
            <button type="button" class="btn-outline" id="s4-open-full-map">
              ${ICONS.fullscreen}
              <span>تمام‌صفحه</span>
            </button>
          </div>

          <div class="map-preview-shell" id="s4-map-shell">
            <div class="map-float-controls" aria-label="کنترل‌های بزرگ‌نمایی نقشه">
              <button type="button" class="map-ctrl-btn" id="s4-zoom-in" aria-label="بزرگ‌نمایی">+</button>
              <button type="button" class="map-ctrl-btn" id="s4-zoom-out" aria-label="کوچک‌نمایی">−</button>
              <button type="button" class="map-ctrl-btn map-ctrl-reset hidden" id="s4-zoom-reset" aria-label="بازنشانی نما" hidden>بازنشانی</button>
            </div>
            <div class="map-viewport" id="s4-map-viewport">
              <div class="map-stage" id="s4-map-stage">
                <div class="map-canvas">
                  <img id="s4-map-img" src="${DATA.map.imageUrl}" alt="نقشه هوایی پردیس دانشگاه علوم پزشکی هرمزگان" draggable="false" />
                  <div class="map-pins-layer" id="s4-map-pins"></div>
                </div>
              </div>
            </div>
            <span class="map-tap-hint" id="s4-tap-hint" aria-hidden="true">با دو انگشت زوم کنید یا روی پین‌ها بزنید</span>
            <div class="map-floating-card hidden" id="s4-map-floating-card" role="region" aria-live="polite" hidden></div>
          </div>
        </div>
      </div>
    `;

    // Fallback تصویر نقشه
    const img = panel.querySelector("#s4-map-img");
    img.onerror = () => {
      if (img.src.indexOf(DATA.map.fallbackUrl) === -1) img.src = DATA.map.fallbackUrl;
    };

    renderPinsLayer(panel.querySelector("#s4-map-pins"));
    updateMapDestinationHighlight();

    const resetBtn = panel.querySelector("#s4-zoom-reset");
    const tapHint = panel.querySelector("#s4-tap-hint");
    inlineMapCtrl = createMapController(panel.querySelector("#s4-map-viewport"), panel.querySelector("#s4-map-stage"), {
      isFullscreen: false,
      onZoomChange: (s) => {
        setHidden(resetBtn, s <= 1);
        setHidden(tapHint, s > 1);
      }
    });

    panel.querySelector("#s4-zoom-in").addEventListener("click", () => inlineMapCtrl.zoomIn());
    panel.querySelector("#s4-zoom-out").addEventListener("click", () => inlineMapCtrl.zoomOut());
    resetBtn.addEventListener("click", () => inlineMapCtrl.reset());
    panel.querySelector("#s4-open-full-map").addEventListener("click", () => openDrawer("map"));

    panel.querySelectorAll("[data-s4-step]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.s4Step;
        if (state.doneSteps.has(id)) state.doneSteps.delete(id);
        else state.doneSteps.add(id);
        saveStoredSet(STORAGE_KEYS.steps, state.doneSteps);
        renderStep4();
      });
    });

    panel.querySelectorAll("[data-s4-pin]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const pinId = btn.dataset.s4Pin;
        renderFloatingPinCard(pinId);
        const shell = panel.querySelector("#s4-map-shell");
        if (shell) shell.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  }

  // ==========================================================================
  // قدم ۵: «بعد از ثبت‌نام و پشتیبانی»
  // ==========================================================================
  function renderStep5() {
    const panel = document.getElementById("panel-step-5");
    if (!panel) return;

    const statusCardsHtml = DATA.statusBoard.items
      .map((item) => {
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

        return `
          <article class="card status-card">
            <div class="status-card-top">
              <h3 class="status-title">${toFaDigits(item.title)}</h3>
              <span class="status-badge ${stateClass}">${toFaDigits(item.badgeText)}</span>
            </div>
            <p class="status-detail">${toFaDigits(item.detail)}</p>
            ${linksHtml ? `<div class="status-links-wrap">${linksHtml}</div>` : ""}
            ${phonesHtml ? `<div class="status-phones-list">${phonesHtml}</div>` : ""}
          </article>
        `;
      })
      .join("");

    const assocHtml = DATA.associations
      .map(
        (assoc) => `
        <article class="card assoc-card${assoc.featured ? " is-featured" : ""}">
          <div>
            ${assoc.featuredTag ? `<div class="assoc-featured-ribbon">${ICONS.sparkle}<span>${toFaDigits(assoc.featuredTag)}</span></div>` : ""}
            <div class="assoc-top">
              <h4 class="assoc-name">${toFaDigits(assoc.name)}</h4>
              ${assoc.platform ? `<span class="assoc-cat-tag">${assoc.platform}</span>` : ""}
            </div>
            <p class="assoc-desc">${toFaDigits(assoc.desc)}</p>
          </div>
          <div class="assoc-actions">
            <button type="button" class="assoc-btn assoc-btn-copy" data-copy-handle="${assoc.handle}">${ICONS.copy}<span>کپی آیدی</span></button>
            <a href="${assoc.url}" target="_blank" rel="noopener noreferrer" class="assoc-btn assoc-btn-link">${ICONS.external}<span>ورود به کانال</span></a>
          </div>
        </article>
      `
      )
      .join("");

    panel.innerHTML = `
      <div class="step-page-stack">
        <div class="step-surface-head">
          <span class="step-kicker-pill">قدم ۵ از ۵</span>
          <h2 class="step-surface-title">بعد از ثبت‌نام و پشتیبانی</h2>
          <p class="step-surface-desc">وضعیت کلاس‌ها، آزمون زبان، امور رفاهی و کانال‌های رسمی پیگیری سوالات.</p>
        </div>

        <div class="status-grid">${statusCardsHtml}</div>

        <div class="subsection-header">
          <h3 class="subsection-title">کانال‌های رسمی و پشتیبانی نوورودی‌ها</h3>
        </div>
        <div class="associations-grid">${assocHtml}</div>

        <!-- دکمه‌های اقدام نهایی -->
        <div class="card step5-final-actions">
          <button type="button" class="mypath-btn-primary" id="s5-share-btn">
            ${ICONS.share}
            <span>اشتراک‌گذاری این راهنما با هم‌کلاسی‌ها</span>
          </button>
          <button type="button" class="mypath-btn-secondary" id="s5-print-btn">
            ${ICONS.print}
            <span>چاپ / PDF چک‌لیست من</span>
          </button>
        </div>
      </div>
    `;

    panel.querySelectorAll("[data-copy-handle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        copyToClipboard(btn.dataset.copyHandle, `آیدی ${btn.dataset.copyHandle} کپی شد.`);
      });
    });

    panel.querySelector("#s5-share-btn").addEventListener("click", triggerShare);
    panel.querySelector("#s5-print-btn").addEventListener("click", triggerPrintChecklist);
  }

  // ==========================================================================
  // کشوها و مودال‌های نوار بالا (نقشه، سوالات متداول، ضروری‌ها)
  // ==========================================================================
  let modalMapCtrl = null;

  function openDrawer(name) {
    closeAllDrawers(false);
    const el = document.getElementById(`drawer-${name}`);
    if (!el) return;
    state.savedScrollY = window.scrollY || 0;
    state.activeDrawer = name;
    setHidden(el, false);
    document.body.style.overflow = "hidden";

    if (name === "map") {
      const modalImg = document.getElementById("modal-map-img");
      if (modalImg && (!modalImg.getAttribute("src") || modalImg.naturalWidth === 0)) {
        modalImg.src = DATA.map.imageUrl;
      }
      if (modalMapCtrl) modalMapCtrl.reset();
      updateMapDestinationHighlight();
      const major = getActiveMajor();
      if (major) {
        renderFloatingPinCard(major.mapPinId);
      } else if (state.activePinId) {
        renderFloatingPinCard(state.activePinId);
      }
    }

    const closeBtn = el.querySelector("[data-close-drawer]");
    if (closeBtn) closeBtn.focus();
  }

  function closeAllDrawers(restoreScroll = true) {
    ["map", "faq", "essentials"].forEach((name) => {
      setHidden(document.getElementById(`drawer-${name}`), true);
    });
    state.activeDrawer = null;
    document.body.style.overflow = "";
    if (restoreScroll && typeof state.savedScrollY === "number") {
      window.scrollTo({ top: state.savedScrollY, behavior: "instant" });
    }
  }

  function renderEssentialsDrawer() {
    const body = document.getElementById("drawer-essentials-body");
    if (!body) return;

    const eduAddr = DATA.extraAddresses && DATA.extraAddresses[0];
    const welfareItem = DATA.statusBoard.items.find((i) => i.phones && i.phones.length);

    const phonesList = [
      ...(welfareItem ? welfareItem.phones : []),
      ...(eduAddr && eduAddr.phone ? [{ label: "معاونت آموزشی دانشگاه", display: eduAddr.phone.display, href: eduAddr.phone.href }] : [])
    ];

    body.innerHTML = `
      <div class="essentials-stack">
        <div class="essentials-section">
          <h4 class="essentials-heading">سامانه‌ها و چاپ سریع</h4>
          <div class="essentials-btn-stack">
            <a href="${window.OFFICIAL_LINKS.HAMAVA_URL}" target="_blank" rel="noopener noreferrer" class="official-link-btn">
              ${ICONS.external}
              <span>ورود به سامانه جامع آموزشی هم‌آوا</span>
            </a>
            <a href="${window.OFFICIAL_LINKS.EDUV_OFFICIAL}" target="_blank" rel="noopener noreferrer" class="official-link-btn is-secondary">
              ${ICONS.external}
              <span>اطلاعیه کامل و دانلود فرم‌ها (معاونت آموزشی)</span>
            </a>
            <button type="button" class="mypath-btn-secondary" id="drawer-print-btn">
              ${ICONS.print}
              <span>چاپ / PDF چک‌لیست اختصاصی من</span>
            </button>
          </div>
        </div>

        <div class="essentials-section">
          <h4 class="essentials-heading">شماره‌های تماس مستقیم و امور رفاهی</h4>
          <div class="status-phones-list">
            ${phonesList
              .map(
                (p) => `
                <a href="${p.href}" class="status-phone-row">
                  <span class="status-phone-label">${ICONS.phone}<span>${toFaDigits(p.label)}</span></span>
                  <span class="status-phone-num" dir="ltr">${p.display}</span>
                </a>
              `
              )
              .join("")}
          </div>
          <a href="${window.OFFICIAL_LINKS.MEFDA}" target="_blank" rel="noopener noreferrer" class="status-link-btn essentials-mefda-btn">
            ${ICONS.external}
            <span>پرتال امور رفاهی و دانشجویی (mefda.ir)</span>
          </a>
        </div>

        <div class="essentials-section">
          <h4 class="essentials-heading">نشانی‌های تکمیلی</h4>
          <div class="essentials-addr-list">
            ${(DATA.extraAddresses || [])
              .map(
                (a) => `
                <div class="essentials-addr-item">
                  <strong>${toFaDigits(a.title)}:</strong>
                  <span>${toFaDigits(a.address)}</span>
                </div>
              `
              )
              .join("")}
          </div>
        </div>

        <div class="essentials-section">
          <h4 class="essentials-heading">کانال رسمی شورای صنفی دانشکده دندانپزشکی</h4>
          <div class="essentials-btn-stack">
            <a href="${DATA.meta.footerChannelUrl}" target="_blank" rel="noopener noreferrer" class="footer-channel-btn">
              ${ICONS.send}
              <span>کانال تلگرام شورای صنفی</span>
            </a>
          </div>
        </div>
      </div>
    `;

    body.querySelector("#drawer-print-btn").addEventListener("click", () => {
      closeAllDrawers(false);
      triggerPrintChecklist();
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
    setHidden(emptyEl, filtered.length > 0);

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

  // ==========================================================================
  // نقشه تعاملی مشترک (مودال نقشه + نقشه قدم ۴ + Pinch-to-Zoom امن)
  // ==========================================================================
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

  function updateMapDestinationHighlight() {
    const activeMajor = getActiveMajor();
    const destPinId = activeMajor ? activeMajor.mapPinId : null;

    document.querySelectorAll(".map-pin-marker").forEach((el) => {
      el.classList.toggle("is-destination", Boolean(destPinId && el.dataset.pinId === destPinId));
    });
    document.querySelectorAll(".legend-item").forEach((el) => {
      el.classList.toggle("is-destination", Boolean(destPinId && el.dataset.legendPin === destPinId));
    });
  }

  function renderFloatingPinCard(pinId) {
    const pin = DATA.map.pins.find((p) => p.id === pinId);
    const cards = [
      document.getElementById("modal-map-floating-card"),
      document.getElementById("s4-map-floating-card")
    ].filter(Boolean);

    if (!pin) {
      state.activePinId = null;
      cards.forEach((c) => setHidden(c, true));
      document.querySelectorAll(".map-pin-marker.is-highlighted, .legend-item.is-highlighted").forEach((el) => {
        el.classList.remove("is-highlighted");
      });
      return;
    }

    state.activePinId = pin.id;
    const activeMajor = getActiveMajor();
    const isDest = Boolean(activeMajor && activeMajor.mapPinId === pin.id);

    document.querySelectorAll(".map-pin-marker").forEach((el) => {
      el.classList.toggle("is-highlighted", el.dataset.pinId === pin.id);
    });
    document.querySelectorAll(".legend-item").forEach((el) => {
      el.classList.toggle("is-highlighted", el.dataset.legendPin === pin.id);
    });

    const markup = `
      <div class="floating-card-head">
        <div class="floating-card-title-row">
          <span class="floating-pin-num">${toFaDigits(pin.number)}</span>
          <h4 class="floating-card-name">${toFaDigits(pin.name)}</h4>
          ${isDest ? `<span class="floating-dest-badge">مقصد ثبت‌نام شما</span>` : ""}
        </div>
        <button type="button" class="floating-card-close" aria-label="بستن">${ICONS.close}</button>
      </div>
      ${pin.address ? `<p class="floating-card-address">${ICONS.mapPin}<span>${toFaDigits(pin.address)}</span></p>` : ""}
      <p class="floating-card-desc">${toFaDigits(pin.desc)}</p>
    `;

    cards.forEach((c) => {
      c.innerHTML = markup;
      setHidden(c, false);
      c.querySelector(".floating-card-close").addEventListener("click", (e) => {
        e.stopPropagation();
        renderFloatingPinCard(null);
      });
    });
  }

  function createMapController(viewportEl, stageEl, options) {
    const isFullscreen = Boolean(options && options.isFullscreen);
    const onZoomChange = options && options.onZoomChange;
    let scale = 1;
    let tx = 0;
    let ty = 0;

    function clamp() {
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

    function apply() {
      clamp();
      stageEl.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
      stageEl.style.setProperty("--map-pin-scale", String(+(1 / Math.sqrt(scale)).toFixed(3)));
      viewportEl.classList.toggle("is-zoomed", scale > 1 || isFullscreen);
      if (onZoomChange) onZoomChange(scale);
    }

    function setScale(next) {
      scale = Math.max(1, Math.min(3, +next.toFixed(2)));
      if (scale <= 1.02) {
        scale = 1;
        tx = 0;
        ty = 0;
      }
      apply();
    }

    function reset() {
      scale = 1;
      tx = 0;
      ty = 0;
      apply();
    }

    let pinchStartDist = 0;
    let pinchStartScale = 1;
    let panStartX = 0;
    let panStartY = 0;
    let panOriginTx = 0;
    let panOriginTy = 0;
    let isTouchPanning = false;
    let lastTapTime = 0;

    const getDist = (a, b) => Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);

    viewportEl.addEventListener(
      "touchstart",
      (e) => {
        if (e.target.closest(".map-pin-marker") || e.target.closest(".map-floating-card")) return;
        if (e.touches.length === 2) {
          e.preventDefault();
          isTouchPanning = false;
          pinchStartDist = getDist(e.touches[0], e.touches[1]);
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
          setScale(pinchStartScale * (getDist(e.touches[0], e.touches[1]) / pinchStartDist));
        } else if (e.touches.length === 1 && isTouchPanning && (scale > 1 || isFullscreen)) {
          e.preventDefault();
          tx = panOriginTx + (e.touches[0].clientX - panStartX);
          ty = panOriginTy + (e.touches[0].clientY - panStartY);
          apply();
        }
      },
      { passive: false }
    );

    viewportEl.addEventListener("touchend", (e) => {
      if (e.touches.length < 2) pinchStartDist = 0;
      if (e.touches.length === 0) isTouchPanning = false;
    });

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
      apply();
    });

    window.addEventListener("mouseup", () => {
      if (!isMousePanning) return;
      isMousePanning = false;
      viewportEl.classList.remove("is-dragging");
    });

    apply();

    return {
      zoomIn: () => setScale(scale + 0.4),
      zoomOut: () => setScale(scale - 0.4),
      reset
    };
  }

  function initModalMap() {
    const img = document.getElementById("modal-map-img");
    if (img) {
      img.onerror = () => {
        if (img.src.indexOf(DATA.map.fallbackUrl) === -1) img.src = DATA.map.fallbackUrl;
      };
    }

    renderPinsLayer(document.getElementById("modal-map-pins"));

    const legendEl = document.getElementById("modal-map-legend");
    if (legendEl) {
      legendEl.innerHTML = "";
      DATA.map.pins.forEach((pin) => {
        const li = document.createElement("li");
        li.className = "legend-item";
        li.dataset.legendPin = pin.id;
        li.tabIndex = 0;
        li.setAttribute("role", "button");
        li.innerHTML = `
          <span class="legend-pin">${toFaDigits(pin.number)}</span>
          <div>
            <div class="legend-name">${toFaDigits(pin.name)}</div>
            <div class="legend-desc">${toFaDigits(pin.desc)}</div>
          </div>
        `;
        li.addEventListener("click", () => renderFloatingPinCard(pin.id));
        li.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            renderFloatingPinCard(pin.id);
          }
        });
        legendEl.appendChild(li);
      });
    }

    const resetBtn = document.getElementById("modal-zoom-reset-btn");
    modalMapCtrl = createMapController(
      document.getElementById("modal-map-viewport"),
      document.getElementById("modal-map-stage"),
      {
        isFullscreen: true,
        onZoomChange: (s) => setHidden(resetBtn, s <= 1)
      }
    );

    document.getElementById("modal-zoom-in-btn").addEventListener("click", () => modalMapCtrl.zoomIn());
    document.getElementById("modal-zoom-out-btn").addEventListener("click", () => modalMapCtrl.zoomOut());
    resetBtn.addEventListener("click", () => modalMapCtrl.reset());
  }

  // ==========================================================================
  // برگه چاپ اختصاصی A4 (از هر قدمی قابل چاپ)
  // ==========================================================================
  function renderPrintSheet() {
    const sheet = document.getElementById("print-sheet");
    if (!sheet) return;

    const major = getActiveMajor();
    const { applicableItems, applicableCompletedCount, applicableTotalCount } = getChecklistStats();

    const majorSummaryHtml = major
      ? `
        <div class="print-summary-box">
          <div><strong>رشته قبولی:</strong> ${toFaDigits(major.label)}</div>
          <div><strong>روز مراجعه حضوری:</strong> ${toFaDigits(major.date)}</div>
          <div><strong>ساختمان و نشانی دقیق:</strong> ${toFaDigits(major.address)}</div>
          <div><strong>ثبت‌نام آنلاین هم‌آوا:</strong> دوشنبه ۱۴۰۵/۰۹/۰۲ تا پنجشنبه ۱۴۰۵/۰۹/۰۵</div>
          ${major.warningBanner ? `<div class="print-warning">${toFaDigits(major.warningBanner)}</div>` : ""}
        </div>
      `
      : `
        <div class="print-summary-box">
          <div><strong>ثبت‌نام آنلاین هم‌آوا:</strong> دوشنبه ۱۴۰۵/۰۹/۰۲ تا پنجشنبه ۱۴۰۵/۰۹/۰۵</div>
          <div><strong>ثبت‌نام حضوری:</strong> شنبه ۱۴۰۵/۰۹/۰۷ تا دوشنبه ۱۴۰۵/۰۹/۰۹ (حضور شخص پذیرفته‌شده الزامی است)</div>
        </div>
      `;

    const itemsHtml = applicableItems
      .map((item) => {
        const done = state.checkedDocs.has(item.id);
        return `
          <li class="print-check-item">
            <span class="print-box">${done ? "✓" : ""}</span>
            <div>
              <strong>${toFaDigits(item.title)}</strong>
              ${item.guide ? ` <span class="print-tag">(${toFaDigits(item.guide)})</span>` : ""}
            </div>
          </li>
        `;
      })
      .join("");

    sheet.innerHTML = `
      <div class="print-header">
        <h1>چک‌لیست اختصاصی روز ثبت‌نام نوورودی‌های ۱۴۰۵–۱۴۰۶</h1>
        <p>دانشگاه علوم پزشکی هرمزگان — تهیه و طراحی: شورای صنفی دانشکده دندانپزشکی</p>
      </div>
      ${majorSummaryHtml}
      <h2 class="print-section-title">مدارک مورد نیاز شما (${toFaDigits(applicableCompletedCount)} از ${toFaDigits(applicableTotalCount)} مورد آماده شده)</h2>
      <ul class="print-check-list">${itemsHtml}</ul>
      <div class="print-footer">
        طراحی و توسعه توسط محمدامین جعفری • شورای صنفی دانشکده دندانپزشکی دانشگاه علوم پزشکی هرمزگان (t.me/hums_senfi)
      </div>
    `;
  }

  // ==========================================================================
  // راه‌اندازی اولیه
  // ==========================================================================
  function initEventListeners() {
    // کلیک روی دکمه تغییر رشته در زیرنوار -> رفتن به قدم ۱ برای ویرایش
    document.getElementById("utility-change-major-btn").addEventListener("click", () => navigateTo(1));

    // دکمه‌های کشوهای نوار بالا
    document.getElementById("open-map-drawer-btn").addEventListener("click", () => openDrawer("map"));
    document.getElementById("open-faq-drawer-btn").addEventListener("click", () => openDrawer("faq"));
    document.getElementById("open-essentials-drawer-btn").addEventListener("click", () => openDrawer("essentials"));

    // چیپ‌های دسترسی سریع در صفحه شروع
    document.querySelectorAll("[data-open-drawer]").forEach((btn) => {
      btn.addEventListener("click", () => openDrawer(btn.dataset.openDrawer));
    });

    // بستن کشوها با دکمه ×، کلیک بیرون یا Escape
    document.querySelectorAll(".drawer-overlay").forEach((overlay) => {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeAllDrawers(true);
      });
    });
    document.querySelectorAll("[data-close-drawer]").forEach((btn) => {
      btn.addEventListener("click", () => closeAllDrawers(true));
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && state.activeDrawer) {
        closeAllDrawers(true);
      }
    });

    // جستجوی سوالات متداول داخل کشوی FAQ
    const faqInput = document.getElementById("faq-search-input");
    const faqClear = document.getElementById("faq-search-clear");
    faqInput.addEventListener("input", () => {
      state.faqQuery = faqInput.value;
      setHidden(faqClear, !faqInput.value);
      renderFaqs();
    });
    faqClear.addEventListener("click", () => {
      faqInput.value = "";
      state.faqQuery = "";
      setHidden(faqClear, true);
      renderFaqs();
      faqInput.focus();
    });

    // دکمه‌های مرحله قبل / مرحله بعد پایین هر قدم
    document.getElementById("wizard-prev-btn").addEventListener("click", () => {
      if (typeof state.currentRoute === "number") {
        if (state.currentRoute === 1) navigateTo("welcome");
        else navigateTo(state.currentRoute - 1);
      }
    });

    document.getElementById("wizard-next-btn").addEventListener("click", () => {
      if (typeof state.currentRoute === "number") {
        if (state.currentRoute === 5) navigateTo("welcome");
        else navigateTo(state.currentRoute + 1);
      }
    });

    // شنیدن تغییر URL Hash (دکمه Back و Forward گوشی/مرورگر)
    window.addEventListener("hashchange", () => {
      if (state.activeDrawer) closeAllDrawers(false);
      applyRoute(parseHashRoute(), true);
    });
  }

  function init() {
    initModalMap();
    renderEssentialsDrawer();
    renderFaqs();
    renderPrintSheet();
    initEventListeners();
    applyRoute(parseHashRoute(), false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
