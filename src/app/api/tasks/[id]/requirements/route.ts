import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

// 获取任务需求列表
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 验证用户身份
    const authResult = await getAuthUser(req);
    const currentUserId = authResult.user?.userId;
    // 注意：不需要强制用户登录，未登录用户也可以查看需求列表
    
    // 使用 await 来获取动态路由参数
    const taskId = parseInt(params.id);

    if (isNaN(taskId)) {
      return NextResponse.json({ error: '无效的任务ID' }, { status: 400 });
    }

    // 检查任务是否存在
    const task = await prisma.task.findUnique({
      where: { id: taskId }
    });

    if (!task) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    // 获取任务的需求列表
    const requirements = await prisma.taskRequirement.findMany({
      where: { taskId: taskId },
      orderBy: { id: 'asc' }
    });

    // 如果用户已登录，查询用户针对该任务的需求完成情况
    let userRequirements: any[] = [];
    if (currentUserId) {
      userRequirements = await prisma.userTaskRequirement.findMany({
        where: {
          userId: currentUserId,
          taskId: taskId
        }
      });
    }
    
    // 创建用户需求映射表
    const userReqMap = new Map(userRequirements.map(ur => [ur.requirementId, ur]));

    // 为每个需求获取完成状态，如果用户已登录，为缺失的需求创建记录
    let requirementsWithStatus = await Promise.all(requirements.map(async req => {
      // 如果用户已登录且没有该需求的记录，创建一个
      if (currentUserId && !userReqMap.has(req.id)) {
        const newUserReq = await prisma.userTaskRequirement.create({
          data: {
            userId: currentUserId,
            taskId: taskId,
            requirementId: req.id,
            completed: req.completed // 使用全局状态作为初始值
          }
        });
        userReqMap.set(req.id, newUserReq);
      }

      // 获取用户特定的完成状态，如果不存在则使用全局状态
      const userReq = userReqMap.get(req.id);
      const completed = currentUserId && userReq ? userReq.completed : req.completed;
      
      return {
        id: req.id.toString(),
        content: req.content,
        completed: completed
      };
    }));

    // 将需求列表返回给客户端
    return NextResponse.json(requirementsWithStatus);
  } catch (error: any) {
    console.error('获取任务需求列表失败:', error);
    return NextResponse.json(
      { error: '获取任务需求列表时发生错误: ' + (error.message || '未知错误') },
      { status: 500 }
    );
  }
} 