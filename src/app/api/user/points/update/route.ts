import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    // 验证用户身份
    const authResult = await getAuthUser(req);
    if (!authResult.user) {
      if (authResult.tokenExpired) {
        return NextResponse.json({ error: '登录已过期，请重新登录', tokenExpired: true }, { status: 401 });
      }
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const currentUserId = authResult.user.userId;
    const { points } = await req.json();
    
    // 验证积分是否合法
    if (!points || typeof points !== 'number' || isNaN(points)) {
      return NextResponse.json({ error: '无效的积分参数' }, { status: 400 });
    }

    // 查询用户当前积分
    const user = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { points: true }
    });

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // 更新用户积分
    const updatedUser = await prisma.user.update({
      where: { id: currentUserId },
      data: { points: user.points + points },
      select: { points: true, username: true }
    });

    return NextResponse.json({
      success: true,
      message: '积分更新成功',
      points: updatedUser.points
    });
  } catch (error: any) {
    console.error('更新积分失败:', error);
    return NextResponse.json(
      { error: '更新积分失败' },
      { status: 500 }
    );
  }
} 