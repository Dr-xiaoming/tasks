import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { addDays } from 'date-fns';

// 获取当前用户ID的函数
async function getCurrentUserId(req: NextRequest): Promise<number | null> {
  try {
    const authResult = await getAuthUser(req);
    if (!authResult.user) {
      return null;
    }
    return authResult.user.userId;
  } catch (error) {
    console.error('获取用户ID错误:', error);
    return null;
  }
}

// 领取任务API
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. 鉴权 - 获取当前用户ID
    const userId = await getCurrentUserId(request);
    if (!userId) {
      return NextResponse.json({ message: '用户未认证' }, { status: 401 });
    }

    // 2. 获取任务ID并转换为数字
    const { id } = params;
    const taskId = parseInt(id, 10);
    if (isNaN(taskId)) {
      return NextResponse.json({ message: '无效的任务ID' }, { status: 400 });
    }

    // 3. 检查任务是否存在
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        taskClaims: {
          where: { status: 'active' }
        }
      }
    });

    if (!task) {
      return NextResponse.json({ message: '任务不存在' }, { status: 404 });
    }

    // 4. 检查任务状态
    if (task.status !== 'open') {
      return NextResponse.json({ message: '该任务已关闭，无法领取' }, { status: 400 });
    }

    // 5. 检查是否为独占式任务且已被领取
    const existingActiveClaimForTask = await prisma.taskClaim.findFirst({
      where: {
        taskId,
        status: 'active'
      }
    });

    if (existingActiveClaimForTask) {
      return NextResponse.json({ message: '该任务已被他人领取' }, { status: 400 });
    }

    // 6. 检查用户是否已领取该任务
    const existingClaim = await prisma.taskClaim.findFirst({
      where: {
        taskId,
        userId,
        status: 'active'
      }
    });

    if (existingClaim) {
      return NextResponse.json({ message: '您已经领取了该任务' }, { status: 400 });
    }

    // 7. 检查用户已领取的任务数量是否超过限制
    const activeClaimsCount = await prisma.taskClaim.count({
      where: {
        userId,
        status: 'active'
      }
    });

    if (activeClaimsCount >= 5) {
      return NextResponse.json({ message: '您已领取的任务数量已达上限（5个）' }, { status: 400 });
    }

    // 8. 创建任务领取记录（设置3天后过期）
    const expiresAt = addDays(new Date(), 3);
    
    const taskClaim = await prisma.taskClaim.create({
      data: {
        taskId,
        userId,
        status: 'active',
        expiresAt
      }
    });

    // 9. 返回成功响应
    return NextResponse.json({
      message: '任务领取成功，请在3天内完成',
      data: {
        claimId: taskClaim.id,
        expiresAt: taskClaim.expiresAt
      }
    }, { status: 201 });

  } catch (error) {
    console.error('领取任务时出错:', error);
    return NextResponse.json({ message: '领取任务时发生错误' }, { status: 500 });
  }
} 