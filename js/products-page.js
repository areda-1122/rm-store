/* =========================================
   R&M Store - صفحة منتجات القسم
   بتقرا القسم من الرابط (?category=skin) وتعرض منتجاته
   ========================================= */
(function () {
  'use strict';

  var RM = (window.RM = window.RM || {});

  function $(id) {
    return document.getElementById(id);
  }

  /* ---------- قراءة القسم من الرابط ---------- */
  function getCategory() {
    try {
      var params = new URLSearchParams(window.location.search);
      var c = (params.get('category') || '').trim().toLowerCase();
      return /^[a-z0-9_-]{1,40}$/.test(c) ? c : '';
    } catch (e) {
      return '';
    }
  }

  /* ---------- اسم القسم (من القائمة الثابتة أو من قاعدة البيانات) ---------- */
  function resolveName(slug) {
    if (!slug) return Promise.resolve('كل المنتجات');
    if (RM.categories && RM.categories[slug]) {
      return Promise.resolve(RM.categories[slug]);
    }
    if (!RM.db) return Promise.resolve('المنتجات');
    return RM.db
      .from('categories')
      .select('name')
      .eq('slug', slug)
      .maybeSingle()
      .then(function (res) {
        return res && res.data && res.data.name ? res.data.name : 'المنتجات';
      })
      .catch(function () {
        return 'المنتجات';
      });
  }

  /* ---------- تمييز القسم الحالي في القائمة ---------- */
  function highlightNav(slug) {
    if (!slug) return;
    var links = document.querySelectorAll('.main-nav a');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href') || '';
      if (href.indexOf('category=' + slug) > -1) {
        links[i].style.color = 'var(--pink-dark)';
        links[i].style.borderBottomColor = 'var(--pink-dark)';
      }
    }
  }

  /* ---------- التشغيل ---------- */
  function init() {
    var grid = $('productsGrid');
    if (!grid) return;

    var slug = getCategory();
    var title = $('pageTitle');
    var subtitle = $('pageSubtitle');

    highlightNav(slug);

    resolveName(slug).then(function (name) {
      if (title) title.textContent = name;
      document.title = name + ' | R&M Store';
    });

    var fetcher = slug
      ? function () { return RM.products.getByCategory(slug); }
      : function () { return RM.products.getAll(); };

    fetcher()
      .then(function (list) {
        RM.products.renderInto(grid, list, 'لا توجد منتجات في هذا القسم حاليًا.');
        if (subtitle) {
          subtitle.textContent = list.length ? 'عدد المنتجات: ' + list.length : '';
        }
      })
      .catch(function (err) {
        RM.products.renderError(grid, err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
