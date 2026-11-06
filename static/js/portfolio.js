(() => {
  'use strict';
  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Helper to retrieve CSRF token from input or cookie
  function getCsrfToken() {
    const inputToken = document.querySelector('[name="csrfmiddlewaretoken"]')?.value;
    if (inputToken) return inputToken;
    const cookieMatch = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    return cookieMatch ? decodeURIComponent(cookieMatch[1]) : '';
  }

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

  // ==========================================
  // CONTACT FORM LOGIC & VALIDATION
  // ==========================================
  const contactForm = document.querySelector('#contact-form');
  const contactStatus = document.querySelector('#contact-status');

  contactForm?.addEventListener('submit', async event => {
    event.preventDefault();

    const nameInput = contactForm.querySelector('#contact-name');
    const emailInput = contactForm.querySelector('#contact-email');
    const subjectInput = contactForm.querySelector('#contact-subject');
    const messageInput = contactForm.querySelector('#contact-message');
    const submitBtn = contactForm.querySelector('.submit-button');

    const name = nameInput?.value.trim() || '';
    const email = emailInput?.value.trim() || '';
    const subject = subjectInput?.value.trim() || '';
    const message = messageInput?.value.trim() || '';

    // Frontend validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!name) {
      setContactStatus('Please enter your name.', 'is-error');
      nameInput?.focus();
      return;
    }
    if (!email) {
      setContactStatus('Please enter your email address.', 'is-error');
      emailInput?.focus();
      return;
    }
    if (!emailRegex.test(email)) {
      setContactStatus('Please enter a valid email address (e.g. name@example.com).', 'is-error');
      emailInput?.focus();
      return;
    }
    if (!subject) {
      setContactStatus('Please enter a subject for your message.', 'is-error');
      subjectInput?.focus();
      return;
    }
    if (!message) {
      setContactStatus('Please enter a message.', 'is-error');
      messageInput?.focus();
      return;
    }

    const csrf = getCsrfToken();
    const payload = {
      name,
      email,
      subject,
      message,
      website: contactForm.querySelector('#website')?.value || '',
    };

    // UI Loading state
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.setAttribute('aria-busy', 'true');
      submitBtn.innerHTML = 'Sending… <span aria-hidden="true">⏳</span>';
    }
    setContactStatus('Sending your message…', 'is-loading');

    try {
      const response = await fetch(contactForm.action || '/api/contact/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrf,
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
        credentials: 'same-origin',
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Your message could not be delivered. Please try again.');
      }

      contactForm.reset();
      setContactStatus(result.message || 'Thank you! Your message has been sent successfully.', 'is-success');
    } catch (error) {
      setContactStatus(error.message || 'A network error occurred. Please try again.', 'is-error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.removeAttribute('aria-busy');
        submitBtn.innerHTML = 'Send message <span>↗</span>';
      }
    }
  });

  function setContactStatus(text, statusClass) {
    if (!contactStatus) return;
    contactStatus.className = `contact-status ${statusClass || ''}`.trim();
    contactStatus.textContent = text;
  }

  // ==========================================
  // GEMINI PORTFOLIO ASSISTANT CHATBOT
  // ==========================================
  const assistant = document.querySelector('#assistant');
  const assistantLauncher = document.querySelector('.assistant-launcher');
  const assistantPanel = document.querySelector('#assistant-panel');
  const assistantClose = document.querySelector('.assistant-close');
  const assistantForm = document.querySelector('#assistant-form');
  const assistantInput = document.querySelector('#assistant-input');
  const assistantMessages = document.querySelector('#assistant-messages');
  const assistantSubmit = assistantForm?.querySelector('button[type="submit"]');

  // Local conversation history for multi-turn context
  let conversationHistory = [];

  function openAssistant() {
    assistant?.classList.add('is-open');
    assistantLauncher?.setAttribute('aria-expanded', 'true');
    assistantPanel?.setAttribute('aria-hidden', 'false');
    assistantInput?.focus();
  }

  function closeAssistant() {
    if (!assistant?.classList.contains('is-open')) return;
    assistant.classList.remove('is-open');
    assistantLauncher?.setAttribute('aria-expanded', 'false');
    assistantPanel?.setAttribute('aria-hidden', 'true');
    assistantLauncher?.focus();
  }

  assistantLauncher?.addEventListener('click', () => {
    assistant.classList.contains('is-open') ? closeAssistant() : openAssistant();
  });
  assistantClose?.addEventListener('click', closeAssistant);

  // Suggested questions quick action
  document.querySelectorAll('.suggested-questions button').forEach(button => {
    button.addEventListener('click', () => {
      if (assistantInput) {
        assistantInput.value = button.textContent.trim();
        assistantForm?.requestSubmit();
      }
    });
  });

  function addChatMessage(text, role, isError = false) {
    const node = document.createElement('p');
    node.className = `chat-message ${role}${isError ? ' is-error' : ''}`;
    node.textContent = text;
    assistantMessages?.append(node);
    node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return node;
  }

  function createTypingIndicator() {
    const typing = document.createElement('p');
    typing.className = 'assistant-typing';
    typing.innerHTML = 'Thinking<span class="assistant-typing-dots"><span></span><span></span><span></span></span>';
    assistantMessages?.append(typing);
    typing.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return typing;
  }

  assistantForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const message = assistantInput?.value.trim();
    if (!message) return;

    // Remove suggested questions once the user starts chatting
    const suggestions = assistantMessages?.querySelector('.suggested-questions');
    suggestions?.remove();

    // Render user message and clear input
    addChatMessage(message, 'user');
    assistantInput.value = '';

    // Disable inputs while generating response
    if (assistantInput) assistantInput.disabled = true;
    if (assistantSubmit) assistantSubmit.disabled = true;

    // Show loading typing animation
    const typingNode = createTypingIndicator();

    const csrf = getCsrfToken();

    try {
      const response = await fetch('/api/assistant/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrf,
          'Accept': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          message,
          history: conversationHistory,
        }),
      });

      const result = await response.json().catch(() => ({}));
      typingNode.remove();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'The assistant is temporarily unavailable. Please try again.');
      }

      addChatMessage(result.answer, 'bot');

      // Update multi-turn history
      conversationHistory.push({ role: 'user', text: message });
      conversationHistory.push({ role: 'model', text: result.answer });
      if (conversationHistory.length > 10) {
        conversationHistory = conversationHistory.slice(-10);
      }
    } catch (error) {
      typingNode.remove();
      addChatMessage(error.message || 'The assistant is temporarily unavailable. Please use the contact form.', 'bot', true);
    } finally {
      if (assistantInput) {
        assistantInput.disabled = false;
        assistantInput.focus();
      }
      if (assistantSubmit) {
        assistantSubmit.disabled = false;
      }
    }
  });
})();
