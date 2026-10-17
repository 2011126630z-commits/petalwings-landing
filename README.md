# Petalwings — 花艺观赏单页（v2，按参考稿版式重做）

参考「SKYWINGS 旅行落地页」截图 1:1 仿结构，内容换成 **花的观赏**：
圆角大图英雄区 + 左侧竖排步骤 + 右下 Know More 浮卡 → Follow / 合作方灰字墙 →
Popular Destination 轮播（图片 + 标题 + 地点 + 蓝色星级评分胶囊）→
Journey To The Blooms Made Simple! 三张步骤卡（中间蓝卡抬起）→
Unleash Wanderlust 图文 + 20% OFF 促销条 → 页脚。

纯 **HTML + CSS + JS**，零运行时依赖、零外部网络请求，双击 `index.html` 就能看。

## 预览

```powershell
# 方式 1：直接双击 index.html（file:// 也能跑，无 fetch / 模块加载）

# 方式 2：本地静态服务
python -m http.server 5173
# 打开 http://127.0.0.1:5173/
```

## 常用命令

```powershell
npm test          # 交付自检：资源引用 / 图片尺寸 / 锚点 / id / CSS / JS / 无外部依赖
npm run check:ui  # 真实浏览器冒烟：灯箱、键盘翻页、轮播按钮 + 拖拽、移动端菜单
npm run shots     # 用本机 Edge/Chrome + CDP 出 5 张页面截图 + 3 张交互状态图
```

截图产物在 `shots/`。

## 与参考稿的对应关系

| 参考稿 | 本页 |
| --- | --- |
| UIXSHUVO / ABOUT TOUR PACKAGE CONTACT / Book Trip | Petalwings / TOURS JOURNEY OFFER CONTACT / Book Trip |
| 圆角天空大图 + 「Experience The Magic Of Flight!」 | 圆角白百合图 + 「Experience The Magic Of Bloom!」 |
| 左侧 ①②③ 竖排步骤点 | 同位置，白底激活态 |
| 右下 Know More 浮卡（三个缩略图 + Awesome Places） | 同位置，Blooming Places / Discover The World One Petal At A Time. |
| Follow + airbnb / Booking.com / trivago / Expedia | Follow + Kew Gardens / RHS / teamLab / Bloom & Wild |
| Popular Destination 三张卡（Forest Wild Life、NRT, Indonesia、★ 4.5） | 6 张卡轮播（White Silk Gardenia、Kyoto, Japan、★ 4.9…） |
| Journey To The Skies Made Simple! 三步骤卡 | Journey To The Blooms Made Simple!，左灰 / 中蓝 / 右灰 |
| UNLEASH WANDERLUST WITH SKYWINGS + 20% OFF + 蓝色 CTA | 同结构，文案换成 Petalwings，图片换成花 |
| 飞机 / 海岛图 | 提供的百合、山茶、压花照片（含 3 张 4:5 卡片裁切） |

## 高难度点都在代码注释里（中文）

- **圆角卡 + 右下浮卡的层叠关系**：hero 容器 `overflow: visible`，图片/遮罩各自做圆角（`css/style.css` 的 `.hero__img` / `.hero__shade` / `.know-card`）。
- **白底照片和纸白背景衔接**：左侧多层渐变遮罩 + 顶部一层很淡的冷蓝，做出“天空画框”的感觉。
- **轮播卡片宽度计算**：`--card-gap` 参与 `calc((100% - gap*2)/3)`，改间距不用改 JS。
- **横向拖拽**：Pointer Events + 6px 阈值 + `setPointerCapture` + 拖拽时临时关闭 scroll-snap + 松手吞 click，见 `js/main.js` 第 5 段。
- **移动端布局视口被撑宽**：hero 在桌面上是 flex 横排，窄屏必须 `display:block`；Know More 卡 static 时要补 `z-index` 否则被绝对定位的图片盖住。
- **灯箱**：焦点陷阱、ESC / 方向键、滚动锁、相邻图预加载、关闭后焦点还原。
- **降级**：`prefers-reduced-motion`、无 JS、`?no-anim=1`（截图用）、`?shot=1`（懒加载改 eager）。

## 文件结构

```
petalwings/
├─ index.html            页面结构 + 内联 SVG 图标
├─ css/style.css         设计变量、组件、响应式、降级（约 1900 行）
├─ js/main.js            7 个交互模块，无依赖（约 480 行）
├─ assets/
│  ├─ favicon.svg
│  └─ img/               8 张花卉图（7 张原图 + 3 张 4:5 裁切卡图）
├─ scripts/              CDP 无头截图 + 交互冒烟测试（开发用）
├─ test/page.test.mjs    node:test 自检
├─ package.json
└─ shots/                截图产物（5 张页面 + 3 张状态图）
```

## 兼容性

现代浏览器（Chrome / Edge / Firefox / Safari 16+）。字体用系统字体（Segoe UI / 苹方 / 微软雅黑），不依赖 Google Fonts，国内网络可直接打开；`backdrop-filter`、`aspect-ratio`、`100svh` 都有可用降级。
