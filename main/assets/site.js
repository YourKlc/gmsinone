(function(){
  var root = document.documentElement;
  var body = document.body;
  var THEMES = ['day', 'night', 'obsidian', 'ocean', 'forest', 'violet'];
  var THEME_KEY = 'gms-theme';

  /* 顶部下拉菜单 */
  var groups = Array.prototype.slice.call(document.querySelectorAll('.nav-group'));
  function closeGroups(except){
    groups.forEach(function(group){
      if (group === except) return;
      group.classList.remove('is-open');
      var btn = group.querySelector('.nav-trigger');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  }
  groups.forEach(function(group){
    var btn = group.querySelector('.nav-trigger');
    if (!btn) return;
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      var open = !group.classList.contains('is-open');
      closeGroups(group);
      group.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });

  /* 全部菜单抽屉 */
  var menuBtn = document.getElementById('menuBtn');
  var drawer = document.getElementById('drawer');
  var drawerClose = document.getElementById('drawerClose');

  function openDrawer(){
    if (!drawer) return;
    drawer.hidden = false;
    window.requestAnimationFrame(function(){ drawer.classList.add('is-open'); });
    body.classList.add('drawer-open');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'true');
    window.setTimeout(function(){ if (drawerClose) drawerClose.focus(); }, 80);
  }
  function closeDrawer(){
    if (!drawer || drawer.hidden) return;
    drawer.classList.remove('is-open');
    body.classList.remove('drawer-open');
    if (menuBtn) {
      menuBtn.setAttribute('aria-expanded', 'false');
      menuBtn.focus();
    }
    window.setTimeout(function(){ if (!drawer.classList.contains('is-open')) drawer.hidden = true; }, 260);
  }
  if (menuBtn) menuBtn.addEventListener('click', function(){
    if (drawer && !drawer.hidden) closeDrawer(); else openDrawer();
  });
  if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
  if (drawer) {
    Array.prototype.forEach.call(drawer.querySelectorAll('[data-close]'), function(el){
      el.addEventListener('click', closeDrawer);
    });
  }

  /* 配色 */
  var dots = Array.prototype.slice.call(document.querySelectorAll('.theme-dot'));
  var solverRoots = Array.prototype.slice.call(document.querySelectorAll('[data-solver-root]'));
  var themeTrigger = document.getElementById('themeTrigger');
  var themePanel = document.getElementById('themePanel');
  function closeTheme(){
    if (!themePanel || themePanel.hidden) return;
    themePanel.hidden = true;
    if (themeTrigger) themeTrigger.setAttribute('aria-expanded', 'false');
  }
  function applyTheme(name){
    if (THEMES.indexOf(name) < 0) name = 'day';
    root.setAttribute('data-theme', name);
    solverRoots.forEach(function(el){ el.setAttribute('data-theme', name); });
    try { localStorage.setItem(THEME_KEY, name); } catch(e) {}
    dots.forEach(function(dot){
      var current = dot.getAttribute('data-theme-choice') === name;
      dot.classList.toggle('is-current', current);
      dot.setAttribute('aria-pressed', current ? 'true' : 'false');
    });
  }
  dots.forEach(function(dot){
    dot.addEventListener('click', function(){
      applyTheme(dot.getAttribute('data-theme-choice'));
      closeTheme();
    });
  });
  if (themeTrigger && themePanel) {
    themeTrigger.addEventListener('click', function(e){
      e.stopPropagation();
      themePanel.hidden = !themePanel.hidden;
      themeTrigger.setAttribute('aria-expanded', themePanel.hidden ? 'false' : 'true');
    });
  }
  applyTheme(root.getAttribute('data-theme') || 'day');

  /* 点击空白 / Esc 收起 */
  document.addEventListener('click', function(e){
    if (!e.target.closest('.nav-group')) closeGroups();
    if (!e.target.closest('.theme-wrap')) closeTheme();
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') {
      closeGroups();
      closeTheme();
      closeDrawer();
    }
  });

  /* 滚动阴影 */
  var head = document.getElementById('siteHead');
  function onScroll(){
    if (head) head.classList.toggle('is-scrolled', window.scrollY > 8);
  }
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();

  /* 桌面端自动收起抽屉 */
  var wide = window.matchMedia('(min-width:1081px)');
  function handleWide(e){ if (e.matches) closeDrawer(); }
  if (wide.addEventListener) wide.addEventListener('change', handleWide);
  else if (wide.addListener) wide.addListener(handleWide);
})();
