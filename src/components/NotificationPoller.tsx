'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { message as antMessage } from 'antd';
import { jwtDecode } from 'jwt-decode';

// 轮询间隔（毫秒）
const POLLING_INTERVAL = 15000; // 15秒

// JWT解码后的用户信息接口
interface DecodedToken {
  userId: number;
  username: string;
  iat: number;
  exp: number;
}

interface NotificationContextType {
  lastNotification: any | null;
  unreadCount: number;
  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationId: string | number) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  lastNotification: null,
  unreadCount: 0,
  fetchNotifications: async () => {},
  markAsRead: async () => {},
});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationPoller: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { getToken, logout } = useAuth();
  const [lastNotification, setLastNotification] = useState<any | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastCheckedTime, setLastCheckedTime] = useState<Date | null>(null);
  const [currentUser, setCurrentUser] = useState<{id: number, username: string} | null>(null);

  // 获取当前用户信息
  useEffect(() => {
    const token = getToken();
    if (token) {
      try {
        const decoded = jwtDecode<DecodedToken>(token);
        setCurrentUser({
          id: decoded.userId,
          username: decoded.username
        });
      } catch (error) {
        console.error('解析token失败:', error);
        setCurrentUser(null);
      }
    } else {
      // 如果没有token，清除用户状态
      setCurrentUser(null);
    }
  }, [getToken]);

  // 获取新通知
  const fetchNotifications = async () => {
    // 再次检查token和用户状态
    const token = getToken();
    
    if (!token || !currentUser) {
      // 如果token失效，清除用户状态
      if (currentUser && !token) {
        setCurrentUser(null);
      }
      return;
    }

    try {
      // 构建API请求，包括上次检查时间
      let url = `/api/notifications`;
      if (lastCheckedTime) {
        url += `?since=${lastCheckedTime.toISOString()}`;
      }

      console.log('发送请求URL:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('服务器响应状态:', response.status);
      
      // 处理令牌过期或无效的情况
      if (response.status === 401) {
        console.warn('令牌已过期或无效，正在登出用户');
        logout();
        antMessage.error('登录已过期，请重新登录');
        return;
      }

      if (!response.ok) {
        console.error('获取通知失败, 状态码:', response.status);
        throw new Error('获取通知失败');
      }

      const data = await response.json();
      console.log('获取到的通知数据:', data);
      
      // 更新最后检查时间
      setLastCheckedTime(new Date());
      
      // 处理通知数据
      if (data.notifications && data.notifications.length > 0) {
        // 更新未读数量，使用服务器返回的未读数量
        setUnreadCount(data.unreadCount);
        
        // 获取最新通知
        const latestNotification = data.notifications[0];
        setLastNotification(latestNotification);
        
        // 显示通知
        data.notifications.forEach((notification: any) => {
          if (notification.type === 'reward') {
            antMessage.success({
              content: `🎉 ${notification.content}`,
              duration: 5,
              style: { marginTop: '20px' },
            });
          } else if (notification.content.includes('采纳')) {
            // 系统消息使用不同的样式
            antMessage.info({
              content: `📢 系统通知: ${notification.content}`,
              duration: 4,
              style: { backgroundColor: '#f0ecfe', borderLeft: '4px solid purple' },
            });
          } else {
            antMessage.info({
              content: `${notification.senderName || ''}：${notification.content.substring(0, 30)}${notification.content.length > 30 ? '...' : ''}`,
              duration: 3,
            });
          }
        });
      }
    } catch (error) {
      console.error('轮询通知失败:', error);
    }
  };

  // 标记通知为已读
  const markAsRead = async (notificationId: string | number) => {
    if (!currentUser) return;

    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // 处理令牌过期或无效的情况
      if (response.status === 401) {
        console.warn('令牌已过期或无效，正在登出用户');
        logout();
        antMessage.error('登录已过期，请重新登录');
        return;
      }

      if (!response.ok) throw new Error('标记通知已读失败');

      // 更新未读计数
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('标记通知已读失败:', error);
    }
  };

  // 设置轮询
  useEffect(() => {
    if (!currentUser) return;

    // 首次加载立即检查
    fetchNotifications();

    // 设置定期轮询
    const intervalId = setInterval(fetchNotifications, POLLING_INTERVAL);

    // 清理定时器
    return () => clearInterval(intervalId);
  }, [currentUser]);

  const value = {
    lastNotification,
    unreadCount,
    fetchNotifications,
    markAsRead
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationPoller; 