/* =========================================
   R&M Store - وظائف لوحة الإدارة
   تسجيل الدخول، المنتجات، الأقسام، الطلبات، العملاء
   المفتاح هنا عام وآمن (Publishable)، والحماية الحقيقية
   في قواعد الصلاحيات داخل قاعدة البيانات.
   ========================================= */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://wdvihassltuldqfjqdrc.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_d6mgTM8N4NHtOmLEpjC4Gw_gk4P01YB';
  var BUCKET = 'product-images';
  var MAX_IMAGE = 5 * 1024 * 1024;
  var IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  var BASE_SLUGS = ['skin', 'hair', 'makeup', 'personal', 'accessories', 'offers'];
  var STATUS = {
    new: 'جديد',
    confirmed: 'تم التأكيد',
    shipped: 'تم الشحن',
    delivered: 'تم التسليم',
    cancelled: 'ملغي'
  };
  var TABS = ['dashboard', 'products', 'categories', 'orders', 'customers'];

  var state = {
    categories: [],
    products: [],
    orders: [],
    editingProduct: null,
    editingCategory: null,
    currentOrder: null,
    previewUrl: null
  };

  var db = null;
  try {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (e) {
    db = null;
  }

  /* ---------- أدوات صغيرة ---------- */
  function $(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function money(n) {
    return (Number(n) || 0).toLocaleString('en-US') + ' ج.م';
  }

  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return '';
    }
  }

  function waLink(phone) {
    var d = String(phone || '').replace(/\D/g, '');
    if (d.charAt(0) === '0') d = '20' + d.slice(1);
    return 'https://wa.me/' + d;
  }

  function showMsg(id, msg) {
    var el = $(id);
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
  }

  function hideMsg(id) {
    var el = $(id);
    if (!el) return;
    el.textContent = '';
    el.hidden = true;
  }

  function listError(el, err) {
    var msg = (err && err.message) ? err.message : 'حدث خطأ غير متوقع.';
    el.innerHTML = '<p class="loading-text">تعذر التحميل. ' + esc(msg) + '</p>';
  }

  function catName(slug) {
    for (var i = 0; i < state.categories.length; i++) {
      if (state.categories[i].slug === slug) return state.categories[i].name;
    }
    return slug;
  }

  function publicImage(path) {
    if (!path) return '../logo.png';
    if (/^https?:\/\//i.test(path)) return path;
    return SUPABASE_URL + '/storage/v1/object/public/' + BUCKET + '/' + path;
  }

  /* ---------- النوافذ المنبثقة ---------- */
  function openModal(id) {
    $(id).hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal(id) {
    $(id).hidden = true;
    var anyOpen = ['productModal', 'categoryModal', 'orderModal'].some(function (m) {
      return !$(m).hidden;
    });
    if (!anyOpen) document.body.style.overflow = '';
  }

  /* =========================================
     تسجيل الدخول والخروج
     ========================================= */
  async function verifyAdmin(user) {
    if (!user) return false;
    var res = await db.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
    return !res.error && !!res.data;
  }

  function showLogin() {
    $('adminApp').hidden = true;
    $('loginScreen').hidden = false;
    $('loginPass').value = '';
  }

  function enterApp() {
    $('loginScreen').hidden = true;
    $('adminApp').hidden = false;
    $('loginPass').value = '';
    switchTab('dashboard');
  }

  function loginMessage(err) {
    var m = (err && err.message) || '';
    if (/invalid login credentials/i.test(m)) return 'الإيميل أو كلمة السر غير صحيحة.';
    if (/email not confirmed/i.test(m)) return 'الحساب غير مؤكد. فعّلي Auto Confirm User من Supabase.';
    if (/rate limit|too many/i.test(m)) return 'محاولات كتيرة. استني شوية وجرّبي تاني.';
    return 'تعذر تسجيل الدخول. تأكدي من الإنترنت وحاولي تاني.';
  }

  async function onLogin(e) {
    e.preventDefault();
    hideMsg('loginError');
    if (!db) {
      showMsg('loginError', 'تعذر الاتصال بقاعدة البيانات. تأكدي من الإنترنت.');
      return;
    }
    var email = $('loginEmail').value.trim();
    var pass = $('loginPass').value;
    if (!email || !pass) {
      showMsg('loginError', 'اكتبي الإيميل وكلمة السر.');
      return;
    }
    var btn = $('loginBtn');
    btn.disabled = true;
    btn.textContent = 'جاري الدخول...';
    try {
      var res = await db.auth.signInWithPassword({ email: email, password: pass });
      if (res.error) {
        showMsg('loginError', loginMessage(res.error));
        return;
      }
      var ok = await verifyAdmin(res.data.user);
      if (!ok) {
        await db.auth.signOut();
        showMsg('loginError', 'هذا الحساب ليس له صلاحية الإدارة.');
        return;
      }
      enterApp();
    } catch (err) {
      showMsg('loginError', loginMessage(err));
    } finally {
      btn.disabled = false;
      btn.textContent = 'دخول';
    }
  }

  async function onLogout() {
    try {
      await db.auth.signOut();
    } catch (e) {}
    state.products = [];
    state.orders = [];
    showLogin();
  }

  /* =========================================
     التبويبات
     ========================================= */
  function switchTab(name) {
    var tabs = document.querySelectorAll('#adminTabs .tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab') === name);
    }
    TABS.forEach(function (t) {
      $('panel-' + t).hidden = t !== name;
    });
    if (name === 'dashboard') loadDashboard();
    else if (name === 'products') loadProducts();
    else if (name === 'categories') loadCategories();
    else if (name === 'orders') loadOrders();
    else if (name === 'customers') loadCustomers();
  }

  /* =========================================
     الأقسام (بيانات)
     ========================================= */
  async function fetchCategories() {
    var res = await db.from('categories').select('*').order('sort_order', { ascending: true });
    if (res.error) throw res.error;
    state.categories = res.data || [];
  }

  async function fetchOrders() {
    var res = await db
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (res.error) throw res.error;
    state.orders = res.data || [];
  }

  /* =========================================
     الإحصائيات
     ========================================= */
  async function loadDashboard() {
    try {
      var results = await Promise.all([
        fetchOrders(),
        db.from('products').select('id', { count: 'exact', head: true })
      ]);
      var pc = results[1];
      if (pc.error) throw pc.error;

      var sales = 0;
      var fresh = 0;
      state.orders.forEach(function (o) {
        if (o.status !== 'cancelled') sales += Number(o.total) || 0;
        if (o.status === 'new') fresh += 1;
      });

      $('statOrders').textContent = state.orders.length;
      $('statNew').textContent = fresh;
      $('statSales').textContent = money(sales);
      $('statProducts').textContent = pc.count || 0;
    } catch (err) {
      alert('تعذر تحميل الإحصائيات: ' + ((err && err.message) || ''));
    }
  }

  /* =========================================
     المنتجات
     ========================================= */
  async function loadProducts() {
    var box = $('productsList');
    box.innerHTML = '<p class="loading-text">جاري التحميل...</p>';
    try {
      await fetchCategories();
      var res = await db.from('products').select('*').order('created_at', { ascending: false });
      if (res.error) throw res.error;
      state.products = res.data || [];
      renderProducts();
    } catch (err) {
      listError(box, err);
    }
  }

  function renderProducts() {
    var box = $('productsList');
    if (!state.products.length) {
      box.innerHTML = '<p class="loading-text">لا توجد منتجات بعد. اضغطي "+ إضافة منتج" للبدء.</p>';
      return;
    }
    box.innerHTML = state.products
      .map(function (p) {
        var tags = '';
        if (p.in_stock === false) tags += '<span class="tag tag-out">غير متوفر</span>';
        if (p.is_featured) tags += '<span class="tag">مميز</span>';
        if (p.is_best_seller) tags += '<span class="tag">الأكثر مبيعًا</span>';
        if (p.is_offer) tags += '<span class="tag">عرض</span>';
        var old = Number(p.old_price) > Number(p.price)
          ? ' <small class="row-meta"><s>' + money(p.old_price) + '</s></small>'
          : '';
        var meta = [p.brand, catName(p.category_slug)].filter(Boolean).join(' · ');
        return (
          '<div class="row">' +
            '<img class="row-img" src="' + esc(publicImage(p.image_url)) + '" alt="" loading="lazy">' +
            '<div class="row-body">' +
              '<div class="row-title">' + esc(p.name) + '</div>' +
              '<div class="row-meta">' + esc(meta) + '</div>' +
              '<div><span class="row-price">' + money(p.price) + '</span>' + old + '</div>' +
              '<div>' + tags + '</div>' +
            '</div>' +
            '<div class="row-actions">' +
              '<button type="button" class="btn btn-small btn-outline" data-act="edit-product" data-id="' + p.id + '">تعديل</button>' +
              '<button type="button" class="btn btn-small btn-danger" data-act="del-product" data-id="' + p.id + '">حذف</button>' +
            '</div>' +
          '</div>'
        );
      })
      .join('');
  }

  function fillCategorySelect(selected) {
    var sel = $('pCategory');
    sel.innerHTML = state.categories
      .map(function (c) {
        return '<option value="' + esc(c.slug) + '">' + esc(c.name) + '</option>';
      })
      .join('');
    if (selected) sel.value = selected;
  }

  function resetPreview(path) {
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
      state.previewUrl = null;
    }
    $('pImageFile').value = '';
    $('pImagePreview').src = path ? publicImage(path) : '../logo.png';
  }

  function openProductModal(product) {
    hideMsg('productError');
    if (!state.categories.length) {
      alert('أضيفي قسمًا واحدًا على الأقل أولًا من تبويب الأقسام.');
      return;
    }
    state.editingProduct = product || null;
    $('productModalTitle').textContent = product ? 'تعديل منتج' : 'إضافة منتج';
    fillCategorySelect(product ? product.category_slug : '');

    $('pName').value = product ? product.name : '';
    $('pBrand').value = product ? product.brand || '' : '';
    $('pPrice').value = product ? product.price : '';
    $('pOldPrice').value = product && product.old_price != null ? product.old_price : '';
    $('pDesc').value = product ? product.description || '' : '';
    $('pInStock').checked = product ? product.in_stock !== false : true;
    $('pFeatured').checked = product ? !!product.is_featured : false;
    $('pBest').checked = product ? !!product.is_best_seller : false;
    $('pOffer').checked = product ? !!product.is_offer : false;
    resetPreview(product ? product.image_url : '');

    openModal('productModal');
  }

  function checkImage(file) {
    if (!IMAGE_TYPES[file.type]) return 'نوع الصورة غير مسموح. استخدمي JPG أو PNG أو WEBP.';
    if (file.size > MAX_IMAGE) return 'حجم الصورة أكبر من 5 ميجا.';
    return '';
  }

  function onImageChosen() {
    hideMsg('productError');
    var file = $('pImageFile').files[0];
    if (!file) {
      resetPreview(state.editingProduct ? state.editingProduct.image_url : '');
      return;
    }
    var problem = checkImage(file);
    if (problem) {
      showMsg('productError', problem);
      resetPreview(state.editingProduct ? state.editingProduct.image_url : '');
      return;
    }
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = URL.createObjectURL(file);
    $('pImagePreview').src = state.previewUrl;
  }

  async function removeImage(path) {
    if (!path || /^https?:\/\//i.test(path)) return;
    try {
      await db.storage.from(BUCKET).remove([path]);
    } catch (e) {}
  }

  async function onSaveProduct(e) {
    e.preventDefault();
    hideMsg('productError');

    var name = $('pName').value.trim();
    var brand = $('pBrand').value.trim();
    var category = $('pCategory').value;
    var priceText = $('pPrice').value.trim();
    var oldText = $('pOldPrice').value.trim();
    var desc = $('pDesc').value.trim();
    var price = Number(priceText);
    var oldPrice = oldText === '' ? null : Number(oldText);

    if (name.length < 2) return showMsg('productError', 'اكتبي اسم المنتج.');
    if (!category) return showMsg('productError', 'اختاري القسم.');
    if (priceText === '' || isNaN(price) || price < 0) return showMsg('productError', 'اكتبي السعر الحالي بشكل صحيح.');
    if (oldPrice !== null && (isNaN(oldPrice) || oldPrice <= price)) {
      return showMsg('productError', 'السعر القديم لازم يكون أعلى من السعر الحالي، أو سيبيه فاضي.');
    }

    var file = $('pImageFile').files[0];
    if (file) {
      var problem = checkImage(file);
      if (problem) return showMsg('productError', problem);
    }

    var editing = state.editingProduct;
    var btn = $('productSaveBtn');
    btn.disabled = true;
    btn.textContent = 'جاري الحفظ...';

    var oldPath = editing ? editing.image_url || '' : '';
    var imagePath = oldPath;
    var uploadedPath = '';

    try {
      if (file) {
        var ext = IMAGE_TYPES[file.type];
        uploadedPath = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
        var up = await db.storage.from(BUCKET).upload(uploadedPath, file, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false
        });
        if (up.error) {
          uploadedPath = '';
          throw up.error;
        }
        imagePath = uploadedPath;
      }

      var payload = {
        name: name,
        brand: brand,
        category_slug: category,
        price: price,
        old_price: oldPrice,
        description: desc,
        image_url: imagePath,
        in_stock: $('pInStock').checked,
        is_featured: $('pFeatured').checked,
        is_best_seller: $('pBest').checked,
        is_offer: $('pOffer').checked
      };

      var res;
      if (editing) {
        res = await db.from('products').update(payload).eq('id', editing.id).select('id');
      } else {
        res = await db.from('products').insert(payload).select('id');
      }
      if (res.error) throw res.error;
      if (!res.data || !res.data.length) throw new Error('لم يتم الحفظ. تأكدي إنك مسجلة دخول كمدير.');

      if (uploadedPath && oldPath && oldPath !== uploadedPath) removeImage(oldPath);

      closeModal('productModal');
      await loadProducts();
    } catch (err) {
      if (uploadedPath) removeImage(uploadedPath);
      showMsg('productError', 'تعذر الحفظ. ' + ((err && err.message) || ''));
    } finally {
      btn.disabled = false;
      btn.textContent = 'حفظ';
    }
  }

  async function deleteProduct(id) {
    var p = null;
    state.products.forEach(function (x) {
      if (x.id === id) p = x;
    });
    if (!p) return;
    if (!confirm('هتحذفي المنتج "' + p.name + '" نهائيًا؟')) return;
    try {
      var res = await db.from('products').delete().eq('id', id).select('id');
      if (res.error) throw res.error;
      if (!res.data || !res.data.length) throw new Error('لم يتم الحذف. تأكدي إنك مسجلة دخول كمدير.');
      removeImage(p.image_url);
      await loadProducts();
    } catch (err) {
      alert('تعذر الحذف: ' + ((err && err.message) || ''));
    }
  }

  /* =========================================
     الأقسام
     ========================================= */
  async function loadCategories() {
    var box = $('categoriesList');
    box.innerHTML = '<p class="loading-text">جاري التحميل...</p>';
    try {
      await fetchCategories();
      renderCategories();
    } catch (err) {
      listError(box, err);
    }
  }

  function renderCategories() {
    var box = $('categoriesList');
    if (!state.categories.length) {
      box.innerHTML = '<p class="loading-text">لا توجد أقسام.</p>';
      return;
    }
    box.innerHTML = state.categories
      .map(function (c) {
        var isBase = BASE_SLUGS.indexOf(c.slug) > -1;
        return (
          '<div class="row">' +
            '<div class="row-body">' +
              '<div class="row-title">' + esc(c.name) + '</div>' +
              '<div class="row-meta" dir="ltr" style="text-align:right">' + esc(c.slug) + ' · ترتيب ' + Number(c.sort_order) + '</div>' +
            '</div>' +
            '<div class="row-actions">' +
              '<button type="button" class="btn btn-small btn-outline" data-act="edit-category" data-slug="' + esc(c.slug) + '">تعديل</button>' +
              (isBase ? '' : '<button type="button" class="btn btn-small btn-danger" data-act="del-category" data-slug="' + esc(c.slug) + '">حذف</button>') +
            '</div>' +
          '</div>'
        );
      })
      .join('');
  }

  function openCategoryModal(cat) {
    hideMsg('categoryError');
    state.editingCategory = cat || null;
    $('categoryModalTitle').textContent = cat ? 'تعديل قسم' : 'إضافة قسم';
    $('cName').value = cat ? cat.name : '';
    $('cSlug').value = cat ? cat.slug : '';
    $('cSlug').disabled = !!cat;
    $('cOrder').value = cat ? cat.sort_order : state.categories.length + 1;
    openModal('categoryModal');
  }

  async function onSaveCategory(e) {
    e.preventDefault();
    hideMsg('categoryError');

    var name = $('cName').value.trim();
    var slug = $('cSlug').value.trim().toLowerCase();
    var order = parseInt($('cOrder').value, 10);
    if (isNaN(order) || order < 0) order = 0;

    if (name.length < 2) return showMsg('categoryError', 'اكتبي اسم القسم.');
    if (!state.editingCategory && !/^[a-z0-9-]{1,40}$/.test(slug)) {
      return showMsg('categoryError', 'الرمز لازم يكون حروف إنجليزية صغيرة وأرقام وشرطة فقط، بدون مسافات.');
    }

    var btn = $('categorySaveBtn');
    btn.disabled = true;
    btn.textContent = 'جاري الحفظ...';
    try {
      var res;
      if (state.editingCategory) {
        res = await db
          .from('categories')
          .update({ name: name, sort_order: order })
          .eq('slug', state.editingCategory.slug)
          .select('slug');
      } else {
        res = await db
          .from('categories')
          .insert({ slug: slug, name: name, sort_order: order })
          .select('slug');
      }
      if (res.error) throw res.error;
      if (!res.data || !res.data.length) throw new Error('لم يتم الحفظ. تأكدي إنك مسجلة دخول كمدير.');
      closeModal('categoryModal');
      await loadCategories();
    } catch (err) {
      if (err && err.code === '23505') {
        showMsg('categoryError', 'الرمز ده مستخدم قبل كده. اختاري رمزًا تانيًا.');
      } else {
        showMsg('categoryError', 'تعذر الحفظ. ' + ((err && err.message) || ''));
      }
    } finally {
      btn.disabled = false;
      btn.textContent = 'حفظ';
    }
  }

  async function deleteCategory(slug) {
    if (BASE_SLUGS.indexOf(slug) > -1) return;
    if (!confirm('هتحذفي القسم "' + catName(slug) + '"؟')) return;
    try {
      var res = await db.from('categories').delete().eq('slug', slug).select('slug');
      if (res.error) throw res.error;
      if (!res.data || !res.data.length) throw new Error('لم يتم الحذف. تأكدي إنك مسجلة دخول كمدير.');
      await loadCategories();
    } catch (err) {
      if (err && err.code === '23503') {
        alert('لا يمكن حذف قسم فيه منتجات. انقلي المنتجات لقسم تاني أو احذفيها أولًا.');
      } else {
        alert('تعذر الحذف: ' + ((err && err.message) || ''));
      }
    }
  }

  /* =========================================
     الطلبات
     ========================================= */
  async function loadOrders() {
    var box = $('ordersList');
    box.innerHTML = '<p class="loading-text">جاري التحميل...</p>';
    try {
      await fetchOrders();
      renderOrders();
    } catch (err) {
      listError(box, err);
    }
  }

  function renderOrders() {
    var box = $('ordersList');
    var filter = $('orderFilter').value;
    var list = state.orders.filter(function (o) {
      return filter === 'all' || o.status === filter;
    });
    if (!list.length) {
      box.innerHTML = '<p class="loading-text">لا توجد طلبات.</p>';
      return;
    }
    box.innerHTML = list
      .map(function (o) {
        return (
          '<div class="row">' +
            '<div class="row-body">' +
              '<div class="row-title">طلب #' + o.id + ' · ' + esc(o.customer_name) + '</div>' +
              '<div class="row-meta">' + esc(fmtDate(o.created_at)) + ' · <span dir="ltr">' + esc(o.customer_phone) + '</span></div>' +
              '<div><span class="row-price">' + money(o.total) + '</span> ' +
                '<span class="status status-' + esc(o.status) + '">' + esc(STATUS[o.status] || o.status) + '</span></div>' +
            '</div>' +
            '<div class="row-actions">' +
              '<button type="button" class="btn btn-small btn-outline" data-act="view-order" data-id="' + o.id + '">تفاصيل</button>' +
            '</div>' +
          '</div>'
        );
      })
      .join('');
  }

  function openOrder(id) {
    var o = null;
    state.orders.forEach(function (x) {
      if (x.id === id) o = x;
    });
    if (!o) return;
    state.currentOrder = o;
    $('orderModalTitle').textContent = 'طلب #' + o.id;

    var items = Array.isArray(o.items) ? o.items : [];
    var itemsHtml = items
      .map(function (it) {
        var line = (Number(it.price) || 0) * (Number(it.qty) || 0);
        return (
          '<div class="detail-line"><span>' + esc(it.name) + ' × ' + Number(it.qty) + '</span>' +
          '<span>' + money(line) + '</span></div>'
        );
      })
      .join('');

    var options = Object.keys(STATUS)
      .map(function (k) {
        return '<option value="' + k + '"' + (k === o.status ? ' selected' : '') + '>' + STATUS[k] + '</option>';
      })
      .join('');

    $('orderModalBody').innerHTML =
      '<div class="detail-block">' +
        '<h4>بيانات العميل</h4>' +
        '<div class="detail-line"><span>الاسم</span><span>' + esc(o.customer_name) + '</span></div>' +
        '<div class="detail-line"><span>الموبايل</span><span dir="ltr">' + esc(o.customer_phone) + '</span></div>' +
        '<div class="detail-line"><span>العنوان</span><span>' + esc(o.customer_address) + '</span></div>' +
        (o.notes ? '<div class="detail-line"><span>ملاحظات</span><span>' + esc(o.notes) + '</span></div>' : '') +
        '<div class="detail-line"><span>التاريخ</span><span>' + esc(fmtDate(o.created_at)) + '</span></div>' +
      '</div>' +
      '<div class="detail-block">' +
        '<h4>المنتجات</h4>' + itemsHtml +
        '<div class="detail-line detail-total"><span>الإجمالي</span><span>' + money(o.total) + '</span></div>' +
      '</div>' +
      '<label class="field"><span>حالة الطلب</span>' +
        '<select id="orderStatusSelect">' + options + '</select>' +
      '</label>' +
      '<p class="form-error" id="orderModalError" role="alert" hidden></p>' +
      '<div class="modal-actions">' +
        '<button type="button" class="btn btn-dark" data-act="save-status">حفظ الحالة</button>' +
        '<a class="btn btn-outline" href="' + esc(waLink(o.customer_phone)) + '" target="_blank" rel="noopener">واتساب العميل</a>' +
      '</div>' +
      '<div class="modal-actions">' +
        '<button type="button" class="btn btn-danger" data-act="del-order">حذف الطلب</button>' +
      '</div>';

    openModal('orderModal');
  }

  async function saveStatus() {
    var o = state.currentOrder;
    if (!o) return;
    hideMsg('orderModalError');
    var status = $('orderStatusSelect').value;
    try {
      var res = await db.from('orders').update({ status: status }).eq('id', o.id).select('id');
      if (res.error) throw res.error;
      if (!res.data || !res.data.length) throw new Error('لم يتم التحديث. تأكدي إنك مسجلة دخول كمدير.');
      closeModal('orderModal');
      await loadOrders();
    } catch (err) {
      showMsg('orderModalError', 'تعذر الحفظ. ' + ((err && err.message) || ''));
    }
  }

  async function deleteOrder() {
    var o = state.currentOrder;
    if (!o) return;
    if (!confirm('هتحذفي الطلب #' + o.id + ' نهائيًا؟ ده هيتشال من الإحصائيات كمان.')) return;
    try {
      var res = await db.from('orders').delete().eq('id', o.id).select('id');
      if (res.error) throw res.error;
      if (!res.data || !res.data.length) throw new Error('لم يتم الحذف. تأكدي إنك مسجلة دخول كمدير.');
      closeModal('orderModal');
      await loadOrders();
    } catch (err) {
      showMsg('orderModalError', 'تعذر الحذف. ' + ((err && err.message) || ''));
    }
  }

  /* =========================================
     العملاء (مجمّعين من الطلبات برقم الموبايل)
     ========================================= */
  async function loadCustomers() {
    var box = $('customersList');
    box.innerHTML = '<p class="loading-text">جاري التحميل...</p>';
    try {
      await fetchOrders();
      var map = {};
      var order = [];
      state.orders.forEach(function (o) {
        var key = o.customer_phone;
        if (!map[key]) {
          map[key] = {
            name: o.customer_name,
            phone: o.customer_phone,
            address: o.customer_address,
            orders: 0,
            spent: 0
          };
          order.push(key);
        }
        map[key].orders += 1;
        if (o.status !== 'cancelled') map[key].spent += Number(o.total) || 0;
      });

      if (!order.length) {
        box.innerHTML = '<p class="loading-text">لا يوجد عملاء بعد.</p>';
        return;
      }

      box.innerHTML = order
        .map(function (k) {
          var c = map[k];
          return (
            '<div class="row">' +
              '<div class="row-body">' +
                '<div class="row-title">' + esc(c.name) + '</div>' +
                '<div class="row-meta"><span dir="ltr">' + esc(c.phone) + '</span></div>' +
                '<div class="row-meta">' + esc(c.address) + '</div>' +
                '<div class="row-meta">عدد الطلبات: ' + c.orders + ' · إجمالي المشتريات: <span class="row-price">' + money(c.spent) + '</span></div>' +
              '</div>' +
              '<div class="row-actions">' +
                '<a class="btn btn-small btn-outline" href="' + esc(waLink(c.phone)) + '" target="_blank" rel="noopener">واتساب</a>' +
              '</div>' +
            '</div>'
          );
        })
        .join('');
    } catch (err) {
      listError(box, err);
    }
  }

  /* =========================================
     التشغيل
     ========================================= */
  function bind() {
    $('loginForm').addEventListener('submit', onLogin);
    $('logoutBtn').addEventListener('click', onLogout);

    $('adminTabs').addEventListener('click', function (e) {
      var tab = e.target.closest('.tab');
      if (tab) switchTab(tab.getAttribute('data-tab'));
    });

    $('addProductBtn').addEventListener('click', function () {
      openProductModal(null);
    });
    $('addCategoryBtn').addEventListener('click', function () {
      openCategoryModal(null);
    });
    $('orderFilter').addEventListener('change', renderOrders);

    $('productForm').addEventListener('submit', onSaveProduct);
    $('categoryForm').addEventListener('submit', onSaveCategory);
    $('pImageFile').addEventListener('change', onImageChosen);

    /* أزرار القوائم */
    $('productsList').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      var id = Number(btn.getAttribute('data-id'));
      var act = btn.getAttribute('data-act');
      if (act === 'edit-product') {
        state.products.forEach(function (p) {
          if (p.id === id) openProductModal(p);
        });
      } else if (act === 'del-product') {
        deleteProduct(id);
      }
    });

    $('categoriesList').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      var slug = btn.getAttribute('data-slug');
      var act = btn.getAttribute('data-act');
      if (act === 'edit-category') {
        state.categories.forEach(function (c) {
          if (c.slug === slug) openCategoryModal(c);
        });
      } else if (act === 'del-category') {
        deleteCategory(slug);
      }
    });

    $('ordersList').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act="view-order"]');
      if (btn) openOrder(Number(btn.getAttribute('data-id')));
    });

    $('orderModalBody').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      var act = btn.getAttribute('data-act');
      if (act === 'save-status') saveStatus();
      else if (act === 'del-order') deleteOrder();
    });

    /* إغلاق النوافذ: زر الإغلاق / الإلغاء / الضغط على الخلفية */
    document.addEventListener('click', function (e) {
      var closer = e.target.closest('[data-close]');
      if (closer) {
        closeModal(closer.getAttribute('data-close'));
        return;
      }
      if (e.target.classList && e.target.classList.contains('modal')) {
        closeModal(e.target.id);
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        ['productModal', 'categoryModal', 'orderModal'].forEach(function (m) {
          if (!$(m).hidden) closeModal(m);
        });
      }
    });
  }

  async function init() {
    bind();
    if (!db) {
      showMsg('loginError', 'تعذر تحميل مكتبة قاعدة البيانات. تأكدي من الإنترنت وحدّثي الصفحة.');
      return;
    }
    try {
      var s = await db.auth.getSession();
      var session = s && s.data && s.data.session;
      if (session && (await verifyAdmin(session.user))) {
        enterApp();
        return;
      }
      if (session) await db.auth.signOut();
    } catch (e) {}
    showLogin();
  }

  init();
})();
