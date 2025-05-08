import { PrismaClient } from '@prisma/client';

// 声明一个全局变量来缓存 Prisma Client 实例
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// 创建 Prisma Client 实例
const client = globalThis.prisma || new PrismaClient({
  log: ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// 添加查询错误处理中间件
client.$use(async (params, next) => {
  try {
    return await next(params);
  } catch (error: any) {
    // 处理连接错误
    if (error.code === 'P1017') {
      console.error('数据库连接已关闭，尝试重新连接...');
      // 记录错误但不重试，由应用层处理重试逻辑
    }
    throw error;
  }
});

// 在开发环境中全局缓存 Prisma 实例
if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = client;
  
  // 只在进程真正退出时断开连接，避免频繁触发
  let isDisconnecting = false;
  process.on('SIGINT', async () => {
    if (!isDisconnecting) {
      isDisconnecting = true;
      console.log('服务关闭，断开Prisma连接');
      await client.$disconnect();
      process.exit(0);
    }
  });
}

export default client; 