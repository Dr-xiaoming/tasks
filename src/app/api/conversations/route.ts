import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
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

    // 获取用户参与的所有对话
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { user1Id: currentUserId },
          { user2Id: currentUserId }
        ]
      },
      include: {
        user1: {
          select: {
            id: true,
            username: true
          }
        },
        user2: {
          select: {
            id: true,
            username: true
          }
        },
        messages: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    // 格式化对话数据
    const formattedConversations = conversations.map(conversation => {
      // 确定对话中的另一个用户
      const isUser1 = conversation.user1Id === currentUserId;
      const otherUser = isUser1 ? conversation.user2 : conversation.user1;

      // 获取最新消息
      const lastMessage = conversation.messages[0];

      return {
        id: conversation.id.toString(),
        name: otherUser.username,
        lastMessage: lastMessage?.content || '无消息',
        timestamp: lastMessage?.createdAt.toISOString() || conversation.createdAt.toISOString(),
        avatar: '', // 暂无头像
      };
    });

    return NextResponse.json(formattedConversations);
  } catch (error) {
    console.error('获取对话列表失败:', error);
    return NextResponse.json(
      { error: '获取对话列表时发生错误' },
      { status: 500 }
    );
  }
} 