import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

// 添加重试函数
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 500
): Promise<T> {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      // 只有在数据库连接错误时进行重试
      if (error.code === 'P1017') {
        console.log(`数据库连接错误，正在重试 (${attempt + 1}/${maxRetries})...`);
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
        continue;
      }
      // 其他类型错误直接抛出
      throw error;
    }
  }
  throw lastError;
}

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

// 获取与对话相关的任务信息
async function getRelatedTaskInfo(taskId: number | null, userId: number) {
  if (!taskId) {
    return null;
  }

  // 查询任务信息
  const task = await withRetry(() => prisma.task.findUnique({
    where: {
      id: taskId,
    },
    select: {
      id: true,
      title: true,
      userId: true,
      status: true,
    },
  }));

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

/**
 * 轮询获取特定对话的最新消息
 * 支持通过since参数获取指定时间之后的消息
 * 支持通过taskId参数关联任务信息
 */
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
    // 使用await获取params
    const { conversationId } = await params;
    const conversationIdInt = parseInt(conversationId);

    // 获取查询参数
    const url = new URL(req.url);
    const since = url.searchParams.get('since');
    const taskId = url.searchParams.get('taskId');
    const taskIdInt = taskId ? parseInt(taskId) : null;

    // 验证用户是否是对话的参与者
    const isParticipant = await withRetry(() => prisma.conversation.findFirst({
      where: {
        id: conversationIdInt,
        OR: [
          { user1Id: currentUserId },
          { user2Id: currentUserId }
        ]
      }
    }));

    if (!isParticipant) {
      return NextResponse.json({ error: '无权访问该对话' }, { status: 403 });
    }

    // 构建查询条件
    let whereClause: any = {
      conversationId: conversationIdInt
    };

    // 如果提供了since参数，只获取该时间之后的消息
    if (since) {
      whereClause.createdAt = {
        gt: new Date(since)
      };
    }

    // 获取对话中的消息
    const messages = await withRetry(() => prisma.message.findMany({
      where: whereClause,
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
    }));

    // 转换消息格式，添加isMe标记
    const formattedMessages: FormattedMessage[] = messages.map(message => {
      // 由于Prisma类型尚未更新，这里通过any临时解决类型问题
      const msg = message as any;
      return {
        id: msg.id.toString(),
        content: msg.content,
        sender: msg.sender.username,
        senderId: msg.sender.id,
        timestamp: msg.createdAt.toISOString(),
        isMe: msg.sender.id === currentUserId,
        type: (msg.type || 'text') as MessageType,
        taskId: msg.taskId ? msg.taskId.toString() : undefined,
        rewardPoints: msg.rewardPoints || undefined
      };
    });

    // 如果提供了taskId，获取任务信息
    const taskInfo = taskIdInt ? await getRelatedTaskInfo(taskIdInt, currentUserId) : null;

    return NextResponse.json({ 
      messages: formattedMessages,
      taskInfo: taskInfo 
    });
  } catch (error) {
    console.error('轮询获取消息失败:', error);
    return NextResponse.json(
      { error: '获取消息时发生错误' },
      { status: 500 }
    );
  }
} 