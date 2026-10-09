# 晚风TV (W-TV) 📺

<p align="center">
  <img src="public/icon-512x512.png" width="96" height="96" alt="晚风TV Logo" />
</p>

<p align="center">
  <strong>基于 Next.js 15 + React 18 打造的高颜值、现代化的聚合影院流媒体 Web 应用</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15.2-black?style=flat-square&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-18.3-blue?style=flat-square&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TailwindCSS-3.4-38bdf8?style=flat-square&logo=tailwind-css" alt="TailwindCSS" />
  <img src="https://img.shields.io/badge/Vidstack-Player-f00?style=flat-square" alt="Vidstack" />
  <img src="https://img.shields.io/badge/DRpy-Engine-emerald?style=flat-square" alt="DRpy Engine" />
  <img src="https://img.shields.io/badge/PWA-Supported-purple?style=flat-square" alt="PWA" />
</p>

---

## ✨ 核心特性

### 🎬 1. 深度聚合双引擎（CMS 采集 + DRpy 爬虫）
- **苹果CMS VOD 采集 API**：兼容主流 MacCMS v10 标准 JSON 接口，支持分页、分类与全局多源搜索。
- **TVBox / DRpy JavaScript 规则沙箱引擎**：
  - 核心集成 V8 沙箱执行器，完美支持原生 JavaScript 爬虫规则（`home`、`category`、`detail`、`play`）。
  - 内置 DOM 解析（Cheerio/pdfa/pdfh）、加解密（RC4/AES）、Cookie 持久化与防爬 WAF 智能穿透。
  - 支持动态发布页自动嗅探与国内免代理直连。

### ⚡ 2. 沉浸式 YouTube 风格流媒体播放器
- **YouTube 经典红白交互进度条**：
  - 极简自适应轨高过渡，鼠标悬停平滑加粗。
  - 经典红色动态滑块（Thumb），悬浮时间预览气泡卡片。
- **全屏沉浸式选集抽屉**：
  - 播放器右侧内置半透明毛玻璃选集弹窗，在**原生全屏**与**网页全屏**下均可直接呼出。
  - 多线路快速 Tab 切换、剧集网格自适应排版、当前集高亮追踪。
  - **切集不退出全屏**：彻底重构切集与全屏维持机制，选集与下一集秒开，全屏状态永不中断。
- **现代剧场模式（网页全屏）**：支持快捷键 `F` 一键切换宽屏剧场视窗。
- **防卡死微推移与 HLS 智能去广告**：
  - 内存与回退缓冲优化（高达 60s 回拉秒播）。
  - 动态检测并微调跳过缓冲空洞（Buffer Stalled），彻底解决拖拽进度条假死。
  - M3U8 切片广告自动清洗过滤。

### 🖼️ 3. 智能图片代理与解密网关 (`/api/proxy`)
- **AES-128-CBC 图像实时解密**：针对黄果短剧等加密 CDN 图源，自动在服务端完成对称解密还原为高清大图。
- **多层网络 Fallback 管道**：原生 Fetch 异常或小众 CDN 遭遇 DNS 解析故障时，自动降级启用系统 Curl 与代理隧道穿透，确保 100% 封面海报正常展示。
- **智能 MIME 纠偏与长效 CDN 缓存**。

### 🎨 4. 高颜值 UI & 体验美学
- **右上角智能影视源切换胶囊**：
  - 玻璃拟态药丸按钮，集成动态呼吸状态指示灯。
  - 明确标注来源属性（`爬虫规则` 翠绿徽章 vs `CMS 采集` 科技蓝徽章）。
  - 域名特征卡片式下拉面板，支持一键直达内容源管理。
- **全站自适应暗黑/浅色主题**：支持中国时区自动感应与本地状态记忆。
- **巨幕轮播海报（HeroCarousel）**：电影级毛玻璃虚化背景与流畅平滑动画。
- **历史记录与继续播放**：本地自动追踪观影进度。
- **全平台 PWA 原生应用体验**：支持安装到 iOS / Android / Windows 主屏幕。

---

## 🛠️ 技术栈

| 模块 | 技术选型 | 说明 |
| :--- | :--- | :--- |
| **基础框架** | Next.js 15 (App Router) + React 18 | 现代化 React 全栈框架 |
| **语言与类型** | TypeScript 5 | 全链路严谨类型约束 |
| **样式与动效** | TailwindCSS + Radix UI + Lucide Icons | 现代原子化样式与无障碍组件库 |
| **视频播放器** | @vidstack/react + Hls.js | 高性能跨平台流媒体播放内核 |
| **爬虫沙箱** | Node.js VM + Cheerio + Node Crypto | TVBox/DRpy 规则解析与解密 |
| **离线与应用化**| Next-PWA (Workbox) | Progressive Web App 体验 |

---

## 🚀 快速启动

### 方式一：本地开发

1. **克隆项目并安装依赖**：
   ```bash
   git clone https://github.com/your-username/W-TV.git
   cd W-TV
   npm install
   ```

2. **启动本地开发服务器**：
   ```bash
   npm run dev
   ```
   浏览器打开 [http://localhost:9002](http://localhost:9002) 即可预览。

3. **打包构建与类型检查**：
   ```bash
   npm run typecheck  # TypeScript 校验
   npm run build      # 生产环境构建
   npm run start      # 启动生产服务
   ```

---

### 方式二：Docker 容器化部署

#### 使用 Docker Compose（推荐）

在服务器创建 `docker-compose.yml`：

```yaml
version: "3.8"
services:
  wanfeng-tv:
    image: oilycn/wanfeng-tv:latest
    container_name: wanfeng-tv
    restart: always
    ports:
      - "9002:3000"
    environment:
      - NODE_ENV=production
```

启动容器：
```bash
docker compose up -d
```

#### 本地自行构建 Docker 镜像

```bash
# 构建镜像
docker build -t wanfeng-tv .

# 运行容器
docker run -d -p 9002:3000 --name wanfeng-tv --restart always wanfeng-tv
```

---

### 方式三：云平台一键部署

#### Vercel 部署
1. 将本项目代码推送到您的 GitHub / GitLab 仓库。
2. 登录 [Vercel](https://vercel.com)，点击 **New Project** 并选择该仓库。
3. 框架预设选择 **Next.js**，点击 **Deploy**，几分钟内即可生成全球 HTTPS 访问链接。

#### Cloudflare Pages 部署
1. 登录 Cloudflare 控制台，进入 **Workers & Pages**。
2. 绑定 Git 仓库并创建 Pages 项目。
3. 构建命令填入：`npm run pages:build`，输出目录填入：`.vercel/output/static`。

> 💡 **PWA 提示**：PWA（添加到主屏幕）强制要求全站 **HTTPS** 环境。若使用 Docker 自建服务器，请在前端配置 Nginx、Caddy 或反向代理证书。

---

## ⚙️ 快捷键指南

播放器内置全键盘操作支持，大屏观影更轻松：

| 快捷键 | 功能描述 |
| :---: | :--- |
| <kbd>空格</kbd> | 播放 / 暂停 |
| <kbd>F</kbd> | 网页全屏（剧场模式）切换 |
| <kbd>Esc</kbd> | 退出全屏 / 关闭选集抽屉 |
| <kbd>Alt</kbd> + <kbd>→</kbd> | 快速切换至下一集 |
| <kbd>←</kbd> / <kbd>→</kbd> | 倒退 10 秒 / 快进 10 秒 |
| <kbd>↑</kbd> / <kbd>↓</kbd> | 音量增加 10% / 减少 10% |

---

## 📁 目录结构

```text
W-TV/
├── public/                # 静态资源与内置本地规则
│   ├── rules/             # DRpy / JS 规则文件（黄果、厂长等）
│   └── sw.js              # PWA Service Worker
├── src/
│   ├── app/               # Next.js App Router 路由
│   │   ├── api/proxy/     # 智能媒体与图片解密代理 API
│   │   ├── api/rule/      # 规则沙箱调度与解析 API
│   │   ├── content/[id]/  # 影视详情与播放主页面
│   │   ├── settings/      # 内容源与订阅管理设置
│   │   └── history/       # 播放历史记录
│   ├── components/
│   │   ├── player/        # YouTube 风格视频播放器及选集抽屉
│   │   ├── content/       # 内容卡片、轮播图组件
│   │   └── common/        # 顶栏导航与源切换组件
│   ├── contexts/          # 分类、内容源与主题 Context
│   └── lib/
│       ├── rule-runner.ts # 通用 JS 规则执行沙箱
│       └── content-loader.ts # 数据转换与多源加载器
└── Dockerfile             # 容器化构建文件
```

---

## ⚠️ 免责声明

- 本项目（晚风TV / W-TV）仅作为开源 Web 技术与多媒体播放技术的学习与交流平台。
- 本项目本身**不存储、不制作、不分发**任何音频或视频资源，所有内容源均由用户自行配置或来自公开第三方网络接口。
- 请自觉遵守当地法律法规，尊重版权方的合法权益。

---

## 🤝 鸣谢与开源支持

- [Next.js](https://nextjs.org/)
- [Vidstack Player](https://vidstack.io/)
- [Hls.js](https://github.com/video-dev/hls.js)
- [Tailwind CSS](https://tailwindcss.com/)
- [Radix UI](https://www.radix-ui.com/)