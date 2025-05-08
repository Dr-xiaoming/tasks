'use client';

import React, { useEffect, useState } from 'react';
import { Typography, Card, List, Tag, Button, message, Skeleton, Empty, Pagination, Space } from 'antd';
import { CheckCircleOutlined, LeftOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const { Title, Paragraph } = Typography;

interface Answer {
  id: number;
  content: string;
  isAdopted: boolean;
  createdAt: string;
  task: {
    id: number;
    title: string;
    status: string;
  };
}

interface Pagination {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const UserAnswersPage: React.FC = () => {
  const { user, isLoggedIn, getToken, logout } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 0,
  });

  useEffect(() => {
    if (!isLoggedIn && !loading) {
      router.push('/login');
    }
  }, [isLoggedIn, loading, router]);

  useEffect(() => {
    const fetchUserAnswers = async () => {
      const token = getToken();
      if (token) {
        try {
          setLoading(true);
          const headers: HeadersInit = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          };
          const response = await fetch(`/api/user/activities?type=answers&page=${pagination.page}&pageSize=${pagination.pageSize}`, { headers });
          const data = await response.json();

          if (response.ok && data.success) {
            setAnswers(data.answers);
            setPagination(data.pagination);
          } else {
            message.error(data.error || '获取回答列表失败');
            if (response.status === 401) {
              logout();
              message.info('登录状态已过期，请重新登录');
            }
          }
        } catch (error) {
          console.error('获取回答列表错误:', error);
          message.error('获取回答列表失败，请重试');
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    fetchUserAnswers();
  }, [isLoggedIn, getToken, logout, pagination.page, pagination.pageSize]);

  const handlePageChange = (page: number) => {
    setPagination({
      ...pagination,
      page,
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN');
  };

  const truncateContent = (content: string, maxLength: number = 150) => {
    if (content.length <= maxLength) return content;
    return `${content.substring(0, maxLength)}...`;
  };

  if (!isLoggedIn && !loading) {
    return null; // 未登录时不显示内容，等待重定向
  }

  if (loading) {
    return (
      <div style={{ padding: '24px' }}>
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Space style={{ marginBottom: '20px' }}>
        <Button icon={<LeftOutlined />} onClick={() => router.push('/profile')}>
          返回个人中心
        </Button>
      </Space>
      
      <Title level={2}>我的回答</Title>
      
      <Card>
        <List
          itemLayout="vertical"
          dataSource={answers}
          locale={{ emptyText: <Empty description="暂无回答" /> }}
          renderItem={item => (
            <List.Item
              key={item.id}
              actions={[
                <span key="date">回答时间: {formatDate(item.createdAt)}</span>,
                <Link href={`/task/${item.task.id}`} key="more">
                  查看任务详情
                </Link>,
              ]}
              extra={
                item.isAdopted ? (
                  <Tag icon={<CheckCircleOutlined />} color="success">已采纳</Tag>
                ) : (
                  item.task.status === 'closed' ? (
                    <Tag color="default">任务已结束</Tag>
                  ) : (
                    <Tag color="processing">未采纳</Tag>
                  )
                )
              }
            >
              <List.Item.Meta
                title={<Link href={`/task/${item.task.id}`}>{item.task.title}</Link>}
              />
              <Paragraph ellipsis={{ rows: 3 }}>
                {truncateContent(item.content)}
              </Paragraph>
            </List.Item>
          )}
        />
        
        {pagination.total > 0 && (
          <div style={{ textAlign: 'right', marginTop: '20px' }}>
            <Pagination
              current={pagination.page}
              pageSize={pagination.pageSize}
              total={pagination.total}
              onChange={handlePageChange}
              showSizeChanger={false}
              showTotal={(total) => `共 ${total} 条回答`}
            />
          </div>
        )}
      </Card>
    </div>
  );
};

export default UserAnswersPage; 