# Petalwings · 花艺观赏单页

按设计稿制作的花卉观赏主题落地页：圆角首屏大图、右下角 Know More 浮卡、品牌墙、目的地横向轮播、三步流程、活动区与 20% OFF 促销条，适配桌面 / 平板 / 手机。

纯 **HTML + CSS + JS**，无第三方依赖、无外部网络请求；双击 `index.html` 即可打开。

## 文件结构

```
petalwings/
├─ index.html      页面结构（含内联 SVG 图标）
├─ css/style.css   样式与响应式
├─ js/main.js      交互脚本
├─ assets/img/     花卉图片
├─ assets/favicon.svg
├─ scripts/        截图与交互自检脚本（开发用，交付时可删除）
├─ test/           静态检查脚本
├─ package.json
└─ shots/          截图产物
```

## 常用命令

```powershell
npm test          # 资源引用、锚点、id、CSS/JS 语法、外部依赖检查
npm run check:ui  # 真实浏览器交互自检：灯箱、键盘翻页、轮播拖拽、移动端菜单
npm run shots     # 无头浏览器生成 5 张页面截图 + 3 张交互状态截图
```

## 修改指引

- **改文案**：在 `index.html` 里搜索对应英文句子直接替换。
- **换图片**：覆盖 `assets/img/` 里的同名文件。卡片建议 4:5 竖图，横幅建议横图，页面会自动裁切。
- **改主色**：`css/style.css` 开头的 `:root` 里修改 `--blue` 即可。
- **关键实现**：代码中的中文注释标出了首屏层叠、标题裁切盒、轮播宽度计算、拖拽与吸附、焦点陷阱等位置。

## 兼容性

现代浏览器（Chrome / Edge / Firefox / Safari 16+）。字体使用系统字体，不依赖 Google Fonts，国内网络可直接打开；`backdrop-filter`、`aspect-ratio`、`100svh` 均有降级方案。
