/* =========================================
   R&M Store - صفحة السلة وإتمام الطلب
   1) يعرض منتجات السلة
   2) يراجع الأسعار والتوفر من قاعدة البيانات
   3) يحفظ الطلب في قاعدة البيانات
   4) يفتح واتساب برسالة الطلب
   ========================================= */
(function () {
  'use strict';

  var RM = (window.RM = window.RM || {});
  var sending = false;

  function $(id) {
    return document.getElementById(id);
  }

  /* ---------- تحويل الأرقام العربية إلى إنجليزية ---------- */
  function toEnglishDigits(text) {
    return String(text || '')
      .replace(/[٠-٩]/g, function (d) {
        return String(d.charCodeAt(0) - 1632);
      })
      .replace(/[۰-۹]/g, function (d) {
        return String(d.charCodeAt(0) - 1776);
      });
  }

  /* ---------- تنظيف رقم الموبايل المصري والتحقق منه ---------- */
  function normalizePhone(raw) {
    var p = toEnglishDigits(raw).replace(/[\s\-().]/g, '');
    if (p.indexOf('+20') === 0) p = '0' + p.slice(3);
    else if (p.indexOf('0020') === 0) p = '0' + p.slice(4);
    else if (p.indexOf('20') === 0 && p.length === 12) p = '0' + p.slice(2);
    return p;
  }

  function isValidPhone(p) {
    return /^01[0125][0-9]{8}$/.test(p);
  }

  /* ---------- رسالة الخطأ ---------- */
  function showError(msg) {
    var el = $('orderError');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function clearError() {
    var el = $('orderError');
    if (el) {
      el.textContent = '';
      el.hidden = true;
    }
  }

  /* ---------- عرض السلة ---------- */
  function render() {
    var items = RM.cart.items();
    var empty = $('cartEmpty');
    var content = $('cartContent');
    var list = $('cartItems');
    if (!empty || !content || !list) return;

    if (!items.length) {
      empty.hidden = false;
      content.hidden = true;
      return;
    }

    empty.hidden = true;
    content.hidden = false;

    list.innerHTML = items
      .map(function (it) {
        var img = RM.escapeHtml(RM.imageUrl ? RM.imageUrl(it.image_url) : 'logo.png');
        var name = RM.escapeHtml(it.name);
        var brand = RM.escapeHtml(it.brand);
        return (
          '<article class="cart-item" data-id="' + it.id + '">' +
            '<img class="cart-item-img" src="' + img + '" alt="' + name + '">' +
            '<div class="cart-item-body">' +
              (brand ? '<span class="cart-item-brand">' + brand + '</span>' : '') +
              '<a class="cart-item-name" href="product.html?id=' + it.id + '">' + name + '</a>' +
              '<span class="cart-item-price">' + RM.formatPrice(it.price) + '</span>' +
              '<div class="cart-item-bottom">' +
                '<div class="qty-box">' +
                  '<button type="button" class="qty-btn" data-act="inc" data-id="' + it.id + '" aria-label="زيادة الكمية">+</button>' +
                  '<span class="qty-num">' + it.qty + '</span>' +
                  '<button type="button" class="qty-btn" data-act="dec" data-id="' + it.id + '" aria-label="تقليل الكمية">−</button>' +
                '</div>' +
                '<span class="cart-item-line">' + RM.formatPrice(it.price * it.qty) + '</span>' +
              '</div>' +
            '</div>' +
            '<button type="button" class="cart-remove" data-act="del" data-id="' + it.id + '" aria-label="حذف المنتج">✕</button>' +
          '</article>'
        );
      })
      .join('');

    $('summaryCount').textContent = RM.cart.count();
    $('summaryTotal').textContent = RM.formatPrice(RM.cart.total());
  }

  /* ---------- أزرار السلة (زيادة / تقليل / حذف) ---------- */
  function onListClick(e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var id = Number(btn.getAttribute('data-id'));
    var act = btn.getAttribute('data-act');
    if (act === 'inc') RM.cart.increase(id);
    else if (act === 'dec') RM.cart.decrease(id);
    else if (act === 'del') RM.cart.remove(id);
  }

  /* ---------- مراجعة الأسعار والتوفر من قاعدة البيانات ---------- */
  function sync() {
    var items = RM.cart.items();
    if (!items.length) {
      return Promise.resolve({ items: [], removed: [], changed: false });
    }
    if (!RM.db) {
      return Promise.reject(new Error(RM.dbError || 'تعذر الاتصال بقاعدة البيانات.'));
    }

    var ids = items.map(function (it) {
      return it.id;
    });

    return RM.db
      .from('products')
      .select('id,name,brand,price,image_url,in_stock')
      .in('id', ids)
      .then(function (res) {
        if (res.error) throw res.error;

        var map = {};
        (res.data || []).forEach(function (p) {
          map[p.id] = p;
        });

        var next = [];
        var removed = [];
        var changed = false;

        items.forEach(function (it) {
          var p = map[it.id];
          if (!p || p.in_stock === false) {
            removed.push(it.name);
            changed = true;
            return;
          }
          var price = Number(p.price) || 0;
          if (
            price !== it.price ||
            p.name !== it.name ||
            (p.brand || '') !== it.brand ||
            (p.image_url || '') !== it.image_url
          ) {
            changed = true;
          }
          next.push({
            id: it.id,
            name: String(p.name || ''),
            brand: String(p.brand || ''),
            price: price,
            image_url: String(p.image_url || ''),
            qty: it.qty
          });
        });

        if (changed) {
          RM.save(RM.config.cartKey, next);
          RM.updateBadges();
        }

        return { items: next, removed: removed, changed: changed };
      });
  }

  /* ---------- نص رسالة واتساب ---------- */
  function buildMessage(order) {
    var lines = [];
    lines.push('طلب جديد من ' + RM.config.storeName);
    lines.push('');
    lines.push('الاسم: ' + order.customer_name);
    lines.push('الموبايل: ' + order.customer_phone);
    lines.push('العنوان: ' + order.customer_address);
    lines.push('');
    lines.push('المنتجات:');
    order.items.forEach(function (it, i) {
      lines.push(
        (i + 1) + ') ' + it.name + ' × ' + it.qty + ' = ' + RM.formatPrice(it.price * it.qty)
      );
    });
    lines.push('');
    lines.push('الإجمالي: ' + RM.formatPrice(order.total));
    if (order.notes) {
      lines.push('');
      lines.push('ملاحظات: ' + order.notes);
    }
    return lines.join('\n');
  }

  /* ---------- إتمام الطلب ---------- */
  function onSubmit(e) {
    e.preventDefault();
    if (sending) return;
    clearError();

    var name = $('custName').value.trim();
    var phone = normalizePhone($('custPhone').value);
    var address = $('custAddress').value.trim();
    var notes = $('custNotes').value.trim();

    if (name.length < 2) {
      showError('من فضلك اكتبي اسمك بالكامل.');
      return;
    }
    if (!isValidPhone(phone)) {
      showError('رقم الموبايل غير صحيح. اكتبيه بالشكل: 01xxxxxxxxx');
      return;
    }
    if (address.length < 8) {
      showError('من فضلك اكتبي العنوان بالتفصيل.');
      return;
    }
    if (!RM.cart.items().length) {
      render();
      return;
    }

    var btn = $('orderBtn');
    var oldText = btn.textContent;
    sending = true;
    btn.disabled = true;
    btn.textContent = 'جاري تجهيز الطلب...';

    function finish() {
      sending = false;
      btn.disabled = false;
      btn.textContent = oldText;
    }

    sync()
      .then(function (result) {
        if (!result.items.length) {
          render();
          showError('المنتجات اللي في السلة لم تعد متوفرة. تم تفريغ السلة.');
          finish();
          return;
        }

        if (result.removed.length) {
          render();
          showError('تم حذف منتجات غير متوفرة من السلة: ' + result.removed.join('، ') + '. راجعي السلة ثم اضغطي إتمام الطلب مرة أخرى.');
          finish();
          return;
        }

        if (result.changed) {
          render();
          showError('تم تحديث بعض الأسعار. راجعي الإجمالي ثم اضغطي إتمام الطلب مرة أخرى.');
          finish();
          return;
        }

        var items = result.items.map(function (it) {
          return { id: it.id, name: it.name, price: it.price, qty: it.qty };
        });

        var total = 0;
        items.forEach(function (it) {
          total += it.price * it.qty;
        });
        total = Math.round(total * 100) / 100;

        var order = {
          customer_name: name,
          customer_phone: phone,
          customer_address: address,
          notes: notes,
          items: items,
          total: total,
          status: 'new'
        };

        return RM.db
          .from('orders')
          .insert(order)
          .then(function (res) {
            if (res.error) throw res.error;

            var url =
              'https://wa.me/' + RM.config.whatsappNumber +
              '?text=' + encodeURIComponent(buildMessage(order));

            RM.cart.clear();
            window.location.href = url;
          });
      })
      .catch(function (err) {
        showError('تعذر إرسال الطلب. تأكدي من الإنترنت وحاولي مرة أخرى.');
        if (window.console) console.error(err);
        finish();
      });
  }

  /* ---------- التشغيل ---------- */
  function init() {
    var list = $('cartItems');
    var form = $('orderForm');
    if (!list || !form) return;

    list.addEventListener('click', onListClick);
    form.addEventListener('submit', onSubmit);
    document.addEventListener('rm:cart-changed', render);

    render();

    /* مراجعة الأسعار والتوفر أول ما الصفحة تفتح */
    sync()
      .then(function (result) {
        if (result.removed.length) {
          RM.toast('تم حذف منتجات غير متوفرة من السلة.');
        }
        if (result.changed) render();
      })
      .catch(function () {
        /* لو النت ضعيف نسيب السلة زي ما هي، والمراجعة هتتكرر عند إتمام الطلب */
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* لو العميل رجع من واتساب بزر الرجوع */
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) render();
  });
})();
