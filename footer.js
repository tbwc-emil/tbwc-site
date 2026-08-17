/* Global site footer for all TBWC pages.
   Single source of truth — edit here, every page inherits.
   Mounts into <div id="site-footer"></div>. Plain JS, no framework needed. */
(function () {
  'use strict';

  var mount = document.getElementById('site-footer');
  if (!mount) return;

  // On the home page use bare hash anchors; elsewhere jump back to index.html.
  var path = location.pathname.replace(/\\/g, '/');
  var file = path.substring(path.lastIndexOf('/') + 1);
  var onIndex = file === '' || file === 'index.html';
  var base = onIndex ? '' : 'index.html';

  var phoneIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5 19.79 19.79 0 0 1 1.6 4.9 2 2 0 0 1 3.58 2.72h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.28a16 16 0 0 0 6.13 6.13l1.62-1.62a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
  var emailIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>';

  mount.innerHTML =
    '<footer class="foot">' +
      '<div class="wrap">' +
        '<div class="foot__grid">' +
          '<div class="foot__col foot__brand">' +
            '<a href="index.html" class="brand">' +
              '<img src="TBWC%20Technology%20Logo%20.png" alt="TBWC Technology" class="brand__logo-img" />' +
            '</a>' +
            '<p class="foot__tag">TBWC Technology with precision since 2002.</p>' +
          '</div>' +
          '<div class="foot__col">' +
            '<h4>Support</h4>' +
            '<ul>' +
              '<li><a href="mailto:info@TBWCinc.com?subject=Tech%20Support%20-">Technical Support</a></li>' +
            '</ul>' +
          '</div>' +
          '<div class="foot__col">' +
            '<h4>Reps</h4>' +
            '<ul>' +
              '<li><a href="' + base + '#reps">Register</a></li>' +
              '<li><a href="reps.html">Territory Map</a></li>' +
              '<li><a href="portal.html">Login</a></li>' +
            '</ul>' +
          '</div>' +
          '<div class="foot__col">' +
            '<h4>Company</h4>' +
            '<ul>' +
              '<li><a href="' + base + '#about">About</a></li>' +
              '<li><a href="mailto:info@tbwcinc.com" target="_blank" rel="noopener noreferrer">New Customer</a></li>' +
            '</ul>' +
          '</div>' +
          '<div class="foot__col" id="footer-contact">' +
            '<h4>Contact Us</h4>' +
            '<ul>' +
              '<li><a href="tel:8885621810" style="display:flex;align-items:center;gap:8px">' + phoneIcon + '(888) 562-1810</a></li>' +
              '<li><a href="mailto:info@TBWCinc.com" style="display:flex;align-items:center;gap:8px">' + emailIcon + 'info@TBWCinc.com</a></li>' +
            '</ul>' +
          '</div>' +
        '</div>' +
        '<div class="foot__bot">' +
          '<span>© 2026 TBWC TECHNOLOGY, INC. · ALL RIGHTS RESERVED.</span>' +
        '</div>' +
      '</div>' +
    '</footer>';
})();
