import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

// 定义消息类型枚举
type MessageType = 'text' | 'system' | 'reward';

// 定义返回消息的接口
interface FormattedMessage {
  id: string;
  content: string;
  sender: string;
  senderId: number;
  timestamp: string;
  isMe: boolean;
  type: MessageType;
  taskId?: string;
  rewardPoints?: number;
}

// 获取特定对话的消息列表
export async function GET(
  req: NextRequest,
  { params }: { params: { conversationId: string } }
) {
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
    // 先await params然后再使用其属性
    const { conversationId } = await params;
    const conversationIdInt = parseInt(conversationId);

    // 从URL获取任务ID（如果存在）
    const url = new URL(req.url);
    const taskId = url.searchParams.get('taskId');

    // 验证用户是否是对话的参与者
    const isParticipant = await prisma.conversation.findFirst({
      where: {
        id: conversationIdInt,
        OR: [
          { user1Id: currentUserId },
          { user2Id: currentUserId }
        ]
      }
    });

    if (!isParticipant) {
      return NextResponse.json({ error: '无权访问该对话' }, { status: 403 });
    }

    // 获取对话中的消息
    const messages = await prisma.message.findMany({
      where: {
        conversationId: conversationIdInt
      },
      orderBy: {
        createdAt: 'asc'
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });

    // 获取对话的另一方信息
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationIdInt },
      include: {
        user1: { select: { username: true } },
        user2: { select: { username: true } }
      }
    });

    if (!conversation) {
      return NextResponse.json({ error: '对话不存在' }, { status: 404 });
    }

    // 获取对话对象的信息
    const otherUser = conversation.user1Id === currentUserId ? conversation.user2 : conversation.user1;

    // 检查是否有关联的任务（使用前端传递的任务ID或从对话中查找）
    const taskInfo = await getRelatedTaskInfo(conversationId, currentUserId, taskId);

    // 格式化消息，确定"我"和"对方"
    const formattedMessages = messages.map((message) => ({
      id: message.id.toString(),
      content: message.content,
      sender: message.sender.username,
      senderId: message.sender.id,
      timestamp: message.createdAt.toISOString(),
      isMe: message.senderId === currentUserId,
      type: message.type || 'text',
      taskId: message.taskId?.toString(),
      rewardPoints: message.rewardPoints,
    }));

    return NextResponse.json({
      messages: formattedMessages,
      partnerName: otherUser.username,
      taskInfo: taskInfo
    });
  } catch (error) {
    console.error('获取消息失败:', error);
    return NextResponse.json(
      { error: '获取消息时发生错误' },
      { status: 500 }
    );
  }
}

// 获取与对话相关的任务信息
async function getRelatedTaskInfo(conversationId: string, userId: number, frontendTaskId: string | null = null) {
  // 如果前端传递了任务ID，优先使用该ID
  let taskId: number | null = null;
  
  if (frontendTaskId) {
    taskId = parseInt(frontendTaskId);
  } else {
    // 没有传递任务ID时，从对话消息中查找（保留原有逻辑作为备用）
    const conversationIdInt = parseInt(conversationId);
    const taskRelatedMessage = await prisma.message.findFirst({
      where: {
        conversationId: conversationIdInt,
        taskId: { not: null },
      },
      select: {
        taskId: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!taskRelatedMessage || !taskRelatedMessage.taskId) {
      return null;
    }
    
    taskId = taskRelatedMessage.taskId;
  }

  if (!taskId) {
    return null;
  }

  // 查询任务信息
  const task = await prisma.task.findUnique({
    where: {
      id: taskId,
    },
    select: {
      id: true,
      title: true,
      userId: true,
      status: true,
    },
  });

  if (!task) {
    return null;
  }

  return {
    id: task.id.toString(),
    title: task.title,
    isPublisher: task.userId === userId,
    isCompleted: task.status === 'closed'
  };
}

// 发送新消息
export async function POST(
  req: NextRequest,
  { params }: { params: { conversationId: string } }
) {
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
    // 先await params然后再使用其属性
    const { conversationId } = await params;
    const conversationIdInt = parseInt(conversationId);
    const { content, type = 'text', taskId, rewardPoints } = await req.json();

    if (!content || content.trim() === '') {
      return NextResponse.json({ error: '消息内容不能为空' }, { status: 400 });
    }

    // 验证用户是否是对话的参与者
    const isParticipant = await prisma.conversation.findFirst({
      where: {
        id: conversationIdInt,
        OR: [
          { user1Id: currentUserId },
          { user2Id: currentUserId }
        ]
      }
    });

    if (!isParticipant) {
      return NextResponse.json({ error: '无权访问该对话' }, { status: 403 });
    }

    // 创建新消息，支持系统和奖励消息类型
    const messageData: any = {
      content,
      senderId: currentUserId,
      conversationId: conversationIdInt
    };
    
    // 添加可选字段
    if (taskId) {
      messageData.taskId = parseInt(taskId);
    }
    
    if (rewardPoints) {
      messageData.rewardPoints = typeof rewardPoints === 'string' 
        ? parseInt(rewardPoints) 
        : rewardPoints;
    }

    const message = await prisma.message.create({
      data: messageData,
      include: {
        sender: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });

    // 更新对话的最后消息时间
    await prisma.conversation.update({
      where: {
        id: conversationIdInt
      },
      data: {
        updatedAt: new Date()
      }
    });

    // 创建返回消息对象
    const msg = message as any;
    const responseMessage: FormattedMessage = {
      id: msg.id.toString(),
      content: msg.content,
      sender: msg.sender.username,
      senderId: msg.sender.id,
      timestamp: msg.createdAt.toISOString(),
      isMe: true,
      type: (msg.type || 'text') as MessageType,
      taskId: msg.taskId ? msg.taskId.toString() : undefined,
      rewardPoints: msg.rewardPoints || undefined
    };

    return NextResponse.json(responseMessage);
  } catch (error) {
    console.error('发送消息失败:', error);
    return NextResponse.json(
      { error: '发送消息时发生错误' },
      { status: 500 }
    );
  }
} 