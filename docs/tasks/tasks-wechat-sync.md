# 任务清单：微信公众号文章同步至 Sanity

## Phase 1: 项目初始化与环境配置

*   **Milestone**: 成功初始化 Node.js 项目，并配置好所有必需的依赖和环境变量。

- [ ] **任务 1: 初始化 Node.js 项目 (P1)**
    -   **目标**: 创建一个新的 Node.js 项目，并设置基本的项目结构。
    -   **子步骤**:
        1.  创建项目目录 `wx-sync-script`。
        2.  进入目录，运行 `npm init -y`。
        3.  创建 `src` 目录用于存放源代码。
        4.  创建主入口文件 `src/main.js`。
    -   **依赖**: Node.js, npm
    -   **输出**: `package.json` 文件，基本的目录结构。

- [ ] **任务 2: 安装依赖库 (P1)**
    -   **目标**: 安装所有执行迁移任务所需的 npm 包。
    -   **子步骤**:
        1.  运行 `npm install axios jsdom @sanity/block-tools @sanity/client dotenv p-limit`。
    -   **依赖**: npm
    -   **输出**: `package-lock.json` 文件，`node_modules` 目录。

- [ ] **任务 3: 配置环境变量 (P1)**
    -   **目标**: 创建并配置 `.env` 文件，用于存储敏感凭证。
    -   **子步骤**:
        1.  在项目根目录创建 `.env` 文件。
        2.  在文件中添加以下变量并填入真实值：
            ```
            WX_APPID=
            WX_SECRET=
            SANITY_PROJECT_ID=
            SANITY_DATASET=
            SANITY_API_TOKEN=
            ```
        3.  创建 `.gitignore` 文件，并添加 `node_modules` 和 `.env`。
    -   **依赖**: 无
    -   **输出**: `.env` 和 `.gitignore` 文件。

## Phase 2: 核心模块开发

*   **Milestone**: 完成与微信 API 和 Sanity 服务交互的核心逻辑封装，并通过单元测试。

- [ ] **任务 4: 封装微信 API 模块 (P1)**
    -   **目标**: 创建一个模块，专门负责与微信公众号素材接口进行通信。
    -   **子步骤**:
        1.  创建 `src/wechat-api.js` 文件。
        2.  实现 `getToken()` 函数，包含 `access_token` 的获取和缓存逻辑。
        3.  实现 `getMaterialCount()` 函数。
        4.  实现 `getMaterialList(offset, count)` 函数。
        5.  实现 `getMaterial(media_id)` 函数。
    -   **依赖**: `axios`
    -   **输出**: `src/wechat-api.js` 模块文件。

- [ ] **任务 5: 封装 Sanity 服务模块 (P1)**
    -   **目标**: 创建一个模块，负责所有与 Sanity 后端的交互，包括内容转换和写入。
    -   **子步骤**:
        1.  创建 `src/sanity-service.js` 文件。
        2.  实现 Sanity 客户端的初始化。
        3.  实现 `transformHtmlToPortableText(html)` 函数。
        4.  实现 `createOrUpdatePost(post)` 函数。
    -   **依赖**: `@sanity/client`, `@sanity/block-tools`, `jsdom`
    -   **输出**: `src/sanity-service.js` 模块文件。

## Phase 3: 图片处理与内容转换

*   **Milestone**: 实现文章 HTML 内容中图片链接的自动替换和上传。

- [ ] **任务 6: 实现图片下载与上传 (P2)**
    -   **目标**: 在 `sanity-service.js` 中添加功能，用于处理内嵌在 HTML 中的微信图片。
    -   **子步骤**:
        1.  在 `transformHtmlToPortableText` 之前，解析 HTML，找出所有 `<img>` 标签。
        2.  对于每个图片，使用 `axios` 下载图片 Buffer。
        3.  使用 Sanity 客户端的 `assets.upload('image', buffer)` 方法上传图片。
        4.  获取返回的 Sanity 图片 URL。
    -   **依赖**: `axios`, `jsdom`, `@sanity/client`
    -   **输出**: 更新后的 `sanity-service.js`。

- [ ] **任务 7: 替换 HTML 中的图片链接 (P2)**
    -   **目标**: 将原微信图片链接替换为上传后得到的 Sanity 链接，再进行 Portable Text 转换。
    -   **子步骤**:
        1.  在 `transformHtmlToPortableText` 函数中，完成图片上传后，用 Sanity URL 替换 `<img>` 标签的 `src` 属性。
        2.  将修改后的 HTML 字符串传递给 `htmlToBlocks`。
    -   **依赖**: `jsdom`
    -   **输出**: 更新后的 `sanity-service.js`，能够输出包含正确图片链接的 Portable Text。

## Phase 4: 主流程编排与执行

*   **Milestone**: 完成主脚本的开发，实现全量迁移和增量同步的完整逻辑。

- [ ] **任务 8: 开发主控脚本 (P1)**
    -   **目标**: 编写 `src/main.js`，调用核心模块，完成端到端的迁移流程。
    -   **子步骤**:
        1.  加载并校验环境变量。
        2.  获取 `access_token`。
        3.  获取素材总数，计算分页。
        4.  使用 `for...of` 循环和 `batchget_material` 接口遍历所有 `media_id`。
        5.  在循环中，调用 `getMaterial` 获取文章详情。
        6.  调用 `sanity-service` 处理内容并写入。
        7.  添加详细的控制台日志输出。
    -   **依赖**: `wechat-api.js`, `sanity-service.js`, `dotenv`
    -   **输出**: `src/main.js` 文件。

- [ ] **任务 9: 实现并发控制 (P2)**
    -   **目标**: 引入并发控制，提高迁移效率，避免短时间内大量请求。
    -   **子步骤**:
        1.  在主循环中，使用 `p-limit` 库来包装文章处理和写入的异步任务。
        2.  设置合理的并发数（如 5-10）。
    -   **依赖**: `p-limit`
    -   **输出**: 更新后的 `src/main.js`。

- [ ] **任务 10: 实现增量同步逻辑 (P3)**
    -   **目标**: 添加命令行参数支持，并实现增量同步的判断逻辑。
    -   **子步骤**:
        1.  使用 `process.argv` 判断是否传入 `--incremental` 标志。
        2.  在增量模式下，写入 Sanity 前，先根据 `wx-[media_id]` 查询文章是否存在。
        3.  如果存在，比较微信 `update_time` 和 Sanity 中的时间戳，决定是否覆盖。
    -   **依赖**: `@sanity/client`
    -   **输出**: 更新后的 `src/main.js`，支持两种同步模式。

## Phase 5: 测试与文档完善

*   **Milestone**: 脚本经过充分测试，稳定可靠，并提供清晰的使用文档。

- [ ] **任务 11: 编写使用文档 (P2)**
    -   **目标**: 创建 `README.md`，说明脚本的安装、配置和使用方法。
    -   **子步骤**:
        1.  说明前提条件（IP 白名单等）。
        2.  提供安装步骤 `npm install`。
        3.  解释如何配置 `.env` 文件。
        4.  提供运行命令，包括全量和增量模式。
    -   **依赖**: 无
    -   **输出**: `README.md` 文件。

- [ ] **任务 12: 端到端测试 (P1)**
    -   **目标**: 在真实环境中测试脚本，确保其功能符合预期。
    -   **子步骤**:
        1.  准备少量测试文章。
        2.  执行全量同步，检查 Sanity 中的数据是否正确（格式、图片）。
        3.  在微信后台更新一篇文章，执行增量同步，检查是否被正确覆盖。
        4.  在微信后台新增一篇文章，执行增量同步，检查是否被正确添加。
    -   **依赖**: 真实的微信和 Sanity 环境
    -   **输出**: 测试报告或确认记录。
