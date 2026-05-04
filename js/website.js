const SD_PUBLIC_API_URL = 'https://script.google.com/macros/s/AKfycbw8QmZ4jl1ym9RwOlqP5_9XVgQNxAZiyMkA9YVYT9ag4dM-BPHaurTIw0aULBJDL5Xvwg/exec';

async function publicApi(action, payload = {}) {
  const response = await fetch(SD_PUBLIC_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, payload })
  });

  const result = await response.json();
  if (!result.ok) throw new Error(result.message || 'Request failed.');
  return result;
}

function showFormStatus(form, message, type) {
  const status = form.querySelector('.form-status');
  if (!status) return;

  status.textContent = message;
  status.className = `form-status ${type || ''}`.trim();
}

function formPayload(form) {
  const data = new FormData(form);
  const payload = {};

  data.forEach((value, key) => {
    payload[key] = String(value || '').trim();
  });

  return payload;
}

function wireSheetForm(selector, action, successMessage) {
  const form = document.querySelector(selector);
  if (!form) return;

  form.addEventListener('submit', async event => {
    event.preventDefault();

    const submit = form.querySelector('[type="submit"]');
    if (submit) submit.disabled = true;
    showFormStatus(form, 'Sending...', 'info');

    try {
      await publicApi(action, formPayload(form));

      form.reset();
      showFormStatus(form, successMessage || 'Submitted.', 'success');
    } catch (error) {
      showFormStatus(form, error.message || 'Could not submit right now.', 'error');
    } finally {
      if (submit) submit.disabled = false;
    }
  });
}

function getActiveWebsiteSale(settings = {}) {
  const enabled = String(settings.saleEnabled || 'No').trim().toLowerCase() === 'yes';
  const percent = Math.max(0, Math.min(100, Number(settings.salePercent || 0)));
  const startText = String(settings.saleStart || '').trim();
  const endText = String(settings.saleEnd || '').trim();
  const start = startText ? new Date(startText).getTime() : NaN;
  const end = endText ? new Date(endText).getTime() : NaN;

  if (!enabled || percent <= 0) return { active: false, percent: 0, start, end };

  const now = Date.now();
  if (!Number.isNaN(start) && now < start) return { active: false, percent, start, end };
  if (!Number.isNaN(end) && now > end) return { active: false, percent, start, end };

  return { active: true, percent, start, end };
}

function websiteCountdown(targetTime) {
  if (!targetTime || Number.isNaN(targetTime)) return 'Active now';

  const remaining = Math.max(0, targetTime - Date.now());
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function showWebsiteSalePopup(sale) {
  const signature = `${sale.percent}-${sale.end || 'open'}`;
  if (sessionStorage.getItem('sd_sale_dismissed') === signature) return;
  if (document.querySelector('.site-sale-popup')) return;

  const popup = document.createElement('aside');
  popup.className = 'site-sale-popup';
  popup.innerHTML = `
    <button class="site-sale-close" type="button" aria-label="Close sale popup">x</button>
    <span class="site-sale-kicker">Sale Live</span>
    <strong>${sale.percent}% off Sean's Donuts</strong>
    <p>Discounts are active for a limited time.</p>
    <div class="site-sale-countdown">${sale.end && !Number.isNaN(sale.end) ? `Ends in ${websiteCountdown(sale.end)}` : 'Active now'}</div>
    <a href="menu.html">View Menu</a>
  `;

  document.body.appendChild(popup);

  const countdown = popup.querySelector('.site-sale-countdown');
  const close = popup.querySelector('.site-sale-close');

  close?.addEventListener('click', () => {
    sessionStorage.setItem('sd_sale_dismissed', signature);
    popup.remove();
  });

  if (sale.end && !Number.isNaN(sale.end)) {
    const timer = window.setInterval(() => {
      if (!document.body.contains(popup)) {
        window.clearInterval(timer);
        return;
      }

      countdown.textContent = `Ends in ${websiteCountdown(sale.end)}`;
      if (Date.now() > sale.end) {
        window.clearInterval(timer);
        popup.remove();
      }
    }, 1000);
  }
}

async function initWebsiteSalePopup() {
  try {
    const boot = await publicApi('getPortalBootstrap', {});
    const sale = getActiveWebsiteSale(boot.settings || {});
    if (sale.active) showWebsiteSalePopup(sale);
  } catch (error) {
    // The website should keep working even if the sale check fails.
  }
}

wireSheetForm('#applicationForm', 'submitApplication', 'Application submitted. We will review it soon.');
wireSheetForm('#contactForm', 'submitContact', 'Message sent. Thank you for reaching out.');
wireSheetForm('#advertiseForm', 'submitAdvertise', 'Advertising request sent. We will review it soon.');
initWebsiteSalePopup();
