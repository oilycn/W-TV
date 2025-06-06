
# 晚风TV (Evening Breeze TV)

这是一个基于 Next.js 构建的个性化影院体验应用程序，在 Firebase Studio 中创建。

核心功能包括：
- **动态内容加载**: 从用户配置的多个内容源 (类似TVBox的通用视频API接口) 动态加载和解析内容。
- **内容源管理**:
    - 用户可以在“设置”页面手动添加、移除和切换当前使用的内容源。
    - 支持通过订阅链接 (JSON格式) 批量导入和更新内容源列表。
    - 若无任何配置，默认添加“黑木耳”作为初始内容源。
- **分类浏览**: 在主页顶部以横向滚动条展示当前选定内容源提供的分类。
- **分页浏览**: 支持内容列表的分页加载，并在主页显示总页数和当前页码。
- **全局搜索**: 顶部的搜索栏支持在所有已配置的内容源中进行搜索，搜索结果在专门的 `/search` 页面按内容源分组展示。
- **内容详情**: 查看电影和电视剧的详细信息，包括海报、简介、演员、导演、评分等。
- **集成播放器**:
    - 详情页内置 `ReactPlayer` 视频播放器，尝试直接播放视频流 (如MP4, M3U8, DASH等)。
    - 对于无法直接播放的链接 (如包含网页播放器的页面)，会自动尝试使用iframe进行加载。
    - 支持“上一集”和“下一集”快速切换。
- **主题切换**: 支持浅色和深色主题切换，并根据中国时区 (UTC+8，早上6点到下午6点为浅色) 自动设置初始主题。用户选择会保存在本地。
- **响应式设计**: 界面适配不同屏幕尺寸。

## 开始

要运行开发服务器：
```bash
npm run dev
```
在浏览器中打开 http://localhost:9002 查看应用。

主要应用逻辑位于 `src/app` 目录下。
主要组件位于 `src/components` 目录下。
内容加载逻辑位于 `src/lib/content-loader.ts`。
类型定义位于 `src/types/index.ts`。
全局样式及主题配置位于 `src/app/globals.css`。

*注意: 项目中包含了 Genkit (用于AI功能) 的基础配置 (`src/ai/genkit.ts`), 但核心的AI推荐功能目前已移除。*

## 使用 Docker 运行
* dockercompose安装
```bash
version: "3.3"
services:
  wanfeng-tv:
    ports:
      - 9002:3000
    container_name: wanfeng-tv-app
    restart: always
    image: oilycn/wanfeng-tv:1.0.0
networks: {}
```

您也可以使用 Docker 自行构建和运行此应用程序。

### 前提条件

*   确保您的机器上已安装 [Docker](https://www.docker.com/get-started)。

### 构建镜像

1.  如果尚未克隆代码仓库，请先克隆。
2.  在命令行中，导航到项目的根目录 (包含 `Dockerfile` 文件的目录)。
3.  运行构建命令：

    ```bash
    docker build -t wanfeng-tv .
    ```
    这将构建 Docker 镜像并将其标记为 `wanfeng-tv`。

### 运行容器

镜像构建完成后，您可以将其作为容器运行：

```bash
docker run -p 9002:3000 wanfeng-tv
```

此命令将：
*   运行 `wanfeng-tv` 镜像。
*   将容器的 3000 端口映射到您主机的 9002 端口。

然后，您可以在浏览器中通过 `http://localhost:9002` 访问应用程序。

要在后台以分离模式运行容器：
```bash
docker run -d -p 9002:3000 wanfeng-tv
```
