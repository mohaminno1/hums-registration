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
    conditions: `reg_guide_${DATA.storageVersion}_conditions`,
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
      // در حالت Private Browsing یا پر بودن حافظه خطا نادیده گرفته می‌شود
    }
  }

  function loadStoredFaculty() {
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

  // وضعیت برنامه
  const state = {
    checkedDocs: loadStoredSet(STORAGE_KEYS.checklist),
    activeConditions: loadStoredSet(STORAGE_KEYS.conditions),
    doneSteps: loadStoredSet(STORAGE_KEYS.steps),
    selectedFacultyId: loadStoredFaculty(),
    checklistFilter: "all",
    tuitionTableOpen: false,
    faqQuery: "",
    zoom: 1
  };

  // آیکون‌های خطی Inline SVG (stroke-width="1.6")
  const ICONS = {
    alert: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    info: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
    mapPin: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
    check: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    plus: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
    copy: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
    external: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`,
    chevron: `<svg class="icon faq-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
    phone: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`,
    calendar: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
    userCheck: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><polyline points="17 11 19 13 23 9"></polyline></svg>`,
    key: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>`,
    table: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line></svg>`,
    sparkle: `<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z"></path></svg>`
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
  // ۲. نوار چسبان Scroll-Spy
  // ==========================================================================
  function initScrollSpy() {
    const sections = [
      "section-timeline",
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
  // ۳. بخش اول: چک‌لیست تعاملی مدارک + جدول شهریه و سفته
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

    const li = document.createElement("li");
    li.className = "checklist-tuition-wrap";

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

    li.innerHTML = `
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

    const trigger = li.querySelector(".tuition-accordion-trigger");
    const acc = li.querySelector(".tuition-accordion");
    trigger.addEventListener("click", () => {
      state.tuitionTableOpen = !state.tuitionTableOpen;
      acc.classList.toggle("is-open", state.tuitionTableOpen);
      trigger.setAttribute("aria-expanded", String(state.tuitionTableOpen));
    });

    return li;
  }

  function renderChecklistConditions() {
    const box = document.getElementById("checklist-conditions-box");
    if (!box || !DATA.checklistConditions || !DATA.checklistConditions.length) return;

    box.innerHTML = `
      <div class="conditions-label">اگر مشمول هرکدام از موارد زیر هستید انتخاب کنید تا به چک‌لیست و نوار پیشرفت شما اضافه شود (امکان چند انتخاب):</div>
      <div class="conditions-chips" role="group" aria-label="انتخاب شرایط خاص چک‌لیست">
        ${DATA.checklistConditions
          .map((cond) => {
            const selected = state.activeConditions.has(cond.id);
            return `<button type="button" class="condition-chip${selected ? " is-selected" : ""}" data-condition-id="${cond.id}" aria-pressed="${selected}">${selected ? ICONS.check : ICONS.plus}<span>${toFaDigits(cond.label)}</span></button>`;
          })
          .join("")}
      </div>
    `;

    box.querySelectorAll("[data-condition-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.conditionId;
        if (state.activeConditions.has(id)) {
          state.activeConditions.delete(id);
        } else {
          state.activeConditions.add(id);
        }
        saveStoredSet(STORAGE_KEYS.conditions, state.activeConditions);
        renderChecklistConditions();
        renderChecklist();
      });
    });
  }

  function renderChecklist() {
    const listEl = document.getElementById("checklist-list");
    const emptyEl = document.getElementById("checklist-empty");

    // فقط مدارک عمومی + شرایط انتخاب‌شده توسط کاربر در چک‌لیست و نوار پیشرفت محاسبه می‌شوند
    const activeItems = DATA.checklist.filter(
      (item) => !item.condition || state.activeConditions.has(item.condition)
    );

    const total = activeItems.length;
    const completed = activeItems.filter((item) => state.checkedDocs.has(item.id)).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    document.getElementById("checklist-progress-text").textContent =
      `${toFaDigits(completed)} از ${toFaDigits(total)} مورد آماده شده`;
    document.getElementById("checklist-progress-percent").textContent = `${toFaDigits(percent)}٪`;
    document.getElementById("checklist-progress-fill").style.width = `${percent}%`;
    document.getElementById("checklist-progressbar").setAttribute("aria-valuenow", String(percent));

    const filtered = activeItems.filter((item) => {
      if (state.checklistFilter === "remaining") {
        return !state.checkedDocs.has(item.id);
      }
      return true;
    });

    listEl.innerHTML = "";
    emptyEl.classList.toggle("hidden", filtered.length > 0);

    let lastGroup = null;
    filtered.forEach((item) => {
      if (item.group && item.group !== lastGroup) {
        lastGroup = item.group;
        const groupLi = document.createElement("li");
        groupLi.className = "checklist-group-header";
        groupLi.innerHTML = `
          <span>${toFaDigits(item.group)}</span>
          ${item.condition ? `<span class="checklist-group-optional">انتخاب‌شده توسط شما</span>` : ""}
        `;
        listEl.appendChild(groupLi);
      }

      const checked = state.checkedDocs.has(item.id);
      const li = document.createElement("li");
      li.className = `checklist-item${checked ? " is-checked" : ""}`;

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
                `<a href="${lnk.url}" target="_blank" rel="noopener noreferrer" class="checklist-link${lnk.ltr ? " is-ltr" : ""}" onclick="event.stopPropagation()">${ICONS.external}<span>${toFaDigits(lnk.label)}</span></a>`
            )
            .join("")}</div>`
        : "";

      li.innerHTML = `
        <label class="checklist-label">
          <input type="checkbox" class="checklist-checkbox" data-doc-id="${item.id}" ${checked ? "checked" : ""} />
          <div class="checklist-body">
            <div class="checklist-title-row">
              <span class="checklist-title">${toFaDigits(item.title)}</span>
              ${badgeText ? `<span class="checklist-qty">${toFaDigits(badgeText)}</span>` : ""}
            </div>
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

      if (item.attachTuitionTable) {
        const tuitionEl = buildTuitionCollapsibleElement();
        if (tuitionEl) listEl.appendChild(tuitionEl);
      }
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
  // ۴. بخش دوم: مسیر مرحله‌به‌مرحله + برنامه هر دانشکده + اتصال به نقشه
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
      <div class="faculty-selector-label">رشته / دانشکده قبولی خود را انتخاب کنید تا روز، تاریخ و محل دقیق ثبت‌نام حضوری نمایش داده شود:</div>
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
          <div class="faculty-venue-note${active.venueWarning ? " is-warning" : ""}">
            ${active.venueWarning ? ICONS.alert : ICONS.mapPin}
            <div>
              <div><strong>${active.label}:</strong> ${toFaDigits(active.venueNote)}</div>
              ${active.address ? `<div class="faculty-address"><strong>آدرس کامل:</strong> ${toFaDigits(active.address)}</div>` : ""}
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
        jumpBtn.addEventListener("click", () => highlightMapPin(resolvedPinId, "map"));
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
    renderTimeline();
    renderOfficialNotice();
    initChecklistControls();
    renderChecklistConditions();
    renderChecklist();
    renderFacultySelector();
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
