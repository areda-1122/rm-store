/* =========================================
   R&M Store - الاتصال بقاعدة البيانات (Supabase)
   المفتاح هنا عام وآمن (Publishable)، والحماية الحقيقية
   في قواعد الصلاحيات داخل قاعدة البيانات.
   ========================================= */
(function () {
  'use strict';

  var RM = (window.RM = window.RM || {});

  var SUPABASE_URL = 'https://wdvihassltuldqfjqdrc.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_d6mgTM8N4NHtOmLEpjC4Gw_gk4P01YB';

  RM.db = null;
  RM.dbError = null;

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    RM.dbError = 'تعذر تحميل مكتبة قاعدة البيانات. تأكد من اتصال الإنترنت.';
    return;
  }

  try {
    RM.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (e) {
    RM.dbError = 'تعذر الاتصال بقاعدة البيانات.';
  }

  /* ---------- رابط صورة المنتج ---------- */
  RM.imageUrl = function (path) {
    if (!path) return 'logo.png';
    if (/^https?:\/\//i.test(path)) return path;
    return SUPABASE_URL + '/storage/v1/object/public/product-images/' + path;
  };
})();
