'use client';

import React, { useState, useEffect } from 'react';
import { Layout, Spin, message, Empty } from 'antd';
import ConversationList from './ConversationList'; 
import { useAuth } from '@/contexts/AuthContext';

const { Sider, Content } = Layout;

interface Conversation {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: string;
  avatar?: string;
}

interface ChatLayoutProps {
  children: React.ReactNode; // 用于显示聊天窗口或提示
  activeConversationId?: string; // 当前选中的对话 ID
}

const ChatLayout: React.FC<ChatLayoutProps> = ({ children, activeConversationId }) => {
  const { getToken, isLoggedIn } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }

    const fetchConversations = async () => {
      setLoading(true);
      try {
        const token = getToken();
        const response = await fetch('/api/conversations', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          if (response.status === 401) {
            message.error('登录已过期，请重新登录');
            return;
          }
          throw new Error('获取对话列表失败');
        }

        const data = await response.json();
        setConversations(data);
      } catch (err: any) {
        console.error('获取对话列表失败:', err);
        setError(err.message || '获取对话列表失败');
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [getToken, isLoggedIn]);

  return (
    <Layout style={{ height: 'calc(100vh - 64px)' }}> {/* 减去顶部导航的高度 */}
      <Sider width={300} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <Spin tip="加载中" />
          </div>
        ) : error ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            {error}
          </div>
        ) : conversations.length === 0 ? (
          <Empty description="暂无对话" style={{ marginTop: '40px' }} />
        ) : (
          <ConversationList 
            conversations={conversations} 
            activeConversationId={activeConversationId} 
          />
        )}
      </Sider>
      <Content style={{ height: '100%', overflow: 'hidden' }}>
        {children}
      </Content>
    </Layout>
  );
};

export default ChatLayout; 