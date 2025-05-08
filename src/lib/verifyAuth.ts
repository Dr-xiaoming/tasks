import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

/**
 * 验证用户身份并返回完整用户信息
 * @param req Next.js请求对象或普通Request对象
 * @returns 返回完整用户信息或null
 */
export async function verifyAuth(req: NextRequest | Request) {
  try {
    // 从认证头中获取用户ID
    const authResult = await getAuthUser(req as NextRequest);
    
    if (!authResult.user) {
      return null;
    }

    const userId = authResult.user.id;

    // 查询用户详细信息
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('验证用户身份错误:', error);
    return null;
  }
} 