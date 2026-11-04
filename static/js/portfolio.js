(() => {
  'use strict';
  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Color theme: the first visit follows the OS; later visits use the saved choice.
  const themeButton = document.querySelector('.theme-toggle');
  function updateThemeButton() {
    const light = root.dataset.theme === 'light';
    if (themeButton) {
      themeButton.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
      themeButton.setAttribute('aria-pressed', String(light));
      const label = themeButton.querySelector('.theme-label');
      if (label) label.textContent = light ? 'DARK' : 'LIGHT';
    }
  }
  updateThemeButton();
  themeButton?.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('ck-theme', root.dataset.theme); } catch (_) { /* Storage may be disabled. */ }
    updateThemeButton();
  });

  // Compact mobile navigation with keyboard and focus support.
  const siteHeader = document.querySelector('.site-header');
  const menuButton = document.querySelector('.menu-toggle');
  function setMenu(open) {
    siteHeader?.classList.toggle('menu-open', open);
    menuButton?.setAttribute('aria-expanded', String(open));
    menuButton?.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  }
  menuButton?.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
  document.querySelectorAll('.site-nav a').forEach(link => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { setMenu(false); closeAssistant(); } });

  // Keyboard-operable category filter; technology claims remain qualitative.
  const tabs = [...document.querySelectorAll('.skill-tab')];
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateSkillTab(tab));
    tab.addEventListener('keydown', event => {
      if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
      activateSkillTab(tabs[next]); tabs[next].focus();
    });
  });
  function activateSkillTab(tab) {
    tabs.forEach(item => { const active = item === tab; item.classList.toggle('is-active', active); item.setAttribute('aria-selected', String(active)); item.tabIndex = active ? 0 : -1; });
    document.querySelector('#skill-panel')?.setAttribute('aria-labelledby', tab.id);
    const category = tab.dataset.category;
    document.querySelectorAll('.skill-group').forEach(group => group.classList.toggle('is-filtered', category !== 'all' && group.dataset.skill !== category));
  }
  if (tabs.length) tabs.forEach((tab, index) => { tab.tabIndex = index === 0 ? 0 : -1; });

  // Custom cursor is only enabled where a precise mouse pointer is available.
  const cursor = document.querySelector('.custom-cursor');
  if (cursor && matchMedia('(hover: hover) and (pointer: fine)').matches && !reduceMotion) {
    document.body.classList.add('has-custom-cursor');
    let x = -30, y = -30, tx = x, ty = y, raf = 0, visible = !document.hidden;
    const draw = () => { if (!visible) return; x += (tx - x) * .2; y += (ty - y) * .2; cursor.style.transform = `translate(${x}px, ${y}px)`; raf = requestAnimationFrame(draw); };
    draw();
    document.addEventListener('pointermove', event => { tx = event.clientX; ty = event.clientY; }, { passive: true });
    document.addEventListener('visibilitychange', () => { visible = !document.hidden; if (visible) draw(); else cancelAnimationFrame(raf); });
    document.querySelectorAll('a,button,input,textarea').forEach(element => {
      element.addEventListener('pointerenter', () => cursor.classList.add('is-hover'));
      element.addEventListener('pointerleave', () => cursor.classList.remove('is-hover'));
    });
    window.addEventListener('pagehide', () => cancelAnimationFrame(raf), { once: true });
  }

  // Reveal sections on scroll; the page remains usable without GSAP or ScrollTrigger.
  if (!reduceMotion && window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    gsap.utils.toArray('.section-kicker, .skills-heading, .projects-heading, .journey-layout, .github-heading, .contact-layout').forEach(element => {
      gsap.fromTo(element, { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: .8, ease: 'power2.out', scrollTrigger: { trigger: element, start: 'top 87%', once: true } });
    });
    gsap.utils.toArray('[data-reveal]').forEach(element => {
      gsap.fromTo(element, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: .8, ease: 'power2.out', scrollTrigger: { trigger: element, start: 'top 88%', once: true } });
    });
    gsap.utils.toArray('.skill-group').forEach((element, index) => {
      gsap.fromTo(element, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: .55, delay: (index % 4) * .06, ease: 'power2.out', scrollTrigger: { trigger: element, start: 'top 93%', once: true } });
    });
  }

  // CSRF-protected contact form uses the existing Django endpoint.
  const contactForm = document.querySelector('#contact-form');
  const contactStatus = document.querySelector('#contact-status');
  contactForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!contactForm.reportValidity()) return;
    const submit = contactForm.querySelector('[type="submit"]');
    const csrf = contactForm.querySelector('[name="csrfmiddlewaretoken"]')?.value;
    const payload = Object.fromEntries(new FormData(contactForm).entries());
    if (submit) { submit.disabled = true; submit.setAttribute('aria-busy', 'true'); }
    if (contactStatus) contactStatus.textContent = 'Sending your message…';
    try {
      const response = await fetch(contactForm.action, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf || '' }, body: JSON.stringify(payload), credentials: 'same-origin' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Your message could not be sent. Please try again.');
      contactForm.reset();
      if (contactStatus) contactStatus.textContent = result.message;
    } catch (error) {
      if (contactStatus) contactStatus.textContent = error.message || 'A connection error occurred. Please try again.';
    } finally {
      if (submit) { submit.disabled = false; submit.removeAttribute('aria-busy'); }
    }
  });

  // Portfolio assistant history is kept in this page session; only the new
  // question is sent to the Django endpoint, which grounds replies in portfolio facts.
  const assistant = document.querySelector('#assistant');
  const assistantLauncher = document.querySelector('.assistant-launcher');
  const assistantPanel = document.querySelector('#assistant-panel');
  const assistantClose = document.querySelector('.assistant-close');
  const assistantForm = document.querySelector('#assistant-form');
  const assistantInput = document.querySelector('#assistant-input');
  const assistantMessages = document.querySelector('#assistant-messages');
  function openAssistant() {
    assistant?.classList.add('is-open'); assistantLauncher?.setAttribute('aria-expanded', 'true');
    assistantPanel?.setAttribute('aria-hidden', 'false'); assistantInput?.focus();
  }
  function closeAssistant() {
    if (!assistant?.classList.contains('is-open')) return;
    assistant.classList.remove('is-open'); assistantLauncher?.setAttribute('aria-expanded', 'false');
    assistantPanel?.setAttribute('aria-hidden', 'true'); assistantLauncher?.focus();
  }
  assistantLauncher?.addEventListener('click', () => assistant.classList.contains('is-open') ? closeAssistant() : openAssistant());
  assistantClose?.addEventListener('click', closeAssistant);
  document.querySelectorAll('.suggested-questions button').forEach(button => button.addEventListener('click', () => { if (assistantInput) { assistantInput.value = button.textContent.trim(); assistantForm?.requestSubmit(); } }));
  function addChatMessage(text, role) {
    const node = document.createElement('p'); node.className = `chat-message ${role}`; node.textContent = text; assistantMessages?.append(node); node.scrollIntoView({ block: 'nearest' }); return node;
  }
  assistantForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const message = assistantInput?.value.trim();
    if (!message) return;
    addChatMessage(message, 'user'); assistantInput.value = '';
    const suggestions = assistantMessages?.querySelector('.suggested-questions'); suggestions?.remove();
    const typing = document.createElement('p'); typing.className = 'assistant-typing'; typing.textContent = 'Thinking…'; assistantMessages?.append(typing); typing.scrollIntoView({ block: 'nearest' });
    const csrf = document.querySelector('[name="csrfmiddlewaretoken"]')?.value;
    try {
      const response = await fetch('/api/assistant/', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf || '' }, credentials: 'same-origin', body: JSON.stringify({ message }) });
      const result = await response.json(); typing.remove();
      if (!response.ok || !result.success) throw new Error(result.error || 'The assistant is unavailable.');
      addChatMessage(result.answer, 'bot');
    } catch (error) { typing.remove(); addChatMessage(error.message || 'The assistant is unavailable. Please use the contact form.', 'bot'); }
  });
})();
