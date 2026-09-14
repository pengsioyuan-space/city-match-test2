# 城市匹配测试 2（账号与卡密版）

在第一套公开测试基础上独立创建的完整版本。包含 45 道题、11 个生活维度、28 座候选城市，以及自有账号、访问码、订单和报告 API。它使用独立的浏览器存储键，不会影响 `city-match-test` 第一套网站的数据。

## 特点

- GitHub Pages 模式下，计分、结果与历史记录均在浏览器本地完成
- Node 服务模式下，提供独立账号、登录令牌、访问码、订单与报告接口
- 开始测试前显示卡密验证；购买卡密会先登录并创建待支付订单
- 登录后可查看自己的订单状态，测试完成后可同步保存报告
- 适配手机与桌面浏览器
- 可直接通过 GitHub Pages 发布

## 本地预览

只看静态版本时，可运行：

```bash
python -m http.server 8000
```

然后访问 `http://localhost:8000`。

## 运行完整服务

服务器不依赖第三方 npm 包，Node.js 18 以上即可：

```bash
set APP_SECRET=请替换为至少32字节随机密钥
set ADMIN_KEY=请替换为另一条管理密钥
npm start
```

访问 `http://localhost:8787`。数据默认写入 `server/data/*.json`，这些文件已被 Git 忽略，不会上传用户资料。

## CloudBase 云托管

仓库根目录已提供 `Dockerfile`：

- 构建上下文：`.`
- Dockerfile：`./Dockerfile`
- 容器服务端口：`8787`
- 对外访问端口：`80`
- 必填环境变量：`APP_SECRET`、`ADMIN_KEY`

当前 JSON 数据目录只适合功能联调。云托管实例的本地文件可能随重启或扩缩容丢失，正式运行前应把 `users`、`codes`、`orders`、`reports` 迁移到 CloudBase 文档型数据库或 MySQL。

### 自有接口

- `POST /api/auth/register`：注册
- `POST /api/auth/login`：登录并签发自有令牌
- `POST /api/access-codes`：管理端创建访问码
- `POST /api/access-codes/redeem`：核销访问码
- `POST /api/orders`、`GET /api/orders`：创建/查询订单
- `POST /api/orders/:id/confirm`：管理端确认订单
- `POST /api/reports`、`GET /api/reports/:id`：保存/读取测试报告

订单接口只维护订单状态，不包含真实支付。接入微信支付或其他支付平台时，密钥只能配置在服务端环境变量中，不能写入前端或提交到 GitHub。

## 说明

本项目是独立实现，不复制任何第三方账号、密钥、订单、用户数据或私有后端接口。测试结果仅供娱乐和自我探索参考。
