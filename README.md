# WeChat Blog Sync

微信公众号文章同步至 Sanity CMS，支持自动翻译和断点续传。

## 功能特性

- 🔄 **断点续传**: 自动记录同步进度，中断后可从上次位置继续
- 🖼️ **图片处理**: 自动下载微信图片并上传到 Sanity
- 🌐 **自动翻译**: 通过 webhook 自动触发英文翻译
- ⚡ **速度控制**: 优化的同步速度，确保翻译质量
- 📊 **进度跟踪**: 实时显示同步进度和状态

## 环境要求

- Node.js 14+
- 微信公众号开发者权限
- Sanity 项目访问权限
- IP 白名单配置

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env` 文件：

```env
WX_APPID=your_wechat_appid
WX_SECRET=your_wechat_secret
SANITY_PROJECT_ID=your_sanity_project_id
SANITY_DATASET=your_sanity_dataset
SANITY_API_TOKEN=your_sanity_token
```

### 3. IP 白名单设置

在微信公众号后台添加服务器 IP 到白名单。

## 使用方法

### 基本用法（推荐）

**首次测试同步 5 篇文章:**
```bash
node src/main.js --limit=5
```

**如果没问题，继续同步更多:**
```bash
node src/main.js --limit=10  # 继续同步10篇
node src/main.js --limit=20  # 继续同步20篇
```

**同步所有剩余文章:**
```bash
node src/main.js
```

### 进度管理

**查看当前进度:**
```bash
cat sync-progress.json
```

**重新开始（清除进度）:**
```bash
node src/main.js --reset --limit=5
```

### 工作原理

- 系统会自动记录同步到第几篇文章
- 下次运行时从上次停止的地方继续
- 进度保存在 `sync-progress.json` 文件中
- 每篇文章处理完成后立即保存进度

## Sanity 数据结构

同步的文章将以以下结构存储在 Sanity 中：

```javascript
{
  _id: "wx-{media_id}",
  _type: "post",
  title: "文章标题",
  slug: {
    _type: "slug",
    current: "wx-{media_id}"
  },
  content: [], // Portable Text 格式内容
  author: "作者",
  publishedAt: "2024-01-01T00:00:00.000Z",
  source: "wechat",
  wechatMediaId: "media_id",
  wechatUrl: "原文链接",
  excerpt: "文章摘要"
}
```

## 同步配置

- **并发数**: 2 篇文章同时处理
- **文章间隔**: 60 秒（确保翻译质量）
- **批次间隔**: 30 秒
- **API 批次大小**: 10 篇文章/批次

## 文件结构

```
wx-blog-sync/
├── src/
│   ├── main.js           # 主控脚本
│   ├── wechat-api.js     # 微信 API 封装
│   └── sanity-service.js # Sanity 服务封装
├── sync-progress.json    # 同步进度记录
├── .env                  # 环境变量配置
└── README.md            # 使用说明
```

## 常见问题

### Q: 如何知道同步到哪里了？
A: 查看 `sync-progress.json` 文件，或观察控制台输出的进度信息。

### Q: 如何从头重新同步？
A: 使用 `--reset` 参数：`node src/main.js --reset --limit=5`

### Q: 翻译没有触发怎么办？
A: 检查 Sanity webhook 配置，确保翻译 API 端点正确配置。

### Q: 同步速度太慢？
A: 当前配置为60秒/篇，这是为了确保翻译质量。如需调整，修改 `main.js` 中的延迟时间。

### Q: 图片没有正确处理？
A: 确保网络能够访问微信图片 CDN (`mmbiz.qpic.cn`)，并且 Sanity 项目有足够的存储配额。

## 技术架构

- **微信 API**: 使用素材管理接口获取文章内容
- **内容转换**: HTML 转 Portable Text 格式
- **图片处理**: 自动下载并上传到 Sanity Assets
- **翻译集成**: 通过 webhook 触发自动翻译
- **进度持久化**: JSON 文件记录同步状态

## 开发信息

- **开发语言**: Node.js
- **主要依赖**: axios, jsdom, @sanity/client, @sanity/block-tools
- **API 限制**: 遵循微信公众号 API 调用限制
- **错误处理**: 完整的错误捕获和重试机制

## 许可证

MIT License