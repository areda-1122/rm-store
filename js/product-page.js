/* =========================================
   R&M Store - صفحة تفاصيل المنتج
   بتقرا رقم المنتج من الرابط (?id=5) وتعرض بياناته
   ========================================= */
(function () {
  'use strict';

  var RM = (window.RM = window.RM || {});
  var current = null;
  var qty = 1;
  var MAX_QTY = 20;

  function $(id) {
    return document.getElementById(id);
  }

  /* ---------- قراءة رقم المنتج من الرابط ---------- */
  function getId() {
    try {
      var params = new URLSearchParams(window.location.search);
      var id = parseInt(params.get('id'), 10);
      return id > 0 ? id : 0;
    } catch (e) {
      return 0;
    }
  }

  /* ---------- رسالة الحالة (تحميل / خطأ) ---------- */
  function showStatus(msg) {
    var el = $('detailStatus');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    var box = $('productDetail');
    if (box) box.hidden = true;
  }

  /* ---------- اسم القسم ---------- */
  function categoryName(slug) {
    if (RM.categories && RM.categories[slug]) return RM.categories[slug];
    return '';
  }

  /* ---------- حالة القلب ---------- */
  function updateFavButton() {
    var btn = $('favBtn');
    if (!btn || !current) return;
    var active = RM.favorites.has(current.id);
    btn.classList.toggle('active', active);
    btn.textContent = active ? '♥' : '♡';
  }

  /* ---------- رابط واتساب للمنتج ---------- */
  function updateWhatsapp() {
    var a = $('whatsappBtn');
    if (!a || !current) return;
    var total = (Number(current.price) || 0) * qty;
    var lines = [
      'طلب جديد من ' + RM.config.storeName,
      '',
      'المنتج: ' + current.name,
      'الكمية: ' + qty,
      'السعر: ' + RM.formatPrice(current.price),
      'الإجمالي: ' + RM.formatPrice(total),
      '',
      'رابط المنتج: ' + window.location.href
    ];
    a.href =
      'https://wa.me/' + RM.config.whatsappNumber +
      '?text=' + encodeURIComponent(lines.join('\n'));
  }

  /* ---------- الكمية ---------- */
  function setQty(n) {
    qty = Math.max(1, Math.min(MAX_QTY, n));
    $('qtyNum').textContent = qty;
    updateWhatsapp();
  }

  /* ---------- عرض المنتج ---------- */
  function render(p) {
    current = p;
    qty = 1;

    var price = Number(p.price) || 0;
    var old = Number(p.old_price) || 0;
    var inStock = p.in_stock !== false;
    var percent = old > price && old > 0 ? Math.round(((old - price) / old) * 100) : 0;

    document.title = p.name + ' | R&M Store';

    var img = $('detailImg');
    img.src = RM.imageUrl(p.image_url);
    img.alt = p.name;
    img.onerror = function () {
      img.onerror = null;
      img.src = 'logo.png';
    };

    $('detailBrand').textContent = p.brand || '';
    $('detailBrand').hidden = !p.brand;
    $('detailName').textContent = p.name;

    var catEl = $('detailCategory');
    var catName = categoryName(p.category_slug);
    catEl.textContent = catName;
    catEl.hidden = !catName;

    $('detailPrice').textContent = RM.formatPrice(price);

    var oldEl = $('detailOldPrice');
    if (percent > 0) {
      oldEl.textContent = RM.formatPrice(old);
      oldEl.hidden = false;
    } else {
      oldEl.hidden = true;
    }

    var badge = $('detailBadge');
    if (!inStock) {
      badge.textContent = 'غير متوفر';
      badge.className = 'product-badge out';
      badge.hidden = false;
    } else if (percent > 0) {
      badge.textContent = 'خصم ' + percent + '%';
      badge.className = 'product-badge';
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }

    var stock = $('detailStock');
    stock.textContent = inStock ? 'متوفر' : 'غير متوفر حاليًا';
    stock.className = 'detail-stock ' + (inStock ? 'in' : 'out');

    var desc = $('detailDesc');
    desc.textContent = p.description || '';
    desc.hidden = !p.description;

    $('addToCartBtn').disabled = !inStock;
    $('addToCartBtn').textContent = inStock ? 'أضف للسلة' : 'غير متوفر';
    $('detailQtyBox').hidden = !inStock;
    $('whatsappBtn').hidden = !inStock;

    $('qtyNum').textContent = qty;
    updateFavButton();
    updateWhatsapp();

    $('detailStatus').hidden = true;
    $('productDetail').hidden = false;
  }

  /* ---------- منتجات مشابهة ---------- */
  function loadRelated(p) {
    RM.products
      .getByCategory(p.category_slug)
      .then(function (list) {
        var others = list
          .filter(function (x) {
            return x.id !== p.id;
          })
          .slice(0, 4);
        if (!others.length) return;
        RM.products.renderInto($('relatedProducts'), others, '');
        $('relatedWrap').hidden = false;
      })
      .catch(function () {
        /* لو فشل تحميل المشابهة نتجاهله */
      });
  }

  /* ---------- الأزرار ---------- */
  function bindButtons() {
    $('qtyInc').addEventListener('click', function () {
      if (qty >= MAX_QTY) {
        RM.toast('أقصى كمية للمنتج الواحد هي ' + MAX_QTY + '.');
        return;
      }
      setQty(qty + 1);
    });

    $('qtyDec').addEventListener('click', function () {
      setQty(qty - 1);
    });

    $('addToCartBtn').addEventListener('click', function () {
      if (current) RM.cart.add(current, qty);
    });

    $('favBtn').addEventListener('click', function () {
      if (!current) return;
      RM.favorites.toggle(current.id);
      updateFavButton();
    });
  }

  /* ---------- التشغيل ---------- */
  function init() {
    if (!$('productDetail')) return;

    var id = getId();
    if (!id) {
      showStatus('المنتج غير موجود.');
      return;
    }

    bindButtons();

    RM.products
      .getById(id)
      .then(function (p) {
        if (!p) {
          showStatus('المنتج غير موجود أو تم حذفه.');
          return;
        }
        render(p);
        loadRelated(p);
      })
      .catch(function (err) {
        showStatus('تعذر تحميل المنتج. ' + ((err && err.message) || ''));
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
