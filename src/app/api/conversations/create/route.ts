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
    const { targetUserId, taskId } = await req.json();

    if (!targetUserId) {
      return NextResponse.json({ error: '缺少目标用户ID' }, { status: 400 });
    }

    // 检查是否试图与自己私聊
    if (currentUserId === parseInt(targetUserId)) {
      return NextResponse.json({ error: '不能与自己私聊' }, { status: 400 });
    }

    // 检查目标用户是否存在
    const targetUser = await prisma.user.findUnique({
      where: { id: parseInt(targetUserId) },
    });

    if (!targetUser) {
      return NextResponse.json({ error: '目标用户不存在' }, { status: 404 });
    }

    // 解析taskId(如果存在)
    const taskIdInt = taskId ? parseInt(taskId) : null;
    
    // 如果有taskId，检查任务是否存在
    if (taskIdInt) {
      const task = await prisma.task.findUnique({
        where: { id: taskIdInt }
      });
      
      if (!task) {
        return NextResponse.json({ error: '关联的任务不存在' }, { status: 404 });
      }
    }

    // 查找现有对话，对话可能已经存在
    let conversation = await prisma.conversation.findFirst({
      where: {
        OR: [
          {
            user1Id: currentUserId,
            user2Id: parseInt(targetUserId)
          },
          {
            user1Id: parseInt(targetUserId),
            user2Id: currentUserId
          }
        ]
      }
    });

    // 如果对话已存在但想要关联新任务，则更新对话
    if (conversation && taskIdInt && conversation.taskId !== taskIdInt) {
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: { taskId: taskIdInt }
      });
    }
    // 如果对话不存在，创建新的对话
    else if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          user1Id: currentUserId,
          user2Id: parseInt(targetUserId),
          taskId: taskIdInt
        }
      });
    }

    return NextResponse.json({ conversationId: conversation.id });
  } catch (error) {
    console.error('创建对话失败:', error);
    return NextResponse.json(
      { error: '创建对话时发生错误' },
      { status: 500 }
    );
  }
} 