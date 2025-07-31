# EdgeOne 部署指南

## 问题说明
EdgeOne平台对Next.js Edge Runtime支持存在兼容性问题，导致304响应处理异常。

## 解决方案

### 方案1: 使用专用的EdgeOne版本文件

1. **替换代理文件**：
   ```bash
   # 备份原文件
   mv src/app/api/proxy/route.ts src/app/api/proxy/route.cloudflare.ts
   
   # 使用EdgeOne专用版本
   mv src/app/api/proxy/route.edgeone.ts src/app/api/proxy/route.ts
   ```

2. **移除Edge Runtime**：
   在 `src/app/content/[id]/page.tsx` 中注释掉：
   ```typescript
   // export const runtime = 'edge';
   ```

### 方案2: 环境变量控制

在 `src/app/api/proxy/route.ts` 中添加环境检测：

```typescript
// 根据环境决定是否使用Edge Runtime
export const runtime = process.env.DEPLOYMENT_TARGET === 'edgeone' ? undefined : 'edge';
```

### 方案3: EdgeOne控制台配置

1. 登录EdgeOne控制台
2. 检查边缘函数设置
3. 配置缓存规则
4. 确保源站配置正确

## 部署步骤

### 对于EdgeOne：
1. 使用 `route.edgeone.ts` 版本
2. 注释掉所有 `export const runtime = 'edge';`
3. 部署到EdgeOne

### 对于CloudFlare/Vercel：
1. 保持原始 `route.ts` 版本
2. 保留 `export const runtime = 'edge';`
3. 正常部署

## 测试验证

部署后使用以下命令测试：

```bash
curl 'https://your-edgeone-domain.com/api/proxy?url=https%3A%2F%2Fjson.heimuer.tv%2Fapi.php%2Fprovide%2Fvod' \
  -H 'if-modified-since: Wed, 30 Jul 2025 13:43:11 GMT' \
  -H 'if-none-match: "163ea020da67b4171a23f86ab3c31d91"'
```

应该返回200状态码而不是304。