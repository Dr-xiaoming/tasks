import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

// 定义需求类型接口
interface TaskRequirement {
  id: number;
  content: string;
  completed: boolean;
}

interface UserTaskRequirement {
  id: number;
  userId: number;
  taskId: number;
  requirementId: number;
  completed: boolean;
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
    const { conversationId, taskId } = body;
    
    if (!conversationId && !taskId) {
      return NextResponse.json({ error: '必须提供conversationId或taskId参数' }, { status: 400 });
    }
    
    let targetTaskId: number | null = null;

    // 优先使用传入的taskId
    if (taskId) {
      targetTaskId = parseInt(taskId);
    } 
    // 如果没有taskId但有conversationId，则尝试从对话相关消息中获取taskId
    else if (conversationId) {
      const conversationIdInt = parseInt(conversationId);
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

      // 查找与该对话关联的任务消息
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

      if (taskRelatedMessage?.taskId) {
        targetTaskId = taskRelatedMessage.taskId;
      }
    }

    // 如果找不到任务ID，返回空数组
    if (!targetTaskId) {
      return NextResponse.json({ requirements: [] });
    }

    // 检查任务是否存在
    const task = await prisma.task.findUnique({
      where: { id: targetTaskId },
      select: {
        id: true,
        userId: true,
        status: true
      }
    });

    if (!task) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }
    
    // 获取任务的需求列表
    const taskRequirements = await prisma.taskRequirement.findMany({
      where: { taskId: targetTaskId },
      orderBy: { id: 'asc' }
    });
    
    // 查询用户针对该任务的需求完成情况
    const userRequirements = await prisma.userTaskRequirement.findMany({
      where: {
        userId: currentUserId,
        taskId: targetTaskId
      }
    });
    
    // 为每个任务需求创建用户特定需求记录（如果不存在）
    const userReqMap = new Map(userRequirements.map((ur: any) => [ur.requirementId, ur]));
    
    // 创建缺失的用户需求记录并获取已存在的状态
    const requirements = await Promise.all(taskRequirements.map(async (req: any) => {
      // 如果用户没有该需求的记录，创建一个
      if (!userReqMap.has(req.id)) {
        const newUserReq = await prisma.userTaskRequirement.create({
          data: {
            userId: currentUserId,
            taskId: targetTaskId as number,
            requirementId: req.id,
            completed: false
          }
        });
        userReqMap.set(req.id, newUserReq);
      }
      
      const userReq: any = userReqMap.get(req.id);
      
      return {
        id: req.id.toString(),
        content: req.content,
        completed: userReq ? userReq.completed : false
      };
    }));

    // 返回任务需求列表和任务信息
    return NextResponse.json({
      taskId: task.id.toString(),
      isPublisher: task.userId === currentUserId,
      isCompleted: task.status === 'closed',
      requirements: requirements
    });
  } catch (error: any) {
    console.error('获取任务需求列表失败:', error);
    return NextResponse.json(
      { error: '获取任务需求列表时发生错误: ' + (error.message || '未知错误') },
      { status: 500 }
    );
  }
} 