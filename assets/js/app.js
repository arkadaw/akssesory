/* تعاملات فرانت‌اند فروشگاه (بدون وابستگی خارجی)
   توجه: سبد خرید در این نسخه طراحی در مرورگر نگهداری می‌شود (localStorage) و قیمت/موجودی
   همیشه از کاتالوگ (data.js) خوانده می‌شود، نه از داده ذخیره‌شده. در نسخه واقعی، همین کارها سمت سرور انجام می‌شود. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var fa = function (n) { return Number(n).toLocaleString('fa-IR').replace(/٬/g, ','); };
  var money = fa;
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var icon = function (n) { return '<svg class="i" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CAT = window.SHOP_CATALOG || {};
  var LS = 'shop_cart_v1';
  var onCartPage = /cart\.html$/.test(location.pathname);

  /* ---------- کاتالوگ ---------- */
  function hasVars(p) { return !!(p.variants && p.variants.length); }
  function findVar(p, v) { for (var i = 0; i < (p.variants || []).length; i++) if (p.variants[i].id === v) return p.variants[i]; return null; }
  function resolve(id, v) {
    var p = CAT[id]; if (!p) return null;
    if (hasVars(p)) {
      var vv = findVar(p, v); if (!vv) return null;
      return { p: p, v: vv, price: vv.price, old: vv.old || 0, stock: vv.stock, img: vv.images[0] };
    }
    return { p: p, v: null, price: p.price, old: p.old || 0, stock: p.stock, img: p.images[0] };
  }

  /* ---------- وضعیت مشترک سبد ---------- */
  var mem = null;
  var Cart = {
    items: [],
    load: function () {
      var raw = [];
      try { raw = JSON.parse((localStorage.getItem(LS)) || '[]'); } catch (e) { raw = mem || []; }
      if (!Array.isArray(raw)) raw = [];
      this.items = raw.map(function (x) {
        var f = resolve(String(x.id), x.v || ''); if (!f || f.stock < 1) return null;
        return { id: String(x.id), v: x.v || '', q: Math.min(Math.max(parseInt(x.q, 10) || 1, 1), f.stock) };
      }).filter(Boolean);
    },
    save: function () { mem = this.items; try { localStorage.setItem(LS, JSON.stringify(this.items)); } catch (e) { /* حالت خصوصی مرورگر */ } },
    get: function (id, v) { for (var i = 0; i < this.items.length; i++) if (this.items[i].id === String(id) && this.items[i].v === (v || '')) return this.items[i]; return null; },
    emit: function () { document.dispatchEvent(new CustomEvent('shop:cart')); },
    add: function (id, v, q) {
      var self = this;
      return new Promise(function (res, rej) {
        setTimeout(function () {
          if (window.SHOP_FAIL) return rej({ code: 'net', msg: 'اتصال برقرار نشد. دوباره تلاش کنید.' });
          var p = CAT[id];
          if (!p) return rej({ code: 'bad', msg: 'این محصول پیدا نشد.' });
          if (hasVars(p) && !v) return rej({ code: 'var', msg: 'لطفاً رنگ مورد نظر را انتخاب کنید.' });
          var f = resolve(id, v);
          if (!f) return rej({ code: 'bad', msg: 'تنوع انتخاب‌شده معتبر نیست.' });
          if (f.stock < 1) return rej({ code: 'out', msg: 'این محصول ناموجود است.' });
          q = Math.max(1, parseInt(q, 10) || 1);
          var it = self.get(id, v), cur = it ? it.q : 0;
          if (cur >= f.stock) return rej({ code: 'max', msg: 'حداکثر موجودی این محصول قبلاً در سبد شما قرار گرفته است.' });
          var want = cur + q, capped = want > f.stock;
          want = Math.min(want, f.stock);
          if (it) it.q = want; else self.items.push({ id: String(id), v: v || '', q: want });
          self.save(); self.emit();
          res({ capped: capped });
        }, 280);
      });
    },
    setQty: function (id, v, q) {
      var it = this.get(id, v); if (!it) return { ok: false };
      var f = resolve(id, v);
      if (q < 1) { this.remove(id, v); return { ok: true }; }
      var capped = f && q > f.stock;
      it.q = f ? Math.min(q, f.stock) : q;
      this.save(); this.emit();
      return { ok: true, capped: capped };
    },
    remove: function (id, v) { this.items = this.items.filter(function (x) { return !(x.id === String(id) && x.v === (v || '')); }); this.save(); this.emit(); },
    lines: function () {
      return this.items.map(function (x) {
        var f = resolve(x.id, x.v); if (!f) return null;
        return { id: x.id, v: x.v, q: x.q, p: f.p, variant: f.v, price: f.price, old: f.old, stock: f.stock, img: f.img, total: f.price * x.q };
      }).filter(Boolean);
    },
    totals: function () {
      var t = { count: 0, orig: 0, pay: 0, disc: 0 };
      this.lines().forEach(function (l) { t.count += l.q; t.pay += l.price * l.q; t.orig += (l.old > l.price ? l.old : l.price) * l.q; });
      t.disc = t.orig - t.pay; return t;
    }
  };
  Cart.load();
  window.ShopCart = Cart;

  /* ---------- قالب‌ها ---------- */
  function key(l) { return l.id + '|' + l.v; }
  function lineHTML(l) {
    var url = 'product.html?id=' + esc(l.id);
    return '<li class="citem" data-key="' + esc(key(l)) + '">' +
      '<a class="cth" href="' + url + '"><img src="' + esc(l.img) + '" alt="" width="72" height="72"></a>' +
      '<div class="cmain"><a class="cname" href="' + url + '">' + esc(l.p.name) + '</a>' +
      (l.variant ? '<span class="cvar"><i class="dot" style="background:' + esc(l.variant.color) + '"></i>' + esc(l.variant.label) + '</span>' : '') +
      '<div class="cprice">' + (l.old > l.price ? '<del>' + money(l.old) + '</del>' : '') + '<b>' + money(l.price) + '</b> تومان</div>' +
      '<div class="cctl"><div class="qty sm" role="group" aria-label="تعداد ' + esc(l.p.name) + '">' +
      '<button type="button" data-act="dec" aria-label="کاهش تعداد">−</button><span class="qv" aria-live="polite">' + fa(l.q) + '</span>' +
      '<button type="button" data-act="inc" aria-label="افزایش تعداد"' + (l.q >= l.stock ? ' disabled' : '') + '>+</button></div>' +
      '<b class="ctot">' + money(l.total) + ' تومان</b></div>' +
      (l.q >= l.stock ? '<small class="cmax">حداکثر موجودی</small>' : '') + '</div>' +
      '<button class="rm" type="button" data-act="rm" aria-label="حذف ' + esc(l.p.name) + ' از سبد">' + icon('trash') + '</button></li>';
  }
  function sumHTML(t) {
    return '<h3 style="margin-bottom:6px">خلاصه سفارش</h3>' +
      '<div class="row"><span>جمع محصولات (' + fa(t.count) + ' عدد)</span><span>' + money(t.orig) + ' تومان</span></div>' +
      (t.disc > 0 ? '<div class="row save"><span>تخفیف</span><span>−' + money(t.disc) + ' تومان</span></div>' : '') +
      '<div class="row note"><span>هزینه ارسال</span><span>در مرحله بعد محاسبه می‌شود</span></div>' +
      '<div class="row t"><span>مبلغ اقلام</span><span>' + money(t.pay) + ' تومان</span></div>';
  }
  function emptyHTML() {
    return '<div class="cempty"><span class="ic">' + icon('cart') + '</span><p>سبد خرید شما خالی است</p><a class="btn" href="category.html">مشاهده محصولات</a></div>';
  }
  function bindList(root) {
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var li = b.closest('[data-key]'); if (!li) return;
      var k = li.dataset.key.split('|'), id = k[0], v = k[1] || '', it = Cart.get(id, v); if (!it) return;
      if (b.dataset.act === 'rm') Cart.remove(id, v);
      else if (b.dataset.act === 'dec') Cart.setQty(id, v, it.q - 1);
      else if (b.dataset.act === 'inc') { var r = Cart.setQty(id, v, it.q + 1); if (r.capped) toast('به حداکثر موجودی رسیدید.'); }
    });
  }

  /* ---------- نشان تعداد ---------- */
  function renderBadges() {
    var n = Cart.totals().count;
    $$('[data-cart-badge]').forEach(function (b) { b.textContent = fa(n); b.hidden = n === 0; });
  }

  /* ---------- پیام کوتاه ---------- */
  var toastEl = $('[data-toast]'), toastT;
  function toast(msg, retry) {
    if (!toastEl) return;
    toastEl.innerHTML = '<span>' + esc(msg) + '</span>' + (retry ? '<button type="button" data-retry>تلاش مجدد</button>' : '');
    toastEl.classList.add('show');
    var rb = $('[data-retry]', toastEl);
    if (rb) rb.onclick = function () { toastEl.classList.remove('show'); retry(); };
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, retry ? 9000 : 4500);
  }

  /* ---------- سبد کشویی ---------- */
  var cd = $('[data-cdrawer]'), cbody = $('[data-cbody]'), cfoot = $('[data-cfoot]'), ccount = $('[data-ccount]'), lastFocus = null;
  function renderDrawer() {
    if (!cd) return;
    var lines = Cart.lines(), t = Cart.totals();
    ccount.textContent = t.count ? fa(t.count) + ' کالا' : '';
    if (!lines.length) { cbody.innerHTML = emptyHTML(); cfoot.hidden = true; cfoot.innerHTML = ''; return; }
    var top = cbody.scrollTop;
    cbody.innerHTML = '<ul class="clist">' + lines.map(lineHTML).join('') + '</ul>';
    cbody.scrollTop = top;
    cfoot.hidden = false;
    cfoot.innerHTML = '<div class="sum">' + sumHTML(t).replace('<h3 style="margin-bottom:6px">خلاصه سفارش</h3>', '') + '</div>' +
      '<a class="btn block" href="checkout.html">ادامه ثبت سفارش</a>' +
      '<div class="alt"><a class="btn ghost" href="cart.html">مشاهده سبد خرید</a><button class="btn ghost" type="button" data-cclose>ادامه خرید</button></div>';
  }
  function lock(on) {
    var de = document.documentElement;
    if (on) { de.style.setProperty('--sbw', (window.innerWidth - de.clientWidth) + 'px'); de.classList.add('lock'); }
    else { de.classList.remove('lock'); de.style.removeProperty('--sbw'); }
  }
  function openCart(opener) {
    if (!cd) return;
    lastFocus = opener || document.activeElement;
    renderDrawer();
    cd.classList.add('open'); cd.setAttribute('aria-hidden', 'false'); lock(true);
    var panel = $('.cpanel', cd);
    setTimeout(function () { var x = $('.cx', cd); (x || panel).focus(); }, reduce ? 0 : 30);
  }
  function closeCart() {
    if (!cd || !cd.classList.contains('open')) return;
    cd.classList.remove('open'); cd.setAttribute('aria-hidden', 'true'); lock(false);
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { } }
  }
  if (cd) {
    bindList(cbody);
    cd.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = $$('a[href],button:not([disabled])', $('.cpanel', cd)).filter(function (x) { return x.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* ---------- افزودن به سبد (یکپارچه برای همه جاها) ---------- */
  var busy = false;
  function setLoading(btns, on) {
    btns.forEach(function (b) {
      b.classList.toggle('loading', on);
      if (on) { b.dataset.was = b.disabled ? '1' : ''; b.disabled = true; var l = $('[data-addlabel]', b); if (l) { b.dataset.lbl = l.textContent; l.textContent = 'در حال افزودن…'; } }
      else { b.disabled = b.dataset.was === '1'; var l2 = $('[data-addlabel]', b); if (l2 && b.dataset.lbl) l2.textContent = b.dataset.lbl; }
    });
  }
  function doAdd(btns, id, v, q, opener) {
    if (busy) return;
    busy = true; setLoading(btns, true);
    Cart.add(id, v, q).then(function (r) {
      busy = false; setLoading(btns, false);
      openCart(opener);
      if (r.capped) toast('فقط به اندازه موجودی به سبد اضافه شد.');
      document.dispatchEvent(new CustomEvent('shop:added'));
    }).catch(function (e) {
      busy = false; setLoading(btns, false);
      toast(e && e.msg ? e.msg : 'افزودن به سبد انجام نشد.', e && e.code === 'net' ? function () { doAdd(btns, id, v, q, opener); } : null);
      if (e && e.code === 'var') document.dispatchEvent(new CustomEvent('shop:needvar'));
    });
  }

  /* ---------- رویدادهای سراسری ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target;
    var add = t.closest('[data-add]');
    if (add) { e.preventDefault(); doAdd([add], add.dataset.add, '', 1, add); return; }
    var op = t.closest('[data-cart-open]');
    if (op && cd && !onCartPage) { e.preventDefault(); openCart(op); return; }
    if (t.closest('[data-cclose]')) { closeCart(); return; }
    var w = t.closest('.wish'); if (w) { e.preventDefault(); w.classList.toggle('on'); return; }
    var tb = t.closest('.tabs [data-tab]');
    if (tb) {
      $$('.tabs [data-tab]').forEach(function (x) { x.classList.toggle('on', x === tb); });
      $$('.tabpane').forEach(function (p) { p.classList.toggle('on', p.id === tb.dataset.tab); });
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var lb = $('.lbx'); if (lb) { lb.remove(); return; }
    if (cd && cd.classList.contains('open')) { closeCart(); return; }
    var menu = $('.drawer'); if (menu) menu.classList.remove('open');
  });
  document.addEventListener('shop:cart', function () { renderBadges(); renderDrawer(); renderPages(); });
  window.addEventListener('storage', function (e) { if (e.key === LS) { Cart.load(); Cart.emit(); } });

  /* ---------- صفحه سبد و تسویه ---------- */
  function renderPages() {
    var cp = $('[data-cartpage]');
    if (cp) {
      var lines = Cart.lines(), t = Cart.totals(), has = lines.length > 0;
      $('[data-cp-empty]').hidden = has; $('[data-cp-full]').hidden = !has;
      if (has) {
        $('[data-cp-list]').innerHTML = lines.map(lineHTML).join('');
        $('[data-cp-sum]').innerHTML = sumHTML(t) + '<a class="btn block" style="margin-top:14px" href="checkout.html">ادامه ثبت سفارش</a><a class="btn ghost block" style="margin-top:8px" href="category.html">ادامه خرید</a>';
      }
    }
    var co = $('[data-checkout]');
    if (co) {
      var ls = Cart.lines(), tt = Cart.totals(), h2 = ls.length > 0;
      $('[data-co-empty]').hidden = h2; $('[data-co-full]').hidden = !h2;
      if (h2) {
        $('[data-co-sum]').innerHTML = '<h3>خلاصه سفارش</h3>' + ls.map(function (l) {
          return '<div class="mini"><span class="th" style="margin:0"><img src="' + esc(l.img) + '" alt="" width="46" height="46"></span><div>' + esc(l.p.name) +
            (l.variant ? '<br><small>' + esc(l.variant.label) + '</small>' : '') + '<br><small>تعداد: ' + fa(l.q) + '</small></div><span>' + money(l.total) + ' تومان</span></div>';
        }).join('') + sumHTML(tt).replace('<h3 style="margin-bottom:6px">خلاصه سفارش</h3>', '') + '<button class="btn block" type="submit" style="margin-top:12px">ادامه و پرداخت</button>';
      }
    }
  }
  var cpl = $('[data-cp-list]'); if (cpl) bindList(cpl);

  /* ---------- صفحه محصول ---------- */
  var pdp = $('[data-pdp]');
  function cardHTML(p) {
    var st = p.stock, hv = hasVars(p);
    if (hv) st = Math.max.apply(null, p.variants.map(function (v) { return v.stock; }));
    var price = hv ? p.variants[0].price : p.price, old = hv ? (p.variants[0].old || 0) : (p.old || 0);
    var off = old > price ? Math.round((old - price) * 100 / old) : 0;
    var btn = hv ? '<a class="cartbtn" href="product.html?id=' + p.id + '" aria-label="انتخاب رنگ ' + esc(p.name) + '">' + icon('cart') + '</a>'
      : '<button class="cartbtn" type="button" data-add="' + p.id + '" aria-label="افزودن ' + esc(p.name) + ' به سبد خرید">' + icon('cart') + '</button>';
    return '<article class="pcard">' + (off ? '<span class="tag">' + fa(off) + '٪</span>' : '') +
      '<a href="product.html?id=' + p.id + '" class="pic"><img src="' + esc(p.images[0]) + '" alt="' + esc(p.name) + '" loading="lazy" width="200" height="200"></a>' +
      '<h3><a href="product.html?id=' + p.id + '">' + esc(p.name) + '</a></h3>' +
      '<div class="price">' + (off ? '<del>' + money(old) + '</del>' : '') + '<b>' + money(price) + '</b><small>تومان</small></div>' +
      (st > 0 ? '<div class="pfoot"><span class="stars" aria-hidden="true">★★★★☆</span>' + btn + '</div>' : '<div class="pfoot"><span class="out">ناموجود</span></div>') + '</article>';
  }
  function initPdp() {
    var id = new URLSearchParams(location.search).get('id') || '1';
    var p = CAT[id];
    if (!p) { pdp.innerHTML = '<div class="cempty"><p>محصول مورد نظر پیدا نشد.</p><a class="btn" href="category.html">مشاهده محصولات</a></div>'; return; }
    var hv = hasVars(p), sel = '', idx = 0;
    var el = function (s) { return $(s, pdp); };
    var mainBtns = $$('[data-add-main]');
    var qtyIn = el('[data-pqty]'), mainImg = $('#mainpic'), thumbs = el('[data-thumbs]');
    el('[data-name]').textContent = p.name; el('[data-sku]').textContent = 'کد محصول: ' + ((window.SITE && SITE.skuPrefix) || '') + String(1000 + Number(p.id)).replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[d]; });
    $('[data-crumb-name]').textContent = p.name; document.title = p.name + ' | ' + ((window.SITE && SITE.name) || '');

    function cur() { return hv ? findVar(p, sel) : { price: p.price, old: p.old || 0, stock: p.stock, images: p.images }; }
    function render() {
      var v = cur(), imgs = v ? v.images : (hv ? p.variants[0].images : p.images);
      if (idx >= imgs.length) idx = 0;
      mainImg.src = imgs[idx]; mainImg.alt = p.name + (v && v.label ? ' — ' + v.label : '');
      thumbs.innerHTML = imgs.length > 1 ? imgs.map(function (s, i) { return '<button type="button" class="' + (i === idx ? 'on' : '') + '" data-ti="' + i + '" aria-label="تصویر ' + fa(i + 1) + '"><img src="' + esc(s) + '" alt="" width="60" height="60"></button>'; }).join('') : '';
      thumbs.style.display = imgs.length > 1 ? '' : 'none';
      var price, old = 0, prefix = '', stockTxt, stockCls = '', canBuy = true, label = 'افزودن به سبد خرید', max = 1;
      if (v) {
        price = v.price; old = v.old || 0; max = v.stock;
        if (v.stock < 1) { stockTxt = 'ناموجود'; stockCls = 'out'; canBuy = false; label = 'ناموجود'; }
        else if (v.stock <= 3) { stockTxt = 'تنها ' + fa(v.stock) + ' عدد در انبار باقی مانده است'; stockCls = 'low'; }
        else stockTxt = 'موجود در انبار';
      } else {
        var live = p.variants.filter(function (x) { return x.stock > 0; });
        if (!live.length) { price = p.variants[0].price; stockTxt = 'ناموجود'; stockCls = 'out'; canBuy = false; label = 'ناموجود'; }
        else { price = Math.min.apply(null, live.map(function (x) { return x.price; })); prefix = 'از '; stockTxt = 'برای مشاهده موجودی، رنگ را انتخاب کنید'; }
        max = 1;
      }
      var off = old > price ? Math.round((old - price) * 100 / old) : 0;
      el('[data-price]').textContent = prefix + money(price) + ' تومان';
      var od = el('[data-old]'); od.hidden = !off; od.textContent = off ? money(old) : '';
      var of = el('[data-off]'); of.hidden = !off; of.textContent = off ? fa(off) + '٪' : '';
      var st = el('[data-stock]'); st.className = 'stock ' + stockCls; st.innerHTML = (stockCls === '' && v ? icon('check') + ' ' : '') + esc(stockTxt);
      $$('[data-sprice]').forEach(function (n) { n.textContent = prefix + money(price) + ' تومان'; });
      $$('[data-sold]').forEach(function (n) { n.hidden = !off; n.textContent = off ? money(old) : ''; });
      qtyIn.max = Math.max(1, max); if (Number(qtyIn.value) > Math.max(1, max)) qtyIn.value = Math.max(1, max);
      $$('button', qtyIn.parentNode).forEach(function (b) { b.disabled = !canBuy; }); qtyIn.disabled = !canBuy;
      mainBtns.forEach(function (b) { b.disabled = !canBuy; var l = $('[data-addlabel]', b); if (l) l.textContent = label; });
      if (hv) {
        el('[data-variants]').hidden = false;
        el('[data-vlabel]').textContent = sel ? findVar(p, sel).label : 'انتخاب نشده';
        el('[data-vopts]').innerHTML = p.variants.map(function (x) {
          var on = x.id === sel, out = x.stock < 1;
          return '<button type="button" role="radio" aria-checked="' + on + '" class="vopt' + (on ? ' on' : '') + '" data-v="' + esc(x.id) + '"' + (out ? ' disabled' : '') + '>' +
            '<span class="vsw" style="background:' + esc(x.color) + '"></span><span class="vn">' + esc(x.label) + '</span>' + (out ? '<small>ناموجود</small>' : '') + icon('check').replace('class="i"', 'class="i vck"') + '</button>';
        }).join('');
      }
    }
    el('[data-vopts]').addEventListener('click', function (e) {
      var b = e.target.closest('[data-v]'); if (!b || b.disabled) return;
      sel = b.dataset.v; idx = 0; el('[data-verr]').hidden = true; el('[data-variants]').classList.remove('attn'); qtyIn.value = 1; render();
      var nb = $('[data-v="' + sel + '"]', pdp); if (nb) nb.focus();
    });
    thumbs.addEventListener('click', function (e) { var b = e.target.closest('[data-ti]'); if (b) { idx = Number(b.dataset.ti); render(); } });
    el('[data-zoom]').addEventListener('click', function () {
      var d = document.createElement('div'); d.className = 'lbx'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'تصویر بزرگ');
      d.innerHTML = '<button type="button" aria-label="بستن">' + icon('close') + '</button><img src="' + esc(mainImg.src) + '" alt="' + esc(mainImg.alt) + '">';
      d.addEventListener('click', function () { d.remove(); }); document.body.appendChild(d); $('button', d).focus();
    });
    document.addEventListener('shop:needvar', needVar);
    function needVar() {
      var box = el('[data-variants]'); el('[data-verr]').hidden = false; box.classList.add('attn');
      box.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      var f = $('.vopt:not([disabled])', box); if (f) f.focus({ preventScroll: true });
      setTimeout(function () { box.classList.remove('attn'); }, 2200);
    }
    mainBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        if (hv && !sel) { needVar(); return; }
        doAdd(mainBtns, p.id, sel, Number(qtyIn.value) || 1, b);
      });
    });
    /* تعداد */
    $$('button', qtyIn.parentNode).forEach(function (b) {
      b.addEventListener('click', function () {
        var v = Number(qtyIn.value) + (b.dataset.d === '+' ? 1 : -1), mx = Number(qtyIn.max) || 1;
        if (v > mx) toast('بیشتر از موجودی قابل خرید نیست.');
        qtyIn.value = Math.min(mx, Math.max(1, v));
      });
    });
    qtyIn.addEventListener('change', function () { var mx = Number(qtyIn.max) || 1; qtyIn.value = Math.min(mx, Math.max(1, parseInt(qtyIn.value, 10) || 1)); });
    /* تب‌ها: فقط بخش‌های دارای محتوا */
    var tabs = [];
    if (p.desc) tabs.push(['t-desc', 'توضیحات', '<p>' + esc(p.desc) + '</p>', 'prose']);
    if (p.specs && p.specs.length) tabs.push(['t-spec', 'مشخصات فنی', '<table class="spec">' + p.specs.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</table>', '']);
    if (tabs.length) {
      el('[data-tabs-area]').hidden = false;
      el('[data-tabs]').innerHTML = tabs.map(function (t, i) { return '<button type="button" role="tab" class="' + (i ? '' : 'on') + '" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('');
      el('[data-panes]').innerHTML = tabs.map(function (t, i) { return '<div id="' + t[0] + '" class="tabpane ' + t[3] + (i ? '' : ' on') + '">' + t[2] + '</div>'; }).join('');
    }
    /* محصولات مرتبط: دستی، وگرنه هم‌دسته */
    var rel = (p.related || []).map(function (x) { return CAT[x]; }).filter(Boolean);
    if (!rel.length) rel = Object.keys(CAT).map(function (k) { return CAT[k]; }).filter(function (x) { return x.cat === p.cat && x.id !== p.id; });
    if (!rel.length) rel = Object.keys(CAT).map(function (k) { return CAT[k]; }).filter(function (x) { return x.id !== p.id; });
    rel = rel.filter(function (x) { return x.id !== p.id; }).slice(0, 4);
    if (rel.length) { el('[data-rel-sec]').hidden = false; el('[data-related]').innerHTML = '<div class="grid g4">' + rel.map(cardHTML).join('') + '</div>'; }
    /* نوار خرید چسبان موبایل */
    var sticky = $('[data-sticky]'), brow = el('[data-buyrow]');
    if (sticky && brow) {
      document.body.classList.add('has-sticky');
      var tick = false;
      var upd = function () {
        tick = false;
        var show = brow.getBoundingClientRect().bottom < 0;   /* دکمه اصلی از بالای صفحه خارج شده */
        if (sticky.classList.contains('show') === show) return;
        sticky.classList.toggle('show', show); sticky.setAttribute('aria-hidden', show ? 'false' : 'true');
      };
      var req = function () { if (!tick) { tick = true; requestAnimationFrame(upd); } };
      window.addEventListener('scroll', req, { passive: true });
      window.addEventListener('resize', req);
      upd();
    }
    render();
  }
  if (pdp) initPdp();

  /* ---------- منوی موبایل ---------- */
  var drawer = $('.drawer');
  $$('[data-open-menu]').forEach(function (b) { b.addEventListener('click', function () { drawer.classList.add('open'); }); });
  $$('[data-close-menu]').forEach(function (b) { b.addEventListener('click', function () { drawer.classList.remove('open'); }); });

  /* ---------- اسلایدر ---------- */
  var slider = $('.slider');
  if (slider) {
    var slides = $$('.slide', slider), dots = $$('.sdots button', slider), cur = 0, timer;
    var go = function (i) {
      cur = (i + slides.length) % slides.length;
      slides.forEach(function (s, k) { s.classList.toggle('on', k === cur); });
      dots.forEach(function (d, k) { d.classList.toggle('on', k === cur); });
    };
    var auto = function () { clearInterval(timer); if (!reduce) timer = setInterval(function () { go(cur + 1); }, 6000); };
    dots.forEach(function (d, k) { d.addEventListener('click', function () { go(k); auto(); }); });
    var pv = $('.sarrow.prev', slider), nx = $('.sarrow.next', slider);
    if (pv) pv.addEventListener('click', function () { go(cur - 1); auto(); });
    if (nx) nx.addEventListener('click', function () { go(cur + 1); auto(); });
    auto();
  }

  /* ---------- رنگ‌های فیلتر دسته‌بندی ---------- */
  $$('.filters .swatches').forEach(function (g) {
    $$('.sw', g).forEach(function (s) { s.addEventListener('click', function () { $$('.sw', g).forEach(function (x) { x.classList.toggle('on', x === s); }); }); });
  });

  /* ---------- دسته‌بندی: مرتب‌سازی و فیلتر ---------- */
  var list = $('[data-list]');
  if (list) {
    var cards = $$('.pcard', list), sort = $('#sort'), range = $('#maxp'), stock = $('#instock'), cnt = $('[data-count]'), none = $('[data-none]');
    var apply = function () {
      var max = range ? Number(range.value) : Infinity, only = stock && stock.checked, shown = 0;
      if ($('[data-maxv]')) $('[data-maxv]').textContent = fa(max);
      cards.forEach(function (c) {
        var ok = Number(c.dataset.price) <= max && (!only || c.dataset.stock === '1');
        c.classList.toggle('hidden', !ok); if (ok) shown++;
      });
      var by = sort ? sort.value : 'new';
      var k = { new: function (c) { return -Number(c.dataset.date); }, cheap: function (c) { return Number(c.dataset.price); }, exp: function (c) { return -Number(c.dataset.price); }, best: function (c) { return -Number(c.dataset.sales); } }[by];
      cards.slice().sort(function (a, b) { return k(a) - k(b); }).forEach(function (c) { list.appendChild(c); });
      if (cnt) cnt.textContent = fa(shown);
      if (none) none.classList.toggle('hidden', shown !== 0);
    };
    [sort, range, stock].forEach(function (x) { if (x) x.addEventListener('input', apply); });
    apply();
  }
  var fb = $('[data-toggle-filters]');
  if (fb) fb.addEventListener('click', function () { $('.filters').classList.toggle('open'); });

  /* ---------- ورود با موبایل (فقط ظاهر) ---------- */
  var auth = $('[data-auth]');
  if (auth) {
    var s1 = $('[data-step1]', auth), s2 = $('[data-step2]', auth), ph = $('#phone');
    var digits = function (s) { return s.replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }); };
    s1.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = digits(ph.value.trim());
      if (!/^09\d{9}$/.test(v)) { $('[data-err]', auth).textContent = 'شماره موبایل را به‌صورت صحیح و با ۰۹ شروع کنید.'; return; }
      $('[data-err]', auth).textContent = '';
      $('[data-shown]', auth).textContent = ph.value;
      s1.classList.add('hidden'); s2.classList.remove('hidden');
      $('.otp input', auth).focus();
    });
    var boxes = $$('.otp input', auth);
    boxes.forEach(function (b, i) {
      b.addEventListener('input', function () { if (b.value && boxes[i + 1]) boxes[i + 1].focus(); });
      b.addEventListener('keydown', function (e) { if (e.key === 'Backspace' && !b.value && boxes[i - 1]) boxes[i - 1].focus(); });
    });
    var back = $('[data-back]', auth);
    if (back) back.addEventListener('click', function () { s2.classList.add('hidden'); s1.classList.remove('hidden'); });
  }

  renderBadges(); renderPages();
})();
