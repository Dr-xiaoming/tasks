import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
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
    const notificationId = params.id;
    
    // 检查通知ID格式
    if (notificationId.startsWith('points_') || notificationId.startsWith('tx_')) {
      // 积分历史或交易记录通知 - 这些没有已读状态，直接返回成功
      return NextResponse.json({
        success: true,
        message: '非消息类通知无需标记已读状态'
      });
    }
    
    // 尝试解析消息ID
    let messageId: bigint;
    try {
      messageId = BigInt(notificationId);
    } catch (e) {
      return NextResponse.json({ error: '无效的通知ID' }, { status: 400 });
    }

    // 查找消息，确保消息是发给当前用户的
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        conversation: {
          OR: [
            { user1Id: currentUserId },
            { user2Id: currentUserId }
          ]
        },
        senderId: { not: currentUserId } // 不是自己发的消息
      },
      include: {
        conversation: {
          select: {
            user1Id: true,
            user2Id: true
          }
        }
      }
    });

    if (!message) {
      return NextResponse.json({ error: '消息不存在或无权操作' }, { status: 404 });
    }

    // 标记消息为已读
    await prisma.message.update({
      where: { id: messageId },
      data: { isRead: true }
    });

    return NextResponse.json({
      success: true,
      message: '通知已标记为已读'
    });
  } catch (error: any) {
    console.error('标记通知已读失败:', error);
    return NextResponse.json(
      { error: '标记通知已读失败: ' + (error.message || '未知错误') },
      { status: 500 }
    );
  }
} 