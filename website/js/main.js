// Mobile nav toggle
const navToggle = document.getElementById('nav-toggle');
const navLinks = document.getElementById('nav-links');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', isOpen);
  });

  // Close menu when a link is clicked
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!navToggle.contains(e.target) && !navLinks.contains(e.target)) {
      navLinks.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

// Smooth scroll polyfill for anchor links (fallback for older browsers)
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const id = anchor.getAttribute('href');
    const target = document.querySelector(id);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// Docs-specific: sidebar drawer + TOC scroll spy
if (document.querySelector('.docs-layout')) {
  const sidebarToggle = document.getElementById('docs-sidebar-toggle');
  const sidebar = document.querySelector('.docs-sidebar');
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }

  const tocLinks = document.querySelectorAll('.docs-toc a');
  if (tocLinks.length) {
    const headings = document.querySelectorAll('.prose h2[id], .prose h3[id]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            tocLinks.forEach(a => a.classList.remove('active'));
            const active = document.querySelector(`.docs-toc a[href="#${entry.target.id}"]`);
            if (active) active.classList.add('active');
          }
        });
      },
      { rootMargin: '-60px 0px -70% 0px' }
    );
    headings.forEach(h => observer.observe(h));
  }
}

// Donate-specific: copy-to-clipboard buttons for the crypto addresses
document.querySelectorAll('.copy-btn').forEach(btn => {
  const idleLabel = btn.textContent;

  btn.addEventListener('click', async () => {
    let copied = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(btn.dataset.address);
        copied = true;
      }
    } catch {
      copied = false;
    }

    // No clipboard API (or it refused): select the address so it can be copied by hand
    if (!copied) {
      const code = btn.parentElement.querySelector('code');
      if (code) {
        const range = document.createRange();
        range.selectNodeContents(code);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }

    btn.textContent = copied ? 'Copied' : 'Selected';
    setTimeout(() => {
      btn.textContent = idleLabel;
    }, 2000);
  });
});

// Docs-specific: "Copy page" split button + dropdown on section pages (not the hub)
document.querySelectorAll('.docs-copy-wrap').forEach(wrap => {
  const chevron = wrap.querySelector('.docs-copy-chevron');
  const menu = wrap.querySelector('.docs-copy-menu');

  const closeMenu = () => {
    if (!menu || !chevron) return;
    menu.classList.remove('open');
    chevron.setAttribute('aria-expanded', 'false');
  };

  if (chevron && menu) {
    chevron.addEventListener('click', () => {
      const isOpen = menu.classList.toggle('open');
      chevron.setAttribute('aria-expanded', isOpen);
    });

    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) closeMenu();
    });
  }

  const mirrorUrl =
    document.querySelector('link[rel="alternate"][type="text/markdown"]')?.href ||
    wrap.querySelector('[data-copy-target]')?.dataset.copyTarget;

  wrap.querySelectorAll('[data-copy-target]').forEach(btn => {
    const labelEl = btn.querySelector('.docs-copy-label, .docs-copy-menu-title');
    if (!labelEl) return;
    const idleLabel = labelEl.textContent;

    btn.addEventListener('click', async () => {
      let copied = false;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          const response = await fetch(mirrorUrl);
          const text = await response.text();
          if (!response.ok || !text.trimStart().startsWith('#')) {
            throw new Error('Unexpected markdown mirror response');
          }
          await navigator.clipboard.writeText(text);
          copied = true;
        }
      } catch {
        copied = false;
      }

      labelEl.textContent = copied ? 'Copied' : 'Copy failed';
      closeMenu();
      setTimeout(() => {
        labelEl.textContent = idleLabel;
      }, 2000);
    });
  });
});
