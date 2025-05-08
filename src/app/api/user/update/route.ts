import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(req: NextRequest) {
  try {
    const { id, username } = await req.json();

    // 验证输入
    if (!id || !username) {
      return NextResponse.json(
        { error: '用户ID和用户名不能为空' },
        { status: 400 }
      );
    }

    // 检查用户名是否已被其他用户使用
    const existingUser = await prisma.user.findFirst({
      where: {
        username,
        NOT: {
          id: parseInt(id),
        },
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: '用户名已存在' },
        { status: 409 }
      );
    }

    // 更新用户信息
    const updatedUser = await prisma.user.update({
      where: {
        id: parseInt(id),
      },
      data: {
        username,
      },
      select: {
        id: true,
        username: true,
        points: true,
      },
    });

    // 返回更新后的用户信息
    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    console.error('更新用户信息错误:', error);
    return NextResponse.json(
      { error: '更新用户信息过程中发生错误' },
      { status: 500 }
    );
  }
} 