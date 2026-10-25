/* تنظیمات مرکزی سایت — برای تغییر نام فروشگاه، اطلاعات تماس یا نوار اطلاعیه فقط همین فایل را ویرایش کنید.
   پس از ذخیره، صفحه را در مرورگر دوباره باز کنید. */
window.SITE = {
  name: "دکوری و اکسسوری",                 /* نام برند: در هدر، فوتر و عنوان همه صفحه‌ها */
  tagline: "فروشگاه اینترنتی تخصصی",              /* توضیح کوتاه زیر نام برند */
  skuPrefix: "P-",          /* پیشوند کد محصول */
  phone: "",                /* خالی بگذارید تا نمایش داده نشود */
  email: "",
  address: "",
  announcement: {           /* نوار اطلاعیه بالای سایت */
    enabled: true,            /* true = نمایش، false = مخفی */
    text: "دنیایی از دکوری‌های خاص برای زیباتر کردن فضای شما",
    link: ""                /* اختیاری؛ مثلاً "category.html" یا "https://..." */
  }
};
(function () {
  var S = window.SITE || {}, A = S.announcement || {};
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  $$('[data-site]').forEach(function (e) { var v = S[e.getAttribute('data-site')]; if (v != null) e.textContent = v; });
  ['phone', 'email', 'address'].forEach(function (k) { $$('[data-site-wrap="' + k + '"]').forEach(function (w) { w.hidden = !S[k]; }); });
  var any = !!(S.phone || S.email || S.address); $$('[data-site-none]').forEach(function (n) { n.hidden = any; });
  $$('a.logo').forEach(function (a) { a.setAttribute('aria-label', S.name || ''); });
  if (document.body.getAttribute('data-title')) document.title = document.body.getAttribute('data-title') + ' | ' + (S.name || '');
  var bar = document.querySelector('[data-annc]');
  if (bar) {
    var on = !!(A.enabled && A.text); bar.hidden = !on;
    if (on) {
      var t = bar.querySelector('[data-annc-t]'), a = bar.querySelector('[data-annc-a]');
      var link = String(A.link || '').trim(), safe = link && !/^\s*(javascript|data|vbscript):/i.test(link);
      t.textContent = A.text; a.textContent = A.text;
      a.hidden = !safe; t.hidden = !!safe; if (safe) a.setAttribute('href', link);
    }
  }
})();
