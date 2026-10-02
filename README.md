# 电商客服 AI 岗位实训与出师认证平台

面向中职电子商务课堂、校企实训和客服岗位训练的智能实训系统。系统由 AI 扮演不同性格、情绪和压力等级的客户，记录完整服务过程，按多维指标实时评估学员表现，并支持教师复核、成长画像、出师考核、证书签发与公开核验。

## 核心能力

- **真实对话训练**：覆盖售前咨询、物流、退换货、投诉、差评威胁、赔偿诉求等典型场景。
- **动态客户行为**：客户会根据学员是否理解诉求、解释规则、给出方案和兑现承诺逐轮调整情绪与信任，不会无条件重复指责。
- **实时质量控制**：识别辱骂、威胁、推诿、机械复读、低信息回复和不当承诺，并在训练过程中即时提示。
- **综合评分报告**：汇总每轮对话证据，按服务规范、沟通表达、业务准确性、问题解决、风险合规等维度计算最终成绩。
- **教学闭环**：支持任务发布、训练与考试、教师复核、成长趋势、出师认证、证书签章和公开验真。
- **组织与权限**：提供管理员、师父（教师）和徒弟（学员）三类角色，适配班级、部门及多组织场景。

## 技术栈

- Next.js 15 App Router、React 19、TypeScript
- Prisma 6、SQLite（适合单机、单实例部署）
- OpenAI 兼容模型接口，可接入 DeepSeek 等服务
- Docker Compose、Nginx 反向代理

## 项目结构

```text
app/          页面、布局和服务端接口
components/   通用界面组件
css/          全局样式
lib/          业务逻辑、鉴权、AI、评分和数据访问
prisma/       数据模型、迁移与初始化脚本
public/       静态资源（运行时签章文件不进入仓库）
scripts/      检查、测试、打包和服务器更新脚本
docs/         产品、架构、评分、开发、部署和测试文档
```

## 本地运行

### 环境要求

- Node.js 20 或更高版本
- npm 10 或更高版本

### 首次启动

```bash
npm ci
cp .env.example .env
npm run db:init
npm run dev -- --hostname 127.0.0.1 --port 3003
```

浏览器访问 `http://127.0.0.1:3003`。

开发环境初始化后会生成三类演示账号：`admin/admin`、`teacher/teacher`、`student/student`。这些账号只用于本地演示，生产环境必须立即修改密码，已有数据库升级时不要重复执行 `npm run db:seed`。

macOS 也可以双击根目录的 `一键启动系统.command` 启动本地开发环境。

## 环境变量

复制 `.env.example` 为 `.env` 后填写配置：

```env
DATABASE_URL="file:./dev.db"
SESSION_SECRET="至少 32 字符的随机密钥"
AI_CONFIG_ENCRYPTION_KEY="另一条至少 32 字符的随机密钥"
APP_URL="https://your-domain.example.com"
NEXT_PUBLIC_APP_URL="https://your-domain.example.com"
SESSION_COOKIE_SECURE="true"

AI_MODE="openai"
OPENAI_BASE_URL="https://api.deepseek.com"
OPENAI_API_KEY=""
OPENAI_MODEL="deepseek-chat"
```

- `SESSION_SECRET` 与 `AI_CONFIG_ENCRYPTION_KEY` 必须使用不同的高强度随机值。
- `AI_CONFIG_ENCRYPTION_KEY` 用于保护数据库内保存的模型密钥；丢失后原密文无法恢复。
- `APP_URL` 必须与 `NEXT_PUBLIC_APP_URL` 完全一致。
- 仅在本地明文 HTTP 调试时将 `SESSION_COOKIE_SECURE` 设为 `false`；公网环境必须使用 HTTPS。
- 也可在管理员页面 `/admin/ai` 配置模型服务，系统会优先读取数据库中的加密配置。

## 常用命令

```bash
npm run dev             # 启动开发服务器
npm run check           # 类型检查并执行生产构建
npm run preflight       # 上线前配置检查
npm run test:integrity  # 数据完整性检查
npm run test:quality    # 违禁用语、复读和评分回归测试
npm run test:smoke      # 对运行中的系统执行角色/API 冒烟测试
npm run test:release    # 完整发布检查
npm run db:studio       # 打开 Prisma 数据管理界面
```

健康检查地址为 `GET /api/health`。

## Docker 部署

```bash
cp docker.env.example docker.env
# 编辑 docker.env，填写正式域名、随机密钥和模型配置
docker compose --env-file docker.env up -d --build
```

同一台服务器部署多个系统时，应为每个容器配置不同的 `127.0.0.1` 宿主机端口，再由 Nginx 按域名反向代理；不要将应用容器端口直接暴露到公网。完整步骤、备份恢复和故障排查请查看[部署运维指南](docs/部署运维指南.md)。

## 数据与密钥安全

仓库已经通过 `.gitignore` 和 `.dockerignore` 排除以下内容：

- `.env`、`docker.env` 及其他本机环境配置
- SQLite 数据库及其 journal、WAL、SHM 文件
- API Key、会话密钥和 AI 配置加密密钥
- SSL 私钥、证书和常见密钥容器文件
- 用户上传的签章图片、Docker 数据卷、备份和发布压缩包
- `node_modules`、Next.js 构建缓存和日志

提交代码前建议执行：

```bash
git status --short
git diff --cached
```

请勿将真实密钥写入源码、文档、示例文件或 Git 历史。如果密钥曾经进入 Git 历史，仅删除文件并不安全，必须立即在服务商后台作废并重新生成。

## 文档索引

- [产品与业务说明](docs/产品与业务说明.md)
- [系统架构与数据模型](docs/系统架构与数据模型.md)
- [AI 与评分机制](docs/AI与评分机制.md)
- [开发维护指南](docs/开发维护指南.md)
- [部署运维指南](docs/部署运维指南.md)
- [测试发布清单](docs/测试发布清单.md)
- [典型案例申报材料](docs/典型案例申报材料.md)

以当前代码、`prisma/schema.prisma` 和以上现行文档为准，不再维护重复的历史教程与旧版设计稿。

## 使用授权

当前仓库未附带开源许可证。若计划公开开源或允许第三方复用，请在确认版权与授权范围后补充合适的 `LICENSE` 文件。
