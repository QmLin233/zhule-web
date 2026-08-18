# 公告系统

## 架构

- 页面：`/rules` → `app/routes/rules.tsx`
- API：`/api/rules` → `app/routes/api.rules.ts`
- 认证：`/api/auth` → `app/routes/api.auth.ts`
- 管理后台：`/admin` → `app/routes/admin.tsx`（需登录）
- 存储：Cloudflare D1（绑定 `DB`）

## 数据结构

```sql
CREATE TABLE rules (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  date TEXT NOT NULL,        -- "2026-08-18"
  important INTEGER NOT NULL DEFAULT 0,  -- 0/1
  createdAt TEXT NOT NULL,   -- ISO 8601
  updatedAt TEXT NOT NULL
);
```

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/rules` | 获取所有公告 |
| POST | `/api/rules` | 创建公告（body: `{ title, content, important? }`） |
| DELETE | `/api/rules?id=xxx` | 删除公告 |

## 管理后台

- 登录通过 `/api/auth` 验证，账号密码从 Workers 环境变量读取
- 部署时设置 secrets：
  ```bash
  wrangler secret put ADMIN        # 管理员账号
  wrangler secret put ADMIN_PASSWD # 管理员密码
  wrangler secret put AUTH_SECRET  # Cookie 签名密钥（随机长字符串）
  ```

## 部署

1. 创建 D1 数据库：`wrangler d1 create zhule`
2. 将返回的 `database_id` 填入 `wrangler.json`
3. 建表：`wrangler d1 execute zhule --command "CREATE TABLE IF NOT EXISTS rules (id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL, date TEXT NOT NULL, important INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);"`
4. `npm run deploy`
