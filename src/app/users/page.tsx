'use client';

import React, { useEffect, useState } from 'react';
import { List, Avatar, Button, Card, Typography, message, Spin } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

const { Title } = Typography;

interface User {
  id: number;
  username: string;
  createdAt: string;
}

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const { isLoggedIn, getToken } = useAuth();
  const router = useRouter();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users', {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('获取用户列表失败');
      }

      const data = await response.json();
      setUsers(data.users);
    } catch (error) {
      console.error('获取用户列表错误:', error);
      message.error('获取用户列表失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleChat = async (userId: number) => {
    if (!isLoggedIn) {
      message.info('请先登录后再发起私聊');
      return;
    }

    try {
      // 检查是否与自己私聊
      const token = getToken();
      const response = await fetch('/api/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('获取用户信息失败');
      }

      const userData = await response.json();
      // 确保使用字符串比较，避免类型不匹配
      if (userData && userData.id.toString() === userId.toString()) {
        message.warning('不能与自己私聊');
        return;
      }

      // 调用API创建或获取与该用户的会话
      const chatResponse = await fetch('/api/conversations/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ targetUserId: userId.toString() })
      });

      if (!chatResponse.ok) {
        const errorData = await chatResponse.json();
        throw new Error(errorData.error || '创建会话失败');
      }

      const data = await chatResponse.json();
      // 跳转到聊天页面，使用获取到的conversationId
      router.push(`/chat/${data.conversationId}`);
    } catch (error: any) {
      message.error(error.message || '无法开始聊天，请稍后再试');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>用户列表</Title>
      
      {loading ? (
        <div style={{ textAlign: 'center', marginTop: '50px' }}>
          <Spin size="large" />
        </div>
      ) : (
        <List
          grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 3, xl: 4, xxl: 4 }}
          dataSource={users}
          renderItem={(user) => (
            <List.Item>
              <Card>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Avatar size={64} icon={<UserOutlined />} />
                  <Title level={4} style={{ marginTop: '12px', marginBottom: '4px' }}>{user.username}</Title>
                  <div style={{ color: '#999', marginBottom: '16px' }}>
                    注册时间: {formatDate(user.createdAt)}
                  </div>
                  <Button 
                    type="primary" 
                    onClick={() => handleChat(user.id)}
                  >
                    发起私聊
                  </Button>
                </div>
              </Card>
            </List.Item>
          )}
        />
      )}
    </div>
  );
};

export default UsersPage; 