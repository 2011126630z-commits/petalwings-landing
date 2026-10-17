# Petalwings — 花艺观赏单页

参考「飞行/旅行落地页」的版式细节，改成 **花的观赏** 主题：白百合英雄区、悬浮 Know More 玻璃卡、Popular Destinations 三张系列卡、深色体验区、三步流程、横向图库、邀请横幅、订阅表单、页脚巨字。
纯 **HTML + CSS + JS**，零运行时依赖、零外部网络请求（字体用系统字体），双击 `index.html` 就能看。

## 预览

```powershell
# 方式 1：直接双击 index.html（无需服务器）

# 方式 2：起一个本地静态服务
python -m http.server 5173
# 打开 http://127.0.0.1:5173/
```

重出截图（本机需 Edge / Chrome，脚本通过 CDP 精确控制视口，不装依赖）：

```powershell
npm run shots
```

跑交付自检（资源引用、图片尺寸、锚点、id 重复、CSS 结构、JS 语法、外部依赖）：

```powershell
npm test
```

跑交互冒烟测试（真实浏览器里点灯箱、翻页、拖拽图库、开菜单、提交表单，并检查页面无 JS 报错）：

```powershell
npm run check:ui
```

截图产物在 `shots/`：5 张页面截图 + 3 张交互状态截图（灯箱 / 菜单 / 订阅成功）。

## 文件结构

```
petalwings/
├─ index.html            # 全部页面结构 + 内联 SVG 图标
├─ css/style.css         # 设计变量、组件、响应式、降级
├─ js/main.js            # 11 个交互模块，无依赖
├─ assets/
│  ├─ favicon.svg
│  └─ img/               # 8 张花卉图（7 张原始图 + 3 张 4:5 裁切卡图）
├─ scripts/              # 仅供开发：无头浏览器截图
├─ test/page.test.mjs    # node:test 自检
└─ shots/                # 截图产物
```

## 对应参考稿的细节

| 参考稿 | 本页 |
| --- | --- |
| Experience The Magic Of Flight! | Experience the magic of bloom. |
| Know More + 三个圆图 + Awesome Places | Know more + 三个圆图 + Blooming places |
| Popular Destination 卡片（标签 / 价格） | Popular destinations 三张系列卡（Rare · 6 places left / from $86…） |
| Journey To The Skies Made Simple! | Journey to the blooms, made simple.（滚动进度线） |
| UNLEASH WANDERLUST WITH SKYWINGS | Unleash wanderlust with Petalwings. |
| 飞机 / 海岛图 | 换成提供的百合、山茶、蓝色百合、压花等照片 |

## 高难度点在哪里（代码里都有中文注释）

- **纯黑底照片融进深色章节**：`mix-blend-mode: lighten`（`css/style.css` 的 `.experience__img`）。
- **白底照片和纸色页面无缝衔接**：英雄区左侧多层渐变遮罩（`.hero__veil`），移动端改成顶部定高图块 + 渐变过渡。
- **玻璃拟态悬浮卡**：`backdrop-filter` + `@supports` 降级。
- **无缝跑马灯**：JS 按宽度克隆内容，再整段复制一份，动画位移 `-50%`；时长按内容宽度计算（`js/main.js` 05 / `.marquee__track`）。
- **英雄区视差**：鼠标阻尼 + 滚动位移，`requestAnimationFrame` 合并更新，只动 transform（`js/main.js` 05）。
- **横向图库**：Pointer Events 拖拽（6px 阈值、`setPointerCapture`、松手吞 click 避免误开灯箱）+ 按钮翻页 + 进度条（`js/main.js` 08）。
- **灯箱**：焦点陷阱、ESC / 方向键、滚动锁、相邻图预加载、关闭后焦点还原（`js/main.js` 09）。
- **三步流程进度线**：滚动比例映射成 0–1 写入 CSS 变量，横向 `scaleX` / 竖向 `scaleY`（`js/main.js` 07）。
- **滚动显现**：`IntersectionObserver` + 同组错落延迟，只触发一次（`js/main.js` 03）。
- **响应式细节**：三卡在平板折成两列、第三张横跨；流程线由横变竖；菜单抽屉带焦点管理。
- **降级**：`prefers-reduced-motion`、无 JS、`?no-anim=1`（截图用）、`?shot=1`（固定 vh 区块，避免整页截图失控）。

## 图片说明

图片由客户提供（百合、山茶、压花等）。卡片图 `col-*.jpg` 是从原始图居中裁出的 4:5 版本，其余使用原图 + CSS `object-fit` 裁切，避免二次压缩。

## 兼容性

现代浏览器（Chrome / Edge / Firefox / Safari 16+）。`mix-blend-mode`、`backdrop-filter`、`aspect-ratio`、`100svh` 均有降级或可接受的回退。字体使用系统字体（Georgia + Segoe UI / 苹方 / 微软雅黑），不依赖 Google Fonts，国内网络可直接打开。
