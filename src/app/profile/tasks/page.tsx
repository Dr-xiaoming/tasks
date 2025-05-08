'use client';

import React, { useEffect, useState } from 'react';
import { Typography, Card, List, Tag, Button, message, Skeleton, Empty, Pagination, Space } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, LeftOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const { Title } = Typography;

interface Task {
  id: number;
  title: string;
  description: string | null;
  points: number;
  status: string;
  createdAt: string;
  _count: {
    answers: number;
  };
}

interface Pagination {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const UserTasksPage: React.FC = () => {
  const { user, isLoggedIn, getToken, logout } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
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
    const fetchUserTasks = async () => {
      const token = getToken();
      if (token) {
        try {
          setLoading(true);
          const headers: HeadersInit = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          };
          const response = await fetch(`/api/user/activities?type=tasks&page=${pagination.page}&pageSize=${pagination.pageSize}`, { headers });
          const data = await response.json();

          if (response.ok && data.success) {
            setTasks(data.tasks);
            setPagination(data.pagination);
          } else {
            message.error(data.error || '获取任务列表失败');
            if (response.status === 401) {
              logout();
              message.info('登录状态已过期，请重新登录');
            }
          }
        } catch (error) {
          console.error('获取任务列表错误:', error);
          message.error('获取任务列表失败，请重试');
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    fetchUserTasks();
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

  if (!isLoggedIn && !loading) {
    return null;
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
      
      <Title level={2}>我的任务</Title>
      
      <Card>
        <List
          itemLayout="vertical"
          dataSource={tasks}
          locale={{ emptyText: <Empty description="暂无任务" /> }}
          renderItem={item => (
            <List.Item
              key={item.id}
              actions={[
                <span key="answers">回答数: {item._count.answers}</span>,
                <span key="date">发布时间: {formatDate(item.createdAt)}</span>,
                <Link href={`/task/${item.id}`} key="more">
                  查看详情
                </Link>,
              ]}
              extra={
                <div>
                  <Tag color="gold" style={{ marginBottom: '8px' }}>{item.points} 积分</Tag>
                  <div>
                    {item.status === 'open' ? (
                      <Tag icon={<ClockCircleOutlined />} color="processing">进行中</Tag>
                    ) : (
                      <Tag icon={<CheckCircleOutlined />} color="success">已完成</Tag>
                    )}
                  </div>
                </div>
              }
            >
              <List.Item.Meta
                title={<Link href={`/task/${item.id}`}>{item.title}</Link>}
                description={item.description || '无描述'}
              />
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
              showTotal={(total) => `共 ${total} 条任务`}
            />
          </div>
        )}
      </Card>
    </div>
  );
};

export default UserTasksPage; 