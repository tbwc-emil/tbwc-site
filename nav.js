/* Global site header/menu for all TBWC pages.
   Single source of truth — edit here, every page inherits.
   Mounts into <div id="site-nav"></div>. Plain JS, no framework needed. */
(function () {
  'use strict';

  var mount = document.getElementById('site-nav');
  if (!mount) return;

  // On the home page use bare hash anchors; elsewhere jump back to index.html.
  var path = location.pathname.replace(/\\/g, '/');
  var file = path.substring(path.lastIndexOf('/') + 1);
  var onIndex = file === '' || file === 'index.html';
  var base = onIndex ? '' : 'index.html';
  var current = file || 'index.html';

  function active(target) {
    return current === target ? ' aria-current="page"' : '';
  }

  var links = [
    { label: 'Applications', href: base + '#applications' },
    { label: 'Representatives', href: 'reps.html', match: 'reps.html' },
    { label: 'About', href: base + '#about' },
    { label: 'Contact', href: base + '#footer-contact', contact: true }
  ];

  function linkRow(cls, closeMobile) {
    return links.map(function (l) {
      var cur = l.match && current === l.match ? ' aria-current="page"' : '';
      return '<a class="' + cls + '" href="' + l.href + '"' + cur +
        ' data-contact="' + (l.contact ? '1' : '0') + '"' +
        ' data-close="' + (closeMobile ? '1' : '0') + '">' + l.label + '</a>';
    }).join('');
  }

  mount.innerHTML =
    '<nav class="nav" data-scrolled="0">' +
      '<div class="wrap nav__inner">' +
        '<a href="index.html" class="brand" aria-label="TBWC — home">' +
          '<img src="TBWC%20Technology%20Logo%20.png" alt="TBWC Technology" class="brand__logo-img" />' +
        '</a>' +
        '<div class="nav__links">' + linkRow('nav__link', false) + '</div>' +
        '<div class="nav__cta-group" style="position:relative">' +
          '<button class="btn btn--primary btn--sm" data-drop-toggle>Rep Portal</button>' +
          '<button class="nav__burger" aria-label="Menu" data-burger data-open="0"><span></span><span></span><span></span></button>' +
          '<div class="portal-drop" data-drop hidden>' +
            '<p class="portal-drop__title">Rep Portal</p>' +
            '<form data-portal-form style="display:flex;flex-direction:column;gap:10px">' +
              '<input class="portal-drop__input" type="email" placeholder="Email" required />' +
              '<input class="portal-drop__input" type="password" placeholder="Password" required />' +
              '<button type="submit" class="btn btn--primary" style="width:100%;justify-content:center">Log in</button>' +
            '</form>' +
            '<div class="portal-drop__links">' +
              '<a href="https://tbwctechnology.com/rep-portal/" target="_blank" rel="noopener noreferrer">Forgot password?</a>' +
              '<a href="newrep-request.html" class="btn btn--ghost btn--sm">Become a Rep</a>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="nav__mobile" data-mobile hidden>' + linkRow('', true) + '</div>' +
    '</nav>';

  var nav = mount.querySelector('.nav');
  var dropToggle = mount.querySelector('[data-drop-toggle]');
  var drop = mount.querySelector('[data-drop]');
  var ctaGroup = mount.querySelector('.nav__cta-group');
  var burger = mount.querySelector('[data-burger]');
  var mobile = mount.querySelector('[data-mobile]');
  var form = mount.querySelector('[data-portal-form]');

  // Scrolled state
  function onScroll() { nav.setAttribute('data-scrolled', window.scrollY > 8 ? '1' : '0'); }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Rep Portal dropdown
  function setDrop(open) {
    drop.hidden = !open;
    if (open) { var el = form.querySelector('input'); if (el) el.focus(); }
  }
  dropToggle.addEventListener('click', function () { setDrop(drop.hidden); });
  document.addEventListener('mousedown', function (e) {
    if (!drop.hidden && !ctaGroup.contains(e.target)) setDrop(false);
  });
  form.addEventListener('submit', function (e) { e.preventDefault(); window.location.href = 'products.html'; });

  // Mobile menu
  function setMobile(open) {
    mobile.hidden = !open;
    burger.setAttribute('data-open', open ? '1' : '0');
  }
  burger.addEventListener('click', function () { setMobile(mobile.hidden); });

  // Smooth-scroll same-page anchors with sticky-nav offset (avoids the
  // "first click doesn't land" issue caused by the fixed header + reveal anims).
  function scrollToId(id) {
    var el = document.getElementById(id);
    if (!el) return false;
    var navH = nav.getBoundingClientRect().height || 0;
    var y = window.pageYOffset + el.getBoundingClientRect().top - navH - 8;
    window.scrollTo({ top: y, behavior: 'smooth' });
    return true;
  }

  // Contact highlight + mobile close + anchor scroll
  mount.addEventListener('click', function (e) {
    var a = e.target.closest('a');
    if (!a) return;
    if (a.getAttribute('data-close') === '1') setMobile(false);

    var href = a.getAttribute('href') || '';
    if (href.charAt(0) === '#' && href.length > 1) {
      var id = href.slice(1);
      e.preventDefault();
      history.replaceState(null, '', href);
      if (!scrollToId(id)) {
        // Target not rendered yet (React still mounting) — retry next frame.
        requestAnimationFrame(function () { scrollToId(id); });
      }
    }

    if (a.getAttribute('data-contact') === '1') {
      var el = document.getElementById('footer-contact');
      if (el) { el.style.background = '#fffde7'; el.style.borderRadius = '6px'; el.style.padding = '8px'; }
    }
  });

  // Deep-link on load: arriving from another page (e.g. reps.html -> index.html#about),
  // the target section is rendered by React after load — poll briefly, then scroll.
  if (location.hash.length > 1) {
    var hashId = location.hash.slice(1);
    var tries = 0;
    (function settle() {
      if (scrollToId(hashId) || tries++ > 40) return;
      setTimeout(settle, 50);
    })();
  }
})();
