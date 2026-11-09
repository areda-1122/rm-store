/* =========================================
   R&M Store - صفحة المفضلة
   بيجيب المنتجات المفضلة من قاعدة البيانات ويعرضها،
   وبيشيل المنتج من الصفحة فورًا لو اتشال من المفضلة.
   ========================================= */
(function () {
  'use strict';

  var RM = (window.RM = window.RM || {});
  var token = 0;

  function $(id) {
    return document.getElementById(id);
  }

  /* ---------- العنوان الفرعي (عدد المنتجات) ---------- */
  function setSubtitle(n) {
    var el = $('favSubtitle');
    if (!el) return;
    el.textContent = n > 0 ? 'عدد المنتجات المفضلة: ' + n : '';
  }

  /* ---------- حالة القائمة الفارغة ---------- */
  function showEmpty() {
    var grid = $('favProducts');
    var empty = $('favEmpty');
    if (grid) {
      grid.hidden = true;
      grid.innerHTML = '';
    }
    if (empty) empty.hidden = false;
    setSubtitle(0);
  }

  function showGrid() {
    var grid = $('favProducts');
    var empty = $('favEmpty');
    if (grid) grid.hidden = false;
    if (empty) empty.hidden = true;
  }

  /* ---------- أرقام المنتجات المعروضة حاليًا ---------- */
  function displayedIds() {
    var grid = $('favProducts');
    var out = [];
    if (!grid) return out;
    var cards = grid.querySelectorAll('.product-card');
    for (var i = 0; i < cards.length; i++) {
      out.push(Number(cards[i].getAttribute('data-id')));
    }
    return out;
  }

  /* ---------- تحميل وعرض المفضلة ---------- */
  function load() {
    var grid = $('favProducts');
    if (!grid) return;

    var ids = RM.favorites.ids();
    if (!ids.length) {
      showEmpty();
      return;
    }

    if (!RM.db) {
      showGrid();
      RM.products.renderError(grid, new Error(RM.dbError || 'تعذر الاتصال بقاعدة البيانات.'));
      return;
    }

    var myToken = ++token;

    RM.db
      .from('products')
      .select('*')
      .in('id', ids)
      .then(function (res) {
        if (myToken !== token) return;
        if (res.error) throw res.error;

        var list = res.data || [];
        var map = {};
        list.forEach(function (p) {
          map[p.id] = p;
          RM.products.byId[p.id] = p;
        });

        /* الترتيب: الأحدث إضافةً للمفضلة أولًا */
        var ordered = [];
        var missing = [];
        ids.slice().reverse().forEach(function (id) {
          if (map[id]) ordered.push(map[id]);
          else missing.push(id);
        });

        if (!ordered.length) {
          missing.forEach(function (id) {
            RM.favorites.remove(id);
          });
          showEmpty();
          return;
        }

        showGrid();
        RM.products.renderInto(grid, ordered, 'لا توجد منتجات.');
        setSubtitle(ordered.length);

        /* تنظيف المنتجات المحذوفة من المتجر */
        missing.forEach(function (id) {
          RM.favorites.remove(id);
        });
      })
      .catch(function (err) {
        if (myToken !== token) return;
        showGrid();
        RM.products.renderError(grid, err);
      });
  }

  /* ---------- لما المفضلة تتغير ---------- */
  function onChanged() {
    var grid = $('favProducts');
    if (!grid) return;

    var ids = RM.favorites.ids();
    var shown = displayedIds();

    /* لو فيه منتج جديد في المفضلة مش معروض (من تبويب تاني) نعيد التحميل */
    var needsReload = ids.some(function (id) {
      return shown.indexOf(id) === -1;
    });
    if (needsReload && shown.length) {
      load();
      return;
    }

    /* شيل الكروت اللي اتشالت من المفضلة */
    var cards = grid.querySelectorAll('.product-card');
    for (var i = 0; i < cards.length; i++) {
      var id = Number(cards[i].getAttribute('data-id'));
      if (ids.indexOf(id) === -1) cards[i].remove();
    }

    var left = grid.querySelectorAll('.product-card').length;
    if (!ids.length || (!left && shown.length)) {
      showEmpty();
    } else {
      setSubtitle(left);
    }
  }

  /* ---------- التشغيل ---------- */
  function init() {
    if (!$('favProducts')) return;
    document.addEventListener('rm:favorites-changed', onChanged);
    load();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* لو العميلة رجعت للصفحة بزر الرجوع */
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) load();
  });
})();
