/**
 * Stealth 404 Gatekeeper & Encrypted Studio (AES-256-GCM + GitHub Owner Verification)
 * Secara default halaman ini adalah 404 murni. Antarmuka Studio hanya di-mount ke DOM
 * setelah pengguna memicu pintu rahasia, membuka kunci PIN (AES-256-GCM), dan lolos
 * verifikasi kepemilikan akun GitHub "ruhulikram".
 */

(() => {
  const ALLOWED_GITHUB_OWNER = "ruhulikram";
  const VAULT_STORAGE_KEY = "ruhul_vault_aes_v1";
  const VAULT_FAILS_KEY = "ruhul_vault_fails_v1";
  const DRAFT_STORAGE_KEY = "ruhul_studio_draft_v1";
  const MAX_PIN_ATTEMPTS = 5;
  const AUTO_LOCK_MS = 15 * 60 * 1000; // 15 minutes

  // Private closure state in RAM only (never attached to window)
  let sessionAuth = null; // { owner, repo, branch, token }
  let state = null;
  let isDirty = false;
  let currentProjectFilter = "all";
  let activeCaseProjectIndex = null;
  let autoLockTimer = null;
  const pendingFiles = new Map();

  const SOCIAL_ICONS = {
    github: `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="fill" d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3" /></svg>`,
    instagram: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect class="stroke" x="3" y="3" width="18" height="18" rx="5" /><circle class="stroke" cx="12" cy="12" r="4.2" /><circle class="fill" cx="17.4" cy="6.6" r="1.2" /></svg>`,
    tiktok: `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="fill" d="M12.5 0h3.9c.1 1.5.6 3.1 1.8 4.2 1.1 1.1 2.7 1.6 4.2 1.8v4c-1.4 0-2.9-.4-4.2-1-.6-.2-1.1-.6-1.6-.9v8.7c-.1 1.4-.5 2.8-1.4 4-1.3 1.9-3.6 3.1-5.9 3.2-1.4 0-2.9-.3-4.1-1-2-1.2-3.4-3.4-3.6-5.7v-1.5c.2-1.9 1.1-3.7 2.6-5 1.7-1.4 4-2.1 6.1-1.7v4.4c-1-.3-2.1-.2-3 .4-.6.4-1.1 1-1.4 1.8-.2.5-.1 1-.1 1.6.2 1.6 1.8 3 3.5 2.9 1.1 0 2.2-.7 2.8-1.6.2-.3.4-.7.4-1.1.1-1.8.1-3.6.1-5.4V0z" /></svg>`,
    linkedin: `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="fill" d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3V9zm7 0h3.8v1.7h.1c.5-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6v6.3h-4v-5.6c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9V21h-4V9z" /></svg>`,
    youtube: `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="fill" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.4 31.4 0 0 0 24 12a31.4 31.4 0 0 0-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z" /></svg>`,
    x: `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="fill" d="M18.2 2h3.5l-7.7 8.8L23 22h-7.1l-5.5-7.2L4.1 22H.6l8.2-9.4L.3 2h7.3l5 6.6L18.2 2zm-1.2 18h1.9L7.1 3.9H5L17 20z" /></svg>`,
    globe: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="stroke" cx="12" cy="12" r="9" /><path class="stroke" d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>`,
  };

  const TAPE_OPTIONS = [
    { value: "tape-kraft-flat.webp", label: "Selotip Kraft Lurus", w: 560, h: 170 },
    { value: "tape-yellow-strip.webp", label: "Lakban Kuning Miring", w: 560, h: 235 },
    { value: "tape-kraft-folded.webp", label: "Selotip Kraft Berlipat", w: 560, h: 165 },
  ];

  const INITIAL_404_HTML = document.getElementById("appRoot")?.innerHTML || "";

  document.addEventListener("DOMContentLoaded", () => {
    bindStealthTriggers();

    if (window.location.hash === "#unlock") {
      history.replaceState(null, "", window.location.pathname);
      openVaultGateModal();
    }
  });

  function bindStealthTriggers() {
    let clicks = 0;
    let timer = null;

    document.addEventListener("click", (e) => {
      if (e.target.closest("#errorCodeTrigger")) {
        clicks++;
        clearTimeout(timer);
        if (clicks >= 5) {
          clicks = 0;
          openVaultGateModal();
        } else {
          timer = setTimeout(() => {
            clicks = 0;
          }, 2200);
        }
      }
    });

    window.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        if (!sessionAuth) {
          openVaultGateModal();
        }
      }
    });
  }

  /* ==========================================================================
     WEB CRYPTO API (PBKDF2 + AES-256-GCM)
     ========================================================================== */

  async function deriveAesKey(pin, saltBytes) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: saltBytes,
        iterations: 100000,
        hash: "SHA-256",
      },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  }

  async function encryptVault(payloadObj, pin) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveAesKey(pin, salt);
    const encoded = new TextEncoder().encode(JSON.stringify(payloadObj));
    const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);

    const record = {
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
      data: bytesToBase64(new Uint8Array(cipherBuf)),
    };
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(record));
    localStorage.removeItem(VAULT_FAILS_KEY);
  }

  async function decryptVault(pin) {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY);
    if (!raw) throw new Error("Brankas belum ditemukan.");
    const record = JSON.parse(raw);
    const salt = base64ToBytes(record.salt);
    const iv = base64ToBytes(record.iv);
    const data = base64ToBytes(record.data);

    const key = await deriveAesKey(pin, salt);
    const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    const jsonStr = new TextDecoder().decode(plainBuf);
    return JSON.parse(jsonStr);
  }

  function bytesToBase64(bytes) {
    let bin = "";
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin);
  }

  function base64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /* ==========================================================================
     GITHUB OWNER & PERMISSION VERIFICATION
     ========================================================================== */

  async function verifyGithubOwnerAndRepo(token, repoName, branchInput) {
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    };

    // 1. Verify authenticated user is strictly ruhulikram
    const userRes = await fetch("https://api.github.com/user", { headers });
    if (!userRes.ok) {
      throw new Error("Token GitHub tidak valid atau sudah kedaluwarsa.");
    }
    const userData = await userRes.json();
    if (!userData.login || userData.login.toLowerCase() !== ALLOWED_GITHUB_OWNER) {
      throw new Error(`Akses ditolak! Token ini milik "${userData.login}", bukan "${ALLOWED_GITHUB_OWNER}".`);
    }

    // 2. Verify repository push permission & resolve default branch
    const cleanRepo = repoName || `${ALLOWED_GITHUB_OWNER}.github.io`;
    const repoRes = await fetch(`https://api.github.com/repos/${ALLOWED_GITHUB_OWNER}/${cleanRepo}`, { headers });
    if (!repoRes.ok) {
      throw new Error(`Repository "${ALLOWED_GITHUB_OWNER}/${cleanRepo}" tidak ditemukan atau token belum diberi izin repo.`);
    }
    const repoData = await repoRes.json();
    if (repoData.permissions && !repoData.permissions.push) {
      throw new Error("Token ini hanya memiliki akses baca (Read-Only). Berikan izin Write/Repo.");
    }

    return {
      owner: ALLOWED_GITHUB_OWNER,
      repo: cleanRepo,
      branch: branchInput || repoData.default_branch || "master",
      token,
    };
  }

  /* ==========================================================================
     SECURITY GATE MODAL (PIN UNLOCK OR INITIAL SETUP)
     ========================================================================== */

  function openVaultGateModal() {
    if (sessionAuth) return;
    document.getElementById("vaultGateOverlay")?.remove();

    const hasVault = Boolean(localStorage.getItem(VAULT_STORAGE_KEY));
    const fails = Number(localStorage.getItem(VAULT_FAILS_KEY) || "0");

    const overlay = document.createElement("div");
    overlay.id = "vaultGateOverlay";
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:9999;background:rgba(10,34,25,0.88);backdrop-filter:blur(6px);display:grid;place-items:center;padding:20px;";

    if (hasVault) {
      overlay.innerHTML = `
        <div class="slip" style="margin:0;width:min(100%,400px);padding:28px 26px;border-radius:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <strong style="font-size:1.15rem;">🔒 Masukkan PIN Studio</strong>
            <button type="button" id="btnCloseGate" style="border:none;background:none;font-size:1.1rem;cursor:pointer;">✕</button>
          </div>
          <p style="font-size:0.86rem;color:var(--ink-soft);margin-bottom:16px;">
            Masukkan PIN 4–6 digit Anda untuk mendekripsi kunci akses GitHub (Percobaan tersisa: <strong>${MAX_PIN_ATTEMPTS - fails}</strong>).
          </p>
          <form id="formUnlockPin" autocomplete="off">
            <input type="password" id="inputUnlockPin" inputmode="numeric" minlength="4" maxlength="12" required
              placeholder="••••••"
              style="width:100%;padding:12px 14px;font-size:1.35rem;letter-spacing:0.25em;text-align:center;border:2px solid rgba(24,32,28,0.25);border-radius:8px;margin-bottom:12px;" />
            <p id="gateErrorMsg" style="color:#b42318;font-size:0.82rem;font-weight:700;margin-bottom:10px;display:none;"></p>
            <button type="submit" id="btnSubmitPin" class="button button--primary" style="width:100%;border:none;cursor:pointer;">
              Buka Studio
            </button>
          </form>
          <div style="margin-top:14px;text-align:center;">
            <button type="button" id="btnResetVault" style="border:none;background:none;color:var(--ink-soft);font-size:0.78rem;text-decoration:underline;cursor:pointer;">
              Lupa PIN / Ganti Token GitHub Baru
            </button>
          </div>
        </div>
      `;
    } else {
      let defaultRepo = "ruhulikram.github.io";
      if (window.location.hostname.endsWith(".github.io")) {
        const seg = window.location.pathname.split("/").filter(Boolean)[0];
        if (seg && seg !== "404.html" && seg !== "index.html") defaultRepo = seg;
      }

      overlay.innerHTML = `
        <div class="slip" style="margin:0;width:min(100%,460px);padding:28px 26px;border-radius:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <strong style="font-size:1.15rem;">🔐 Setup Brankas Studio (Sekali Saja)</strong>
            <button type="button" id="btnCloseGate" style="border:none;background:none;font-size:1.1rem;cursor:pointer;">✕</button>
          </div>
          <p style="font-size:0.84rem;color:var(--ink-soft);margin-bottom:14px;">
            Sistem hanya mengizinkan pemilik akun GitHub <strong>@${ALLOWED_GITHUB_OWNER}</strong>. Token Anda akan dienkripsi dengan algoritma <code>AES-256-GCM</code> menggunakan PIN pilihan Anda.
          </p>
          <form id="formSetupVault" autocomplete="off" style="display:flex;flex-direction:column;gap:10px;">
            <div>
              <label style="font-size:0.8rem;font-weight:700;display:block;margin-bottom:4px;">GitHub Personal Access Token</label>
              <input type="password" id="setupToken" required placeholder="ghp_... atau github_pat_..."
                style="width:100%;padding:9px 12px;border:1.5px solid rgba(24,32,28,0.25);border-radius:7px;" />
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <div>
                <label style="font-size:0.8rem;font-weight:700;display:block;margin-bottom:4px;">Nama Repository</label>
                <input type="text" id="setupRepo" required value="${defaultRepo}"
                  style="width:100%;padding:9px 12px;border:1.5px solid rgba(24,32,28,0.25);border-radius:7px;" />
              </div>
              <div>
                <label style="font-size:0.8rem;font-weight:700;display:block;margin-bottom:4px;">Buat PIN (4–6 Angka)</label>
                <input type="password" id="setupPin" inputmode="numeric" minlength="4" maxlength="12" required placeholder="Contoh: 123456"
                  style="width:100%;padding:9px 12px;border:1.5px solid rgba(24,32,28,0.25);border-radius:7px;" />
              </div>
            </div>
            <p id="gateErrorMsg" style="color:#b42318;font-size:0.82rem;font-weight:700;display:none;"></p>
            <button type="submit" id="btnSubmitSetup" class="button button--primary" style="width:100%;border:none;cursor:pointer;margin-top:6px;">
              Verifikasi &amp; Kunci dengan PIN
            </button>
          </form>
        </div>
      `;
    }

    document.body.appendChild(overlay);
    overlay.querySelector("input")?.focus();

    overlay.querySelector("#btnCloseGate")?.addEventListener("click", () => overlay.remove());

    overlay.querySelector("#btnResetVault")?.addEventListener("click", () => {
      if (confirm("Hapus brankas PIN lama dan masukkan Token GitHub baru?")) {
        localStorage.removeItem(VAULT_STORAGE_KEY);
        localStorage.removeItem(VAULT_FAILS_KEY);
        openVaultGateModal();
      }
    });

    overlay.querySelector("#formUnlockPin")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const pinInput = document.getElementById("inputUnlockPin");
      const errEl = document.getElementById("gateErrorMsg");
      const submitBtn = document.getElementById("btnSubmitPin");
      const pin = pinInput.value.trim();

      submitBtn.disabled = true;
      submitBtn.textContent = "⏳ Memverifikasi...";
      errEl.style.display = "none";

      try {
        const decrypted = await decryptVault(pin);
        const verified = await verifyGithubOwnerAndRepo(decrypted.token, decrypted.repo, decrypted.branch);
        localStorage.removeItem(VAULT_FAILS_KEY);
        sessionAuth = verified;
        overlay.remove();
        await launchStudioApp();
      } catch (err) {
        const currentFails = Number(localStorage.getItem(VAULT_FAILS_KEY) || "0") + 1;
        if (currentFails >= MAX_PIN_ATTEMPTS) {
          localStorage.removeItem(VAULT_STORAGE_KEY);
          localStorage.removeItem(VAULT_FAILS_KEY);
          alert("Batas 5x percobaan PIN terlampaui! Demi keamanan, brankas token terenkripsi telah dihapus otomatis.");
          openVaultGateModal();
          return;
        }
        localStorage.setItem(VAULT_FAILS_KEY, String(currentFails));
        errEl.textContent =
          err.name === "OperationError"
            ? `PIN salah! Sisa percobaan: ${MAX_PIN_ATTEMPTS - currentFails}`
            : err.message;
        errEl.style.display = "block";
        pinInput.value = "";
        pinInput.focus();
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Buka Studio";
      }
    });

    overlay.querySelector("#formSetupVault")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const token = document.getElementById("setupToken").value.trim();
      const repo = document.getElementById("setupRepo").value.trim();
      const pin = document.getElementById("setupPin").value.trim();
      const errEl = document.getElementById("gateErrorMsg");
      const submitBtn = document.getElementById("btnSubmitSetup");

      if (pin.length < 4) {
        errEl.textContent = "PIN minimal 4 karakter.";
        errEl.style.display = "block";
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "⏳ Memverifikasi akun GitHub @ruhulikram...";
      errEl.style.display = "none";

      try {
        const verified = await verifyGithubOwnerAndRepo(token, repo, "");
        await encryptVault(verified, pin);
        sessionAuth = verified;
        overlay.remove();
        await launchStudioApp();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = "block";
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Verifikasi & Kunci dengan PIN";
      }
    });
  }

  /* ==========================================================================
     STUDIO APPLICATION MOUNT & AUTO-LOCK
     ========================================================================== */

  function startAutoLockWatchdog() {
    const reset = () => {
      if (!sessionAuth) return;
      clearTimeout(autoLockTimer);
      autoLockTimer = setTimeout(() => {
        lockAndExitStudio("Sesi dikunci otomatis karena tidak ada aktivitas selama 15 menit.");
      }, AUTO_LOCK_MS);
    };
    ["pointerdown", "keydown", "input"].forEach((ev) => window.addEventListener(ev, reset, { passive: true }));
    reset();
  }

  function lockAndExitStudio(reasonMsg) {
    sessionAuth = null;
    state = null;
    pendingFiles.clear();
    clearTimeout(autoLockTimer);
    document.getElementById("studioDynamicStyle")?.remove();
    const root = document.getElementById("appRoot");
    if (root) root.innerHTML = INITIAL_404_HTML;
    document.title = "404 — Berkas Tidak Ditemukan | Ruhul Ikram";
    if (reasonMsg) alert(reasonMsg);
  }

  async function launchStudioApp() {
    injectStudioStyles();
    document.title = "Ruhul Desk Studio (Terkunci Aman)";
    const root = document.getElementById("appRoot");
    root.innerHTML = getStudioShellMarkup();

    setupStudioTabsAndModals();
    await loadPortfolioState();
    renderAll();
    startAutoLockWatchdog();
    showToast(`Selamat datang, @${sessionAuth.owner}! Sesi terenkripsi aktif.`, "success");
  }

  async function loadPortfolioState() {
    const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
    try {
      // Load live portfolio.json directly from GitHub API so it's always fresh without CDN cache lag!
      const headers = {
        Authorization: `Bearer ${sessionAuth.token}`,
        Accept: "application/vnd.github.raw+json",
      };
      const apiUrl = `https://api.github.com/repos/${sessionAuth.owner}/${sessionAuth.repo}/contents/data/portfolio.json?ref=${sessionAuth.branch}`;
      const res = await fetch(apiUrl, { headers });
      if (res.ok) {
        const liveData = await res.json();
        if (savedDraft) {
          state = JSON.parse(savedDraft);
          markDirty(true, "Memuat draf yang belum di-publish");
        } else {
          state = liveData;
          markDirty(false);
        }
        return;
      }
    } catch {
      // fallback to local fetch
    }

    const fallbackRes = await fetch(`data/portfolio.json?t=${Date.now()}`);
    const fallbackData = await fallbackRes.json();
    state = savedDraft ? JSON.parse(savedDraft) : fallbackData;
    markDirty(Boolean(savedDraft));
  }

  function saveDraft() {
    if (!state) return;
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(state));
    markDirty(true);
    updateBadgesAndStats();
  }

  function markDirty(dirty, customText) {
    isDirty = dirty;
    const dot = document.getElementById("saveStatusDot");
    const text = document.getElementById("saveStatusText");
    if (!dot || !text) return;

    dot.classList.toggle("is-dirty", dirty);
    if (customText) {
      text.textContent = customText;
    } else {
      const pendingCount = pendingFiles.size;
      const fileNote = pendingCount > 0 ? ` (+${pendingCount} file baru)` : "";
      text.textContent = dirty ? `Belum di-publish${fileNote}` : "Sudah live & sinkron";
    }
  }

  function showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type === "success" ? "toast--success" : type === "error" ? "toast--error" : ""}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4200);
  }

  /* ==========================================================================
     STUDIO UI SHELL & TABS
     ========================================================================== */

  function getStudioShellMarkup() {
    return `
      <header class="studio-topbar">
        <div class="studio-brand">
          <img src="assets/images/folder-ui/stamp.webp" alt="Ruhul Studio" width="34" height="39" />
          <div>
            <h1>Ruhul Desk Studio</h1>
            <span>🔒 Terverifikasi sebagai @${escapeHtml(sessionAuth.owner)} • Repo: ${escapeHtml(sessionAuth.repo)} (${escapeHtml(sessionAuth.branch)})</span>
          </div>
        </div>

        <div class="studio-status">
          <span class="status-dot" id="saveStatusDot"></span>
          <span id="saveStatusText">Sudah live &amp; sinkron</span>
        </div>

        <div class="studio-actions">
          <a class="btn btn--ghost" href="index.html" target="_blank" rel="noopener">Lihat Web ↗</a>
          <button type="button" class="btn btn--ghost" id="btnPreviewHtml">👁️ Pratinjau</button>
          <button type="button" class="btn btn--yellow" id="btnPublishGithub">🚀 Simpan &amp; Publish</button>
          <button type="button" class="btn btn--danger" id="btnLockExit" title="Kunci kembali ke halaman 404">🔒 Kunci Keluar</button>
        </div>
      </header>

      <div class="studio-layout">
        <aside class="studio-sidebar" aria-label="Menu Studio">
          <span class="sidebar-label">Menu Konten</span>
          <button type="button" class="tab-btn is-active" data-tab="overview"><span>⚡ Ringkasan &amp; Seksi</span></button>
          <button type="button" class="tab-btn" data-tab="hero"><span>🏠 Hero &amp; CV</span></button>
          <button type="button" class="tab-btn" data-tab="projects">
            <span>🗂️ Proyek &amp; Ongoing</span>
            <span class="tab-badge" id="badgeProjectCount">0</span>
          </button>
          <button type="button" class="tab-btn" data-tab="teaching">
            <span>🎓 Mengajar &amp; Polaroid</span>
            <span class="tab-badge" id="badgeTeachCount">0</span>
          </button>
          <button type="button" class="tab-btn" data-tab="journey">
            <span>📏 Perjalanan &amp; Sertifikat</span>
            <span class="tab-badge" id="badgeJourneyCount">0</span>
          </button>
          <button type="button" class="tab-btn" data-tab="process"><span>📌 Proses Kerja (4 Note)</span></button>
          <button type="button" class="tab-btn" data-tab="contact">
            <span>✉️ Kontak &amp; Sosmed</span>
            <span class="tab-badge" id="badgeSocialCount">0</span>
          </button>

          <div class="studio-sidebar-footer">
            <button type="button" class="btn btn--ghost btn--sm" id="btnResetDefault">↺ Muat Ulang Data Live</button>
            <button type="button" class="btn btn--ghost btn--sm" id="btnChangePin">🔑 Ganti PIN / Token</button>
          </div>
        </aside>

        <main class="studio-main">
          <section class="tab-pane is-active" id="pane-overview">
            <div class="pane-header">
              <div>
                <h2>Ringkasan &amp; Visibilitas Seksi</h2>
                <p>Atur seksi mana saja yang tampil di halaman utama, serta informasi judul &amp; deskripsi web Anda.</p>
              </div>
            </div>
            <div class="stats-grid" id="statsGrid"></div>
            <div class="paper-box">
              <div class="paper-box-head"><h3 class="paper-box-title">Aktif / Nonaktifkan Seksi Halaman Utama</h3></div>
              <div class="section-toggle-list" id="sectionToggleList"></div>
            </div>
            <div class="paper-box">
              <div class="paper-box-head"><h3 class="paper-box-title">Judul Website &amp; Informasi SEO</h3></div>
              <div class="form-grid" id="metaFormContainer"></div>
            </div>
          </section>

          <section class="tab-pane" id="pane-hero">
            <div class="pane-header">
              <div>
                <h2>Hero, Identitas &amp; File CV</h2>
                <p>Ubah headline utama, sub-teks perkenalan, foto perangko (stamp), dan unggah file CV PDF Anda.</p>
              </div>
            </div>
            <div id="heroEditorContainer"></div>
          </section>

          <section class="tab-pane" id="pane-projects">
            <div class="pane-header">
              <div>
                <h2>Proyek &amp; Ongoing Project</h2>
                <p>Tambah proyek selesai, proyek yang sedang dikerjakan (Ongoing + pita progres), maupun rencana proyek berikutnya.</p>
              </div>
              <button type="button" class="btn btn--yellow" id="btnAddProject">+ Tambah Proyek Baru</button>
            </div>
            <div class="paper-box">
              <div class="paper-box-head"><h3 class="paper-box-title">Judul &amp; Pengantar Seksi Proyek</h3></div>
              <div class="form-grid" id="projectsHeaderForm"></div>
            </div>
            <div class="filter-bar" id="projectFilterBar">
              <button type="button" class="filter-chip is-active" data-filter="all">Semua</button>
              <button type="button" class="filter-chip" data-filter="ongoing">Sedang Dikerjakan (Ongoing)</button>
              <button type="button" class="filter-chip" data-filter="completed">Selesai</button>
              <button type="button" class="filter-chip" data-filter="upcoming">Segera (Upcoming)</button>
              <button type="button" class="filter-chip" data-filter="inactive">Nonaktif / Disembunyikan</button>
            </div>
            <div id="projectsListContainer"></div>
          </section>

          <section class="tab-pane" id="pane-teaching">
            <div class="pane-header">
              <div>
                <h2>Mengajar, Mentoring &amp; Foto Polaroid</h2>
                <p>Kelola daftar kegiatan mengajar pada kartu indeks serta unggah foto kegiatan ke bingkai Polaroid.</p>
              </div>
            </div>
            <div id="teachingEditorContainer"></div>
          </section>

          <section class="tab-pane" id="pane-journey">
            <div class="pane-header">
              <div>
                <h2>Perjalanan Karir &amp; Kartu Sertifikasi</h2>
                <p>Kelola slip riwayat pekerjaan/studi di sepanjang penggaris besi dan daftar sertifikasi Anda.</p>
              </div>
              <button type="button" class="btn btn--yellow" id="btnAddJourney">+ Tambah Slip Perjalanan</button>
            </div>
            <div id="journeyEditorContainer"></div>
          </section>

          <section class="tab-pane" id="pane-process">
            <div class="pane-header">
              <div>
                <h2>Proses Kerja (Sticky Notes)</h2>
                <p>Atur judul seksi dan isi keempat kertas catatan tempel di papan proses kerja.</p>
              </div>
              <button type="button" class="btn btn--yellow" id="btnAddProcessStep">+ Tambah Sticky Note</button>
            </div>
            <div id="processEditorContainer"></div>
          </section>

          <section class="tab-pane" id="pane-contact">
            <div class="pane-header">
              <div>
                <h2>Kontak &amp; Stiker Sosial Media</h2>
                <p>Atur kalimat ajakan pada buku sketsa, email, LinkedIn, serta aktifkan/nonaktifkan stiker sosial media Anda.</p>
              </div>
              <button type="button" class="btn btn--yellow" id="btnAddSocial">+ Tambah Stiker Sosmed</button>
            </div>
            <div id="contactEditorContainer"></div>
          </section>
        </main>
      </div>

      <div class="modal-backdrop" id="caseStudyModal" aria-hidden="true">
        <div class="modal-dialog" role="dialog" aria-labelledby="caseModalTitle">
          <div class="modal-header">
            <h3 id="caseModalTitle">Editor Halaman Studi Kasus</h3>
            <button type="button" class="btn btn--ghost-ink btn--sm" id="btnCloseCaseModal">✕ Tutup</button>
          </div>
          <div class="modal-body" id="caseModalBody"></div>
          <div class="modal-footer">
            <button type="button" class="btn btn--ink" id="btnCancelCaseModal">Selesai</button>
          </div>
        </div>
      </div>

      <div class="modal-backdrop" id="previewModal" aria-hidden="true">
        <div class="modal-dialog" style="width: min(100%, 1280px); margin-bottom: 0;">
          <div class="modal-header">
            <h3>👁️ Pratinjau Tampilan Portofolio</h3>
            <div style="display:flex; gap:8px;">
              <button type="button" class="btn btn--ghost-ink btn--sm" id="btnPreviewDesktop">Layar Desktop</button>
              <button type="button" class="btn btn--ghost-ink btn--sm" id="btnPreviewMobile">Layar HP (390px)</button>
              <button type="button" class="btn btn--ink btn--sm" id="btnClosePreviewModal">✕ Tutup</button>
            </div>
          </div>
          <div class="modal-body" style="padding: 0; height: 80vh; background: #103528; display:flex; justify-content:center;">
            <iframe id="previewIframe" title="Pratinjau Portofolio" style="width:100%; height:100%; border:none; background:#1d5a43; transition: width 240ms ease;"></iframe>
          </div>
        </div>
      </div>

      <div class="toast-container" id="toastContainer" aria-live="polite"></div>
    `;
  }

  function setupStudioTabsAndModals() {
    const buttons = document.querySelectorAll(".tab-btn");
    const panes = document.querySelectorAll(".tab-pane");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.tab;
        buttons.forEach((b) => b.classList.toggle("is-active", b === btn));
        panes.forEach((p) => p.classList.toggle("is-active", p.id === `pane-${target}`));
      });
    });

    const filterChips = document.querySelectorAll("#projectFilterBar .filter-chip");
    filterChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        currentProjectFilter = chip.dataset.filter;
        filterChips.forEach((c) => c.classList.toggle("is-active", c === chip));
        renderProjectsList();
      });
    });

    document.getElementById("btnPublishGithub")?.addEventListener("click", publishToGithub);
    document.getElementById("btnLockExit")?.addEventListener("click", () => lockAndExitStudio());

    document.getElementById("btnResetDefault")?.addEventListener("click", async () => {
      if (!confirm("Batalkan perubahan yang belum di-publish dan muat ulang data live saat ini?")) return;
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      pendingFiles.clear();
      await loadPortfolioState();
      renderAll();
      showToast("Data dikembalikan ke kondisi live.", "info");
    });

    document.getElementById("btnChangePin")?.addEventListener("click", () => {
      if (confirm("Hapus brankas PIN saat ini dan atur ulang PIN / Token baru?")) {
        localStorage.removeItem(VAULT_STORAGE_KEY);
        localStorage.removeItem(VAULT_FAILS_KEY);
        lockAndExitStudio();
        openVaultGateModal();
      }
    });

    document.getElementById("btnAddProject")?.addEventListener("click", () => {
      const newNum = state.projects.items.length + 1;
      const newSlug = `proyek-baru-${newNum}`;
      state.projects.items.unshift({
        id: `proj-${Date.now()}`,
        slug: newSlug,
        active: true,
        status: "ongoing",
        statusBadge: "Ongoing • 50%",
        progress: 50,
        showProgress: true,
        kind: "Produk, 2026",
        title: "Nama Proyek Baru",
        summary: "Deskripsi singkat mengenai masalah yang diselesaikan atau eksperimen yang sedang dikerjakan.",
        tags: ["HTML", "JS", "AI"],
        openLabel: "Lihat progres",
        emptyLabel: "Sedang dibangun",
        image: { src: "", alt: "", width: 1440, height: 900 },
        linkType: "case-study",
        externalUrl: "",
        caseStudy: createDefaultCaseStudy("Nama Proyek Baru"),
      });
      saveDraft();
      renderProjectsList();
      showToast("Proyek baru ditambahkan di urutan teratas!", "success");
    });

    document.getElementById("btnAddJourney")?.addEventListener("click", () => {
      state.journey.items.unshift({
        id: `jour-${Date.now()}`,
        datetime: new Date().toISOString().slice(0, 7),
        period: "2026 – sekarang",
        role: "Peran / Posisi Baru",
        org: "Nama Perusahaan / Instansi",
        description: "Deskripsi tanggung jawab dan pencapaian utama.",
        active: true,
      });
      saveDraft();
      renderJourneyPane();
      showToast("Slip perjalanan baru ditambahkan!", "success");
    });

    document.getElementById("btnAddProcessStep")?.addEventListener("click", () => {
      state.process.steps.push({
        id: `step-${Date.now()}`,
        title: "Langkah Baru",
        text: "Penjelasan singkat langkah kerja.",
        color: "yellow",
        active: true,
      });
      saveDraft();
      renderProcessPane();
    });

    document.getElementById("btnAddSocial")?.addEventListener("click", () => {
      state.contact.socials.push({
        id: `soc-${Date.now()}`,
        platform: "instagram",
        label: "Instagram",
        url: "https://instagram.com/",
        active: true,
      });
      saveDraft();
      renderContactPane();
    });

    const closeCase = () => {
      document.getElementById("caseStudyModal")?.classList.remove("is-open");
      activeCaseProjectIndex = null;
      renderProjectsList();
    };
    document.getElementById("btnCloseCaseModal")?.addEventListener("click", closeCase);
    document.getElementById("btnCancelCaseModal")?.addEventListener("click", closeCase);

    const previewModal = document.getElementById("previewModal");
    const iframe = document.getElementById("previewIframe");
    document.getElementById("btnPreviewHtml")?.addEventListener("click", () => {
      let html = bakeIndexHtml(state);
      for (const [path, fileObj] of pendingFiles.entries()) {
        if (fileObj.dataUrl) html = html.split(path).join(fileObj.dataUrl);
      }
      iframe.srcdoc = html;
      previewModal?.classList.add("is-open");
    });
    document.getElementById("btnClosePreviewModal")?.addEventListener("click", () => {
      previewModal?.classList.remove("is-open");
      if (iframe) iframe.srcdoc = "";
    });
    document.getElementById("btnPreviewDesktop")?.addEventListener("click", () => {
      if (iframe) iframe.style.width = "100%";
    });
    document.getElementById("btnPreviewMobile")?.addEventListener("click", () => {
      if (iframe) iframe.style.width = "390px";
    });
  }

  /* ==========================================================================
     RENDER ALL PANES
     ========================================================================== */

  function renderAll() {
    if (!state) return;
    updateBadgesAndStats();
    renderOverviewPane();
    renderHeroPane();
    renderProjectsHeader();
    renderProjectsList();
    renderTeachingPane();
    renderJourneyPane();
    renderProcessPane();
    renderContactPane();
  }

  function updateBadgesAndStats() {
    const activeProjects = state.projects.items.filter((p) => p.active);
    const ongoingProjects = activeProjects.filter((p) => p.status === "ongoing");
    const activeTeach = state.teaching.activities.filter((a) => a.active);
    const activePolaroids = state.teaching.polaroids.filter((p) => p.active && p.src);
    const activeJourney = state.journey.items.filter((j) => j.active);
    const activeSocials = state.contact.socials.filter((s) => s.active);

    setText("badgeProjectCount", `${activeProjects.length}`);
    setText("badgeTeachCount", `${activeTeach.length}`);
    setText("badgeJourneyCount", `${activeJourney.length}`);
    setText("badgeSocialCount", `${activeSocials.length}`);

    const statsGrid = document.getElementById("statsGrid");
    if (statsGrid) {
      statsGrid.innerHTML = `
        <div class="stat-card"><strong>${activeProjects.length}</strong><span>Proyek Aktif di Meja</span></div>
        <div class="stat-card"><strong>${ongoingProjects.length}</strong><span>Proyek Sedang Dikerjakan (Ongoing)</span></div>
        <div class="stat-card"><strong>${activePolaroids.length}/${state.teaching.polaroids.filter((p) => p.active).length}</strong><span>Foto Polaroid Terisi</span></div>
        <div class="stat-card"><strong>${activeSocials.length}</strong><span>Stiker Sosmed Aktif</span></div>
      `;
    }
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function renderOverviewPane() {
    const listEl = document.getElementById("sectionToggleList");
    const sectionLabels = {
      proses: "📌 Proses Kerja (4 Sticky Notes)",
      proyek: "🗂️ Proyek & Ongoing Project",
      mengajar: "🎓 Mengajar & Foto Polaroid",
      perjalanan: "📏 Perjalanan Karir & Sertifikasi",
      kontak: "✉️ Buku Sketsa Kontak & Sosmed",
    };

    listEl.innerHTML = Object.keys(sectionLabels)
      .map(
        (key) => `
        <div class="section-toggle-item">
          <strong>${sectionLabels[key]}</strong>
          <label class="toggle">
            <input type="checkbox" data-section-toggle="${key}" ${state.sections[key] ? "checked" : ""} />
            <span class="toggle-track"></span>
            <span>${state.sections[key] ? "Aktif" : "Nonaktif"}</span>
          </label>
        </div>
      `,
      )
      .join("");

    listEl.querySelectorAll("[data-section-toggle]").forEach((input) => {
      input.addEventListener("change", (e) => {
        state.sections[e.target.dataset.sectionToggle] = e.target.checked;
        saveDraft();
        renderOverviewPane();
      });
    });

    const metaEl = document.getElementById("metaFormContainer");
    metaEl.innerHTML = `
      <div class="field">
        <label>Judul Halaman (Title Tag)</label>
        <input type="text" class="input" data-meta="siteTitle" value="${escapeAttr(state.meta.siteTitle)}" />
      </div>
      <div class="field">
        <label>Lokasi di Footer</label>
        <input type="text" class="input" data-meta="location" value="${escapeAttr(state.meta.location || "Bogor, Indonesia")}" />
      </div>
      <div class="field field--full">
        <label>Deskripsi Meta SEO</label>
        <textarea class="textarea" data-meta="metaDescription">${escapeHtml(state.meta.metaDescription)}</textarea>
      </div>
      <div class="field">
        <label>Deskripsi OpenGraph (Share Sosmed)</label>
        <input type="text" class="input" data-meta="ogDescription" value="${escapeAttr(state.meta.ogDescription)}" />
      </div>
      <div class="field">
        <label>URL Canonical Base</label>
        <input type="url" class="input" data-meta="canonicalBase" value="${escapeAttr(state.meta.canonicalBase)}" />
      </div>
    `;

    metaEl.querySelectorAll("[data-meta]").forEach((input) => {
      input.addEventListener("input", (e) => {
        state.meta[e.target.dataset.meta] = e.target.value;
        saveDraft();
      });
    });
  }

  function renderHeroPane() {
    const container = document.getElementById("heroEditorContainer");
    const h = state.hero;
    const stampPreview = getPreviewSrc(h.stamp.src);

    container.innerHTML = `
      <div class="paper-box">
        <div class="paper-box-head"><h3 class="paper-box-title">Headline &amp; Perkenalan Utama</h3></div>
        <div class="form-grid">
          <div class="field">
            <label>Nama Lengkap (Hero Name)</label>
            <input type="text" class="input" data-hero="name" value="${escapeAttr(h.name)}" />
          </div>
          <div class="field">
            <label>Headline / Peran (Hero Role)</label>
            <input type="text" class="input" data-hero="role" value="${escapeAttr(h.role)}" />
          </div>
          <div class="field field--full">
            <label>Paragraf Pembuka (Hero Lead)</label>
            <textarea class="textarea" data-hero="lead">${escapeHtml(h.lead)}</textarea>
          </div>
          <div class="field">
            <label>Teks Tombol Utama</label>
            <input type="text" class="input" data-hero-btn1="label" value="${escapeAttr(h.primaryBtn.label)}" />
          </div>
          <div class="field">
            <label>URL Tombol Utama</label>
            <input type="text" class="input" data-hero-btn1="url" value="${escapeAttr(h.primaryBtn.url)}" />
          </div>
          <div class="field">
            <label>Teks Tombol Kedua</label>
            <input type="text" class="input" data-hero-btn2="label" value="${escapeAttr(h.secondaryBtn.label)}" />
          </div>
          <div class="field">
            <label>URL / Anchor Tombol Kedua</label>
            <input type="text" class="input" data-hero-btn2="url" value="${escapeAttr(h.secondaryBtn.url)}" />
          </div>
        </div>
      </div>

      <div class="paper-box">
        <div class="paper-box-head"><h3 class="paper-box-title">Map Portofolio, Catatan Kapur &amp; Foto Perangko</h3></div>
        <div class="form-grid">
          <div class="field">
            <label>Catatan Kapur di Atas Map</label>
            <input type="text" class="input" data-hero="chalkNote" value="${escapeAttr(h.chalkNote)}" />
          </div>
          <div class="field">
            <label>Label Map Baris 1 &amp; 2</label>
            <div style="display:flex; gap:8px;">
              <input type="text" class="input" data-hero="folderLabelLine1" value="${escapeAttr(h.folderLabelLine1)}" />
              <input type="text" class="input" data-hero="folderLabelLine2" value="${escapeAttr(h.folderLabelLine2)}" />
            </div>
          </div>
          <div class="field field--full">
            <label>Foto Perangko / Stamp (Otomatis dikonversi ke WebP)</label>
            <div class="upload-zone">
              <img class="upload-thumb upload-thumb--square" src="${escapeAttr(stampPreview)}" alt="Stamp preview" />
              <div class="upload-info">
                <div><strong>Path:</strong> <code>${escapeHtml(h.stamp.src)}</code> (${h.stamp.width}×${h.stamp.height})</div>
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                  <label class="btn btn--ink btn--sm" style="cursor:pointer;">
                    📷 Ganti Foto Stamp
                    <input type="file" accept="image/*" id="inputStampUpload" hidden />
                  </label>
                  <input type="text" class="input" style="max-width:260px;" data-stamp="alt" value="${escapeAttr(h.stamp.alt)}" placeholder="Alt text foto" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="paper-box">
        <div class="paper-box-head">
          <h3 class="paper-box-title">File CV (PDF)</h3>
          <label class="toggle">
            <input type="checkbox" id="toggleCvEnabled" ${h.cv.enabled ? "checked" : ""} />
            <span class="toggle-track"></span>
            <span>${h.cv.enabled ? "Tombol CV Aktif" : "Disembunyikan"}</span>
          </label>
        </div>
        <div class="form-grid">
          <div class="field">
            <label>Label Tombol Unduh CV</label>
            <input type="text" class="input" id="inputCvLabel" value="${escapeAttr(h.cv.label)}" />
          </div>
          <div class="field">
            <label>Path File CV</label>
            <input type="text" class="input" id="inputCvPath" value="${escapeAttr(h.cv.path)}" />
          </div>
          <div class="field field--full">
            <label>Unggah File PDF CV Baru</label>
            <div style="display:flex; align-items:center; gap:12px;">
              <label class="btn btn--ink btn--sm" style="cursor:pointer;">
                📄 Pilih File PDF CV
                <input type="file" accept="application/pdf" id="inputCvFile" hidden />
              </label>
              <span style="font-size:0.84rem; color:var(--ink-soft);" id="cvUploadStatus">
                Akan di-upload ke <code>${escapeHtml(h.cv.path)}</code> saat Anda klik Simpan &amp; Publish.
              </span>
            </div>
          </div>
        </div>
      </div>
    `;

    container.querySelectorAll("[data-hero]").forEach((el) => {
      el.addEventListener("input", (e) => {
        h[e.target.dataset.hero] = e.target.value;
        saveDraft();
      });
    });
    container.querySelectorAll("[data-hero-btn1]").forEach((el) => {
      el.addEventListener("input", (e) => {
        h.primaryBtn[e.target.dataset.heroBtn1] = e.target.value;
        saveDraft();
      });
    });
    container.querySelectorAll("[data-hero-btn2]").forEach((el) => {
      el.addEventListener("input", (e) => {
        h.secondaryBtn[e.target.dataset.heroBtn2] = e.target.value;
        saveDraft();
      });
    });
    container.querySelector('[data-stamp="alt"]')?.addEventListener("input", (e) => {
      h.stamp.alt = e.target.value;
      saveDraft();
    });
    document.getElementById("inputStampUpload")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const res = await processImageToWebP(file, "assets/images/folder-ui/stamp.webp", { maxWidth: 524 });
      h.stamp.src = res.targetPath;
      h.stamp.width = res.width;
      h.stamp.height = res.height;
      saveDraft();
      renderHeroPane();
      showToast("Foto perangko berhasil dikonversi ke WebP!", "success");
    });
    document.getElementById("toggleCvEnabled")?.addEventListener("change", (e) => {
      h.cv.enabled = e.target.checked;
      saveDraft();
      renderHeroPane();
    });
    document.getElementById("inputCvLabel")?.addEventListener("input", (e) => {
      h.cv.label = e.target.value;
      saveDraft();
    });
    document.getElementById("inputCvPath")?.addEventListener("input", (e) => {
      h.cv.path = e.target.value;
      saveDraft();
    });
    document.getElementById("inputCvFile")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const base64 = await fileToBase64(file);
      const targetPath = h.cv.path || "assets/cv/Ruhul-Ikram-CV.pdf";
      pendingFiles.set(targetPath, {
        base64,
        blob: file,
        dataUrl: URL.createObjectURL(file),
        mimeType: "application/pdf",
      });
      saveDraft();
      const st = document.getElementById("cvUploadStatus");
      if (st) st.textContent = `✅ File "${file.name}" siap di-publish ke ${targetPath}!`;
      showToast(`File CV "${file.name}" siap di-publish!`, "success");
    });
  }

  function renderProjectsHeader() {
    const el = document.getElementById("projectsHeaderForm");
    if (!el) return;
    el.innerHTML = `
      <div class="field">
        <label>Judul Seksi Proyek</label>
        <input type="text" class="input" id="projSecTitle" value="${escapeAttr(state.projects.title)}" />
      </div>
      <div class="field">
        <label>Sub-teks Pengantar Proyek</label>
        <input type="text" class="input" id="projSecDesc" value="${escapeAttr(state.projects.description)}" />
      </div>
    `;
    document.getElementById("projSecTitle")?.addEventListener("input", (e) => {
      state.projects.title = e.target.value;
      saveDraft();
    });
    document.getElementById("projSecDesc")?.addEventListener("input", (e) => {
      state.projects.description = e.target.value;
      saveDraft();
    });
  }

  function renderProjectsList() {
    const container = document.getElementById("projectsListContainer");
    if (!container) return;

    const items = state.projects.items;
    const filtered = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => {
        if (currentProjectFilter === "all") return true;
        if (currentProjectFilter === "inactive") return !item.active;
        return item.active && item.status === currentProjectFilter;
      });

    if (!filtered.length) {
      container.innerHTML = `<div class="paper-box"><p style="color:var(--ink-soft);">Tidak ada proyek pada kategori filter ini.</p></div>`;
      return;
    }

    container.innerHTML = filtered
      .map(({ item, index }) => {
        const statusPill =
          item.status === "completed"
            ? `<span class="pill pill--completed">Selesai</span>`
            : item.status === "ongoing"
              ? `<span class="pill pill--ongoing">🔨 Ongoing${item.progress ? ` (${item.progress}%)` : ""}</span>`
              : `<span class="pill pill--upcoming">Segera</span>`;

        const thumbSrc = item.image?.src ? getPreviewSrc(item.image.src) : "";

        return `
        <div class="paper-box ${item.active ? "" : "is-inactive"}" data-proj-idx="${index}">
          <div class="paper-box-head">
            <div class="paper-box-title">
              <span>#${index + 1} — ${escapeHtml(item.title || "Proyek Tanpa Judul")}</span>
              ${statusPill}
              ${!item.active ? `<span class="pill pill--muted">Nonaktif</span>` : ""}
            </div>
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <label class="toggle" style="margin-right:6px;">
                <input type="checkbox" data-proj-action="toggle-active" data-idx="${index}" ${item.active ? "checked" : ""} />
                <span class="toggle-track"></span>
                <span>${item.active ? "Tampil" : "Sembunyi"}</span>
              </label>
              <button type="button" class="btn btn--ghost-ink btn--sm" data-proj-action="up" data-idx="${index}" ${index === 0 ? "disabled" : ""}>↑</button>
              <button type="button" class="btn btn--ghost-ink btn--sm" data-proj-action="down" data-idx="${index}" ${index === items.length - 1 ? "disabled" : ""}>↓</button>
              <button type="button" class="btn btn--ink btn--sm" data-proj-action="edit-case" data-idx="${index}">📝 Edit Halaman Studi Kasus</button>
              <button type="button" class="btn btn--danger btn--sm" data-proj-action="delete" data-idx="${index}">Hapus</button>
            </div>
          </div>

          <div class="form-grid form-grid--3">
            <div class="field">
              <label>Judul Proyek</label>
              <input type="text" class="input" data-proj-field="title" data-idx="${index}" value="${escapeAttr(item.title)}" />
            </div>
            <div class="field">
              <label>Kategori &amp; Tahun</label>
              <input type="text" class="input" data-proj-field="kind" data-idx="${index}" value="${escapeAttr(item.kind)}" />
            </div>
            <div class="field">
              <label>Status Proyek</label>
              <select class="select" data-proj-field="status" data-idx="${index}">
                <option value="completed" ${item.status === "completed" ? "selected" : ""}>✅ Selesai (Completed)</option>
                <option value="ongoing" ${item.status === "ongoing" ? "selected" : ""}>🔨 Sedang Dikerjakan (Ongoing)</option>
                <option value="upcoming" ${item.status === "upcoming" ? "selected" : ""}>⏳ Segera / Rencana (Upcoming)</option>
              </select>
            </div>

            <div class="field field--full">
              <label>Ringkasan Singkat di Kartu</label>
              <textarea class="textarea" style="min-height:60px;" data-proj-field="summary" data-idx="${index}">${escapeHtml(item.summary)}</textarea>
            </div>

            <div class="field">
              <label>Teks Pita Lakban Status (Opsional)</label>
              <input type="text" class="input" data-proj-field="statusBadge" data-idx="${index}" value="${escapeAttr(item.statusBadge || "")}" placeholder="${item.status === "ongoing" ? "Ongoing • 70%" : "Kosongkan jika tidak perlu"}" />
            </div>
            <div class="field">
              <label>Persentase Progres (${item.progress || 0}%)</label>
              <input type="range" min="0" max="100" step="5" data-proj-field="progress" data-idx="${index}" value="${item.progress || 0}" style="margin-top:8px;" />
              <label class="toggle" style="margin-top:6px;">
                <input type="checkbox" data-proj-field="showProgress" data-idx="${index}" ${item.showProgress ? "checked" : ""} />
                <span class="toggle-track"></span>
                <span>Tampilkan Bar Progres</span>
              </label>
            </div>
            <div class="field">
              <label>Tags Teknologi (pisahkan koma)</label>
              <input type="text" class="input" data-proj-field="tags" data-idx="${index}" value="${escapeAttr((item.tags || []).join(", "))}" />
            </div>

            <div class="field">
              <label>Aksi Saat Kartu Diklik</label>
              <select class="select" data-proj-field="linkType" data-idx="${index}">
                <option value="case-study" ${item.linkType === "case-study" ? "selected" : ""}>Buka Studi Kasus (projects/${escapeHtml(item.slug || "slug")}.html)</option>
                <option value="external" ${item.linkType === "external" ? "selected" : ""}>Buka Link Eksternal (Demo/Repo)</option>
                <option value="none" ${item.linkType === "none" ? "selected" : ""}>Belum Bisa Diklik (Hanya Kartu)</option>
              </select>
            </div>
            <div class="field">
              <label>Slug File / URL Eksternal</label>
              ${
                item.linkType === "external"
                  ? `<input type="url" class="input" data-proj-field="externalUrl" data-idx="${index}" value="${escapeAttr(item.externalUrl || "")}" placeholder="https://..." />`
                  : `<input type="text" class="input" data-proj-field="slug" data-idx="${index}" value="${escapeAttr(item.slug || "")}" placeholder="nama-proyek" />`
              }
            </div>
            <div class="field">
              <label>Teks Label Buka</label>
              <input type="text" class="input" data-proj-field="openLabel" data-idx="${index}" value="${escapeAttr(item.openLabel || "")}" />
            </div>

            <div class="field field--full">
              <label>Gambar Mockup / Thumbnail Kartu Proyek</label>
              <div class="upload-zone">
                ${
                  thumbSrc
                    ? `<img class="upload-thumb" src="${escapeAttr(thumbSrc)}" alt="" />`
                    : `<div class="upload-thumb" style="display:grid;place-items:center;font-size:0.72rem;color:var(--ink-soft);">Kosong</div>`
                }
                <div class="upload-info">
                  <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                    <label class="btn btn--ink btn--sm" style="cursor:pointer;">
                      🖼️ Upload Mockup (Auto WebP)
                      <input type="file" accept="image/*" data-proj-upload="${index}" hidden />
                    </label>
                    ${
                      item.image?.src
                        ? `<button type="button" class="btn btn--ghost-ink btn--sm" data-proj-action="clear-img" data-idx="${index}">Kosongkan Gambar</button>`
                        : ""
                    }
                    <input type="text" class="input" style="max-width:240px;" data-proj-field="imageSrc" data-idx="${index}" value="${escapeAttr(item.image?.src || "")}" placeholder="Path gambar" />
                    <input type="text" class="input" style="max-width:240px;" data-proj-field="imageAlt" data-idx="${index}" value="${escapeAttr(item.image?.alt || "")}" placeholder="Deskripsi alt" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      })
      .join("");

    bindProjectEvents(container);
  }

  function bindProjectEvents(container) {
    container.querySelectorAll("[data-proj-action]").forEach((btn) => {
      const idx = Number(btn.dataset.idx);
      const action = btn.dataset.projAction;
      if (action === "toggle-active") {
        btn.addEventListener("change", (e) => {
          state.projects.items[idx].active = e.target.checked;
          saveDraft();
          renderProjectsList();
        });
        return;
      }
      btn.addEventListener("click", () => {
        const items = state.projects.items;
        if (action === "up" && idx > 0) {
          [items[idx - 1], items[idx]] = [items[idx], items[idx - 1]];
          saveDraft();
          renderProjectsList();
        } else if (action === "down" && idx < items.length - 1) {
          [items[idx + 1], items[idx]] = [items[idx], items[idx + 1]];
          saveDraft();
          renderProjectsList();
        } else if (action === "delete") {
          if (confirm(`Hapus proyek "${items[idx].title}"?`)) {
            items.splice(idx, 1);
            saveDraft();
            renderProjectsList();
          }
        } else if (action === "clear-img") {
          items[idx].image = { src: "", alt: "", width: 1440, height: 900 };
          saveDraft();
          renderProjectsList();
        } else if (action === "edit-case") {
          openCaseStudyModal(idx);
        }
      });
    });

    container.querySelectorAll("[data-proj-field]").forEach((input) => {
      const idx = Number(input.dataset.idx);
      const field = input.dataset.projField;
      const item = state.projects.items[idx];

      const handler = (e) => {
        const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
        if (field === "tags") {
          item.tags = val
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
        } else if (field === "progress") {
          item.progress = Number(val);
          const label = input.parentElement?.querySelector("label");
          if (label) label.textContent = `Persentase Progres (${item.progress}%)`;
        } else if (field === "imageSrc") {
          if (!item.image) item.image = { src: "", alt: "", width: 1440, height: 900 };
          item.image.src = val;
        } else if (field === "imageAlt") {
          if (!item.image) item.image = { src: "", alt: "", width: 1440, height: 900 };
          item.image.alt = val;
        } else if (field === "status") {
          item.status = val;
          if (val === "ongoing" && !item.statusBadge) {
            item.statusBadge = "Ongoing";
            item.openLabel = item.linkType === "none" ? "Sedang dikerjakan" : "Lihat progres";
          } else if (val === "upcoming") {
            item.openLabel = "Segera";
            item.linkType = "none";
          } else if (val === "completed" && item.openLabel === "Segera") {
            item.openLabel = "Buka studi kasus";
            item.linkType = "case-study";
          }
          saveDraft();
          renderProjectsList();
          return;
        } else if (field === "linkType") {
          item.linkType = val;
          saveDraft();
          renderProjectsList();
          return;
        } else {
          item[field] = val;
        }
        saveDraft();
      };
      input.addEventListener(input.tagName === "SELECT" || input.type === "checkbox" ? "change" : "input", handler);
    });

    container.querySelectorAll("[data-proj-upload]").forEach((fileInput) => {
      fileInput.addEventListener("change", async (e) => {
        const idx = Number(e.target.dataset.projUpload);
        const file = e.target.files?.[0];
        if (!file) return;
        const item = state.projects.items[idx];
        const safeSlug = slugify(item.slug || item.title || `project-${idx + 1}`);
        item.slug = safeSlug;
        const res = await processImageToWebP(file, `assets/images/projects/${safeSlug}.webp`, { maxWidth: 1440 });
        item.image = {
          src: res.targetPath,
          alt: item.image?.alt || `Tampilan proyek ${item.title}`,
          width: res.width,
          height: res.height,
        };
        saveDraft();
        renderProjectsList();
        showToast(`Gambar proyek dikonversi ke ${res.targetPath}!`, "success");
      });
    });
  }

  function createDefaultCaseStudy(title) {
    return {
      metaDescription: `Studi kasus ${title} oleh Ruhul Ikram.`,
      lead: `Ringkasan cerita di balik pembuatan ${title}, dari riset awal hingga implementasi.`,
      facts: [
        { label: "Peran", value: "Product Developer" },
        { label: "Tahun", value: String(new Date().getFullYear()) },
        { label: "Teknologi", value: "HTML, CSS, JavaScript" },
        { label: "Status", value: "Sedang berjalan (Ongoing)" },
      ],
      videoEmbedUrl: "",
      mainMedia: { src: "", alt: `Tampilan ${title}`, width: 1440, height: 900, caption: "Tampilan utama produk." },
      gallery: [],
      problem: "Latar belakang masalah yang dialami pengguna.",
      processSteps: ["Menganalisa kebutuhan utama pengguna.", "Membangun prototipe dan menguji fitur inti."],
      result: "Hasil atau progres yang sudah dicapai sejauh ini.",
      primaryAction: { label: "Lihat Demo / Repo", url: "https://github.com/ruhulikram" },
      secondaryAction: { label: "Hubungi saya", url: "../index.html#kontak" },
    };
  }

  function openCaseStudyModal(projIdx) {
    activeCaseProjectIndex = projIdx;
    const item = state.projects.items[projIdx];
    if (!item.caseStudy) item.caseStudy = createDefaultCaseStudy(item.title);
    const cs = item.caseStudy;
    const modal = document.getElementById("caseStudyModal");
    const titleEl = document.getElementById("caseModalTitle");
    const body = document.getElementById("caseModalBody");

    titleEl.textContent = `📝 Halaman Studi Kasus: ${item.title} (projects/${item.slug || "proyek"}.html)`;

    body.innerHTML = `
      <div class="form-grid">
        <div class="field">
          <label>Slug Nama File HTML (tanpa .html)</label>
          <input type="text" class="input" id="csSlug" value="${escapeAttr(item.slug || "")}" />
        </div>
        <div class="field">
          <label>Deskripsi Meta SEO</label>
          <input type="text" class="input" id="csMetaDesc" value="${escapeAttr(cs.metaDescription || "")}" />
        </div>
        <div class="field field--full">
          <label>Paragraf Pembuka (Case Lead)</label>
          <textarea class="textarea" id="csLead">${escapeHtml(cs.lead || "")}</textarea>
        </div>
        <div class="field field--full">
          <label>4 Kotak Fakta Singkat</label>
          <div class="form-grid">
            ${(cs.facts || [])
              .map(
                (f, fi) => `
              <div style="display:flex; gap:8px;">
                <input type="text" class="input" style="width:40%;" data-cs-fact-label="${fi}" value="${escapeAttr(f.label)}" />
                <input type="text" class="input" data-cs-fact-val="${fi}" value="${escapeAttr(f.value)}" />
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
        <div class="field field--full">
          <label>Video Showcase YouTube (Opsional)</label>
          <input type="url" class="input" id="csVideoUrl" value="${escapeAttr(cs.videoEmbedUrl || "")}" placeholder="https://www.youtube.com/watch?v=..." />
        </div>
        <div class="field field--full">
          <label>Gambar Showcase Utama &amp; Caption</label>
          <div class="upload-zone">
            ${cs.mainMedia?.src ? `<img class="upload-thumb" src="${escapeAttr(getPreviewSrc(cs.mainMedia.src))}" alt="" />` : `<div class="upload-thumb"></div>`}
            <div class="upload-info">
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <label class="btn btn--ink btn--sm" style="cursor:pointer;">
                  📷 Upload Gambar Utama
                  <input type="file" accept="image/*" id="csMainImgUpload" hidden />
                </label>
                <input type="text" class="input" style="max-width:240px;" id="csMainImgSrc" value="${escapeAttr(cs.mainMedia?.src || "")}" placeholder="Path gambar" />
                <input type="text" class="input" style="max-width:240px;" id="csMainImgCaption" value="${escapeAttr(cs.mainMedia?.caption || "")}" placeholder="Caption gambar" />
              </div>
            </div>
          </div>
        </div>
        <div class="field field--full">
          <label>Cerita Bagian 1: Masalah</label>
          <textarea class="textarea" id="csProblem">${escapeHtml(cs.problem || "")}</textarea>
        </div>
        <div class="field field--full">
          <label>Cerita Bagian 2: Langkah-Langkah Proses (Satu poin per baris)</label>
          <textarea class="textarea" style="min-height:100px;" id="csProcessSteps">${escapeHtml((cs.processSteps || []).join("\n"))}</textarea>
        </div>
        <div class="field field--full">
          <label>Cerita Bagian 3: Hasil / Progres Saat Ini</label>
          <textarea class="textarea" id="csResult">${escapeHtml(cs.result || "")}</textarea>
        </div>
        <div class="field">
          <label>Label Tombol Aksi Utama</label>
          <input type="text" class="input" id="csBtn1Label" value="${escapeAttr(cs.primaryAction?.label || "Lihat kode di GitHub")}" />
        </div>
        <div class="field">
          <label>URL Tombol Aksi Utama</label>
          <input type="text" class="input" id="csBtn1Url" value="${escapeAttr(cs.primaryAction?.url || "")}" />
        </div>
      </div>
    `;

    document.getElementById("csSlug")?.addEventListener("input", (e) => {
      item.slug = slugify(e.target.value);
      saveDraft();
    });
    document.getElementById("csMetaDesc")?.addEventListener("input", (e) => {
      cs.metaDescription = e.target.value;
      saveDraft();
    });
    document.getElementById("csLead")?.addEventListener("input", (e) => {
      cs.lead = e.target.value;
      saveDraft();
    });
    body.querySelectorAll("[data-cs-fact-label]").forEach((inp) => {
      inp.addEventListener("input", (e) => {
        cs.facts[Number(e.target.dataset.csFactLabel)].label = e.target.value;
        saveDraft();
      });
    });
    body.querySelectorAll("[data-cs-fact-val]").forEach((inp) => {
      inp.addEventListener("input", (e) => {
        cs.facts[Number(e.target.dataset.csFactVal)].value = e.target.value;
        saveDraft();
      });
    });
    document.getElementById("csVideoUrl")?.addEventListener("input", (e) => {
      cs.videoEmbedUrl = e.target.value;
      saveDraft();
    });
    document.getElementById("csMainImgSrc")?.addEventListener("input", (e) => {
      if (!cs.mainMedia) cs.mainMedia = { src: "", alt: item.title, width: 1440, height: 900, caption: "" };
      cs.mainMedia.src = e.target.value;
      saveDraft();
    });
    document.getElementById("csMainImgCaption")?.addEventListener("input", (e) => {
      if (!cs.mainMedia) cs.mainMedia = { src: "", alt: item.title, width: 1440, height: 900, caption: "" };
      cs.mainMedia.caption = e.target.value;
      saveDraft();
    });
    document.getElementById("csMainImgUpload")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const safeSlug = slugify(item.slug || item.title);
      const res = await processImageToWebP(file, `assets/images/projects/${safeSlug}-main.webp`, { maxWidth: 1440 });
      cs.mainMedia = {
        src: res.targetPath,
        alt: item.title,
        width: res.width,
        height: res.height,
        caption: cs.mainMedia?.caption || "",
      };
      saveDraft();
      openCaseStudyModal(projIdx);
      showToast("Gambar utama studi kasus diunggah!", "success");
    });
    document.getElementById("csProblem")?.addEventListener("input", (e) => {
      cs.problem = e.target.value;
      saveDraft();
    });
    document.getElementById("csProcessSteps")?.addEventListener("input", (e) => {
      cs.processSteps = e.target.value
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      saveDraft();
    });
    document.getElementById("csResult")?.addEventListener("input", (e) => {
      cs.result = e.target.value;
      saveDraft();
    });
    document.getElementById("csBtn1Label")?.addEventListener("input", (e) => {
      if (!cs.primaryAction) cs.primaryAction = { label: "", url: "" };
      cs.primaryAction.label = e.target.value;
      saveDraft();
    });
    document.getElementById("csBtn1Url")?.addEventListener("input", (e) => {
      if (!cs.primaryAction) cs.primaryAction = { label: "", url: "" };
      cs.primaryAction.url = e.target.value;
      saveDraft();
    });

    modal.classList.add("is-open");
  }

  function renderTeachingPane() {
    const container = document.getElementById("teachingEditorContainer");
    if (!container) return;
    const t = state.teaching;

    container.innerHTML = `
      <div class="paper-box">
        <div class="paper-box-head"><h3 class="paper-box-title">Judul &amp; Pengantar Mengajar</h3></div>
        <div class="form-grid">
          <div class="field">
            <label>Judul Seksi</label>
            <input type="text" class="input" id="teachTitle" value="${escapeAttr(t.title)}" />
          </div>
          <div class="field field--full">
            <label>Paragraf Penjelasan</label>
            <textarea class="textarea" id="teachDesc">${escapeHtml(t.description)}</textarea>
          </div>
        </div>
      </div>

      <div class="paper-box">
        <div class="paper-box-head">
          <h3 class="paper-box-title">Kartu Indeks (Daftar Kegiatan Mengajar &amp; Mentoring)</h3>
          <button type="button" class="btn btn--ink btn--sm" id="btnAddTeachActivity">+ Tambah Kegiatan</button>
        </div>
        <div style="display:flex; flex-direction:column; gap:12px;">
          ${t.activities
            .map(
              (act, idx) => `
            <div class="section-toggle-item" style="flex-wrap:wrap; gap:10px; opacity:${act.active ? 1 : 0.55};">
              <div style="display:flex; gap:8px; flex:1; min-width:260px;">
                <input type="text" class="input" data-teach-act="title" data-idx="${idx}" value="${escapeAttr(act.title)}" placeholder="Nama Peran / Kelas" />
                <input type="text" class="input" data-teach-act="subtitle" data-idx="${idx}" value="${escapeAttr(act.subtitle)}" placeholder="Instansi, Tahun" />
              </div>
              <div style="display:flex; align-items:center; gap:10px;">
                <label class="toggle">
                  <input type="checkbox" data-teach-act="isPlaceholder" data-idx="${idx}" ${act.isPlaceholder ? "checked" : ""} />
                  <span class="toggle-track"></span>
                  <span>Placeholder</span>
                </label>
                <label class="toggle">
                  <input type="checkbox" data-teach-act="active" data-idx="${idx}" ${act.active ? "checked" : ""} />
                  <span class="toggle-track"></span>
                  <span>Aktif</span>
                </label>
                <button type="button" class="btn btn--danger btn--sm" data-teach-del="${idx}">✕</button>
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>

      <div class="paper-box">
        <div class="paper-box-head">
          <h3 class="paper-box-title">Foto Kegiatan Polaroid</h3>
          <button type="button" class="btn btn--ink btn--sm" id="btnAddPolaroid">+ Tambah Polaroid</button>
        </div>
        <div style="display:flex; flex-direction:column; gap:16px;">
          ${t.polaroids
            .map(
              (pol, idx) => `
            <div class="upload-zone" style="opacity:${pol.active ? 1 : 0.55};">
              ${
                pol.src
                  ? `<img class="upload-thumb upload-thumb--square" src="${escapeAttr(getPreviewSrc(pol.src))}" alt="" />`
                  : `<div class="upload-thumb upload-thumb--square" style="display:grid;place-items:center;font-size:0.7rem;color:var(--ink-soft);">Kosong</div>`
              }
              <div class="upload-info">
                <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
                  <label class="btn btn--ink btn--sm" style="cursor:pointer;">
                    📷 Upload Foto Polaroid
                    <input type="file" accept="image/*" data-pol-upload="${idx}" hidden />
                  </label>
                  ${pol.src ? `<button type="button" class="btn btn--ghost-ink btn--sm" data-pol-clear="${idx}">Kosongkan</button>` : ""}
                  <input type="text" class="input" style="max-width:190px;" data-pol-field="caption" data-idx="${idx}" value="${escapeAttr(pol.caption)}" />
                  <select class="select" style="max-width:200px;" data-pol-field="tape" data-idx="${idx}">
                    ${TAPE_OPTIONS.map((opt) => `<option value="${opt.value}" ${pol.tape === opt.value ? "selected" : ""}>${opt.label}</option>`).join("")}
                  </select>
                  <label class="toggle">
                    <input type="checkbox" data-pol-field="active" data-idx="${idx}" ${pol.active ? "checked" : ""} />
                    <span class="toggle-track"></span>
                    <span>Tampil</span>
                  </label>
                  <button type="button" class="btn btn--danger btn--sm" data-pol-del="${idx}">Hapus</button>
                </div>
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `;

    document.getElementById("teachTitle")?.addEventListener("input", (e) => {
      t.title = e.target.value;
      saveDraft();
    });
    document.getElementById("teachDesc")?.addEventListener("input", (e) => {
      t.description = e.target.value;
      saveDraft();
    });
    document.getElementById("btnAddTeachActivity")?.addEventListener("click", () => {
      t.activities.push({ id: `teach-${Date.now()}`, title: "Kegiatan Baru", subtitle: "Instansi, Tahun", isPlaceholder: false, active: true });
      saveDraft();
      renderTeachingPane();
    });
    container.querySelectorAll("[data-teach-act]").forEach((inp) => {
      const idx = Number(inp.dataset.idx);
      const field = inp.dataset.teachAct;
      inp.addEventListener(inp.type === "checkbox" ? "change" : "input", (e) => {
        t.activities[idx][field] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
        saveDraft();
        if (e.target.type === "checkbox") renderTeachingPane();
      });
    });
    container.querySelectorAll("[data-teach-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        t.activities.splice(Number(btn.dataset.teachDel), 1);
        saveDraft();
        renderTeachingPane();
      });
    });
    document.getElementById("btnAddPolaroid")?.addEventListener("click", () => {
      t.polaroids.push({ id: `pol-${Date.now()}`, src: "", alt: "Kegiatan", width: 800, height: 800, caption: "Kegiatan", tape: "tape-kraft-flat.webp", active: true });
      saveDraft();
      renderTeachingPane();
    });
    container.querySelectorAll("[data-pol-field]").forEach((inp) => {
      const idx = Number(inp.dataset.idx);
      const field = inp.dataset.polField;
      inp.addEventListener(inp.type === "checkbox" || inp.tagName === "SELECT" ? "change" : "input", (e) => {
        t.polaroids[idx][field] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
        saveDraft();
        if (e.target.type === "checkbox") renderTeachingPane();
      });
    });
    container.querySelectorAll("[data-pol-clear]").forEach((btn) => {
      btn.addEventListener("click", () => {
        t.polaroids[Number(btn.dataset.polClear)].src = "";
        saveDraft();
        renderTeachingPane();
      });
    });
    container.querySelectorAll("[data-pol-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        t.polaroids.splice(Number(btn.dataset.polDel), 1);
        saveDraft();
        renderTeachingPane();
      });
    });
    container.querySelectorAll("[data-pol-upload]").forEach((inp) => {
      inp.addEventListener("change", async (e) => {
        const idx = Number(e.target.dataset.polUpload);
        const file = e.target.files?.[0];
        if (!file) return;
        const pol = t.polaroids[idx];
        const safeName = slugify(pol.caption || `polaroid-${idx + 1}`);
        const res = await processImageToWebP(file, `assets/images/teaching/${safeName}-${idx + 1}.webp`, { maxWidth: 800, squareCrop: true });
        pol.src = res.targetPath;
        pol.width = res.width;
        pol.height = res.height;
        pol.alt = pol.caption || "Foto kegiatan mengajar";
        saveDraft();
        renderTeachingPane();
        showToast("Foto polaroid berhasil dipotong persegi & dikonversi ke WebP!", "success");
      });
    });
  }

  function renderJourneyPane() {
    const container = document.getElementById("journeyEditorContainer");
    if (!container) return;
    const j = state.journey;

    container.innerHTML = `
      <div class="paper-box">
        <div class="paper-box-head"><h3 class="paper-box-title">Judul &amp; Pengantar Perjalanan</h3></div>
        <div class="form-grid">
          <div class="field">
            <label>Judul Seksi</label>
            <input type="text" class="input" id="jourTitle" value="${escapeAttr(j.title)}" />
          </div>
          <div class="field">
            <label>Deskripsi Pengantar</label>
            <input type="text" class="input" id="jourDesc" value="${escapeAttr(j.description)}" />
          </div>
        </div>
      </div>

      ${j.items
        .map(
          (item, idx) => `
        <div class="paper-box ${item.active ? "" : "is-inactive"}">
          <div class="paper-box-head">
            <div class="paper-box-title"><span>Slip #${idx + 1}: ${escapeHtml(item.role)}</span></div>
            <div style="display:flex; gap:8px; align-items:center;">
              <label class="toggle">
                <input type="checkbox" data-jour-act="active" data-idx="${idx}" ${item.active ? "checked" : ""} />
                <span class="toggle-track"></span>
                <span>${item.active ? "Tampil" : "Sembunyi"}</span>
              </label>
              <button type="button" class="btn btn--ghost-ink btn--sm" data-jour-move="up" data-idx="${idx}" ${idx === 0 ? "disabled" : ""}>↑</button>
              <button type="button" class="btn btn--ghost-ink btn--sm" data-jour-move="down" data-idx="${idx}" ${idx === j.items.length - 1 ? "disabled" : ""}>↓</button>
              <button type="button" class="btn btn--danger btn--sm" data-jour-del="${idx}">Hapus</button>
            </div>
          </div>
          <div class="form-grid form-grid--3">
            <div class="field">
              <label>Jabatan / Program Studi</label>
              <input type="text" class="input" data-jour-field="role" data-idx="${idx}" value="${escapeAttr(item.role)}" />
            </div>
            <div class="field">
              <label>Instansi / Perusahaan / Kampus</label>
              <input type="text" class="input" data-jour-field="org" data-idx="${idx}" value="${escapeAttr(item.org)}" />
            </div>
            <div class="field">
              <label>Rentang Waktu Tampil</label>
              <input type="text" class="input" data-jour-field="period" data-idx="${idx}" value="${escapeAttr(item.period)}" />
            </div>
            <div class="field field--full">
              <label>Deskripsi Singkat</label>
              <textarea class="textarea" style="min-height:60px;" data-jour-field="description" data-idx="${idx}">${escapeHtml(item.description)}</textarea>
            </div>
          </div>
        </div>
      `,
        )
        .join("")}

      <div class="paper-box">
        <div class="paper-box-head">
          <h3 class="paper-box-title">Kartu Sertifikasi (.cert)</h3>
          <label class="toggle">
            <input type="checkbox" id="toggleCertEnabled" ${j.certifications.enabled ? "checked" : ""} />
            <span class="toggle-track"></span>
            <span>${j.certifications.enabled ? "Tampil" : "Sembunyi"}</span>
          </label>
        </div>
        <div class="form-grid">
          <div class="field">
            <label>Judul Kartu Sertifikasi</label>
            <input type="text" class="input" id="certTitle" value="${escapeAttr(j.certifications.title)}" />
          </div>
          <div class="field field--full">
            <label>Daftar Sertifikasi (Satu per baris)</label>
            <textarea class="textarea" id="certItems">${escapeHtml((j.certifications.items || []).join("\n"))}</textarea>
          </div>
        </div>
      </div>
    `;

    document.getElementById("jourTitle")?.addEventListener("input", (e) => {
      j.title = e.target.value;
      saveDraft();
    });
    document.getElementById("jourDesc")?.addEventListener("input", (e) => {
      j.description = e.target.value;
      saveDraft();
    });
    container.querySelectorAll("[data-jour-field]").forEach((inp) => {
      inp.addEventListener("input", (e) => {
        j.items[Number(e.target.dataset.idx)][e.target.dataset.jourField] = e.target.value;
        saveDraft();
      });
    });
    container.querySelectorAll('[data-jour-act="active"]').forEach((inp) => {
      inp.addEventListener("change", (e) => {
        j.items[Number(e.target.dataset.idx)].active = e.target.checked;
        saveDraft();
        renderJourneyPane();
      });
    });
    container.querySelectorAll("[data-jour-move]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.idx);
        const dir = btn.dataset.jourMove;
        if (dir === "up" && idx > 0) [j.items[idx - 1], j.items[idx]] = [j.items[idx], j.items[idx - 1]];
        else if (dir === "down" && idx < j.items.length - 1) [j.items[idx + 1], j.items[idx]] = [j.items[idx], j.items[idx + 1]];
        saveDraft();
        renderJourneyPane();
      });
    });
    container.querySelectorAll("[data-jour-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        j.items.splice(Number(btn.dataset.jourDel), 1);
        saveDraft();
        renderJourneyPane();
      });
    });
    document.getElementById("toggleCertEnabled")?.addEventListener("change", (e) => {
      j.certifications.enabled = e.target.checked;
      saveDraft();
      renderJourneyPane();
    });
    document.getElementById("certTitle")?.addEventListener("input", (e) => {
      j.certifications.title = e.target.value;
      saveDraft();
    });
    document.getElementById("certItems")?.addEventListener("input", (e) => {
      j.certifications.items = e.target.value
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      saveDraft();
    });
  }

  function renderProcessPane() {
    const container = document.getElementById("processEditorContainer");
    if (!container) return;
    const p = state.process;

    container.innerHTML = `
      <div class="paper-box">
        <div class="paper-box-head"><h3 class="paper-box-title">Judul &amp; Penjelasan Proses Kerja</h3></div>
        <div class="form-grid">
          <div class="field">
            <label>Judul Seksi</label>
            <input type="text" class="input" id="procTitle" value="${escapeAttr(p.title)}" />
          </div>
          <div class="field field--full">
            <label>Deskripsi</label>
            <textarea class="textarea" id="procDesc">${escapeHtml(p.description)}</textarea>
          </div>
        </div>
      </div>
      <div class="form-grid">
        ${p.steps
          .map(
            (step, idx) => `
          <div class="paper-box ${step.active ? "" : "is-inactive"}" style="margin-bottom:0;">
            <div class="paper-box-head">
              <strong class="paper-box-title">Sticky Note #${idx + 1}</strong>
              <div style="display:flex; gap:8px; align-items:center;">
                <label class="toggle">
                  <input type="checkbox" data-proc-active="${idx}" ${step.active ? "checked" : ""} />
                  <span class="toggle-track"></span>
                </label>
                <button type="button" class="btn btn--danger btn--sm" data-proc-del="${idx}">✕</button>
              </div>
            </div>
            <div class="field" style="margin-bottom:10px;">
              <label>Judul Langkah</label>
              <input type="text" class="input" data-proc-field="title" data-idx="${idx}" value="${escapeAttr(step.title)}" />
            </div>
            <div class="field" style="margin-bottom:10px;">
              <label>Warna Kertas</label>
              <select class="select" data-proc-field="color" data-idx="${idx}">
                <option value="yellow" ${step.color === "yellow" ? "selected" : ""}>🟨 Kuning</option>
                <option value="green" ${step.color === "green" ? "selected" : ""}>🟩 Hijau Mint</option>
                <option value="coral" ${step.color === "coral" ? "selected" : ""}>🟧 Koral</option>
                <option value="lavender" ${step.color === "lavender" ? "selected" : ""}>🟪 Ungu Muda</option>
              </select>
            </div>
            <div class="field">
              <label>Isi Catatan</label>
              <textarea class="textarea" data-proc-field="text" data-idx="${idx}">${escapeHtml(step.text)}</textarea>
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
    `;

    document.getElementById("procTitle")?.addEventListener("input", (e) => {
      p.title = e.target.value;
      saveDraft();
    });
    document.getElementById("procDesc")?.addEventListener("input", (e) => {
      p.description = e.target.value;
      saveDraft();
    });
    container.querySelectorAll("[data-proc-field]").forEach((inp) => {
      inp.addEventListener(inp.tagName === "SELECT" ? "change" : "input", (e) => {
        p.steps[Number(e.target.dataset.idx)][e.target.dataset.procField] = e.target.value;
        saveDraft();
      });
    });
    container.querySelectorAll("[data-proc-active]").forEach((inp) => {
      inp.addEventListener("change", (e) => {
        p.steps[Number(e.target.dataset.procActive)].active = e.target.checked;
        saveDraft();
        renderProcessPane();
      });
    });
    container.querySelectorAll("[data-proc-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        p.steps.splice(Number(btn.dataset.procDel), 1);
        saveDraft();
        renderProcessPane();
      });
    });
  }

  function renderContactPane() {
    const container = document.getElementById("contactEditorContainer");
    if (!container) return;
    const c = state.contact;

    container.innerHTML = `
      <div class="paper-box">
        <div class="paper-box-head"><h3 class="paper-box-title">Buku Sketsa Kontak</h3></div>
        <div class="form-grid">
          <div class="field field--full">
            <label>Headline Ajakan Kontak</label>
            <input type="text" class="input" data-contact="title" value="${escapeAttr(c.title)}" />
          </div>
          <div class="field">
            <label>Sub-teks Kontak</label>
            <input type="text" class="input" data-contact="description" value="${escapeAttr(c.description)}" />
          </div>
          <div class="field">
            <label>Catatan Kapur Kontak</label>
            <input type="text" class="input" data-contact="chalkNote" value="${escapeAttr(c.chalkNote)}" />
          </div>
          <div class="field">
            <label>Label Tombol LinkedIn</label>
            <input type="text" class="input" data-contact="linkedinLabel" value="${escapeAttr(c.linkedinLabel)}" />
          </div>
          <div class="field">
            <label>URL Profil LinkedIn</label>
            <input type="url" class="input" data-contact="linkedinUrl" value="${escapeAttr(c.linkedinUrl)}" />
          </div>
          <div class="field">
            <label>Label Tombol Email</label>
            <input type="text" class="input" data-contact="emailLabel" value="${escapeAttr(c.emailLabel)}" />
          </div>
          <div class="field">
            <label>Alamat Email Tujuan</label>
            <input type="email" class="input" data-contact="emailAddress" value="${escapeAttr(c.emailAddress)}" />
          </div>
        </div>
      </div>

      <div class="paper-box">
        <div class="paper-box-head"><h3 class="paper-box-title">Stiker Sosial Media</h3></div>
        <div style="display:flex; flex-direction:column; gap:12px;">
          ${c.socials
            .map(
              (soc, idx) => `
            <div class="section-toggle-item" style="flex-wrap:wrap; gap:12px; opacity:${soc.active ? 1 : 0.6};">
              <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:260px;">
                <select class="select" style="max-width:140px;" data-soc-field="platform" data-idx="${idx}">
                  <option value="github" ${soc.platform === "github" ? "selected" : ""}>GitHub</option>
                  <option value="instagram" ${soc.platform === "instagram" ? "selected" : ""}>Instagram</option>
                  <option value="tiktok" ${soc.platform === "tiktok" ? "selected" : ""}>TikTok</option>
                  <option value="linkedin" ${soc.platform === "linkedin" ? "selected" : ""}>LinkedIn</option>
                  <option value="youtube" ${soc.platform === "youtube" ? "selected" : ""}>YouTube</option>
                  <option value="x" ${soc.platform === "x" ? "selected" : ""}>X / Twitter</option>
                  <option value="globe" ${soc.platform === "globe" ? "selected" : ""}>Website</option>
                </select>
                <input type="text" class="input" style="max-width:150px;" data-soc-field="label" data-idx="${idx}" value="${escapeAttr(soc.label)}" />
                <input type="url" class="input" data-soc-field="url" data-idx="${idx}" value="${escapeAttr(soc.url)}" />
              </div>
              <div style="display:flex; align-items:center; gap:10px;">
                <label class="toggle">
                  <input type="checkbox" data-soc-field="active" data-idx="${idx}" ${soc.active ? "checked" : ""} />
                  <span class="toggle-track"></span>
                  <span>${soc.active ? "Aktif" : "Nonaktif"}</span>
                </label>
                <button type="button" class="btn btn--danger btn--sm" data-soc-del="${idx}">✕</button>
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `;

    container.querySelectorAll("[data-contact]").forEach((inp) => {
      inp.addEventListener("input", (e) => {
        c[e.target.dataset.contact] = e.target.value;
        saveDraft();
      });
    });
    container.querySelectorAll("[data-soc-field]").forEach((inp) => {
      const idx = Number(inp.dataset.idx);
      const field = inp.dataset.socField;
      inp.addEventListener(inp.type === "checkbox" || inp.tagName === "SELECT" ? "change" : "input", (e) => {
        c.socials[idx][field] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
        saveDraft();
        if (e.target.type === "checkbox") renderContactPane();
      });
    });
    container.querySelectorAll("[data-soc-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        c.socials.splice(Number(btn.dataset.socDel), 1);
        saveDraft();
        renderContactPane();
      });
    });
  }

  /* ==========================================================================
     IMAGE WEBP PROCESSOR & HTML BAKERS
     ========================================================================== */

  async function processImageToWebP(file, targetPath, { maxWidth = 1440, squareCrop = false } = {}) {
    const bitmap = await createImageBitmap(file);
    let srcX = 0,
      srcY = 0,
      srcW = bitmap.width,
      srcH = bitmap.height;
    if (squareCrop) {
      const side = Math.min(srcW, srcH);
      srcX = Math.floor((srcW - side) / 2);
      srcY = Math.floor((srcH - side) / 2);
      srcW = side;
      srcH = side;
    }
    const scale = srcW > maxWidth ? maxWidth / srcW : 1;
    const outW = Math.round(srcW * scale);
    const outH = Math.round(srcH * scale);

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    canvas.getContext("2d").drawImage(bitmap, srcX, srcY, srcW, srcH, 0, 0, outW, outH);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
    const base64 = await fileToBase64(blob);
    const dataUrl = canvas.toDataURL("image/webp", 0.82);

    pendingFiles.set(targetPath, { base64, blob, dataUrl, mimeType: "image/webp" });
    return { targetPath, width: outW, height: outH, blob, base64, dataUrl };
  }

  function fileToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = String(reader.result || "");
        const idx = res.indexOf(",");
        resolve(idx >= 0 ? res.slice(idx + 1) : res);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function getPreviewSrc(path) {
    if (!path) return "";
    return pendingFiles.has(path) ? pendingFiles.get(path).dataUrl : path;
  }

  function bakeIndexHtml(data) {
    const m = data.meta;
    const h = data.hero;
    const sec = data.sections;
    const base = m.canonicalBase.endsWith("/") ? m.canonicalBase : `${m.canonicalBase}/`;
    const ogImgUrl = m.ogImage.startsWith("http") ? m.ogImage : `${base}${m.ogImage}`;

    const navItems = [
      `<a class="tape-link tape-link--identity nav-link" href="#home">\n        <img src="${escapeAttr(h.stamp.src)}" alt="" width="${h.stamp.width}" height="${h.stamp.height}" />\n        <span class="tape-text">${escapeHtml(h.name)}</span>\n      </a>`,
    ];
    if (sec.proyek) navItems.push(`<a class="tape-link nav-link" href="#proyek">Proyek</a>`);
    if (sec.mengajar) navItems.push(`<a class="tape-link nav-link" href="#mengajar">Mengajar</a>`);
    if (sec.kontak) navItems.push(`<a class="tape-link tape-link--yellow nav-link" href="#kontak">Kontak</a>`);

    const activeSteps = data.process.steps.filter((s) => s.active);
    const processHtml = sec.proses
      ? `
        <section class="section" id="proses" aria-labelledby="proses-title">
          <img class="desk-prop prop-triangle" src="assets/images/desk/ruler-triangle.webp" alt="" width="760"
            height="638" data-speed="1.15" />
          <img class="desk-prop prop-clips" src="assets/images/desk/paperclips-pile.webp" alt="" width="504"
            height="560" data-speed="0.9" />

          <div class="container">
            <header class="section-head">
              <h2 id="proses-title">${escapeHtml(data.process.title)}</h2>
              <p>${escapeHtml(data.process.description)}</p>
            </header>

            <div class="process-board">
              <svg class="process-arrows" viewBox="0 0 1000 80" preserveAspectRatio="none" aria-hidden="true">
                <path class="chalk" d="M150 70 C 200 8, 300 8, 352 62" />
                <path class="chalk" d="M338 50 L 352 64 L 360 46" />
                <path class="chalk" d="M400 70 C 450 8, 550 8, 602 62" />
                <path class="chalk" d="M588 50 L 602 64 L 610 46" />
                <path class="chalk" d="M650 70 C 700 8, 800 8, 852 62" />
                <path class="chalk" d="M838 50 L 852 64 L 860 46" />
              </svg>

              <ol class="process">
${activeSteps
  .map(
    (s) => `                <li class="process-note process-note--${escapeAttr(s.color || "yellow")}">
                  <img class="pin" src="assets/images/desk/pushpin-red-top.webp" alt="" width="113" height="140" />
                  <h3>${escapeHtml(s.title)}</h3>
                  <p>${escapeHtml(s.text)}</p>
                </li>`,
  )
  .join("\n")}
              </ol>
            </div>
          </div>
        </section>`
      : "";

    const activeProjects = data.projects.items.filter((p) => p.active);
    const projectsHtml = sec.proyek
      ? `
        <section class="section section--projects" id="proyek" aria-labelledby="proyek-title">
          <img class="desk-prop prop-macbook" src="assets/images/desk/macbook.webp" alt="" width="1400" height="911"
            data-speed="0.9" />
          <img class="desk-prop prop-ruler" src="assets/images/desk/ruler-steel.webp" alt="" width="1800" height="198"
            data-speed="1.08" />

          <div class="container">
            <header class="section-head">
              <h2 id="proyek-title">${escapeHtml(data.projects.title)}</h2>
              <p>${escapeHtml(data.projects.description)}</p>
            </header>
          </div>

          <div class="project-viewport">
            <div class="project-track">
${activeProjects.map((p) => bakeProjectCard(p)).join("\n\n")}
            </div>
          </div>
        </section>`
      : "";

    const activeActivities = data.teaching.activities.filter((a) => a.active);
    const activePolaroids = data.teaching.polaroids.filter((p) => p.active);
    const teachingHtml = sec.mengajar
      ? `
        <section class="section" id="mengajar" aria-labelledby="mengajar-title">
          <img class="desk-prop prop-scissors" src="assets/images/desk/scissors.webp" alt="" width="760" height="364"
            data-speed="1.1" />
          <img class="desk-prop prop-highlighter" src="assets/images/desk/highlighter-yellow.webp" alt="" width="560"
            height="489" data-speed="0.92" />

          <div class="container teach">
            <div class="teach-copy">
              <header class="section-head">
                <h2 id="mengajar-title">${escapeHtml(data.teaching.title)}</h2>
                <p>${escapeHtml(data.teaching.description)}</p>
              </header>

              <div class="index-card">
                <img class="index-clip" src="assets/images/desk/paperclip-blue.webp" alt="" width="131" height="200" />
                <ul>
${activeActivities
  .map(
    (act) => `                  <li${act.isPlaceholder ? ' class="is-placeholder"' : ""}>
                    <strong>${escapeHtml(act.title)}</strong>
                    <span>${escapeHtml(act.subtitle)}</span>
                  </li>`,
  )
  .join("\n")}
                </ul>
              </div>
            </div>

            <div class="polaroids" aria-label="Foto kegiatan">
${activePolaroids
  .map((pol) => {
    const tapeObj = TAPE_OPTIONS.find((t) => t.value === pol.tape) || TAPE_OPTIONS[0];
    const photoMarkup = pol.src
      ? `<img class="polaroid-photo" src="${escapeAttr(pol.src)}" alt="${escapeAttr(pol.alt || pol.caption)}" width="${pol.width || 800}" height="${pol.height || 800}" loading="lazy" />`
      : `<span class="polaroid-photo"></span>`;
    return `              <figure class="polaroid">
                <img class="tape" src="assets/images/desk/${escapeAttr(tapeObj.value)}" alt="" width="${tapeObj.w}" height="${tapeObj.h}" />
                ${photoMarkup}
                <figcaption>${escapeHtml(pol.caption)}</figcaption>
              </figure>`;
  })
  .join("\n")}
            </div>
          </div>
        </section>`
      : "";

    const activeJourney = data.journey.items.filter((j) => j.active);
    const cert = data.journey.certifications;
    const journeyHtml = sec.perjalanan
      ? `
        <section class="section" id="perjalanan" aria-labelledby="perjalanan-title">
          <img class="desk-prop prop-earphones" src="assets/images/desk/earphones.webp" alt="" width="760" height="756"
            data-speed="1.12" />

          <div class="container">
            <header class="section-head">
              <h2 id="perjalanan-title">${escapeHtml(data.journey.title)}</h2>
              <p>${escapeHtml(data.journey.description)}</p>
            </header>

            <div class="ruler">
              <div class="ruler-rail" aria-hidden="true"></div>

              <ol class="ruler-list">
${activeJourney
  .map((item, idx) => {
    const isLast = idx === activeJourney.length - 1;
    const certBlock =
      isLast && cert.enabled && cert.items?.length
        ? `\n                  <div class="cert">
                    <p class="cert-title">${escapeHtml(cert.title)}</p>
                    <ul>
${cert.items.map((ci) => `                      <li>${escapeHtml(ci)}</li>`).join("\n")}
                    </ul>
                  </div>`
        : "";
    return `                <li class="ruler-item">
                  <time datetime="${escapeAttr(item.datetime || "2026")}">${escapeHtml(item.period)}</time>
                  <div class="slip">
                    <h3>${escapeHtml(item.role)}</h3>
                    <p class="slip-org">${escapeHtml(item.org)}</p>
                    <p>${escapeHtml(item.description)}</p>
                  </div>${certBlock}
                </li>`;
  })
  .join("\n")}
              </ol>
            </div>
          </div>
        </section>`
      : "";

    const c = data.contact;
    const activeSocials = c.socials.filter((s) => s.active);
    const cvButtonHtml = h.cv.enabled
      ? `\n                <a class="button button--ghost-ink" href="${escapeAttr(h.cv.path)}" download>${escapeHtml(h.cv.label)}</a>`
      : "";

    const contactHtml = sec.kontak
      ? `
        <section class="section section--contact" id="kontak" aria-labelledby="kontak-title">
          <img class="desk-prop prop-mug keep-mobile" src="assets/images/desk/coffee-mug.webp" alt="" width="437"
            height="560" data-speed="0.92" />
          <img class="desk-prop prop-taperoll" src="assets/images/desk/tape-yellow-roll.webp" alt="" width="520"
            height="519" data-speed="1.1" />
          <img class="desk-prop desk-prop--drag prop-paperball" src="assets/images/desk/paper-crumpled-real.webp" alt=""
            width="520" height="489" />

          <div class="container contact-wrap">
            <div class="chalk-note chalk-note--contact" aria-hidden="true">
              <span>${escapeHtml(c.chalkNote)}</span>
              <svg viewBox="0 0 140 70">
                <path class="chalk" d="M6 20 C 50 4, 100 18, 128 52" />
                <path class="chalk" d="M112 48 L 130 56 L 128 36" />
              </svg>
            </div>

            <div class="letter">
              <img class="letter-clip" src="assets/images/desk/clip-bulldog-metal.webp" alt="" width="380"
                height="308" />
              <h2 id="kontak-title">${escapeHtml(c.title)}</h2>
              <p>${escapeHtml(c.description)}</p>
              <div class="letter-actions">
                <a class="button button--primary" href="${escapeAttr(c.linkedinUrl)}" target="_blank"
                  rel="noopener noreferrer">${escapeHtml(c.linkedinLabel)}</a>
                <a class="button button--ink" href="mailto:${escapeAttr(c.emailAddress)}">${escapeHtml(c.emailLabel)}</a>${cvButtonHtml}
              </div>
              <ul class="stickers" aria-label="Media sosial">
${activeSocials
  .map(
    (s) => `                <li>
                  <a class="sticker" href="${escapeAttr(s.url)}" target="_blank" rel="noopener noreferrer"
                    aria-label="${escapeAttr(s.label)}">
                    ${SOCIAL_ICONS[s.platform] || SOCIAL_ICONS.globe}
                  </a>
                </li>`,
  )
  .join("\n")}
              </ul>
            </div>
          </div>
        </section>`
      : "";

    return `<!doctype html>
<html lang="id">

<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(m.siteTitle)}</title>
  <meta name="description"
    content="${escapeAttr(m.metaDescription)}" />
  <meta name="theme-color" content="#1d5a43" />
  <meta property="og:title" content="${escapeAttr(m.siteTitle)}" />
  <meta property="og:description"
    content="${escapeAttr(m.ogDescription)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeAttr(base)}" />
  <meta property="og:image" content="${escapeAttr(ogImgUrl)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="canonical" href="${escapeAttr(base)}" />
  <link rel="preload" href="assets/fonts/geist-latin.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Nanum+Pen+Script&display=swap" rel="stylesheet" />
  <link rel="icon" type="image/webp" href="${escapeAttr(h.stamp.src)}" />
  <link rel="stylesheet" href="css/style.css" />
</head>

<body>
  <a class="skip-link" href="#main-content">Lewati ke konten</a>
  <div class="site-noise" aria-hidden="true"></div>

  <header class="site-header" id="siteHeader">
    <nav class="tape-nav" aria-label="Navigasi utama">
      ${navItems.join("\n      ")}
    </nav>
  </header>

  <div id="smooth-wrapper">
    <div id="smooth-content" class="mat">
      <main id="main-content">
        <section class="hero" id="home" aria-labelledby="hero-title">
          <img class="desk-prop prop-keyboard" src="assets/images/desk/keyboard-mechanical.webp" alt="" width="1500"
            height="540" data-speed="0.85" />
          <img class="desk-prop desk-prop--drag prop-pencil keep-mobile" src="assets/images/desk/pencil-yellow.webp"
            alt="" width="1100" height="105" />
          <img class="desk-prop prop-shaving" src="assets/images/desk/pencil-shaving.webp" alt="" width="460"
            height="373" data-speed="1.05" />
          <img class="desk-prop desk-prop--drag prop-eraser" src="assets/images/desk/eraser.webp" alt="" width="520"
            height="187" />

          <div class="hero-copy">
            <h1 id="hero-title">
              <span class="hero-name">${escapeHtml(h.name)}</span>
              <span class="hero-role">${escapeHtml(h.role)}</span>
            </h1>
            <p class="hero-lead">${escapeHtml(h.lead)}</p>
            <div class="hero-actions">
              <a class="button button--primary" href="${escapeAttr(h.primaryBtn.url)}"${h.primaryBtn.external ? ' target="_blank"\n                rel="noopener noreferrer"' : ""}>${escapeHtml(h.primaryBtn.label)}</a>
              <a class="button button--ghost" href="${escapeAttr(h.secondaryBtn.url)}">${escapeHtml(h.secondaryBtn.label)}</a>
            </div>
          </div>

          <div class="folder-stage" id="folderStage">
            <div class="chalk-note chalk-note--hero" aria-hidden="true">
              <span>${escapeHtml(h.chalkNote)}</span>
              <svg viewBox="0 0 120 90">
                <path class="chalk" d="M10 8 C 60 6, 96 26, 92 74" />
                <path class="chalk" d="M80 62 L 92 76 L 102 60" />
              </svg>
            </div>

            <div class="folder-asset" id="mainFolder">
              <img src="assets/images/folder-ui/folder-back.webp" alt="" class="folder-layer folder-back-img"
                draggable="false" width="855" height="596" />

              <div class="folder-files-layer">
                <div class="asset-file file-empty" aria-hidden="true">
                  <img src="assets/images/folder-ui/file-empty.webp" alt="" draggable="false" width="531"
                    height="574" />
                </div>

                <a class="asset-file file-interactive file-work" href="#perjalanan">
                  <img src="assets/images/folder-ui/file-work.webp" alt="" draggable="false" width="736" height="399" />
                  <span class="file-bubble"><strong>Perjalanan</strong><small>Kerja &amp; studi</small></span>
                </a>

                <a class="asset-file file-interactive file-studies" href="#mengajar">
                  <img src="assets/images/folder-ui/file-studies.webp" alt="" draggable="false" width="410"
                    height="476" />
                  <span class="file-bubble"><strong>Mengajar</strong><small>Kelas &amp; mentoring</small></span>
                </a>

                <a class="asset-file file-interactive file-project" href="#proyek">
                  <img src="assets/images/folder-ui/file-project.webp" alt="" draggable="false" width="410"
                    height="476" />
                  <span class="file-bubble"><strong>Proyek</strong><small>Studi kasus</small></span>
                </a>
              </div>

              <img src="assets/images/folder-ui/folder-front.webp" alt="" class="folder-layer folder-front-img"
                draggable="false" width="892" height="626" />
              <div class="stamp-layer">
                <img src="${escapeAttr(h.stamp.src)}" alt="${escapeAttr(h.stamp.alt)}" class="stamp-img" draggable="false"
                  width="${h.stamp.width}" height="${h.stamp.height}" />
              </div>
              <p class="folder-label" aria-hidden="true">${escapeHtml(h.folderLabelLine1)}<br />${escapeHtml(h.folderLabelLine2)}</p>
            </div>
          </div>
        </section>${processHtml}${projectsHtml}${teachingHtml}${journeyHtml}${contactHtml}
      </main>

      <footer class="site-footer">
        <div class="container footer-row">
          <p>&copy; <span id="currentYear">2026</span> ${escapeHtml(h.name)}, ${escapeHtml(m.location || "Bogor, Indonesia")}</p>
          <a href="#home">Kembali ke atas</a>
        </div>
      </footer>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/ScrollTrigger.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/ScrollSmoother.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/DrawSVGPlugin.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/Draggable.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/InertiaPlugin.min.js" defer></script>
  <script src="js/main.js" defer></script>
</body>

</html>
`;
  }

  function bakeProjectCard(p) {
    const isPending = p.status === "upcoming";
    const isOngoing = p.status === "ongoing";
    const isClickable = !isPending && p.linkType !== "none";

    const classes = ["project-card"];
    if (isPending) classes.push("is-pending");
    if (isOngoing) classes.push("is-ongoing");

    const href = p.linkType === "external" ? p.externalUrl || "#" : `projects/${p.slug || slugify(p.title)}.html`;
    const targetAttr = p.linkType === "external" ? ' target="_blank" rel="noopener noreferrer"' : "";

    const openTag = isClickable ? `<a class="${classes.join(" ")}" href="${escapeAttr(href)}"${targetAttr}>` : `<div class="${classes.join(" ")}">`;
    const closeTag = isClickable ? `</a>` : `</div>`;

    const badgeText = p.statusBadge || (isOngoing ? "Ongoing" : "");
    const badgeHtml = badgeText ? `\n                  <span class="project-badge">${escapeHtml(badgeText)}</span>` : "";

    const printHtml = p.image?.src
      ? `<span class="project-print">${badgeHtml}
                  <img src="${escapeAttr(p.image.src)}" alt="${escapeAttr(p.image.alt || p.title)}"
                    loading="lazy" width="${p.image.width || 1440}" height="${p.image.height || 900}" />
                </span>`
      : `<span class="project-print project-print--empty">${badgeHtml}<span>${escapeHtml(p.emptyLabel || "Mockup menyusul")}</span></span>`;

    const progressHtml =
      p.showProgress && typeof p.progress === "number"
        ? `\n                <span class="project-progress">
                  <span class="project-progress-head"><span>Progres pengerjaan</span><span>${p.progress}%</span></span>
                  <span class="project-progress-bar"><span class="project-progress-fill" style="width:${Math.min(100, Math.max(0, p.progress))}%"></span></span>
                </span>`
        : "";

    const tagsHtml = p.tags?.length ? `\n                  <span class="tags">${p.tags.map((t) => `<span>${escapeHtml(t)}</span>`).join("")}</span>` : "";

    return `              ${openTag}
                <img class="binder-clip" src="assets/images/desk/clip-binder-black.webp" alt="" width="228"
                  height="300" />
                ${printHtml}
                <span class="project-kind">${escapeHtml(p.kind)}</span>
                <h3>${escapeHtml(p.title)}</h3>
                <p>${escapeHtml(p.summary)}</p>${progressHtml}
                <span class="project-meta">${tagsHtml}
                  <span class="project-open">${escapeHtml(p.openLabel || (isPending ? "Segera" : "Buka studi kasus"))}</span>
                </span>
              ${closeTag}`;
  }

  function bakeCaseStudyHtml(project, data) {
    const cs = project.caseStudy || createDefaultCaseStudy(project.title);
    const m = data.meta;
    const h = data.hero;
    const base = m.canonicalBase.endsWith("/") ? m.canonicalBase : `${m.canonicalBase}/`;
    const slug = project.slug || slugify(project.title);

    const embedUrl = toYoutubeEmbedUrl(cs.videoEmbedUrl);
    const mainMediaSrc = cs.mainMedia?.src
      ? cs.mainMedia.src.startsWith("../") || cs.mainMedia.src.startsWith("http")
        ? cs.mainMedia.src
        : `../${cs.mainMedia.src}`
      : `../${project.image?.src || "assets/images/projects/ruhul-os.jpg"}`;

    const mediaInner = embedUrl
      ? `<iframe src="${escapeAttr(embedUrl)}" title="Video showcase ${escapeAttr(project.title)}"
              allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>`
      : `<img src="${escapeAttr(mainMediaSrc)}"
              alt="${escapeAttr(cs.mainMedia?.alt || project.title)}" width="${cs.mainMedia?.width || 1440}" height="${cs.mainMedia?.height || 900}" />`;

    return `<!doctype html>
<html lang="id">

<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(project.title)} | ${escapeHtml(h.name)}</title>
  <meta name="description" content="${escapeAttr(cs.metaDescription || project.summary)}" />
  <meta name="theme-color" content="#1d5a43" />
  <link rel="canonical" href="${escapeAttr(`${base}projects/${slug}.html`)}" />
  <link rel="preload" href="../assets/fonts/geist-latin.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Nanum+Pen+Script&display=swap" rel="stylesheet" />
  <link rel="icon" type="image/webp" href="../${escapeAttr(h.stamp.src)}" />
  <link rel="stylesheet" href="../css/style.css" />
</head>

<body>
  <a class="skip-link" href="#main-content">Lewati ke konten</a>
  <div class="site-noise" aria-hidden="true"></div>

  <header class="site-header" id="siteHeader">
    <nav class="tape-nav" aria-label="Navigasi utama">
      <a class="tape-link tape-link--identity" href="../index.html">
        <img src="../${escapeAttr(h.stamp.src)}" alt="" width="${h.stamp.width}" height="${h.stamp.height}" />
        <span class="tape-text">${escapeHtml(h.name)}</span>
      </a>
      <a class="tape-link" href="../index.html#proyek">Proyek</a>
      <a class="tape-link" href="../index.html#mengajar">Mengajar</a>
      <a class="tape-link tape-link--yellow" href="../index.html#kontak">Kontak</a>
    </nav>
  </header>

  <div id="smooth-wrapper">
    <div id="smooth-content" class="mat">
      <main id="main-content" class="case">
        <div class="container">
          <a class="case-back" href="../index.html#proyek">Kembali ke semua proyek</a>
          <h1 class="case-title">${escapeHtml(project.title)}</h1>
          <p class="case-lead">${escapeHtml(cs.lead || project.summary)}</p>
          <dl class="case-facts">
${(cs.facts || []).map((f) => `            <div>\n              <dt>${escapeHtml(f.label)}</dt>\n              <dd>${escapeHtml(f.value)}</dd>\n            </div>`).join("\n")}
          </dl>
          <figure class="case-media">
            <img class="tape" src="../assets/images/desk/tape-kraft-flat.webp" alt="" width="560" height="170" />
            ${mediaInner}
            <figcaption>${escapeHtml(cs.mainMedia?.caption || "")}</figcaption>
          </figure>
          <article class="case-story">
            <h2>Masalah</h2>
            <p>${escapeHtml(cs.problem || "")}</p>
            <h2>Proses</h2>
            <ul>
${(cs.processSteps || []).map((step) => `              <li>${escapeHtml(step)}</li>`).join("\n")}
            </ul>
            <h2>Hasil</h2>
            <p>${escapeHtml(cs.result || "")}</p>
            <div class="case-actions">
              ${cs.primaryAction?.url ? `<a class="button button--primary" href="${escapeAttr(cs.primaryAction.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(cs.primaryAction.label || "Lihat Proyek")}</a>` : ""}
              <a class="button button--ghost-ink" href="../index.html#kontak">${escapeHtml(cs.secondaryAction?.label || "Hubungi saya")}</a>
            </div>
          </article>
        </div>
      </main>
      <footer class="site-footer">
        <div class="container footer-row">
          <p>&copy; <span id="currentYear">2026</span> ${escapeHtml(h.name)}, ${escapeHtml(m.location || "Bogor, Indonesia")}</p>
          <a href="../index.html">Kembali ke beranda</a>
        </div>
      </footer>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/ScrollTrigger.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/ScrollSmoother.min.js" defer></script>
  <script src="../js/main.js" defer></script>
</body>

</html>
`;
  }

  function bakeSitemapXml(data) {
    const base = data.meta.canonicalBase.endsWith("/") ? data.meta.canonicalBase : `${data.meta.canonicalBase}/`;
    const today = new Date().toISOString().slice(0, 10);
    const urls = [`  <url>\n    <loc>${escapeHtml(base)}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`];
    data.projects.items
      .filter((p) => p.active && p.linkType === "case-study" && p.slug)
      .forEach((p) => {
        urls.push(`  <url>\n    <loc>${escapeHtml(`${base}projects/${p.slug}.html`)}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`);
      });
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
  }

  function collectAllGeneratedTextFiles() {
    const files = new Map();
    files.set("data/portfolio.json", JSON.stringify(state, null, 2) + "\n");
    files.set("index.html", bakeIndexHtml(state));
    files.set("sitemap.xml", bakeSitemapXml(state));
    state.projects.items.forEach((proj) => {
      if (proj.linkType === "case-study" && proj.slug) {
        files.set(`projects/${proj.slug}.html`, bakeCaseStudyHtml(proj, state));
      }
    });
    return files;
  }

  async function publishToGithub() {
    if (!sessionAuth?.token) {
      lockAndExitStudio("Sesi telah berakhir. Silakan buka kembali dengan PIN Anda.");
      return;
    }

    const btn = document.getElementById("btnPublishGithub");
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "⏳ Mempublish ke Live...";

    try {
      const headers = {
        Authorization: `Bearer ${sessionAuth.token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      };
      const apiBase = `https://api.github.com/repos/${sessionAuth.owner}/${sessionAuth.repo}`;
      const branch = sessionAuth.branch || "master";

      const refRes = await fetch(`${apiBase}/git/ref/heads/${branch}`, { headers });
      if (!refRes.ok) throw new Error(`Gagal membaca branch "${branch}" (${refRes.status}).`);
      const refData = await refRes.json();
      const latestCommitSha = refData.object.sha;

      const commitRes = await fetch(`${apiBase}/git/commits/${latestCommitSha}`, { headers });
      const commitData = await commitRes.json();
      const baseTreeSha = commitData.tree.sha;

      const treeItems = [];
      for (const [path, content] of collectAllGeneratedTextFiles().entries()) {
        treeItems.push({ path, mode: "100644", type: "blob", content });
      }

      for (const [path, fileObj] of pendingFiles.entries()) {
        const blobRes = await fetch(`${apiBase}/git/blobs`, {
          method: "POST",
          headers,
          body: JSON.stringify({ content: fileObj.base64, encoding: "base64" }),
        });
        if (!blobRes.ok) throw new Error(`Gagal mengunggah file ${path}`);
        const blobData = await blobRes.json();
        treeItems.push({ path, mode: "100644", type: "blob", sha: blobData.sha });
      }

      const newTreeRes = await fetch(`${apiBase}/git/trees`, {
        method: "POST",
        headers,
        body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
      });
      if (!newTreeRes.ok) throw new Error("Gagal membuat Git Tree.");
      const newTreeData = await newTreeRes.json();

      const newCommitRes = await fetch(`${apiBase}/git/commits`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: "content: update portfolio via Studio",
          tree: newTreeData.sha,
          parents: [latestCommitSha],
        }),
      });
      if (!newCommitRes.ok) throw new Error("Gagal membuat Commit.");
      const newCommitData = await newCommitRes.json();

      const updateRefRes = await fetch(`${apiBase}/git/refs/heads/${branch}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ sha: newCommitData.sha }),
      });
      if (!updateRefRes.ok) throw new Error("Gagal memperbarui branch.");

      pendingFiles.clear();
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      markDirty(false);
      showToast(`🚀 Berhasil dipublish ke GitHub Pages (${branch})! Perubahan akan tampil live dalam ~30 detik.`, "success");
    } catch (err) {
      showToast("Gagal Publish: " + err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = origText;
    }
  }

  /* ==========================================================================
     DYNAMIC STUDIO CSS INJECTION (ONLY LOADED AFTER AUTH)
     ========================================================================== */

  function injectStudioStyles() {
    if (document.getElementById("studioDynamicStyle")) return;
    const style = document.createElement("style");
    style.id = "studioDynamicStyle";
    style.textContent = `
      .studio-topbar { position:sticky;top:0;z-index:100;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:12px 24px;background:rgba(16,53,40,0.95);backdrop-filter:blur(10px);border-bottom:1px solid rgba(238,244,230,0.16); }
      .studio-brand { display:flex;align-items:center;gap:12px; }
      .studio-brand img { width:34px;height:auto; }
      .studio-brand h1 { font-size:1.1rem;font-weight:800;color:var(--chalk); }
      .studio-brand span { display:block;font-size:0.76rem;color:var(--yellow);font-weight:600; }
      .studio-status { display:flex;align-items:center;gap:8px;padding:5px 12px;border-radius:999px;background:rgba(255,255,255,0.08);font-size:0.82rem;font-weight:600; }
      .status-dot { width:8px;height:8px;border-radius:50%;background:var(--green); }
      .status-dot.is-dirty { background:var(--yellow);box-shadow:0 0 8px var(--yellow); }
      .studio-actions { display:flex;flex-wrap:wrap;align-items:center;gap:8px; }
      .btn { display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:36px;padding:0 14px;border:1px solid transparent;border-radius:8px;font-family:inherit;font-size:0.85rem;font-weight:700;text-decoration:none;cursor:pointer; }
      .btn--yellow { color:var(--ink);background:var(--yellow); }
      .btn--ink { color:var(--paper);background:var(--ink); }
      .btn--ghost { color:var(--chalk);background:rgba(255,255,255,0.08);border-color:rgba(238,244,230,0.18); }
      .btn--ghost-ink { color:var(--ink);background:rgba(24,32,28,0.06);border-color:rgba(24,32,28,0.15); }
      .btn--danger { color:#8a1c14;background:#ffd6d0;border-color:#f3a69c; }
      .btn--sm { min-height:28px;padding:0 10px;font-size:0.76rem;border-radius:6px; }
      .studio-layout { display:grid;grid-template-columns:245px minmax(0,1fr);min-height:calc(100vh - 62px); }
      .studio-sidebar { padding:18px 12px;background:rgba(16,53,40,0.7);border-right:1px solid rgba(238,244,230,0.16);display:flex;flex-direction:column;gap:5px; }
      .sidebar-label { padding:6px 10px 4px;font-size:0.7rem;font-weight:750;text-transform:uppercase;letter-spacing:0.06em;color:var(--chalk-soft); }
      .tab-btn { display:flex;align-items:center;justify-content:space-between;width:100%;padding:10px 12px;border:none;border-radius:8px;background:transparent;color:var(--chalk);font-family:inherit;font-size:0.88rem;font-weight:650;text-align:left;cursor:pointer; }
      .tab-btn.is-active { color:var(--ink);background:var(--yellow);font-weight:800; }
      .tab-badge { padding:2px 7px;border-radius:999px;font-size:0.72rem;font-weight:750;background:rgba(0,0,0,0.18); }
      .studio-sidebar-footer { margin-top:auto;padding-top:14px;border-top:1px solid rgba(238,244,230,0.16);display:flex;flex-direction:column;gap:6px; }
      .studio-main { padding:26px clamp(16px,3vw,38px) 80px;max-width:1060px; }
      .tab-pane { display:none; }
      .tab-pane.is-active { display:block; }
      .pane-header { display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:14px;margin-bottom:22px; }
      .pane-header h2 { font-size:1.65rem;font-weight:850;letter-spacing:-0.03em; }
      .pane-header p { color:var(--chalk-soft);font-size:0.9rem;margin-top:4px; }
      .paper-box { color:var(--ink);background:var(--paper);border-radius:10px;box-shadow:var(--shadow-paper);padding:20px 22px;margin-bottom:18px; }
      .paper-box.is-inactive { opacity:0.6;background:#e9e6dc; }
      .paper-box-head { display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;padding-bottom:12px;margin-bottom:14px;border-bottom:1px solid rgba(24,32,28,0.14); }
      .paper-box-title { display:flex;align-items:center;gap:10px;font-size:1.05rem;font-weight:800; }
      .pill { display:inline-flex;align-items:center;padding:2px 9px;border-radius:999px;font-size:0.74rem;font-weight:750; }
      .pill--completed { background:var(--green);color:var(--ink); }
      .pill--ongoing { background:var(--yellow);color:var(--ink); }
      .pill--upcoming { background:var(--lavender);color:var(--ink); }
      .pill--muted { background:rgba(24,32,28,0.1);color:var(--ink-soft); }
      .form-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px; }
      .form-grid--3 { grid-template-columns:repeat(3,minmax(0,1fr)); }
      .field { display:flex;flex-direction:column;gap:4px; }
      .field--full { grid-column:1 / -1; }
      .field label { font-size:0.8rem;font-weight:750;color:var(--ink); }
      .input,.select,.textarea { width:100%;padding:8px 11px;color:var(--ink);background:#fff;border:1.5px solid rgba(24,32,28,0.22);border-radius:7px;font-family:inherit;font-size:0.9rem; }
      .textarea { min-height:78px;resize:vertical; }
      .toggle { display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:0.82rem;font-weight:700;color:var(--ink); }
      .toggle input { position:absolute;opacity:0;width:0;height:0; }
      .toggle-track { position:relative;width:38px;height:20px;background:rgba(24,32,28,0.25);border-radius:999px;transition:0.18s; }
      .toggle-track::after { content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;background:#fff;border-radius:50%;transition:0.18s; }
      .toggle input:checked + .toggle-track { background:#1d7a55; }
      .toggle input:checked + .toggle-track::after { transform:translateX(18px); }
      .stats-grid { display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:20px; }
      .stat-card { padding:14px 16px;background:rgba(255,255,255,0.08);border:1px solid rgba(238,244,230,0.16);border-radius:10px; }
      .stat-card strong { display:block;font-size:1.7rem;font-weight:850;color:var(--yellow); }
      .stat-card span { font-size:0.8rem;color:var(--chalk-soft); }
      .section-toggle-list { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px; }
      .section-toggle-item { display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#f4f1e8;border-radius:8px;border:1px solid rgba(24,32,28,0.12); }
      .upload-zone { display:flex;align-items:center;gap:14px;padding:10px;background:#f4f1e8;border:1.5px dashed rgba(24,32,28,0.25);border-radius:8px; }
      .upload-thumb { width:88px;height:62px;border-radius:6px;object-fit:cover;background:#e4e0d4;border:1px solid rgba(24,32,28,0.15);flex-shrink:0; }
      .upload-thumb--square { width:70px;height:70px; }
      .upload-info { flex:1;display:flex;flex-direction:column;gap:6px; }
      .filter-bar { display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px; }
      .filter-chip { padding:5px 13px;border-radius:999px;border:1px solid rgba(238,244,230,0.18);background:rgba(255,255,255,0.07);color:var(--chalk);font-family:inherit;font-size:0.8rem;font-weight:700;cursor:pointer; }
      .filter-chip.is-active { background:var(--yellow);color:var(--ink);border-color:var(--yellow); }
      .modal-backdrop { position:fixed;inset:0;z-index:200;background:rgba(8,26,19,0.8);backdrop-filter:blur(4px);display:none;align-items:flex-start;justify-content:center;padding:28px 16px;overflow-y:auto; }
      .modal-backdrop.is-open { display:flex; }
      .modal-dialog { width:min(100%,820px);color:var(--ink);background:var(--paper);border-radius:12px;box-shadow:0 24px 60px rgba(0,0,0,0.5);overflow:hidden; }
      .modal-header,.modal-footer { display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:#f4f1e8;border-bottom:1px solid rgba(24,32,28,0.12); }
      .modal-body { padding:20px;max-height:74vh;overflow-y:auto; }
      .toast-container { position:fixed;bottom:20px;right:20px;z-index:300;display:flex;flex-direction:column;gap:8px; }
      .toast { padding:11px 16px;border-radius:9px;color:var(--ink);background:var(--yellow);box-shadow:0 10px 24px rgba(0,0,0,0.4);font-weight:750;font-size:0.88rem; }
      .toast--success { background:var(--green); }
      .toast--error { background:var(--coral); }
      @media (max-width:900px) {
        .studio-layout,.form-grid,.form-grid--3,.stats-grid,.section-toggle-list { grid-template-columns:1fr; }
        .studio-sidebar { flex-direction:row;overflow-x:auto; }
        .sidebar-label,.studio-sidebar-footer { display:none; }
      }
    `;
    document.head.appendChild(style);
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, "&quot;");
  }

  function slugify(str) {
    return String(str ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function toYoutubeEmbedUrl(url) {
    if (!url) return "";
    const trimmed = url.trim();
    if (trimmed.includes("youtube-nocookie.com/embed/") || trimmed.includes("youtube.com/embed/")) return trimmed;
    const match = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
    return match && match[1] ? `https://www.youtube-nocookie.com/embed/${match[1]}` : trimmed;
  }
})();
