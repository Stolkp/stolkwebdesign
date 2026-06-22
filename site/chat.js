// Stolkwebdesign — exit-intent chatbot panel
// Vanilla JS, geen dependencies. Brutalist zij-paneel dat verschijnt zodra de
// bezoeker dreigt te vertrekken (desktop: muis richting browser-top; mobiel:
// 45 seconden inactief). Stream-antwoorden van /api/chat. Leadcapture: zodra
// Claude een <<LEAD:{...}>>-signaal teruggeeft, posten we naar /api/chat-lead.
//
// Aanroep: simpelweg `<script src="/chat.js" defer></script>` vóór </body>.
// Onderdrukken: voeg `data-swd-no-chat` toe aan <html> of <body>, of laad de
// pagina met ?nochat=1 (handig voor admin/preview-routes).

(() => {
  // Niet activeren op admin/preview-pagina's, of als de site dit expliciet vraagt.
  const path = location.pathname.toLowerCase();
  if (/\/(admin|onderteken|reserveren|rooster|seo|bedankt|plan-gesprek|contact)/.test(path)) return;
  if (document.documentElement.hasAttribute('data-swd-no-chat')) return;
  if (document.body && document.body.hasAttribute('data-swd-no-chat')) return;
  if (new URLSearchParams(location.search).get('nochat') === '1') return;

  const SESSION_KEY = 'swd-chat-shown';
  const MIN_TIME_ON_PAGE = 5_000;
  const MOBILE_IDLE_MS = 45_000;
  const MOBILE_BREAKPOINT = 768;

  if (sessionStorage.getItem(SESSION_KEY) === '1') {
    // Bezoeker zag het paneel al deze sessie — alleen handmatige open laten werken.
    installManualOpener();
    return;
  }

  const startedAt = Date.now();
  let armed = false;
  let opened = false;

  // ── Trigger ──
  function arm() {
    if (armed) return;
    armed = true;

    const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
    if (isMobile) {
      // Inactiviteitstimer voor mobiel — daar bestaat geen mouseleave.
      let idleTimer = setTimeout(open, MOBILE_IDLE_MS);
      const reset = () => { clearTimeout(idleTimer); idleTimer = setTimeout(open, MOBILE_IDLE_MS); };
      ['touchstart', 'scroll', 'click'].forEach((ev) => window.addEventListener(ev, reset, { passive: true }));
    } else {
      document.addEventListener('mouseleave', onMouseLeave);
    }
  }

  function onMouseLeave(e) {
    // e.clientY <= 0 betekent dat de muis de browser-bovenkant heeft verlaten.
    if (e.clientY <= 0) open();
  }

  if (Date.now() - startedAt >= MIN_TIME_ON_PAGE) arm();
  else setTimeout(arm, MIN_TIME_ON_PAGE - (Date.now() - startedAt));

  // ── State ──
  const messages = [{ role: 'assistant', content: 'Wacht even — kan ik je ergens mee helpen? Stel gerust een vraag over onze websites, prijzen of werkwijze.' }];
  let lead = { name: '', email: '', captured: false };
  let sending = false;

  // ── DOM injectie ──
  function injectStyles() {
    const css = `
      #swd-chat-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,.32);
        opacity: 0; pointer-events: none; transition: opacity .25s ease;
        z-index: 9998;
      }
      #swd-chat-overlay.swd-open { opacity: 1; pointer-events: auto; }
      #swd-chat-panel {
        position: fixed; top: 0; right: 0; bottom: 0;
        width: 46%; max-width: 560px; min-width: 380px;
        background: #fff; border-left: 3px solid #000;
        box-shadow: -8px 0 0 0 #EA2525;
        transform: translateX(100%); transition: transform .35s cubic-bezier(.5,.05,.2,1);
        z-index: 9999; display: flex; flex-direction: column;
        font-family: 'Space Grotesk', system-ui, sans-serif;
      }
      #swd-chat-panel.swd-open { transform: translateX(0); }
      #swd-chat-header {
        background: #0A0A0A; color: #fff; padding: 14px 18px;
        display: flex; justify-content: space-between; align-items: center;
        border-bottom: 2px solid #EA2525;
      }
      #swd-chat-title {
        font-family: 'Archivo Black', sans-serif;
        font-size: 13px; letter-spacing: .12em; text-transform: uppercase;
      }
      #swd-chat-title small {
        display: block; font-family: 'JetBrains Mono', monospace;
        font-size: 10px; color: #767676; letter-spacing: .08em;
        margin-top: 3px; font-weight: 400;
      }
      #swd-chat-close {
        background: transparent; color: #EA2525;
        border: 1.5px solid #EA2525; padding: 6px 10px;
        font-family: 'JetBrains Mono', monospace; font-size: 10px;
        letter-spacing: .1em; cursor: pointer; text-transform: uppercase;
      }
      #swd-chat-close:hover { background: #EA2525; color: #fff; }
      #swd-chat-messages {
        flex: 1; padding: 18px; overflow-y: auto; background: #F5F5F5;
        display: flex; flex-direction: column; gap: 12px;
      }
      .swd-msg {
        padding: 10px 14px; max-width: 90%;
        font-size: 14px; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word;
      }
      .swd-msg-bot { background: #000; color: #fff; align-self: flex-start; }
      .swd-msg-user { background: #EA2525; color: #fff; align-self: flex-end; }
      .swd-msg-typing::after {
        content: '▍'; display: inline-block; margin-left: 2px;
        animation: swd-blink 1s steps(2) infinite;
      }
      @keyframes swd-blink { 50% { opacity: 0; } }
      .swd-lead-confirmed {
        background: #fff; color: #000;
        border: 2px solid #000; align-self: stretch; max-width: 100%;
        font-family: 'JetBrains Mono', monospace; font-size: 12px;
        text-transform: uppercase; letter-spacing: .08em;
      }
      #swd-chat-input-row {
        padding: 12px; background: #fff; border-top: 2px solid #000;
        display: flex; gap: 8px;
      }
      #swd-chat-input {
        flex: 1; border: 2px solid #000; background: #F5F5F5;
        padding: 10px 12px; font-family: 'Space Grotesk', sans-serif;
        font-size: 14px; outline: none;
      }
      #swd-chat-input:focus { background: #fff; border-color: #EA2525; }
      #swd-chat-send {
        background: #EA2525; color: #fff; border: 2px solid #000;
        padding: 0 18px; font-family: 'Archivo Black', sans-serif;
        font-size: 14px; cursor: pointer; letter-spacing: .05em;
      }
      #swd-chat-send:hover { background: #000; }
      #swd-chat-send:disabled { background: #767676; cursor: not-allowed; }
      .swd-honeypot {
        position: absolute !important; left: -9999px !important;
        width: 1px; height: 1px; opacity: 0;
      }

      @media (max-width: ${MOBILE_BREAKPOINT}px) {
        #swd-chat-panel {
          width: 100%; max-width: none; min-width: 0;
          border-left: none; box-shadow: none;
        }
      }
    `;
    const style = document.createElement('style');
    style.id = 'swd-chat-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function injectPanel() {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div id="swd-chat-overlay"></div>
      <aside id="swd-chat-panel" role="dialog" aria-label="Stolkwebdesign chat">
        <div id="swd-chat-header">
          <div id="swd-chat-title">Stel je vraag<small>Direct antwoord van onze AI</small></div>
          <button id="swd-chat-close" type="button" aria-label="Sluiten">✕ Sluiten</button>
        </div>
        <div id="swd-chat-messages" aria-live="polite"></div>
        <div id="swd-chat-input-row">
          <input class="swd-honeypot" type="text" id="swd-chat-company" tabindex="-1" autocomplete="off" />
          <input id="swd-chat-input" type="text" placeholder="Typ je vraag…" autocomplete="off" maxlength="500" />
          <button id="swd-chat-send" type="button">→</button>
        </div>
      </aside>
    `;
    document.body.appendChild(wrap);
  }

  function renderMessages() {
    const box = document.getElementById('swd-chat-messages');
    if (!box) return;
    box.innerHTML = '';
    for (const m of messages) {
      const div = document.createElement('div');
      div.className = 'swd-msg ' + (m.role === 'user' ? 'swd-msg-user' : 'swd-msg-bot');
      // Strip eventueel achtergebleven LEAD-signaal uit weergave.
      div.textContent = (m.content || '').replace(/<<LEAD:[^>]*>>/g, '').trim();
      if (m.typing) div.classList.add('swd-msg-typing');
      box.appendChild(div);
    }
    if (lead.captured) {
      const conf = document.createElement('div');
      conf.className = 'swd-msg swd-lead-confirmed';
      conf.textContent = '✓ Bedankt — Peter neemt binnen 1 werkdag contact op.';
      box.appendChild(conf);
    }
    box.scrollTop = box.scrollHeight;
  }

  function open() {
    if (opened) return;
    opened = true;
    sessionStorage.setItem(SESSION_KEY, '1');
    document.removeEventListener('mouseleave', onMouseLeave);

    injectStyles();
    injectPanel();
    renderMessages();

    requestAnimationFrame(() => {
      document.getElementById('swd-chat-overlay').classList.add('swd-open');
      document.getElementById('swd-chat-panel').classList.add('swd-open');
      setTimeout(() => document.getElementById('swd-chat-input')?.focus(), 300);
    });

    document.getElementById('swd-chat-close').addEventListener('click', close);
    document.getElementById('swd-chat-overlay').addEventListener('click', close);
    document.getElementById('swd-chat-send').addEventListener('click', onSend);
    document.getElementById('swd-chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); onSend(); }
    });
  }

  function close() {
    document.getElementById('swd-chat-overlay')?.classList.remove('swd-open');
    document.getElementById('swd-chat-panel')?.classList.remove('swd-open');
  }

  async function onSend() {
    if (sending) return;
    const input = document.getElementById('swd-chat-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    messages.push({ role: 'user', content: text });
    const botMsg = { role: 'assistant', content: '', typing: true };
    messages.push(botMsg);
    renderMessages();

    sending = true;
    const sendBtn = document.getElementById('swd-chat-send');
    sendBtn.disabled = true;

    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: messages
            .filter((m) => !m.typing)
            .map(({ role, content }) => ({ role, content })),
        }),
      });
      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'AI-server gaf een fout.');
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        botMsg.content += decoder.decode(value, { stream: true });
        renderMessages();
      }
      botMsg.typing = false;

      // Lead-signaal detecteren + opslaan.
      const leadMatch = botMsg.content.match(/<<LEAD:(\{[^}]*\})>>/);
      if (leadMatch && !lead.captured) {
        try {
          const data = JSON.parse(leadMatch[1]);
          if (data.name && data.email) await captureLead(data.name, data.email);
        } catch { /* signaal kapot, negeer */ }
      }
      // Strip signaal uit zichtbare tekst.
      botMsg.content = botMsg.content.replace(/<<LEAD:[^>]*>>/g, '').trim();
      renderMessages();
    } catch (e) {
      botMsg.content = 'Er ging iets mis: ' + (e.message || 'onbekende fout') + '. Probeer het zo nog eens of mail Peter direct.';
      botMsg.typing = false;
      renderMessages();
    } finally {
      sending = false;
      sendBtn.disabled = false;
      document.getElementById('swd-chat-input')?.focus();
    }
  }

  async function captureLead(name, email) {
    const company = document.getElementById('swd-chat-company')?.value || '';
    try {
      const resp = await fetch('/api/chat-lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name, email, company,
          page_url: location.href,
          conversation: messages
            .filter((m) => !m.typing)
            .map(({ role, content }) => ({ role, content: (content || '').replace(/<<LEAD:[^>]*>>/g, '').trim() })),
        }),
      });
      if (resp.ok) { lead = { name, email, captured: true }; renderMessages(); }
    } catch { /* stil falen — bezoekerservaring breekt niet */ }
  }

  // Voor het geval het paneel deze sessie al was vertoond, laat dan in elk geval
  // een (verborgen) opener-hook in window staan — zo kan een toekomstige CTA
  // ergens op de pagina handmatig openen zonder duplicate scripts.
  function installManualOpener() {
    window.SWDChat = { open: () => { sessionStorage.removeItem(SESSION_KEY); location.reload(); } };
  }
  window.SWDChat = { open };
})();
