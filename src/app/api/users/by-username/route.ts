import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma'; // 假设您的 Prisma 客户端路径
import { getAuthUser } from '@/lib/auth'; // 假设您的 JWT 验证函数路径

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get('username');

  // 1. 验证JWT Token
  const authResult = await getAuthUser(req);
  if (!authResult) {
    return NextResponse.json({ error: '未经授权' }, { status: 500 });
  }
  // const currentUserId = authResult.userId; // 当前登录用户ID，如果需要的话

  if (!username) {
    return NextResponse.json({ error: '必须提供用户名' }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: {
        username: username,
      },
      select: {
        id: true,
        username: true,
        // 根据需要选择其他字段，但至少需要 id
      },
    });

    if (!user) {
      return NextResponse.json({ error: '用户未找到' }, { status: 404 });
    }

    return NextResponse.json(user, { status: 200 });
  } catch (error) {
    console.error('通过用户名查找用户失败:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
} 