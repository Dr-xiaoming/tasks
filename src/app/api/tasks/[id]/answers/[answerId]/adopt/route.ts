import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; answerId: string } }
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
    // 使用 await 来获取动态路由参数
    const parsedParams = await params;
    const taskId = parseInt(parsedParams.id);
    const answerIdInt = parseInt(parsedParams.answerId);

    if (isNaN(taskId) || isNaN(answerIdInt)) {
      return NextResponse.json({ error: '无效的任务或回答ID' }, { status: 400 });
    }

    // 检查任务是否存在且属于当前用户
    const task = await prisma.task.findUnique({
      where: { 
        id: taskId,
        userId: currentUserId // 确保只有任务发布者可以采纳回答
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            points: true // 获取发布者当前积分
          }
        }
      }
    });

    if (!task) {
      return NextResponse.json({ error: '任务不存在或您无权操作' }, { status: 403 });
    }

    // 检查任务状态是否为open
    if (task.status !== 'open') {
      return NextResponse.json({ error: '任务已关闭，无法采纳回答' }, { status: 400 });
    }

    // 检查回答是否存在
    const answer = await prisma.answer.findUnique({
      where: { 
        id: answerIdInt,
        taskId: taskId 
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            points: true // 获取回答者当前积分
          }
        }
      }
    });

    if (!answer) {
      return NextResponse.json({ error: '回答不存在' }, { status: 404 });
    }

    // 检查任务悬赏的积分是否足够
    if (task.points > task.user.points) {
      return NextResponse.json({ error: '您的积分不足，无法完成奖励' }, { status: 400 });
    }

    try {
      // 使用事务处理所有操作，确保原子性
      const result = await prisma.$transaction(async (tx) => {
        // 1. 从发布者扣除积分
        await tx.user.update({
          where: { id: currentUserId },
          data: { 
            points: { decrement: task.points }
          }
        });

        // 2. 给回答者加积分
        await tx.user.update({
          where: { id: answer.userId },
          data: { 
            points: { increment: task.points }
          }
        });

        // 3. 更新任务状态为已解决和已采纳答案
        await tx.task.update({
          where: { id: taskId },
          data: { 
            status: 'closed',
            adoptedAnswerId: answerIdInt
          }
        });

        // 4. 更新回答状态为已采纳
        await tx.answer.update({
          where: { id: answerIdInt },
          data: { isAdopted: true }
        });

        // 5. 查找或创建与回答者的私聊会话
        let conversation = await tx.conversation.findFirst({
          where: {
            OR: [
              { user1Id: currentUserId, user2Id: answer.userId },
              { user1Id: answer.userId, user2Id: currentUserId }
            ]
          }
        });

        if (!conversation) {
          conversation = await tx.conversation.create({
            data: {
              user1Id: currentUserId,
              user2Id: answer.userId
            }
          });
        }

        // 6. 发送系统通知消息
        const messageContent = `恭喜！您在任务"${task.title}"中的回答已被采纳，获得${task.points}积分奖励`;
        
        // 直接使用原生SQL创建消息，避开type字段问题
        await tx.$executeRaw`
          INSERT INTO messages (conversation_id, sender_id, content, task_id, reward_points, created_at)
          VALUES (${conversation.id}, ${currentUserId}, ${messageContent}, ${taskId}, ${task.points}, NOW())
        `;
        
        // 查询刚创建的消息和发送者信息
        const message = await tx.message.findFirst({
          where: { 
            conversationId: conversation.id,
            senderId: currentUserId
          },
          orderBy: { id: 'desc' },
          include: {
            sender: {
              select: {
                id: true,
                username: true
              }
            }
          }
        });

        // 7. 更新会话的最后活动时间
        await tx.conversation.update({
          where: { id: conversation.id },
          data: { updatedAt: new Date() }
        });

        // 8. 创建积分历史记录，用于轮询获取通知
        await tx.$executeRaw`
          INSERT INTO points_history (user_id, amount, type, description, related_task_id, related_answer_id, created_at)
          VALUES (${answer.userId}, ${task.points}, 'reward', ${messageContent}, ${taskId}, ${answerIdInt}, NOW())
        `;

        return { message, conversation };
      }, {
        // 设置事务超时和重试策略
        timeout: 10000,
        maxWait: 5000,
        isolationLevel: 'Serializable' // 使用最高隔离级别确保数据一致性
      });

      // 事务外处理不影响核心业务逻辑的操作
      try {
        // 8. 记录交易历史(在事务外执行，即使失败也不影响已完成的采纳操作)
        // 注意: 如果该行出错，可能需要检查数据库是否确实有transaction表
        // 或者模型名称可能是其他拼写
        await prisma.$queryRaw`
          INSERT INTO transactions (sender_id, receiver_id, amount, type, task_id, answer_id, status, description, created_at, updated_at)
          VALUES (${currentUserId}, ${answer.userId}, ${task.points}, 'task_reward', ${taskId}, ${answerIdInt}, 'COMPLETED', ${`任务"${task.title}"采纳回答奖励`}, NOW(), NOW())
        `;
      } catch (transactionError) {
        console.error('记录交易历史失败:', transactionError);
        // 交易记录失败不影响核心业务
      }

      return NextResponse.json({
        success: true,
        message: '回答已成功采纳，积分奖励已发放，通知已创建'
      });
    } catch (txError) {
      console.error('事务执行失败:', txError);
      return NextResponse.json(
        { error: '积分交易过程中发生错误，已自动回滚' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('采纳回答失败:', error);
    return NextResponse.json(
      { error: '采纳回答过程中发生错误: ' + (error.message || '未知错误') },
      { status: 500 }
    );
  }
} 