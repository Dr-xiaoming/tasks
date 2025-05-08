import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

// 获取当前用户ID的函数
async function getCurrentUserId(req: NextRequest): Promise<number | null> {
  try {
    const authResult = await getAuthUser(req);
    if (!authResult.user) {
      return null;
    }
    return authResult.user.userId;
  } catch (error) {
    console.error('获取用户ID错误:', error);
    return null;
  }
}

// 获取当前用户已领取任务数量的API
export async function GET(request: NextRequest) {
  try {
    // 1. 获取当前用户ID
    const userId = await getCurrentUserId(request);
    if (!userId) {
      return NextResponse.json({ message: '用户未认证' }, { status: 401 });
    }

    // 2. 查询当前用户活跃任务领取数量
    const count = await prisma.taskClaim.count({
      where: {
        userId,
        status: 'active'
      }
    });

    // 3. 返回数量
    return NextResponse.json({ count });

  } catch (error) {
    console.error('获取用户任务领取数量出错:', error);
    return NextResponse.json({ message: '获取任务领取数量时发生错误' }, { status: 500 });
  }
} 