import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

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

// 释放任务API（任务发布者取消用户的任务领取）
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

    // 3. 获取请求体中的领取ID
    const body = await request.json();
    const claimId = body.claimId;
    
    if (!claimId) {
      return NextResponse.json({ message: '请提供要取消的任务领取ID' }, { status: 400 });
    }

    // 4. 验证当前用户是否为任务发布者
    const task = await prisma.task.findUnique({
      where: { id: taskId }
    });

    if (!task) {
      return NextResponse.json({ message: '任务不存在' }, { status: 404 });
    }

    if (task.userId !== userId) {
      return NextResponse.json({ message: '只有任务发布者可以取消任务领取' }, { status: 403 });
    }

    // 5. 查找任务领取记录
    const taskClaim = await prisma.taskClaim.findFirst({
      where: {
        id: claimId,
        taskId: taskId,
        status: 'active'
      }
    });

    if (!taskClaim) {
      return NextResponse.json({ message: '未找到对应的任务领取记录或已被取消' }, { status: 404 });
    }

    // 6. 更新任务领取状态为取消
    const updatedClaim = await prisma.taskClaim.update({
      where: { id: claimId },
      data: { status: 'cancelled' }
    });

    // 新增：发送通知给被取消认领的用户
    if (updatedClaim && task) {
      const releasedUserId = updatedClaim.userId;
      const publisherId = userId; // 当前操作用户即发布者
      const taskTitle = task.title;

      if (releasedUserId !== publisherId) { // 不给自己发通知
        // 查找或创建对话
        let conversation = await prisma.conversation.findFirst({
          where: {
            taskId: taskId,
            OR: [
              { user1Id: publisherId, user2Id: releasedUserId },
              { user1Id: releasedUserId, user2Id: publisherId },
            ],
          },
        });

        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: {
              user1Id: Math.min(publisherId, releasedUserId), // 确保user1Id总是较小的ID，以便唯一性
              user2Id: Math.max(publisherId, releasedUserId),
              taskId: taskId,
            },
          });
        }

        // 创建系统消息
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            senderId: publisherId, // 代表是发布者行为触发的系统消息
            content: `您对任务 "${taskTitle}" 的领取已被发布者取消。`,
            type: 'system', // MessageType.system
            taskId: taskId,
          },
        });
      }
    }

    // 7. 返回成功响应
    return NextResponse.json({
      message: '已成功取消该用户的任务领取',
      data: {
        taskId,
        claimId
      }
    });

  } catch (error) {
    console.error('释放任务时出错:', error);
    return NextResponse.json({ message: '释放任务时发生错误' }, { status: 500 });
  }
} 