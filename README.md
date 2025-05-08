# Next.js 聊天应用

## 技术栈

- Next.js 15
- React 18
- TypeScript
- Prisma (数据库ORM)
- JWT (认证)
- Ant Design (UI组件库)

## 开发和部署

### 安装依赖

```bash
npm install
```

### 数据库设置

```bash
npx prisma migrate dev
```

### 开发环境

```bash
npm run dev
```

### 生产环境

```bash
npm run build
npm run start
```

# 项目启动教程

本教程将指导你如何启动本项目。

## 1. 创建 .env 文件

在项目根目录下创建一个名为 `.env.local` 的文件。这个文件用于存放环境变量，例如数据库连接信息、API 密钥等。

**请注意：** `.env.local` 文件不应该提交到版本库中，因为它可能包含敏感信息。确保已将其添加到 `.gitignore` 文件中。

示例 `.env.local` 文件内容：

```env
# 数据库连接信息 (示例)
DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/DATABASE"

# Sealos 对象存储 (示例)
SEALOS_S3_ENDPOINT="your-s3-endpoint"
SEALOS_S3_ACCESS_KEY="your-access-key"
SEALOS_S3_SECRET_KEY="your-secret-key"
SEALOS_S3_BUCKET_NAME="your-bucket-name"
SEALOS_S3_REGION="your-region" # 通常可以省略或设置为 "us-east-1"

# NextAuth.js (如果使用)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="somereallylongrandomstring" # 生成一个安全的随机字符串

# 其他自定义环境变量
# API_KEY="your_api_key"
```

请根据你的实际配置修改上述示例中的值。

## 2. 创建 Sealos MySQL 数据库

你需要一个 MySQL 数据库来存储应用数据。Sealos 提供开箱即用的 MySQL 服务。

1.  访问 [Sealos 国内官网](https://cloud.sealos.io/) 并登录你的账户。
2.  在应用市场中找到并部署 MySQL 服务。
3.  部署完成后，你将获得数据库的连接地址、端口、用户名和密码。
4.  将这些信息更新到你的 `.env.local` 文件中的 `DATABASE_URL` 变量。
    例如：`DATABASE_URL="mysql://your_user:your_password@your_sealos_mysql_host:your_sealos_mysql_port/your_database_name"`

## 3. 创建 Sealos 云服务存储桶 (对象存储)

如果你的应用需要存储用户上传的文件、图片或其他静态资源，可以使用 Sealos 的对象存储服务。

1.  访问 [Sealos 国内官网](https://cloud.sealos.io/) 并登录你的账户。
2.  在应用市场中找到并部署对象存储服务（通常是基于 MinIO 的 S3 兼容服务）。
3.  部署完成后，你将获得以下信息：
    *   Endpoint (服务地址)
    *   Access Key (访问密钥)
    *   Secret Key (私有密钥)
4.  创建一个存储桶 (Bucket)。
5.  将这些信息以及你创建的存储桶名称更新到 `.env.local` 文件中对应的变量：
    *   `SEALOS_S3_ENDPOINT`
    *   `SEALOS_S3_ACCESS_KEY`
    *   `SEALOS_S3_SECRET_KEY`
    *   `SEALOS_S3_BUCKET_NAME`

## 4. 安装依赖

在项目根目录下打开终端，运行以下命令安装项目所需的依赖包：

```bash
npm install
# 或者
yarn install
```

## 5. 启动项目

完成以上配置后，你可以启动 Next.js 开发服务器：

```bash
npm run dev
# 或者
yarn dev
```

打开浏览器并访问 `http://localhost:3000` (或你在 `.env.local` 中 `NEXTAUTH_URL` 指定的端口)，你应该能看到项目正在运行。

## 6. 构建和生产启动 (可选)

当准备好将应用部署到生产环境时，可以使用以下命令：

```bash
# 构建应用
npm run build
# 或者
yarn build

# 启动生产服务器
npm run start
# 或者
yarn start
``` 


NEXT_PUBLIC_AI_ASSIST_URL变量用来控制AI回答的跳转链接