'use client';

import React, { useEffect, useState } from 'react';
import { List, Card, Tag, Button, Typography, Divider, Spin, Empty, message } from 'antd';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/components/NotificationPoller';
import Link from 'next/link';
import { jwtDecode } from 'jwt-decode';

const { Title, Text } = Typography;

// JWT解码后的用户信息接口
interface DecodedToken {
  userId: number;
  username: string;
  iat: number;
  exp: number;
}

interface Notification {
  id: string;
  type: string;
  content: string;
  timestamp: string;
  source: string;
  conversationId?: number;
  taskId?: number;
  taskTitle?: string;
  rewardPoints?: number;
  senderName?: string;
  amount?: number;
  isSystemMessage?: boolean; // 新增字段：是否为系统消息
}

const NotificationsPage: React.FC = () => {
  const { isLoggedIn, getToken } = useAuth();
  const { fetchNotifications, markAsRead } = useNotifications();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{id: number, username: string} | null>(null);

  // 获取当前用户信息
  useEffect(() => {
    if (!isLoggedIn) {
      router.push('/login');
      return;
    }
    
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }
    
    try {
      const decoded = jwtDecode<DecodedToken>(token);
      setCurrentUser({
        id: decoded.userId,
        username: decoded.username
      });
    } catch (error) {
      // token解析失败，但不立即跳转，让AuthContext处理
      console.error('解析token失败:', error);
    }
  }, [isLoggedIn, getToken, router]);

  const loadNotifications = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    try {
      const token = getToken();
      if (!token) {
        message.error('请先登录');
        router.push('/login');
        return;
      }

      // 获取所有通知 (不使用since参数，获取所有)
      const response = await fetch(`/api/notifications`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('获取通知失败');
      
      const data = await response.json();
      
      // 处理通知数据，标记系统消息
      const processedNotifications = data.notifications.map((notification: Notification) => {
        // 判断消息是否为系统消息（采纳后的通知）
        if (notification.source === 'message' && notification.content.includes('采纳')) {
          notification.isSystemMessage = true;
        }
        return notification;
      });
      
      setNotifications(processedNotifications);
    } catch (error) {
      console.error('加载通知失败:', error);
      message.error('加载通知失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn && currentUser) {
      loadNotifications();
    }
  }, [isLoggedIn, currentUser]);

  const handleViewNotification = async (notification: Notification) => {
    try {
      // 标记通知为已读
      if (notification.source === 'message') {
        await markAsRead(notification.id);
      }
      
      // 根据通知类型跳转到相应页面
      if (notification.conversationId) {
        // 如果是消息通知，跳转到对话页面
        router.push(`/chat/${notification.conversationId}`);
      } else if (notification.taskId) {
        // 如果是任务通知，跳转到任务详情页
        router.push(`/task/${notification.taskId}`);
      }
    } catch (error) {
      console.error('处理通知失败:', error);
      message.error('操作失败，请稍后重试');
    }
  };

  const renderNotificationContent = (notification: Notification) => {
    // 根据不同通知类型渲染不同内容
    if (notification.type === 'reward') {
      return (
        <>
          <div className="notification-content">
            <Text>{notification.content}</Text>
            {notification.taskId && (
              <Link href={`/task/${notification.taskId}`}>
                <Button type="link" size="small" style={{ padding: 0, marginLeft: 8 }}>
                  查看任务
                </Button>
              </Link>
            )}
          </div>
          {notification.rewardPoints && (
            <Tag color="gold">+{notification.rewardPoints} 积分</Tag>
          )}
          {notification.amount && notification.amount > 0 && (
            <Tag color="gold">+{notification.amount} 积分</Tag>
          )}
        </>
      );
    }
    
    // 普通消息通知
    return (
      <>
        <div className="notification-content">
          <Text>来自：{notification?.senderName}，内容：</Text>
          <Text>{notification.content}</Text>
          {notification.conversationId && (
            <Button 
              type="link" 
              size="small" 
              style={{ padding: 0, marginLeft: 8 }}
              onClick={() => handleViewNotification(notification)}
            >
              查看对话
            </Button>
          )}
        </div>
      </>
    );
  };

  if (!isLoggedIn) {
    return null; // 会被路由重定向到登录页
  }

  return (
    <div className="notifications-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2}>我的通知</Title>
        <Button type="primary" onClick={loadNotifications}>刷新</Button>
      </div>
      
      <Spin spinning={loading}>
        {notifications.length > 0 ? (
          <List
            itemLayout="horizontal"
            dataSource={notifications}
            renderItem={(notification) => (
              <List.Item>
                <Card 
                  style={{ width: '100%' }}
                  hoverable
                  className={
                    notification.type === 'reward' 
                      ? 'reward-notification' 
                      : notification.isSystemMessage 
                        ? 'system-notification' 
                        : ''
                  }
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      {notification.type === 'reward' ? (
                        <Tag color="gold">奖励</Tag>
                      ) : notification.isSystemMessage ? (
                        <Tag color="purple">系统消息</Tag>
                      ) : (
                        <Tag color="blue">消息</Tag>
                      )}
                      {renderNotificationContent(notification)}
                    </div>
                    <Text type="secondary">
                      {new Date(notification.timestamp).toLocaleString('zh-CN')}
                    </Text>
                  </div>
                </Card>
              </List.Item>
            )}
          />
        ) : (
          <Empty description="暂无通知" />
        )}
      </Spin>
      
      <style jsx global>{`
        .reward-notification {
          border-left: 4px solid gold;
        }
        .system-notification {
          border-left: 4px solid purple;
        }
        .notification-content {
          margin: 8px 0;
        }
      `}</style>
    </div>
  );
};

export default NotificationsPage; 