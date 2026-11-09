/* =========================================
   R&M Store - المفضلة
   بتتحفظ في متصفح العميل وبتفضل موجودة
   حتى بعد قفل الموقع.
   ========================================= */
(function () {
  'use strict';

  var RM = (window.RM = window.RM || {});
  var KEY = (RM.config && RM.config.favoritesKey) || 'rm_favorites';

  var F = (RM.favorites = {});

  /* ---------- قراءة المفضلة بشكل آمن (قائمة أرقام منتجات) ---------- */
  function read() {
    var list = RM.load(KEY, []);
    if (!Array.isArray(list)) return [];
    var clean = [];
    list.forEach(function (v) {
      var id = Number(v);
      if (id > 0 && clean.indexOf(id) === -1) clean.push(id);
    });
    return clean;
  }

  /* ---------- حفظ المفضلة وتحديث العدادات ---------- */
  function write(list) {
    RM.save(KEY, list);
    if (typeof RM.updateBadges === 'function') RM.updateBadges();
    document.dispatchEvent(new CustomEvent('rm:favorites-changed'));
  }

  /* ---------- قراءة البيانات ---------- */
  F.ids = function () {
    return read();
  };

  F.count = function () {
    return read().length;
  };

  F.has = function (id) {
    return read().indexOf(Number(id)) > -1;
  };

  /* ---------- إضافة وإزالة ---------- */
  F.add = function (id) {
    id = Number(id);
    if (!(id > 0)) return false;
    var list = read();
    if (list.indexOf(id) === -1) {
      list.push(id);
      write(list);
    }
    return true;
  };

  F.remove = function (id) {
    id = Number(id);
    var list = read().filter(function (v) {
      return v !== id;
    });
    write(list);
  };

  /* ---------- تبديل الحالة (يضيف لو مش موجود، ويشيل لو موجود) ---------- */
  F.toggle = function (id) {
    id = Number(id);
    if (!(id > 0)) return false;
    if (F.has(id)) {
      F.remove(id);
      RM.toast('تمت الإزالة من المفضلة');
      return false;
    }
    F.add(id);
    RM.toast('تمت الإضافة للمفضلة ♥');
    return true;
  };

  /* ---------- تحديث العدادات لو المفضلة اتغيرت من تبويب تاني ---------- */
  window.addEventListener('storage', function (e) {
    if (e.key === KEY) {
      if (typeof RM.updateBadges === 'function') RM.updateBadges();
      document.dispatchEvent(new CustomEvent('rm:favorites-changed'));
    }
  });
})();
