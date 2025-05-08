import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// API路由：处理过期的任务领取 
// 这个API可以通过定时任务调用，或者在获取任务列表时顺便调用
export async function GET(request: NextRequest) {
  try {
    // 1. 找出所有已过期但状态仍为active的任务领取
    const now = new Date();
    const expiredClaims = await prisma.taskClaim.findMany({
      where: {
        status: 'active',
        expiresAt: {
          lt: now // 过期时间早于当前时间
        }
      },
      include: {
        task: {
          select: {
            id: true,
            title: true
          }
        },
        user: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });

    if (expiredClaims.length === 0) {
      return NextResponse.json({
        message: '没有发现过期的任务领取',
        processed: 0
      });
    }

    // 2. 批量更新这些过期的任务领取状态为expired
    const claimIds = expiredClaims.map(claim => claim.id);
    
    await prisma.taskClaim.updateMany({
      where: {
        id: {
          in: claimIds
        }
      },
      data: {
        status: 'expired'
      }
    });

    // 3. 记录处理的结果，用于日志或返回
    const processedResult = expiredClaims.map(claim => ({
      claimId: claim.id,
      taskId: claim.taskId,
      taskTitle: claim.task.title,
      userId: claim.userId,
      username: claim.user.username,
      expiresAt: claim.expiresAt
    }));

    // 4. 返回处理结果
    return NextResponse.json({
      message: `成功处理了 ${expiredClaims.length} 个过期的任务领取`,
      processed: expiredClaims.length,
      details: processedResult
    });

  } catch (error) {
    console.error('处理过期任务领取时出错:', error);
    return NextResponse.json({ message: '处理过期任务领取时发生错误' }, { status: 500 });
  }
} 