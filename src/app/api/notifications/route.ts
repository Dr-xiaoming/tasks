import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { Prisma } from '@prisma/client';

// 通知接口定义
interface Notification {
  id: string;
  type: string;
  content: string;
  timestamp: Date | string;
  senderId?: number;
  senderName?: string;
  conversationId?: number;
  taskId?: number | null;
  taskTitle?: string | null;
  rewardPoints?: number | null;
  amount?: number;
  changeType?: string;
  source: 'message' | 'points_history';
}

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
    
    // 从URL获取查询参数
    const { searchParams } = new URL(req.url);
    const sinceParam = searchParams.get('since');
    
    // 解析时间范围筛选条件
    let timeFilter = "";
    if (sinceParam) {
      try {
        const sinceDate = new Date(sinceParam);
        timeFilter = ` AND ph.created_at >= '${sinceDate.toISOString()}'`;
      } catch (e) {
        console.error('解析时间参数错误:', e);
      }
    }

    // 查找用户的所有对话
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { user1Id: currentUserId },
          { user2Id: currentUserId }
        ]
      },
      select: {
        id: true
      }
    });

    const conversationIds = conversations.map(conv => conv.id);
    
    // 如果没有对话，返回空结果
    if (conversationIds.length === 0) {
      return NextResponse.json({
        success: true,
        notifications: [],
        unreadCount: 0
      });
    }

    // 获取未读消息
    const messages = await prisma.message.findMany({
      where: {
        conversationId: { in: conversationIds },
        senderId: { not: currentUserId }, // 不是当前用户发送的
        isRead: false,
        ...(sinceParam ? {
          createdAt: {
            gte: new Date(sinceParam)
          }
        } : {})
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true
          }
        },
        conversation: {
          select: {
            id: true,
            user1Id: true,
            user2Id: true,
            taskId: true,
            task: {
              select: {
                id: true,
                title: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // 仅获取消息通知，暂时跳过积分历史查询
    let pointsNotifications: Notification[] = [];

    // 当Prisma模型正确同步后再恢复以下查询
    try {
      // 尝试简单查询一条积分记录，查看表是否存在
      const testQuery = await prisma.$queryRaw`SELECT 1 FROM points_history LIMIT 1`;
      
      // 如果不抛出错误，表示表存在，可以继续查询
      if (testQuery) {
        // 构建SQL查询，正确处理条件查询
        let sqlQuery = `
          SELECT 
            ph.id, 
            ph.amount, 
            ph.type, 
            ph.description, 
            ph.related_task_id as relatedTaskId, 
            ph.created_at as timestamp,
            t.title as taskTitle
          FROM 
            points_history ph
          LEFT JOIN
            tasks t ON ph.related_task_id = t.id
          WHERE 
            ph.user_id = ${currentUserId}
            AND ph.type = 'reward_received'`;
            
        // 如果有时间筛选，添加条件
        if (sinceParam) {
          sqlQuery += ` AND ph.created_at >= '${new Date(sinceParam).toISOString()}'`;
        }
        
        // 添加排序
        sqlQuery += `
          ORDER BY 
            ph.created_at DESC
        `;
        
        const pointsChangesRaw = await prisma.$queryRaw`${Prisma.raw(sqlQuery)}`;
        
        // 格式化积分变更通知
        pointsNotifications = Array.isArray(pointsChangesRaw) ? pointsChangesRaw.map((change: any) => ({
          id: `points_${change.id}`,
          type: 'reward',
          content: `您收到了 ${Math.abs(change.amount)} 积分${change.description ? `，${change.description}` : ''}`,
          timestamp: change.timestamp,
          amount: change.amount,
          changeType: change.type,
          taskId: change.relatedTaskId,
          taskTitle: change.taskTitle,
          source: 'points_history'
        })) : [];
      }
    } catch (err) {
      console.warn('积分历史查询失败，可能是表不存在:', err);
      // 失败时使用空数组，不影响消息通知的显示
    }

    // 格式化消息通知
    const messageNotifications = messages.map(msg => ({
      id: msg.id.toString(),
      type: msg.type,
      content: msg.content,
      timestamp: msg.createdAt,
      senderId: msg.sender.id,
      senderName: msg.sender.username,
      conversationId: msg.conversation.id,
      taskId: msg.conversation.taskId,
      taskTitle: msg.conversation.task?.title,
      rewardPoints: msg.rewardPoints,
      source: 'message'
    }));
    
    // 合并所有通知
    let allNotifications = [
      ...messageNotifications,
      ...pointsNotifications
    ];
    
    // 按时间排序（最新的在前）
    allNotifications.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json({
      success: true,
      notifications: allNotifications,
      unreadCount: messageNotifications.length
    });
  } catch (error: any) {
    console.error('获取通知失败:', error);
    return NextResponse.json(
      { error: '获取通知失败: ' + (error.message || '未知错误') },
      { status: 500 }
    );
  }
} 