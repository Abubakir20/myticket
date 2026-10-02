// Oddiy (modul bo'lmagan) skript <head> da, sahifa chizilishidan oldin ishlaydi:
// 1) mavzu (dizayndagidek standart — yorug'; tanlov localStorage'da saqlanadi) — "miltillash" bo'lmaydi;
// 2) shriftlar dinamik yuklanadi — parser qo'shgan stylesheet modul skriptlarni to'xtatib turardi.
(function () {
  var root = document.documentElement;
  if (!root.hasAttribute('data-theme-fixed')) {
    var theme = 'light';
    try {
      theme =
        localStorage.getItem('chipta:theme') === 'dark' ? 'dark' : 'light';
    } catch {
      theme = 'light';
    }
    root.setAttribute('data-theme', theme);
  }
  var fonts = document.createElement('link');
  fonts.rel = 'stylesheet';
  fonts.href =
    'https://fonts.googleapis.com/css2?family=Caprasimo&family=Figtree:wght@400;600;700&display=swap';
  document.head.appendChild(fonts);
})();
