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
    
    // 获取请求参数
    const body = await req.json();
    const { conversationId, taskId, requirementId, completed } = body;
    
    if (!requirementId || typeof completed !== 'boolean') {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }
    
    let targetTaskId: number | null = null;
    
    if (taskId) {
      targetTaskId = parseInt(taskId);
    } else if (conversationId) {
      const conversationIdInt = parseInt(conversationId);
      
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
      
      // 查找对话关联的任务
      const taskMessage = await withRetry(() => prisma.message.findFirst({
        where: {
          conversationId: conversationIdInt,
          taskId: { not: null }
        },
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          taskId: true
        }
      }));
      
      if (taskMessage?.taskId) {
        targetTaskId = taskMessage.taskId;
      }
    }
    
    if (!targetTaskId) {
      return NextResponse.json({ error: '找不到关联的任务' }, { status: 404 });
    }
    
    // 检查任务是否存在
    const task = await withRetry(() => prisma.task.findUnique({
      where: { id: targetTaskId },
      select: { id: true, userId: true, status: true }
    }));
    
    if (!task) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }
    
    // 验证用户是否有权限修改（只有任务发布者可以修改）
    if (task.userId !== currentUserId) {
      return NextResponse.json({ error: '只有任务发布者才能更新需求状态' }, { status: 403 });
    }
    
    // 检查需求是否存在
    const requirement = await withRetry(() => prisma.taskRequirement.findUnique({
      where: { 
        id: parseInt(requirementId),
      },
      select: { id: true, taskId: true }
    }));
    
    if (!requirement) {
      return NextResponse.json({ error: '需求不存在' }, { status: 404 });
    }
    
    if (requirement.taskId !== targetTaskId) {
      return NextResponse.json({ error: '需求不属于指定任务' }, { status: 400 });
    }
    
    // 查找并更新所有相关用户的任务需求记录
    const userRequirements = await withRetry(() => prisma.userTaskRequirement.findMany({
      where: {
        taskId: targetTaskId,
        requirementId: requirement.id
      }
    }));
    
    if (userRequirements.length > 0) {
      // 批量更新所有记录
      await withRetry(() => prisma.userTaskRequirement.updateMany({
        where: {
          taskId: targetTaskId,
          requirementId: requirement.id
        },
        data: { completed }
      }));
    } else {
      // 获取对话的两个用户ID
      const conversation = await withRetry(() => prisma.conversation.findFirst({
        where: {
          OR: [
            { 
              user1Id: currentUserId,
              messages: { some: { taskId: targetTaskId } }
            },
            { 
              user2Id: currentUserId,
              messages: { some: { taskId: targetTaskId } }
            }
          ]
        },
        select: { id: true, user1Id: true, user2Id: true }
      }));

      if (conversation) {
        // 为对话中的两个用户创建记录
        await withRetry(() => prisma.userTaskRequirement.createMany({
          data: [
            {
              userId: conversation.user1Id,
              taskId: targetTaskId,
              requirementId: requirement.id,
              completed
            },
            {
              userId: conversation.user2Id,
              taskId: targetTaskId,
              requirementId: requirement.id,
              completed
            }
          ]
        }));
      } else {
        // 至少为当前用户创建记录
        await withRetry(() => prisma.userTaskRequirement.create({
          data: {
            userId: currentUserId,
            taskId: targetTaskId,
            requirementId: requirement.id,
            completed
          }
        }));
      }
    }
    
    return NextResponse.json({
      id: requirement.id.toString(),
      completed
    });
  } catch (error: any) {
    console.error('更新任务需求状态失败:', error);
    return NextResponse.json(
      { error: '更新任务需求状态时发生错误: ' + (error.message || '未知错误') },
      { status: 500 }
    );
  }
} 