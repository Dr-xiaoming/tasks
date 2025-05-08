import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyPassword } from '@/lib/password';
import jwt from 'jsonwebtoken';

// !! 重要提示：请务必将此密钥移至环境变量 !!
const JWT_SECRET = process.env.JWT_SECRET || 'your_default_secret_key';

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

    // 查找用户
    const user = await prisma.user.findUnique({
      where: {
        username,
      },
    });

    // 用户不存在
    if (!user) {
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    // 比较密码 - 使用我们的自定义验证函数
    const isPasswordValid = await verifyPassword(password, user.passwordHash);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    // 登录成功，生成 JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    // 返回包含 token 的响应
    return NextResponse.json({
      success: true,
      token: token,
    });
  } catch (error) {
    console.error('登录错误:', error);
    return NextResponse.json(
      { error: '登录过程中发生错误' },
      { status: 500 }
    );
  }
} 