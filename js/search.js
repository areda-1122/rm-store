/* =========================================
   R&M Store - البحث عن المنتجات
   بيبحث في قاعدة البيانات بالاسم أو العلامة التجارية
   ========================================= */
(function () {
  'use strict';

  var RM = (window.RM = window.RM || {});
  var S = (RM.search = {});

  var MIN_CHARS = 2;
  var DELAY = 300;
  var timer = null;
  var lastQuery = '';

  /* ---------- تنظيف كلمة البحث (يمنع الرموز اللي تكسر الاستعلام) ---------- */
  function clean(text) {
    return String(text || '')
      .replace(/[%_,()*"'\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* ---------- البحث في قاعدة البيانات ---------- */
  S.run = function (text) {
    var term = clean(text);
    if (term.length < MIN_CHARS) return Promise.resolve([]);
    if (!RM.db) {
      return Promise.reject(new Error(RM.dbError || 'تعذر الاتصال بقاعدة البيانات.'));
    }
    var pattern = '%' + term + '%';
    return RM.db
      .from('products')
      .select('*')
      .or('name.ilike.' + pattern + ',brand.ilike.' + pattern + ',description.ilike.' + pattern)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(function (res) {
        if (res.error) throw res.error;
        var list = res.data || [];
        if (RM.products && RM.products.byId) {
          list.forEach(function (p) {
            RM.products.byId[p.id] = p;
          });
        }
        return list;
      });
  };

  /* ---------- عناصر الصفحة ---------- */
  function box() {
    return document.getElementById('searchResults');
  }

  function hide() {
    var b = box();
    if (b) {
      b.classList.remove('show');
      b.innerHTML = '';
    }
  }

  function showMessage(msg) {
    var b = box();
    if (!b) return;
    b.innerHTML = '<div class="search-empty">' + RM.escapeHtml(msg) + '</div>';
    b.classList.add('show');
  }

  function showResults(list) {
    var b = box();
    if (!b) return;
    if (!list.length) {
      showMessage('لا توجد نتائج مطابقة.');
      return;
    }
    b.innerHTML = list
      .slice(0, 8)
      .map(function (p) {
        var img = RM.escapeHtml(RM.imageUrl ? RM.imageUrl(p.image_url) : 'logo.png');
        return (
          '<a class="search-item" href="product.html?id=' + Number(p.id) + '">' +
            '<img src="' + img + '" alt="">' +
            '<div>' +
              '<div class="search-item-name">' + RM.escapeHtml(p.name) + '</div>' +
              '<div class="search-item-price">' + RM.formatPrice(p.price) + '</div>' +
            '</div>' +
          '</a>'
        );
      })
      .join('');
    b.classList.add('show');
  }

  /* ---------- تنفيذ البحث وعرض النتيجة ---------- */
  function perform(text) {
    var term = clean(text);
    lastQuery = term;

    if (term.length < MIN_CHARS) {
      hide();
      return;
    }

    showMessage('جاري البحث...');

    S.run(term)
      .then(function (list) {
        if (term !== lastQuery) return; /* تجاهل النتائج القديمة */
        showResults(list);
      })
      .catch(function (err) {
        if (term !== lastQuery) return;
        showMessage((err && err.message) || 'حدث خطأ أثناء البحث.');
      });
  }

  /* ---------- التشغيل ---------- */
  function init() {
    var input = document.getElementById('searchInput');
    var form = document.getElementById('searchForm');
    if (!input || !form) return;

    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        perform(input.value);
      }, DELAY);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearTimeout(timer);
      perform(input.value);
    });

    /* قفل النتائج عند الضغط خارج مربع البحث */
    document.addEventListener('click', function (e) {
      var wrap = document.querySelector('.search-wrap');
      if (wrap && !wrap.contains(e.target)) hide();
    });

    /* قفل النتائج بزر Escape */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') hide();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
