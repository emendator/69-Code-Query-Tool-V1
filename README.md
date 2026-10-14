# 69 码查询器

**简体中文** | [English](README.en.md)

[![Python](https://img.shields.io/badge/Python-3.9%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)

一个可自托管的产品条码（69 码）数据管理与查询工具：把 Excel 里的产品清单导入本地 SQLite，自动识别「型号 / 品名 / 69 码」等列，之后即可用完整或部分 69 码快速反查产品信息，并支持批量查询、结果导出与多公司（多租户）数据隔离。

> **关于「69 码」**：指以 `69` 开头的中国商品条码（EAN-13）。本工具**不联网查询任何第三方条码数据库**，只在你自己导入的数据范围内检索。

---

## 目录

- [项目简介](#项目简介)
- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [配置说明](#配置说明)
- [使用示例](#使用示例)
- [账号与权限模型](#账号与权限模型)
- [数据存储与备份](#数据存储与备份)
- [API 一览](#api-一览)
- [项目结构](#项目结构)
- [部署（自托管）](#部署自托管)
- [常见问题](#常见问题)
- [更新记录](#更新记录)
- [贡献](#贡献)
- [许可证](#许可证)
- [联系方式](#联系方式)

---

## 项目简介

很多中小团队的产品清单仍以 Excel 维护，靠人工查找条码效率很低。69 码查询器把这件事变成一次导入、长期可查：

1. **导入**：上传 `.xlsx` / `.xls` / `.csv`，系统自动识别哪一列是型号、哪一列是品名、哪一列是 69 码，允许人工修正，并可把匹配规则存入「语义库」供下次自动复用；
2. **查询**：在查询页按行粘贴条码，一次性做精确 + 模糊匹配，结果标注匹配方式并可导出；
3. **协作**：内置三级权限、邀请码注册、多公司数据隔离与账号有效期管理，适合一个团队共用一个实例、各公司数据互不可见。

全部数据存放在本地 SQLite 文件中，**无需安装数据库服务**，克隆下来即可运行。

## 功能特性

**数据导入**

- 支持 `.xlsx` / `.xls` / `.csv`，上传后立即解析预览
- 列名自动匹配：内置中英文关键词 → 公司语义库 → 序列相似度模糊匹配，给出高 / 中 / 低置信度，可在界面上手动改配
- 可选「将本次匹配规则加入语义库」，下次同格式表格自动匹配
- 导入结果给出成功条数与跳过原因明细（69 码为空、文件内重复、库中已存在）

**69 码查询**

- 多行输入，每行一个条码或关键词，批量查询
- 精确匹配 + 模糊匹配合并展示，逐行标注「精确 / 模糊 / 未找到」
- 结果可勾选后导出为 Excel（自选导出列）

**数据管理**

- 搜索（300ms 防抖）、分页（50 / 100 / 200 / 500 / 1000 条每页）、按列值筛选
- 新增、编辑、单条删除、批量删除
- 重复 69 码红色高亮 + 顶部提醒，一键去重（每组保留 id 最小、即最早导入的一条）

**列显示配置**

- 「数据管理表」与「查询结果表」两套**互相独立**的列配置
- 拖拽排序、自定义列显示名、列宽（40–600px）、显示 / 隐藏
- 保存后对该公司的全部成员生效

**账号与权限**

- 三级角色：最高级管理员（`super_admin`）> 管理员（`admin`）> 用户（`user`），另有一次性「游客」
- 邀请码注册：一次一码、注册成功即作废，可设邀请码有效期与账号默认有效期
- 多公司数据物理隔离：每家公司一个独立 SQLite 文件
- 账号有效期管理：到期自动禁止登录，管理员可延长或清除账号
- 密码以 bcrypt 哈希存储，登录凭证为 JWT（HS256）

**界面**

- 深色 / 浅色双主题，可一键切换并自动记忆
- 自研零依赖动效（Canvas 粒子背景、按钮涟漪、磁吸、3D 倾斜、计数滚动、阅读进度条），并尊重系统「减少动态效果」偏好自动降级

## 技术栈

| 层次 | 选型 |
| --- | --- |
| 前端框架 | React 18 + TypeScript 5.5（函数组件 + Hooks；页面切换由应用内状态管理，未引入 react-router） |
| UI 组件 | Ant Design 5 + @ant-design/icons |
| 前端构建 | Vite 5（开发端口 5178，`/api` 代理至后端 8005） |
| 前端 HTTP / Excel | axios；SheetJS（xlsx 0.18，浏览器端生成 .xlsx） |
| 后端框架 | Python 3.9+ / FastAPI（uvicorn），自动生成接口文档 `/docs` |
| ORM / 数据库 | SQLAlchemy 2.x；SQLite（主库开启 WAL 与外键） |
| 表格解析 | pandas + openpyxl |
| 认证 | passlib[bcrypt] 哈希 + python-jose（JWT HS256）+ email-validator |
| 一键启动 | `启动.bat` + `start.ps1`（Windows PowerShell） |

## 快速开始

### 环境要求

- **Python 3.9+**：<https://www.python.org/downloads/>（Windows 安装时请勾选 *Add Python to PATH*）
- **Node.js 18+**：<https://nodejs.org/>
- Windows 一键启动脚本依赖 PowerShell（系统自带）；macOS / Linux 请使用下方手动步骤

### 一键启动（Windows）

1. 双击项目根目录的 **`启动.bat`**
2. 脚本会自动：创建 Python 虚拟环境 `.venv` → 生成/补全 `.env` 凭据 → 安装后端与前端依赖 → 启动前后端服务 → 打开浏览器
3. 首次运行需要联网下载依赖，请耐心等待
4. 浏览器访问 **<http://localhost:5178>**；后端为 <http://localhost:8005>，接口文档为 <http://localhost:8005/docs>
5. 前后端各占一个命令行窗口，**关闭窗口即停止对应服务**
6. 启动完成后控制台会打印**超级管理员账号与口令**（首次运行时由脚本随机生成并写入 `.env`）

之后再次使用只需重复第 1 步；依赖已安装时脚本会自动跳过安装。

### 手动启动（Windows / macOS / Linux）

后端（**需在 `backend/` 目录内执行**，代码使用顶层模块导入）：

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS / Linux: source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8005
```

前端（另开一个终端）：

```bash
cd frontend
npm install
npm run dev        # http://localhost:5178
```

生产构建：`npm run build`，产物输出到 `frontend/dist`。

### 首次登录

系统首次启动时会自动建表，并创建**内置最高级管理员**与**默认公司**。

凭据一律由环境变量注入，代码中**不含任何默认口令，也没有可预测的密钥回退值**：

| 必需的环境变量 | 用途 |
| --- | --- |
| `JWT_SECRET_KEY` | JWT 签名密钥（足够长的随机字符串） |
| `SUPER_ADMIN_PASSWORD` | 内置最高级管理员的初始口令，仅首次初始化时使用 |
| `DEFAULT_COMPANY_DB_PASSWORD` | 默认公司的数据库口令（其他账号加入该公司时需要） |

配置方式二选一：

1. **Windows 一键启动**：直接双击 `启动.bat`。首次运行会在项目根目录自动生成 `.env` 并写入随机值，启动完成后在控制台打印超级管理员账号与口令。
2. **手动配置**：复制 `.env.example` 为 `.env` 填写上述三项，或直接设置同名环境变量（进程环境变量优先于 `.env`）。

> ⚠️ 上述三项任意一项缺失，后端启动会**直接报错退出**，而不是回退到某个内置默认值——这是有意设计，避免把可预测的凭据带上线。

登录后可在「用户管理」中分发邀请码供他人注册；也可以点击「以游客身份登录」先体验全部业务功能（游客数据在退出时清除）。

## 配置说明

| 配置项 | 位置 | 说明 |
| --- | --- | --- |
| `JWT_SECRET_KEY` | 环境变量 / `.env`（**必需**） | JWT 签名密钥。缺失时后端启动直接报错退出，无内置默认值 |
| `SUPER_ADMIN_PASSWORD` | 环境变量 / `.env`（**必需**） | 内置最高级管理员的初始口令，仅首次初始化时使用 |
| `DEFAULT_COMPANY_DB_PASSWORD` | 环境变量 / `.env`（**必需**） | 默认公司的数据库口令 |
| `SUPER_ADMIN_USERNAME` | 环境变量 / `.env`（可选） | 管理员用户名，默认 `admin` |
| `SUPER_ADMIN_EMAIL` | 环境变量 / `.env`（可选） | 管理员邮箱，默认占位值 `admin@example.com`，请按需覆盖 |
| `DEFAULT_COMPANY_NAME` | 环境变量 / `.env`（可选） | 默认公司名称，默认 `我的公司` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 环境变量 / `.env`（可选） | 登录令牌有效期（分钟），默认 `720`（12 小时） |
| 数据目录 | `backend/config.py` 的 `DATA_DIR` | 默认 `<项目根>/data`，含主库与上传临时目录 |
| CORS 允许来源 | `backend/main.py` | 默认仅允许 `http://localhost:5178`；换成其他端口或域名访问时需同步修改 |
| 后端端口 | 8005 | `start.ps1` 与直接运行 `main.py` 均使用 8005，`frontend/vite.config.ts` 的 `/api` 代理指向它 |
| 前端开发端口 | 5178 | `frontend/vite.config.ts` |
| 账号到期提醒阈值 | `backend/config.py` 的 `EXPIRE_WARN_DAYS` | 默认 `7` 天，进入该区间后界面显示到期提醒 |

> `.env` 放在**项目根目录**，已被 `.gitignore` 忽略，可安全保存本地或生产密钥；进程环境变量优先于 `.env`。`deploy/` 的 systemd 单元通过 `EnvironmentFile` 读取同一个文件，`deploy.sh` / `update.sh` 会在部署时自动补全缺失的键（不会覆盖已有值）。

## 使用示例

以下流程可在启动后 3 分钟内走完：

**1. 导入数据** — 左侧「数据管理」→ 顶部「导入」

- 拖入或选择 Excel / CSV 文件（**第一行必须是列名**）
- 系统自动匹配「型号 / 品名 / 69 码」三列，检查匹配结果，不对则用下拉框手动修改
- 建议勾选「将本次匹配规则加入语义库」
- 点击「确认导入」，完成后显示导入条数与跳过原因

**2. 查询 69 码** — 左侧「69 码查询」

```
6901234567890
6901234567891
```

多行输入后点击「查询」：完整条码走精确匹配，未命中的行会自动做模糊匹配，结果合并为一张表并标注匹配方式；顶部统计精确 / 模糊 / 未找到的数量。

**3. 导出结果** — 勾选需要导出的行 →「导出」→ 选择列 → 保存为 Excel。

**4. 调整显示** — 左侧「列配置」→ 切换「数据管理表 / 查询结果表」→ 拖拽排序、改显示名与列宽、控制显隐 →「保存配置」。

## 账号与权限模型

| 权限 | 最高级管理员 `super_admin` | 管理员 `admin` | 用户 `user` |
| --- | --- | --- | --- |
| 69 码查询 / 数据管理 / 列配置 | ✅ | ✅ | ✅ |
| 用户管理（邀请码 + 账号） | ✅ | ✅ | ❌ |
| 分发一级邀请码（注册为管理员） | ✅ | ❌ | ❌ |
| 分发二级邀请码（注册为用户） | ✅ | ✅ | ❌ |
| 延长 / 清除账号 | ✅（全部账号） | ✅（仅自己邀请的） | ❌ |
| 创建公司 / 加入公司 | ✅ | ✅ | ❌ |
| 修改公司数据库密码 | ✅ | ✅ | ❌ |

- **注册**：需要**邮箱 + 邀请码**。一级邀请码注册为管理员（可创建或加入公司），二级邀请码注册为普通用户（仅可加入已有公司）。
- **数据隔离**：每家公司对应一个独立 SQLite 文件；同公司账号共享同一份 69 码库，不同公司之间数据互不可见。加入公司时需要该公司管理员设置的「公司数据库密码」。
- **孤儿公司清理**：公司没有任何注册账号时，该公司及其数据库文件会被自动删除。
- **游客模式**：一键体验全部业务功能，没有用户管理入口，退出登录后自动删除其临时账号、临时公司与数据库文件。

## 数据存储与备份

```
data/
├── 69code.db                      主库：users / companies / invite_codes
├── companies/company_{id}.db      公司业务库：products / semantic_mappings / column_config
└── upload/                        导入过程中的临时上传目录
```

- **备份**：复制整个 `data/` 目录即可（主库 + 全部公司库）。
- **还原**：停止程序后，用备份的 `data/` 目录覆盖，再重启。
- **清空重来**：停止程序后删除 `data/69code.db` 与 `data/companies/`，重启后会自动重建（系统表 + 默认公司 + 内置管理员）。
- 日志默认输出到 `logs/`（`backend.log` / `frontend.log`）；`data/`、`logs/`、`.env`、`.venv/`、`node_modules/`、`frontend/dist/` 均已加入 `.gitignore`，不会进入版本库。

## API 一览

所有接口统一返回 `{ success, data, message }`；参数错误、权限不足等以 HTTP 异常返回，前端拦截器统一提示。完整的交互式文档见运行后的 `/docs`。

| 模块 | 接口 | 方法 | 功能 |
| --- | --- | --- | --- |
| 认证 | `/api/auth/login` | POST | 用户名 + 密码登录，返回 token 与用户信息 |
| 认证 | `/api/auth/register/check-invite` | POST | 注册前校验邀请码并返回其级别 |
| 认证 | `/api/auth/register` | POST | 邮箱 + 邀请码注册（一级码可创建/加入公司，二级码仅可加入） |
| 认证 | `/api/auth/me` | GET | 获取当前登录用户信息 |
| 认证 | `/api/auth/guest/login` | POST | 游客登录（创建临时公司与账号） |
| 认证 | `/api/auth/logout` | POST | 退出登录；游客同时清理全部临时数据 |
| 认证 | `/api/auth/company/password` | PUT | 管理员修改本公司数据库密码 |
| 邀请码 | `/api/invites` | GET / POST | 查看 / 生成邀请码（按角色限定范围与级别） |
| 邀请码 | `/api/invites/{id}` | DELETE | 撤销未使用的邀请码 |
| 用户 | `/api/users` | GET | 账号列表（超管可见全部；管理员仅见自己与自己邀请的） |
| 用户 | `/api/users/{id}/extend` | PUT | 延长 / 设置账号有效期 |
| 用户 | `/api/users/{id}` | DELETE | 清除账号（超管清除管理员时级联清除其邀请的用户） |
| 查询 | `/api/query/single` | GET | 按完整 69 码精确查询 |
| 查询 | `/api/query/fuzzy` | GET | 按关键词模糊搜索（69 码 / 型号 / 品名 / 来源） |
| 查询 | `/api/query/batch` | POST | 多行 69 码批量精确查询 |
| 查询 | `/api/query/export` | POST | 按输入的码集合取数（供导出使用） |
| 数据管理 | `/api/data` | GET / POST | 分页列表 / 新增记录 |
| 数据管理 | `/api/data/{id}` | PUT / DELETE | 编辑 / 删除单条记录 |
| 数据管理 | `/api/data/batch-delete` | POST | 按 id 列表批量删除 |
| 数据管理 | `/api/data/duplicate-codes` | GET | 返回存在重复的 69 码列表 |
| 数据管理 | `/api/data/duplicates` | GET | 返回所有重复 69 码对应的记录 |
| 数据管理 | `/api/data/deduplicate` | POST | 一键去重（每组保留最早导入的一条） |
| 导入 | `/api/import/upload` | POST | 上传 Excel / CSV 并返回解析预览 |
| 导入 | `/api/import/upload-temp` | POST | 先上传文件到公司临时目录，供确认导入时使用 |
| 导入 | `/api/import/match-columns` | POST | 自动匹配文件列名（型号 / 品名 / 69 码）与置信度 |
| 导入 | `/api/import/confirm` | POST | 按用户确认的列映射导入，可写入语义库 |
| 语义库 | `/api/semantic` | GET / POST | 查看 / 新增列名语义映射 |
| 列配置 | `/api/config/columns` | GET / PUT | 按 `data` / `query` 视图读取、保存列显示配置 |

## 项目结构

```
69code-query/
├── backend/            后端（FastAPI + SQLAlchemy）
│   ├── main.py             应用入口：CORS、启动钩子、查询 / 数据 / 导入 / 语义 / 列配置 API
│   ├── routers/            子路由：auth.py（认证）、invites.py（邀请码）、users.py（账号）
│   ├── config.py           全局配置：路径、JWT、内置管理员与默认公司、列名关键词库
│   ├── database.py         主库 + 多公司库的引擎 / 会话 / 建表与删除
│   ├── models.py           ORM 模型（系统表 + 业务表）
│   ├── schemas.py          Pydantic 请求 / 响应模型与校验规则
│   ├── crud.py             数据访问层：产品、导入去重、语义库、列配置、账号组织
│   ├── matcher.py          Excel 列名自动匹配引擎（语义库 + 内置关键词 + 相似度）
│   ├── security.py         bcrypt 哈希、JWT 签发解析、邀请码生成
│   ├── deps.py             鉴权依赖：当前用户 / 三级角色 / 公司库会话
│   ├── init_auth.py        启动初始化：建表、默认公司与管理员、旧库迁移、孤儿与游客清理
│   └── common.py           账号剩余天数、对外用户信息组装等公共函数
├── frontend/           前端（React 18 + TypeScript + Vite）
│   ├── index.html          SPA 页面壳
│   ├── vite.config.ts      开发端口 5178，/api 代理到 8005
│   └── src/
│       ├── App.tsx             应用外壳：登录门控、侧栏与顶栏、页面切换、提醒横幅
│       ├── theme.ts            antd 深 / 浅主题令牌与组件级定制
│       ├── index.css           全局样式与双主题 CSS 变量
│       ├── motion.css          自研动效样式
│       ├── api/index.ts        axios 封装与全部后端接口函数
│       ├── types/index.ts      与后端 schemas 对应的 TS 类型
│       ├── context/            全局状态：主题 / 登录态 / 列配置
│       ├── components/         ThemeToggle、ImportModal、ExportDrawer、motion/*
│       └── pages/              AuthPage、QueryPage、DataManagePage、ConfigPage、UserManagePage
├── data/               运行期数据（主库 + 各公司库，已在 .gitignore 中）
├── docs/               设计与实现文档（需求分析 / 技术方案 / 数据库设计 / 实现步骤）
├── deploy/             自托管部署脚本（deploy.sh / update.sh / nginx.conf / systemd 服务）
├── logs/               运行日志与自动生成的服务启动脚本（已在 .gitignore 中）
├── 启动.bat            Windows 一键启动入口（调用 start.ps1）
├── start.ps1           启动脚本：环境检测 → 凭据生成 → 安装依赖 → 启动前后端 → 打开浏览器
├── .env.example        凭据模板（复制为 .env 后填写；.env 已被 .gitignore 忽略）
└── README.md           本文档
```

**想改某个功能时，按这条链路定位代码**：页面组件（`frontend/src/pages/`）→ 接口函数（`frontend/src/api/index.ts`）→ 后端路由（`backend/main.py` 或 `backend/routers/`）→ `crud.py` → `models.py`。

## 部署（自托管）

`deploy/` 目录提供一套面向 Ubuntu 的部署脚本与配置模板：

| 文件 | 用途 |
| --- | --- |
| `deploy/deploy.sh` | 一键部署：安装系统依赖与 Node.js → 创建 venv 并安装后端依赖 → 构建前端 → 配置 systemd 服务与 Nginx → 放行防火墙端口 |
| `deploy/update.sh` | 更新已有部署：修正目录权限 → 更新后端依赖 → 重新构建前端 → 重启服务 |
| `deploy/nginx.conf` | Nginx 站点模板：托管 `frontend/dist` 静态文件，并把 `/api` 反代到后端 |
| `deploy/69code-query.service` | systemd 服务单元：以 `www-data` 运行 uvicorn（默认监听 `127.0.0.1:8006`，仅内网由 Nginx 反代） |

```bash
# 将项目放到脚本约定的目录后执行（默认安装路径 /opt/69code-query）
sudo bash deploy/deploy.sh <端口>      # 参数为对外访问端口，缺省值见脚本内 PORT 定义
```

几点提示：

- systemd 单元通过 `EnvironmentFile` 读取安装目录下的 `.env`，请在其中写入生产用的 `JWT_SECRET_KEY`（`.env` 已被 `.gitignore` 忽略，不会入库）。
- 服务器内存较小时，`update.sh` 会限制 Node 堆内存（`--max-old-space-size=1024`）并在必要时启用 swap；也可以在本地执行 `npm run build` 后只上传 `frontend/dist`。
- 若部署在非 `localhost:5178` 的来源下访问，记得同步调整 `backend/main.py` 中的 CORS 允许来源。

## 常见问题

**Q：忘记登录密码怎么办？**
当前版本没有自助找回密码的功能，密码以 bcrypt 哈希存储、无法反查明文。请联系你所部署实例的最高级管理员，在「用户管理 → 账号管理」中清除该账号后，用新的邀请码重新注册。

**Q：注册时提示邀请码无效？**
邀请码「一次一码」，可能已被使用或已过期，请向管理员重新索取。

**Q：加入公司时提示公司数据库密码错误？**
公司数据库密码由该公司管理员在注册时设置，可联系该管理员确认或请其在顶栏「修改公司数据库密码」中重置。

**Q：游客模式的数据会保留吗？**
不会。游客的临时账号、临时公司与数据库文件会在退出登录时一并删除，仅供体验。

**Q：启动时报「Python 未找到」/「Node.js 未找到」？**
安装 Python 3.9+（勾选 *Add Python to PATH*）与 Node.js 18+（LTS），重新运行 `启动.bat`。

**Q：端口 8005 / 5178 被占用？**
启动脚本会自动清理本项目遗留的旧进程（只清理本项目的 uvicorn / vite）。若仍被其他程序占用，可关闭占用程序，或修改端口：后端改 `start.ps1` 中的 `--port 8005`；前端改 `start.ps1` 中的 `--port 5178` 以及 `frontend/vite.config.ts` 中的代理目标。

**Q：网页打不开 / 服务窗口一闪而过？**
新版的启动窗口不会自动关闭，失败时也会停住并显示错误，同时日志写入 `logs/backend.log` 与 `logs/frontend.log`。常见原因是端口被占用，或依赖安装不完整——删除 `.venv` 与 `frontend/node_modules` 后重新运行 `启动.bat` 即可。

**Q：启动脚本输出乱码？**
脚本本身全部使用英文。若仍有乱码，请将 Windows 系统区域设置为 UTF-8（设置 → 时间和语言 → 语言和区域 → 管理语言设置 → 更改系统区域设置 → 勾选 Beta 版 UTF-8）。

**Q：数据库文件在哪？如何备份？**
主库 `data/69code.db`（账号 / 公司 / 邀请码），业务库 `data/companies/company_{id}.db`（69 码 / 语义库 / 列配置，按公司隔离）。备份整个 `data/` 目录即可。

## 更新记录

### v2.0.0

- 全新界面：深色编辑部工艺风 UI 重构，全部页面与组件视觉系统重做
- 深色 / 浅色双主题，可一键切换并自动记忆（基于 antd token + CSS 变量）
- 登录与注册合并为一张可 3D 翻转的认证卡片，移除旧的独立登录 / 注册页
- 全站动效体系（零第三方依赖）：Canvas 粒子背景、按钮涟漪、磁吸、3D 倾斜、流光、计数滚动、页面模糊入场、阅读进度条
- 修复登录输入框错位、顶栏眉题错位、登录背景事件遮挡、表格滚动条样式、浏览器自动填充覆盖登录框底色等问题

### v1.1.0

- 新增登录 / 注册（邮箱 + 邀请码）与三级权限（最高级管理员 > 管理员 > 用户）
- 新增游客模式（体验全部功能，不保留任何数据）
- 新增多公司数据隔离（一公司一个 69 码库）、公司库密码管理、孤儿公司自动清理
- 新增邀请码机制（一次一码、可设有效期）与账号有效期管理（到期禁止登录、延长 / 清除）
- 新增用户管理界面（邀请码管理 + 账号管理）与管理员级联清除
- 密码改用 bcrypt 哈希存储，登录凭证改用 JWT

### v1.0.0

- 项目初版完成：69 码查询、数据管理、列配置、Excel 导入与导出

## 贡献

欢迎提交 Issue 与 Pull Request。

- 提交前请确认：`cd frontend && npm run build` 可通过（含 TypeScript 类型检查）
- 请勿在提交中包含 `data/`、`logs/`、`.env` 等本地运行数据或凭据
- (待补充：贡献指南 / 提交规范 / 行为准则)

## 许可证

(待补充：本仓库当前未包含 `LICENSE` 文件，许可证尚未确定。在确定并添加许可证前，默认保留全部权利。)

## 联系方式

(待补充：维护者 / 作者署名、Issue 地址或联系邮箱。)
