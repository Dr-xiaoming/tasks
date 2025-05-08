'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Spin, message } from 'antd';
import ChatLayout from '@/components/ChatLayout';
import ChatWindow from '@/components/ChatWindow';
import { useAuth } from '@/contexts/AuthContext';
import { startPolling, stopPolling, sendMessage as sendMessageApi, resetPollingState } from '@/lib/polling';

interface Message {
  id: string;
  content: string;
  sender: string;
  senderId: number;
  timestamp: string;
  isMe: boolean;
  type?: 'text' | 'system' | 'reward' | 'notification'; // 消息类型：普通文本、系统通知、奖励或采纳通知
  taskId?: string; // 相关任务ID
  rewardPoints?: number; // 奖励积分数量
}

interface ConversationResponse {
  messages: Message[];
  partnerName: string;
  taskInfo?: {
    id: string;
    title: string;
    isPublisher: boolean;
    isCompleted: boolean;
  };
}

const ConversationPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.conversationId as string;
  const { getToken, isLoggedIn, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [partnerName, setPartnerName] = useState('');
  const [taskInfo, setTaskInfo] = useState<ConversationResponse['taskInfo']>(undefined);

  // 处理系统通知和积分奖励
  const handleSystemNotification = (notification: Message) => {
    if (notification.type === 'reward') {
      // 显示积分奖励通知
      message.success(`恭喜！您的回答已被采纳，获得 ${notification.rewardPoints} 积分奖励`);
      
      // 更新用户积分信息（可以调用相关API或更新本地状态）
      updateUserPoints(notification.rewardPoints || 0);
    } else if (notification.type === 'notification') {
      // 采纳回答的系统通知，这里可以添加额外的处理逻辑
      message.info(`系统通知：${notification.content}`);
      
      if (notification.rewardPoints) {
        // 如果有积分奖励，也更新用户积分
        updateUserPoints(notification.rewardPoints);
      }
    }
  };
  
  // 更新用户积分
  const updateUserPoints = async (points: number) => {
    try {
      const token = getToken();
      const response = await fetch('/api/user/points/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ points })
      });
      
      if (!response.ok) {
        const data = await response.json();
        if (response.status === 401 && data.tokenExpired) {
          handleTokenExpired();
          return;
        }
        throw new Error('更新积分失败');
      }
      
      // 可以在这里更新本地的用户积分状态（如果有的话）
    } catch (err: any) {
      console.error('更新积分失败:', err);
    }
  };

  // 处理新消息
  const handleNewMessages = (newMessages: Message[]) => {
    setMessages(prevMessages => {
      // 使用消息ID去重
      const messageIds = new Set(prevMessages.map(msg => msg.id));
      const uniqueNewMessages = newMessages.filter(msg => !messageIds.has(msg.id));
      
      // 处理系统消息通知
      uniqueNewMessages.forEach(msg => {
        if ((msg.type === 'system' || msg.type === 'reward' || msg.type === 'notification') && !msg.isMe) {
          handleSystemNotification(msg);
        }
      });
      
      return [...prevMessages, ...uniqueNewMessages];
    });
  };

  // 处理令牌过期
  const handleTokenExpired = () => {
    message.error('登录已过期，请重新登录');
    logout();
    router.push('/login');
  };

  useEffect(() => {
    if (!isLoggedIn) {
      message.error('请先登录');
      return;
    }

    // 重置轮询状态
    resetPollingState();

    const fetchMessages = async () => {
      setLoading(true);
      try {
        const token = getToken();
        
        // 从URL获取taskId参数
        const url = new URL(window.location.href);
        const taskIdParam = url.searchParams.get('taskId');
        
        // 构建API请求URL，如果有taskId则添加到查询参数
        let apiUrl = `/api/conversations/${conversationId}/messages`;
        if (taskIdParam) {
          apiUrl += `?taskId=${taskIdParam}`;
        }
        
        const response = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          const data = await response.json();
          if (response.status === 401) {
            if (data.tokenExpired) {
              handleTokenExpired();
              return;
            }
            message.error('未授权访问');
            return;
          }
          throw new Error('获取消息失败');
        }

        const data: ConversationResponse = await response.json();
        setMessages(data.messages);
        setPartnerName(data.partnerName);
        
        // 设置任务信息
        if (data.taskInfo) {
          setTaskInfo(data.taskInfo);
        }
        
        // 检查是否有未处理的系统通知
        const systemNotifications = data.messages.filter(
          msg => (msg.type === 'system' || msg.type === 'reward' || msg.type === 'notification') && !msg.isMe
        );
        
        // 处理系统通知
        systemNotifications.forEach(notification => {
          handleSystemNotification(notification);
        });
      } catch (err: any) {
        console.error('获取消息失败:', err);
        setError(err.message || '获取消息失败');
      } finally {
        setLoading(false);
      }
    };

    fetchMessages().then(() => {
      // 初始加载完成后，启动消息轮询
      const token = getToken();
      if (token) {
        // 获取taskId参数，并将其传递给轮询函数
        const url = new URL(window.location.href);
        const taskIdParam = url.searchParams.get('taskId');
        
        startPolling(
          token,
          conversationId as string,
          handleNewMessages,
          handleTokenExpired,
          3000, // 每3秒轮询一次
          taskIdParam // 将taskId传递给轮询函数
        );
      }
    });
    
    // 卸载时停止轮询
    return () => {
      stopPolling();
    };
  }, [conversationId, getToken, isLoggedIn, router, logout]);

  const handleSendMessage = async (content: string) => {
    if (!content || content.trim() === '') return;

    try {
      const token = getToken();
      
      // 确保token存在
      if (!token) {
        message.error('未授权，请重新登录');
        handleTokenExpired();
        return;
      }
      
      // 使用轮询服务发送消息
      const newMessage = await sendMessageApi(
        token, 
        conversationId as string, 
        content
      );
      
      if (!newMessage) {
        message.error('发送消息失败');
        return;
      }
      
      // 更新本地消息列表
      setMessages(prevMessages => [...prevMessages, newMessage]);
    } catch (err: any) {
      message.error(err.message || '发送消息失败');
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    setLoading(true);
    try {
      const token = getToken();
      if (!token) {
        message.error('未授权，请重新登录');
        handleTokenExpired();
        setLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          // 如果你的 API 需要 token 进行鉴权，可以在这里添加
          // 'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.details || result.error || '文件上传失败');
      }

      const fileUrl = result.fileUrl;
      const fileName = file.name; // 获取原始文件名
      // 创建可点击的下载链接 HTML
      const linkHtml = `<a href="${fileUrl}" download="${fileName}" target="_blank" rel="noopener noreferrer">下载文件: ${fileName}</a>`;
      handleSendMessage(linkHtml);
      message.success('文件上传成功!');

    } catch (err: any) {
      console.error('文件上传失败:', err);
      message.error(err.message || '文件上传失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ChatLayout activeConversationId={conversationId}>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <Spin size="large" />
        </div>
      ) : error ? (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          {error}
        </div>
      ) : (
        <ChatWindow 
          conversationId={conversationId}
          messages={messages}
          partnerName={partnerName}
          onSendMessage={handleSendMessage}
          onFileUpload={handleFileUpload}
          taskInfo={taskInfo}
        />
      )}
    </ChatLayout>
  );
};

export default ConversationPage; 