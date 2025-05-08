import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

// 更新任务需求状态
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string, requirementId: string } }
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
    
    // 获取动态路由参数
    const taskId = parseInt(params.id);
    const requirementId = parseInt(params.requirementId);

    if (isNaN(taskId) || isNaN(requirementId)) {
      return NextResponse.json({ error: '无效的ID参数' }, { status: 400 });
    }

    // 获取请求体
    const { completed } = await req.json();
    if (typeof completed !== 'boolean') {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 检查任务是否存在
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, userId: true, status: true }
    });

    if (!task) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }
    
    // 验证用户是否有权限修改（只有任务发布者可以修改）
    if (task.userId !== currentUserId) {
      return NextResponse.json({ error: '只有任务发布者才能更新需求状态' }, { status: 403 });
    }
    
    // 检查需求是否存在
    const requirement = await prisma.taskRequirement.findUnique({
      where: { 
        id: requirementId,
      },
      select: { id: true, taskId: true }
    });
    
    if (!requirement) {
      return NextResponse.json({ error: '需求不存在' }, { status: 404 });
    }
    
    if (requirement.taskId !== taskId) {
      return NextResponse.json({ error: '需求不属于指定任务' }, { status: 400 });
    }
    
    // 更新全局需求状态
    await prisma.taskRequirement.update({
      where: { id: requirementId },
      data: { completed }
    });
    
    // 查找与此任务相关的所有用户记录
    const usersWithTaskInteraction = await prisma.$queryRaw`
      SELECT DISTINCT userId FROM (
        SELECT user_id as userId FROM tasks WHERE id = ${taskId}
        UNION
        SELECT userId FROM user_task_requirements WHERE taskId = ${taskId}
        UNION
        SELECT user_id as userId FROM answers WHERE task_id = ${taskId}
      ) as users
    `;
    
    // 确保当前用户也在列表中
    const allUserIds = [
      ...(usersWithTaskInteraction as any[]).map(u => u.userId),
      currentUserId
    ];
    const userIds = new Set(allUserIds);
    
    // 为所有用户批量更新或创建需求状态记录
    for (const userId of userIds) {
      // 查找用户任务需求记录
      const userReq = await prisma.userTaskRequirement.findFirst({
        where: {
          userId: userId,
          taskId: taskId,
          requirementId: requirementId
        }
      });
      
      if (userReq) {
        // 更新现有记录
        await prisma.userTaskRequirement.update({
          where: { id: userReq.id },
          data: { completed }
        });
      } else {
        // 创建新记录
        await prisma.userTaskRequirement.create({
          data: {
            userId: userId,
            taskId: taskId,
            requirementId: requirementId,
            completed
          }
        });
      }
    }
    
    // 查找当前用户更新后的记录，用于返回
    const currentUserRequirement = await prisma.userTaskRequirement.findFirst({
      where: {
        userId: currentUserId,
        taskId: taskId,
        requirementId: requirementId
      }
    });
    
    return NextResponse.json({
      id: requirement.id.toString(),
      completed: currentUserRequirement?.completed || completed
    });
  } catch (error: any) {
    console.error('更新任务需求状态失败:', error);
    return NextResponse.json(
      { error: '更新任务需求状态时发生错误: ' + (error.message || '未知错误') },
      { status: 500 }
    );
  }
} 