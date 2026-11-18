(function(){
  var root = document.documentElement;
  var THEMES = ['day', 'night', 'obsidian', 'ocean', 'forest', 'violet'];
  var THEME_KEY = 'gms-theme';

  /* 左侧菜单：分组折叠 */
  Array.prototype.forEach.call(document.querySelectorAll('.side-group-head'), function(btn){
    btn.addEventListener('click', function(){
      var group = btn.closest('.side-group');
      var open = group.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });

  /* 移动端抽屉 */
  var body = document.body;
  var menuBtn = document.getElementById('menuToggle');
  var closeBtn = document.getElementById('sidebarClose');
  var backdrop = document.getElementById('sidebarBackdrop');

  function setNav(open){
    body.classList.toggle('nav-open', open);
    if (menuBtn) menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open && closeBtn) {
      window.setTimeout(function(){ closeBtn.focus(); }, 60);
    }
  }
  if (menuBtn) menuBtn.addEventListener('click', function(){ setNav(!body.classList.contains('nav-open')); });
  if (closeBtn) closeBtn.addEventListener('click', function(){ setNav(false); });
  if (backdrop) backdrop.addEventListener('click', function(){ setNav(false); });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && body.classList.contains('nav-open')) setNav(false);
  });
  var wide = window.matchMedia('(min-width:1081px)');
  function handleWide(e){ if (e.matches) setNav(false); }
  if (wide.addEventListener) wide.addEventListener('change', handleWide);
  else if (wide.addListener) wide.addListener(handleWide);

  /* 配色 */
  var dots = Array.prototype.slice.call(document.querySelectorAll('.theme-dot'));
  function applyTheme(name){
    if (THEMES.indexOf(name) < 0) name = 'day';
    root.setAttribute('data-theme', name);
    try { localStorage.setItem(THEME_KEY, name); } catch(e) {}
    dots.forEach(function(dot){
      var current = dot.getAttribute('data-theme-choice') === name;
      dot.classList.toggle('is-current', current);
      dot.setAttribute('aria-pressed', current ? 'true' : 'false');
    });
  }
  dots.forEach(function(dot){
    dot.addEventListener('click', function(){ applyTheme(dot.getAttribute('data-theme-choice')); });
  });
  applyTheme(root.getAttribute('data-theme') || 'day');
})();
