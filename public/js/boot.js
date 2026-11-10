// Oddiy (modul bo'lmagan) skript <head> da, sahifa chizilishidan oldin ishlaydi:
// 1) mavzu (tanlov localStorage'da; tanlanmagan bo'lsa — tizim sozlamasi) — "miltillash" bo'lmaydi;
// 2) shriftlar dinamik yuklanadi — parser qo'shgan stylesheet modul skriptlarni to'xtatib turardi.
(function () {
  var root = document.documentElement;
  if (!root.hasAttribute('data-theme-fixed')) {
    var theme = null;
    try {
      theme = localStorage.getItem('chipta:theme');
    } catch {
      theme = null;
    }
    if (theme !== 'dark' && theme !== 'light') {
      theme =
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    }
    root.setAttribute('data-theme', theme);
  }
  var fonts = document.createElement('link');
  fonts.rel = 'stylesheet';
  fonts.href =
    'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600..800&family=Manrope:wght@400..800&display=swap';
  document.head.appendChild(fonts);
})();
