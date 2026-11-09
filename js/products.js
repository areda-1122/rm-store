/* =========================================
   R&M Store - عرض المنتجات من قاعدة البيانات
   ========================================= */
(function () {
  'use strict';

  var RM = (window.RM = window.RM || {});
  var P = (RM.products = { all: [], byId: {} });

  /* ---------- حفظ المنتجات في الذاكرة (للبحث والسلة) ---------- */
  function remember(list) {
    list.forEach(function (p) {
      P.byId[p.id] = p;
    });
  }

  /* ---------- طلب عام من قاعدة البيانات ---------- */
  function query(build) {
    if (!RM.db) {
      return Promise.reject(new Error(RM.dbError || 'تعذر الاتصال بقاعدة البيانات.'));
    }
    return build(RM.db.from('products').select('*')).then(function (res) {
      if (res.error) throw res.error;
      var list = res.data || [];
      remember(list);
      return list;
    });
  }

  P.getFeatured = function () {
    return query(function (q) {
      return q.eq('is_featured', true).order('created_at', { ascending: false }).limit(8);
    });
  };

  P.getLatest = function () {
    return query(function (q) {
      return q.order('created_at', { ascending: false }).limit(8);
    });
  };

  P.getBestSellers = function () {
    return query(function (q) {
      return q.eq('is_best_seller', true).order('sales_count', { ascending: false }).limit(8);
    });
  };

  P.getAll = function () {
    return query(function (q) {
      return q.order('created_at', { ascending: false });
    });
  };

  P.getByCategory = function (slug) {
    return query(function (q) {
      if (slug === 'offers') {
        return q.or('is_offer.eq.true,category_slug.eq.offers').order('created_at', { ascending: false });
      }
      return q.eq('category_slug', slug).order('created_at', { ascending: false });
    });
  };

  P.getById = function (id) {
    if (!RM.db) {
      return Promise.reject(new Error(RM.dbError || 'تعذر الاتصال بقاعدة البيانات.'));
    }
    return RM.db
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(function (res) {
        if (res.error) throw res.error;
        if (res.data) remember([res.data]);
        return res.data || null;
      });
  };

  /* ---------- المفضلة (قراءة فقط لتلوين القلب) ---------- */
  function isFav(id) {
    if (RM.favorites && typeof RM.favorites.has === 'function') {
      return RM.favorites.has(id);
    }
    var list = RM.load(RM.config.favoritesKey, []);
    return Array.isArray(list) && list.indexOf(Number(id)) > -1;
  }

  /* ---------- نسبة الخصم ---------- */
  function discountPercent(p) {
    var price = Number(p.price) || 0;
    var old = Number(p.old_price) || 0;
    if (old > price && old > 0) {
      return Math.round(((old - price) / old) * 100);
    }
    return 0;
  }

  /* ---------- شكل كارت المنتج ---------- */
  P.cardHtml = function (p) {
    var id = Number(p.id);
    var name = RM.escapeHtml(p.name);
    var brand = RM.escapeHtml(p.brand);
    var img = RM.escapeHtml(RM.imageUrl ? RM.imageUrl(p.image_url) : 'logo.png');
    var percent = discountPercent(p);
    var inStock = p.in_stock !== false;
    var fav = isFav(id);

    var badge = '';
    if (!inStock) {
      badge = '<span class="product-badge out">غير متوفر</span>';
    } else if (percent > 0) {
      badge = '<span class="product-badge">خصم ' + percent + '%</span>';
    }

    var oldPrice = percent > 0 ? '<span class="price-old">' + RM.formatPrice(p.old_price) + '</span>' : '';

    return (
      '<article class="product-card" data-id="' + id + '">' +
        '<a class="product-img-wrap" href="product.html?id=' + id + '" aria-label="' + name + '">' +
          '<img class="product-img" src="' + img + '" alt="' + name + '" loading="lazy">' +
          badge +
        '</a>' +
        '<button type="button" class="product-fav' + (fav ? ' active' : '') + '" data-fav="' + id + '" aria-label="إضافة للمفضلة">' +
          (fav ? '♥' : '♡') +
        '</button>' +
        '<div class="product-info">' +
          (brand ? '<span class="product-brand">' + brand + '</span>' : '') +
          '<a class="product-name" href="product.html?id=' + id + '">' + name + '</a>' +
          '<div class="product-price">' +
            '<span class="price-new">' + RM.formatPrice(p.price) + '</span>' +
            oldPrice +
          '</div>' +
        '</div>' +
        '<div class="product-actions">' +
          '<button type="button" class="btn-add" data-add="' + id + '"' + (inStock ? '' : ' disabled') + '>' +
            (inStock ? 'أضف للسلة' : 'غير متوفر') +
          '</button>' +
        '</div>' +
      '</article>'
    );
  };

  /* ---------- عرض قائمة منتجات داخل عنصر ---------- */
  P.renderInto = function (el, list, emptyMessage) {
    if (!el) return;
    if (!list || !list.length) {
      el.innerHTML = '<p class="loading-text">' + RM.escapeHtml(emptyMessage || 'لا توجد منتجات حاليًا.') + '</p>';
      return;
    }
    el.innerHTML = list.map(P.cardHtml).join('');
  };

  P.renderError = function (el, err) {
    if (!el) return;
    var msg = (err && err.message) ? err.message : 'حدث خطأ أثناء تحميل المنتجات.';
    el.innerHTML = '<p class="loading-text">تعذر تحميل المنتجات. ' + RM.escapeHtml(msg) + '</p>';
  };

  function load(elId, fetcher, emptyMessage) {
    var el = document.getElementById(elId);
    if (!el) return;
    fetcher()
      .then(function (list) {
        P.renderInto(el, list, emptyMessage);
      })
      .catch(function (err) {
        P.renderError(el, err);
      });
  }

  /* ---------- الأزرار: السلة والمفضلة ---------- */
  function onClick(e) {
    var addBtn = e.target.closest('[data-add]');
    if (addBtn) {
      var product = P.byId[addBtn.getAttribute('data-add')];
      if (!product) return;
      if (RM.cart && typeof RM.cart.add === 'function') {
        RM.cart.add(product, 1);
      } else {
        RM.toast('السلة غير جاهزة بعد.');
      }
      return;
    }

    var favBtn = e.target.closest('[data-fav]');
    if (favBtn) {
      e.preventDefault();
      var id = Number(favBtn.getAttribute('data-fav'));
      if (RM.favorites && typeof RM.favorites.toggle === 'function') {
        RM.favorites.toggle(id);
        var buttons = document.querySelectorAll('[data-fav="' + id + '"]');
        var active = isFav(id);
        for (var i = 0; i < buttons.length; i++) {
          buttons[i].classList.toggle('active', active);
          buttons[i].textContent = active ? '♥' : '♡';
        }
      } else {
        RM.toast('المفضلة غير جاهزة بعد.');
      }
    }
  }

  /* ---------- صورة بديلة لو الصورة ما اتحملتش ---------- */
  function onImageError(e) {
    var t = e.target;
    if (t && t.tagName === 'IMG' && t.classList.contains('product-img')) {
      if (t.getAttribute('src') !== 'logo.png') {
        t.setAttribute('src', 'logo.png');
      }
    }
  }

  /* ---------- التشغيل ---------- */
  function init() {
    document.addEventListener('click', onClick);
    document.addEventListener('error', onImageError, true);

    load('featuredProducts', P.getFeatured, 'لا توجد منتجات مميزة حاليًا.');
    load('latestProducts', P.getLatest, 'لا توجد منتجات حاليًا.');
    load('bestSellers', P.getBestSellers, 'لا توجد منتجات في الأكثر مبيعًا حاليًا.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
