import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import jwt from 'jsonwebtoken';

// !! 确保 JWT_SECRET 与登录时使用的密钥一致，并从环境变量读取 !!
const JWT_SECRET = process.env.JWT_SECRET || 'your_default_secret_key';

// 定义 JWT Payload 接口
interface JwtPayload {
  userId: number;
  // 可能有其他字段，例如 username, iat, exp 等
}

// 输入验证模式
const createAnswerSchema = z.object({
  content: z.string().min(1, '回答内容不能为空'),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 从请求中获取 token 并解析用户 ID
    let userId: number | null = null;
    
    try {
      const authHeader = req.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7); // 移除 "Bearer " 前缀
        // 验证 token 并解码
        const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
        userId = decoded.userId;
      }
    } catch (error) {
      console.warn('JWT verification failed or token not provided:', error);
      return NextResponse.json({ error: '用户未认证或 Token 无效' }, { status: 401 });
    }
    
    if (!userId) {
      return NextResponse.json({ error: '用户未认证或 Token 无效' }, { status: 401 });
    }

    const { id } = params;
    const taskIdInt = parseInt(id, 10);
    if (isNaN(taskIdInt)) {
      return NextResponse.json({ error: '无效的任务 ID' }, { status: 400 });
    }

    const body = await req.json();
    const validation = createAnswerSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: '输入无效', details: validation.error.errors }, { status: 400 });
    }

    const { content } = validation.data;

    // 检查任务是否存在且开放
    const task = await prisma.task.findUnique({
      where: { id: taskIdInt },
      select: { status: true, userId: true }, // 只需要检查状态和提问者ID
    });

    if (!task) {
      return NextResponse.json({ error: '任务未找到' }, { status: 404 });
    }

    if (task.status !== 'open') {
      return NextResponse.json({ error: '任务已关闭，无法回答' }, { status: 400 });
    }
    
    // 用户不能回答自己的问题
    if (task.userId === userId) {
      return NextResponse.json({ error: '不能回答自己的问题' }, { status: 403 });
    }

    // 创建回答
    const newAnswer = await prisma.answer.create({
      data: {
        content,
        taskId: taskIdInt,
        userId,
        isAdopted: false, // 默认未采纳
      },
      include: { // 返回包含用户信息的新回答
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    return NextResponse.json(newAnswer, { status: 201 });

  } catch (error:any) {
    console.error('提交回答错误:', error);
     if (error instanceof z.ZodError) {
         return NextResponse.json({ error: '输入数据格式错误', details: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { error: '提交回答过程中发生错误' },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const taskIdInt = parseInt(id, 10);
    if (isNaN(taskIdInt)) {
      return NextResponse.json({ error: '无效的任务 ID' }, { status: 400 });
    }

    // 检查任务是否存在
    const task = await prisma.task.findUnique({
      where: { id: taskIdInt },
    });

    if (!task) {
      return NextResponse.json({ error: '任务未找到' }, { status: 404 });
    }

    // 获取该任务的所有回答
    const answers = await prisma.answer.findMany({
      where: { taskId: taskIdInt },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(answers, { status: 200 });
  } catch (error) {
    console.error('获取回答错误:', error);
    return NextResponse.json(
      { error: '获取回答过程中发生错误' },
      { status: 500 }
    );
  }
} 