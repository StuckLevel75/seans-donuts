const SD_PUBLIC_API_URL = 'https://script.google.com/macros/s/AKfycbw8QmZ4jl1ym9RwOlqP5_9XVgQNxAZiyMkA9YVYT9ag4dM-BPHaurTIw0aULBJDL5Xvwg/exec';

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
      const response = await fetch(SD_PUBLIC_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, payload: formPayload(form) })
      });

      const result = await response.json();
      if (!result.ok) throw new Error(result.message || 'Something went wrong.');

      form.reset();
      showFormStatus(form, successMessage || 'Submitted.', 'success');
    } catch (error) {
      showFormStatus(form, error.message || 'Could not submit right now.', 'error');
    } finally {
      if (submit) submit.disabled = false;
    }
  });
}

wireSheetForm('#applicationForm', 'submitApplication', 'Application submitted. We will review it soon.');
wireSheetForm('#contactForm', 'submitContact', 'Message sent. Thank you for reaching out.');
wireSheetForm('#advertiseForm', 'submitAdvertise', 'Advertising request sent. We will review it soon.');
