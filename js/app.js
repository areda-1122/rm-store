/* =========================================
   R&M Store - الوظائف العامة
   ========================================= */
(function () {
  'use strict';

  var RM = (window.RM = window.RM || {});

  /* ---------- إعدادات المتجر ---------- */
  RM.config = {
    storeName: 'R&M Store',
    whatsappNumber: '201010031279',
    currency: 'ج.م',
    cartKey: 'rm_cart',
    favoritesKey: 'rm_favorites'
  };

  /* ---------- أسماء الأقسام ---------- */
  RM.categories = {
    skin: 'العناية بالبشرة',
    hair: 'العناية بالشعر',
    makeup: 'المكياج',
    personal: 'العناية الشخصية',
    accessories: 'الإكسسوارات',
    offers: 'العروض والخصومات'
  };

  /* ---------- حفظ وقراءة آمنة من الجهاز ---------- */
  RM.load = function (key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  };

  RM.save = function (key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  };

  /* ---------- حماية النصوص قبل عرضها ---------- */
  RM.escapeHtml = function (str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  /* ---------- تنسيق السعر ---------- */
  RM.formatPrice = function (n) {
    var num = Number(n) || 0;
    return num.toLocaleString('en-US') + ' ' + RM.config.currency;
  };

  /* ---------- رسالة تنبيه صغيرة ---------- */
  RM.toast = function (message) {
    var old = document.getElementById('rmToast');
    if (old) old.remove();

    var el = document.createElement('div');
    el.id = 'rmToast';
    el.className = 'rm-toast';
    el.textContent = message;
    document.body.appendChild(el);

    setTimeout(function () {
      el.classList.add('show');
    }, 10);

    setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () {
        el.remove();
      }, 300);
    }, 2200);
  };

  /* ---------- تحديث عداد السلة والمفضلة في الهيدر ---------- */
  RM.updateBadges = function () {
    var cart = RM.load(RM.config.cartKey, []);
    var favs = RM.load(RM.config.favoritesKey, []);

    var cartTotal = 0;
    if (Array.isArray(cart)) {
      cart.forEach(function (item) {
        cartTotal += Number(item.qty) || 0;
      });
    }
    var favTotal = Array.isArray(favs) ? favs.length : 0;

    var cartEl = document.getElementById('cartCount');
    var favEl = document.getElementById('favCount');
    if (cartEl) cartEl.textContent = cartTotal;
    if (favEl) favEl.textContent = favTotal;
  };

  /* ---------- تنسيق رسالة التنبيه (بدون تعديل ملف CSS) ---------- */
  function injectToastStyle() {
    var style = document.createElement('style');
    style.textContent =
      '.rm-toast{position:fixed;bottom:24px;left:50%;' +
      'transform:translate(-50%,20px);background:#1a1a1a;color:#fff;' +
      'padding:12px 22px;border-radius:30px;font-size:14px;font-weight:700;' +
      'opacity:0;transition:all .3s;z-index:9999;max-width:90%;' +
      'text-align:center;pointer-events:none;}' +
      '.rm-toast.show{opacity:1;transform:translate(-50%,0);}';
    document.head.appendChild(style);
  }

  /* ---------- زر القائمة في الموبايل ---------- */
  function setupMenu() {
    var btn = document.getElementById('menuBtn');
    var nav = document.getElementById('mainNav');
    if (!btn || !nav) return;

    btn.setAttribute('aria-expanded', 'false');

    btn.addEventListener('click', function () {
      var isOpen = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      btn.textContent = isOpen ? '✕' : '☰';
    });

    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        btn.textContent = '☰';
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 768) {
        nav.classList.remove('open');
        btn.textContent = '☰';
      }
    });
  }

  /* ---------- التشغيل ---------- */
  function init() {
    injectToastStyle();
    setupMenu();
    RM.updateBadges();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* تحديث العدادات عند الرجوع للصفحة من زر الرجوع في سفاري */
  window.addEventListener('pageshow', function () {
    RM.updateBadges();
  });
})();
