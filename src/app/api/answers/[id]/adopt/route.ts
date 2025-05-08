import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// 假设有一个函数可以获取当前用户ID
async function getCurrentUserId(req: NextRequest): Promise<number | null> {
  // TODO: 实现真实的身份验证逻辑
  return 1; // 暂时硬编码，假设当前用户是 ID 为 1 的用户
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } } // id 是 Answer ID
) {
  try {
    const adopterUserId = await getCurrentUserId(req);
    if (!adopterUserId) {
      return NextResponse.json({ error: '用户未登录' }, { status: 401 });
    }

    const answerId = parseInt(params.id, 10);
    if (isNaN(answerId)) {
      return NextResponse.json({ error: '无效的回答 ID' }, { status: 400 });
    }

    // 在事务中执行采纳操作
    const result = await prisma.$transaction(async (tx) => {
      // 1. 查找答案及其关联的问题信息
      const answer = await tx.answer.findUnique({
        where: { id: answerId },
        include: {
          task: { // 包含关联的问题
            select: {
              id: true,
              userId: true, // 提问者的 ID
              points: true, // 悬赏积分
              status: true,
              adoptedAnswerId: true,
            },
          },
          user: { // 包含回答者的 ID
             select: { id: true }
          }
        },
      });

      // 2. 验证
      if (!answer) {
        throw new Error('回答未找到');
      }
      if (!answer.task) {
        // 理论上不应该发生，因为 taskId 是必须的
        throw new Error('回答未关联到任何问题');
      }
      if (answer.task.userId !== adopterUserId) {
        throw new Error('只有提问者才能采纳答案'); // 403 Forbidden
      }
      if (answer.task.status !== 'open') {
        throw new Error('问题已关闭，无法采纳答案'); // 400 Bad Request
      }
      if (answer.task.adoptedAnswerId) {
        throw new Error('该问题已有采纳的答案'); // 400 Bad Request
      }
      if (answer.isAdopted) {
        // 理论上 adoptedAnswerId 为 null 时，这里也应该是 false
        throw new Error('该答案已经被采纳');
      }
      if (answer.userId === adopterUserId) {
          throw new Error('不能采纳自己的回答'); // 403 Forbidden
      }

      const rewardPoints = answer.task.points;
      const answerAuthorId = answer.userId;
      const taskId = answer.task.id;

      // 3. 更新回答状态
      await tx.answer.update({
        where: { id: answerId },
        data: { isAdopted: true },
      });

      // 4. 更新问题状态和采纳答案 ID
      await tx.task.update({
        where: { id: taskId },
        data: {
          adoptedAnswerId: answerId,
          status: 'closed', // 问题状态变为关闭
        },
      });

      // 5. 将悬赏积分给回答者
      await tx.user.update({
        where: { id: answerAuthorId },
        data: {
          points: { increment: rewardPoints },
        },
      });
      
      // 提问者已经在一开始发布问题时扣除了积分，这里不需要再操作提问者的积分

      return { success: true, taskId, answerId, rewardPoints };
    });

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('采纳答案错误:', error);
    // 根据错误类型返回不同的状态码
    let status = 500;
    if (error.message === '只有提问者才能采纳答案' || error.message === '不能采纳自己的回答') {
      status = 403; 
    }
    if (error.message === '问题已关闭，无法采纳答案' || error.message === '该问题已有采纳的答案') {
        status = 400;
    }
    if (error.message === '回答未找到') {
      status = 404;
    }

    return NextResponse.json(
      { error: error.message || '采纳答案过程中发生错误' },
      { status }
    );
  }
} 