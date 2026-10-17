/**
 * 首屏初始化
 * 在页面渲染前执行：先标记 JS 是否可用，避免标题入场动画闪一下。
 * 同时读取地址栏参数：
 *   no-anim=1  关闭动效，用于静态预览
 *   shot=1     把懒加载图片改为立即加载，方便整页截图
 */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.remove('no-js');
  root.classList.add('js');

  var params = new URLSearchParams(window.location.search);
  if (params.get('no-anim') === '1') root.classList.add('no-anim');

  if (params.get('shot') === '1') {
    root.classList.add('is-shot');
    document.addEventListener('DOMContentLoaded', function () {
      var lazy = document.querySelectorAll('img[loading="lazy"]');
      for (var i = 0; i < lazy.length; i++) {
        lazy[i].setAttribute('loading', 'eager');
      }
    });
  }
})();
