/* =========================================
   R&M Store - منطق السلة
   السلة بتتحفظ في متصفح العميل وبتفضل موجودة
   حتى بعد قفل الموقع.
   ========================================= */
(function () {
  'use strict';

  var RM = (window.RM = window.RM || {});
  var KEY = (RM.config && RM.config.cartKey) || 'rm_cart';
  var MAX_QTY = 20;

  var C = (RM.cart = {});

  /* ---------- قراءة السلة بشكل آمن ---------- */
  function read() {
    var list = RM.load(KEY, []);
    if (!Array.isArray(list)) return [];
    var clean = [];
    list.forEach(function (it) {
      var id = Number(it && it.id);
      var qty = Math.floor(Number(it && it.qty));
      var price = Number(it && it.price);
      if (!id || !(qty > 0) || !(price >= 0)) return;
      clean.push({
        id: id,
        name: String(it.name || ''),
        brand: String(it.brand || ''),
        price: price,
        image_url: String(it.image_url || ''),
        qty: Math.min(qty, MAX_QTY)
      });
    });
    return clean;
  }

  /* ---------- حفظ السلة وتحديث العدادات ---------- */
  function write(list) {
    RM.save(KEY, list);
    if (typeof RM.updateBadges === 'function') RM.updateBadges();
    document.dispatchEvent(new CustomEvent('rm:cart-changed'));
  }

  /* ---------- قراءة بيانات السلة ---------- */
  C.items = function () {
    return read();
  };

  C.count = function () {
    var n = 0;
    read().forEach(function (it) {
      n += it.qty;
    });
    return n;
  };

  C.total = function () {
    var t = 0;
    read().forEach(function (it) {
      t += it.price * it.qty;
    });
    return Math.round(t * 100) / 100;
  };

  /* ---------- إضافة منتج ---------- */
  C.add = function (product, qty) {
    if (!product) return false;
    var id = Number(product.id);
    var add = Math.floor(Number(qty)) || 1;

    if (!id) return false;

    if (product.in_stock === false) {
      RM.toast('المنتج غير متوفر حاليًا.');
      return false;
    }

    var list = read();
    var found = null;
    list.forEach(function (it) {
      if (it.id === id) found = it;
    });

    if (found) {
      if (found.qty >= MAX_QTY) {
        RM.toast('أقصى كمية للمنتج الواحد هي ' + MAX_QTY + '.');
        return false;
      }
      found.qty = Math.min(found.qty + add, MAX_QTY);
      /* تحديث السعر لآخر سعر معروض */
      found.price = Number(product.price) || 0;
    } else {
      list.push({
        id: id,
        name: String(product.name || ''),
        brand: String(product.brand || ''),
        price: Number(product.price) || 0,
        image_url: String(product.image_url || ''),
        qty: Math.min(add, MAX_QTY)
      });
    }

    write(list);
    RM.toast('تمت إضافة المنتج للسلة ✓');
    return true;
  };

  /* ---------- حذف منتج ---------- */
  C.remove = function (id) {
    id = Number(id);
    var list = read().filter(function (it) {
      return it.id !== id;
    });
    write(list);
  };

  /* ---------- تحديد كمية معينة ---------- */
  C.setQty = function (id, qty) {
    id = Number(id);
    qty = Math.floor(Number(qty));
    if (!(qty > 0)) {
      C.remove(id);
      return;
    }
    var list = read();
    list.forEach(function (it) {
      if (it.id === id) it.qty = Math.min(qty, MAX_QTY);
    });
    write(list);
  };

  /* ---------- زيادة وتقليل الكمية ---------- */
  C.increase = function (id) {
    id = Number(id);
    var list = read();
    list.forEach(function (it) {
      if (it.id === id) {
        if (it.qty >= MAX_QTY) {
          RM.toast('أقصى كمية للمنتج الواحد هي ' + MAX_QTY + '.');
        } else {
          it.qty += 1;
        }
      }
    });
    write(list);
  };

  C.decrease = function (id) {
    id = Number(id);
    var list = read();
    var result = [];
    list.forEach(function (it) {
      if (it.id === id) it.qty -= 1;
      if (it.qty > 0) result.push(it);
    });
    write(result);
  };

  /* ---------- تفريغ السلة ---------- */
  C.clear = function () {
    write([]);
  };

  /* ---------- تحديث العدادات لو السلة اتغيرت من تبويب تاني ---------- */
  window.addEventListener('storage', function (e) {
    if (e.key === KEY) {
      if (typeof RM.updateBadges === 'function') RM.updateBadges();
      document.dispatchEvent(new CustomEvent('rm:cart-changed'));
    }
  });
})();
