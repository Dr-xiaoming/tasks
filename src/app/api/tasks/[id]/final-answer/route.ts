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
const createFinalAnswerSchema = z.object({
  content: z.string().min(1, '最终答案内容不能为空'),
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
    const validation = createFinalAnswerSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: '输入无效', details: validation.error.errors }, { status: 400 });
    }

    const { content } = validation.data;

    // 检查任务是否存在且开放
    const task = await prisma.task.findUnique({
      where: { id: taskIdInt },
      select: { 
        status: true, 
        userId: true
      },
    });

    if (!task) {
      return NextResponse.json({ error: '任务未找到' }, { status: 404 });
    }

    if (task.status !== 'open') {
      return NextResponse.json({ error: '任务已关闭，无法提交最终答案' }, { status: 400 });
    }
    
    // 用户不能为自己的问题提交最终答案
    if (task.userId === userId) {
      return NextResponse.json({ error: '不能为自己的问题提交最终答案' }, { status: 403 });
    }
    
    // 检查用户是否已经提交过最终答案
    const existingAnswer = await prisma.finalAnswer.findFirst({
      where: {
        taskId: taskIdInt,
        userId: userId
      }
    });
    
    // 如果已提交过，则更新现有答案
    let finalAnswer;
    if (existingAnswer) {
      finalAnswer = await prisma.finalAnswer.update({
        where: {
          id: existingAnswer.id
        },
        data: {
          content: content,
          updatedAt: new Date()
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });
    } else {
      // 创建新的最终答案
      finalAnswer = await prisma.finalAnswer.create({
        data: {
          content,
          taskId: taskIdInt,
          userId,
        },
        include: { // 返回包含用户信息的新最终答案
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });
    }
    
    // 同步到 Answer 表
    if (finalAnswer && finalAnswer.id) {
      const existingRegularAnswer = await prisma.answer.findFirst({
        where: {
          taskId: taskIdInt,
          userId: userId,
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (existingRegularAnswer) {
        await prisma.answer.update({
          where: {
            id: existingRegularAnswer.id,
          },
          data: {
            content: content,
            updatedAt: new Date(),
          },
        });
      } else {
        await prisma.answer.create({
          data: {
            content: content,
            taskId: taskIdInt,
            userId: userId,
            isAdopted: false,
          },
        });
      }
    }
    
    // 如果有关联的会话，向会话中发送消息通知
    try {
      // 查找与任务相关的会话
      const conversation = await prisma.conversation.findFirst({
        where: {
          taskId: taskIdInt,
          OR: [
            { user1Id: userId, user2Id: task.userId },
            { user1Id: task.userId, user2Id: userId }
          ]
        }
      });
      
      if (conversation) {
        // 发送系统消息到会话
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            senderId: userId,
            content: existingAnswer 
              ? `更新了最终答案: ${content}`
              : `提交了最终答案: ${content}`,
            type: 'system',
            taskId: taskIdInt
          }
        });
      }
    } catch (msgError) {
      console.error('发送最终答案通知消息失败:', msgError);
      // 不影响主流程，继续返回成功
    }

    return NextResponse.json(finalAnswer, { status: 201 });

  } catch (error:any) {
    console.error('提交最终答案错误:', error);
     if (error instanceof z.ZodError) {
         return NextResponse.json({ error: '输入数据格式错误', details: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { error: '提交最终答案过程中发生错误' },
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

    // 获取该任务的所有最终答案
    const finalAnswers = await prisma.finalAnswer.findMany({
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

    if (finalAnswers.length === 0) {
      return NextResponse.json({ error: '该任务暂无最终答案' }, { status: 404 });
    }

    // 格式化创建时间为可读字符串
    const formattedFinalAnswers = finalAnswers.map(answer => ({
      ...answer,
      timestamp: answer.createdAt.toLocaleString('zh-CN'),
    }));

    return NextResponse.json(formattedFinalAnswers, { status: 200 });
  } catch (error) {
    console.error('获取最终答案错误:', error);
    return NextResponse.json(
      { error: '获取最终答案过程中发生错误' },
      { status: 500 }
    );
  }
} 