/* ==========================================================================
   Waitlist form → MailerLite (single opt-in)
   - Intercepts submit and posts via fetch (no-cors) so the user stays on page.
   - Honeypot + basic email sanity check.
   - On "acceptance" (opaque response → MailerLite will have recorded the subscriber)
     swaps the form view for the success view, animated.
   - Reduced-motion: instant swap.
   ========================================================================== */

(function () {
  'use strict';

  const form = document.getElementById('wl-form');
  if (!form) return;

  const formView    = document.querySelector('[data-signup-form-view]');
  const successView = document.querySelector('[data-signup-success-view]');
  const emailOut    = document.querySelector('[data-signup-email]');
  const status      = form.querySelector('.wl-form__status');
  const submitBtn   = form.querySelector('.wl-submit');
  const honey       = form.querySelector('input[name="wl_address_2"]');

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setStatus(kind, msg) {
    if (!status) return;
    if (!msg) {
      status.hidden = true;
      status.textContent = '';
      status.className = 'wl-form__status';
      return;
    }
    status.hidden = false;
    status.textContent = msg;
    status.className = 'wl-form__status wl-form__status--' + kind;
  }

  function setBusy(busy) {
    submitBtn.disabled = busy;
    submitBtn.classList.toggle('is-busy', busy);
    submitBtn.setAttribute('aria-busy', busy ? 'true' : 'false');
  }

  function showSuccess(email) {
    if (emailOut && email) emailOut.textContent = email;

    if (reducedMotion) {
      formView.hidden = true;
      successView.hidden = false;
    } else {
      formView.classList.add('is-leaving');
      setTimeout(() => {
        formView.hidden = true;
        successView.hidden = false;
        // Reflow before adding the enter class so the animation restarts cleanly.
        void successView.offsetWidth;
        successView.classList.add('is-entering');
      }, 280);
    }

    // Gently scroll into view (useful on mobile).
    try { successView.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (_) {}
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Bot caught in honeypot — silently pretend success, do not submit.
    if (honey && honey.value) {
      showSuccess('you');
      return;
    }

    const emailField = form.elements['fields[email]'];
    const email = (emailField.value || '').trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus('error', 'Please enter a valid email address.');
      emailField.focus();
      return;
    }

    setStatus();
    setBusy(true);

    try {
      // MailerLite's endpoint doesn't return CORS headers, so we submit
      // opaquely via no-cors. fetch always resolves; treat resolution as "accepted".
      // With single opt-in, acceptance means the subscriber is now on the list.
      await fetch(form.action, {
        method: 'POST',
        mode: 'no-cors',
        body: new FormData(form),
      });

      // Fire-and-forget telemetry ping that MailerLite's own snippet makes.
      try {
        fetch('https://assets.mailerlite.com/jsonp/2287503/forms/185513123710502322/takel', { mode: 'no-cors' });
      } catch (_) { /* ignore */ }

      showSuccess(email);
    } catch (err) {
      setBusy(false);
      setStatus('error', 'Something went wrong on our end. Please try again, or email camel-ecg@seas.upenn.edu.');
    }
  });
})();
