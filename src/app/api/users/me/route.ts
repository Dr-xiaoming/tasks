import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    // 验证用户身份
    const authResult = await getAuthUser(req);
    if (!authResult.user) {
      if (authResult.tokenExpired) {
        return NextResponse.json({ error: '登录已过期，请重新登录', tokenExpired: true }, { status: 401 });
      }
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const userId = authResult.user.userId;

    // 查询用户基本信息
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        username: true,
        points: true,
        createdAt: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // 确保id字段是数字类型，避免类型转换问题
    return NextResponse.json({
      ...user,
      id: Number(user.id)
    });
  } catch (error) {
    console.error('获取当前用户信息失败:', error);
    return NextResponse.json(
      { error: '获取当前用户信息时发生错误' },
      { status: 500 }
    );
  }
} 