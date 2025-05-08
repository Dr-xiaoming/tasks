import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    // 获取用户列表，限制返回的字段以保护隐私
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        createdAt: true,
        _count: {
          select: {
            tasks: true,
            answers: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50 // 限制结果数量
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return NextResponse.json(
      { error: '获取用户列表时发生错误' },
      { status: 500 }
    );
  }
} 