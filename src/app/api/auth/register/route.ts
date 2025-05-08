import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma'; // 导入 Prisma Client 实例
import { hashPassword } from '@/lib/password';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    // 验证输入
    if (!username || !password) {
      return NextResponse.json(
        { error: '用户名和密码不能为空' },
        { status: 400 }
      );
    }

    // 检查用户名是否已存在
    const existingUser = await prisma.user.findUnique({
      where: {
        username,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: '用户名已存在' },
        { status: 409 }
      );
    }

    // 哈希密码
    const hashedPassword = await hashPassword(password);

    // 创建新用户
    const newUser = await prisma.user.create({
      data: {
        username,
        passwordHash: hashedPassword,
        points: 0,
      },
    });

    // 返回用户信息（不含密码）
    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        points: newUser.points,
      }
    }, { status: 201 });
  } catch (error) {
    console.error('注册错误:', error);
    return NextResponse.json(
      { error: '注册过程中发生错误' },
      { status: 500 }
    );
  }
} 