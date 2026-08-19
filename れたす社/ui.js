/**
 * UI — 共通UIコンポーネント
 */

// ---- モーダル ----
const Modal = (() => {
  function show(title, bodyHtml, buttons = []) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;

    const footer = document.getElementById('modal-footer');
    footer.innerHTML = '';
    buttons.forEach(btn => {
      const el = document.createElement('button');
      el.className = `btn ${btn.cls || 'btn-secondary'}`;
      el.textContent = btn.text;
      el.addEventListener('click', btn.cb);
      footer.appendChild(el);
    });

    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function hide() {
    document.getElementById('modal-overlay').classList.add('hidden');
  }

  return { show, hide };
})();

// ---- トースト通知 ----
const UI = (() => {
  let toastContainer = null;

  function ensureContainer() {
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.style.cssText = `
        position:fixed;bottom:24px;right:24px;z-index:999;
        display:flex;flex-direction:column;gap:8px;
        pointer-events:none;
      `;
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
  }

  function toast(message, type = 'info') {
    const colors = {
      success: { bg: 'var(--success)', icon: '✓' },
      warning: { bg: 'var(--warning)', icon: '⚠' },
      danger:  { bg: 'var(--danger)',  icon: '✕' },
      info:    { bg: 'var(--accent)',  icon: 'ℹ' },
    };
    const c = colors[type] || colors.info;
    const cont = ensureContainer();

    const el = document.createElement('div');
    el.style.cssText = `
      background:var(--bg-card);border:1px solid var(--border2);
      border-left:3px solid ${c.bg};
      padding:12px 16px;border-radius:6px;
      display:flex;align-items:center;gap:8px;
      font-size:13px;color:var(--text);
      box-shadow:0 4px 16px rgba(0,0,0,.4);
      pointer-events:auto;
      transform:translateX(120%);transition:transform .25s ease;
      max-width:320px;
    `;
    el.innerHTML = `<span style="color:${c.bg};font-weight:700">${c.icon}</span><span>${message}</span>`;
    cont.appendChild(el);

    requestAnimationFrame(() => {
      el.style.transform = 'translateX(0)';
    });

    setTimeout(() => {
      el.style.transform = 'translateX(120%)';
      setTimeout(() => el.remove(), 300);
    }, 3500);
  }

  return { toast };
})();