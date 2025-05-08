'use client'; // Ant Design 组件需要客户端渲染

import React, { useState, useEffect } from 'react';
import { List, Tag, Button, Spin, Input, Space, Card, Tabs, Row, Col, Typography, Divider } from 'antd';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

const { Search } = Input;
const { Title, Text } = Typography;

// 定义 Task 接口
interface Task {
  id: string;
  title: string;
  description: string;
  points: number;
  tags: string[];
  author: string;
  answers: number;
  user: {
    username: string;
  };
  _count: {
    answers: number;
  };
}

export default function HomePage() {
  const { getToken } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [recommendedTasks, setRecommendedTasks] = useState<Task[]>([]); // 新增推荐任务状态
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);

  // 搜索处理函数
  const handleSearch = (value: string) => {
    setSearchKeyword(value);
  };

  // 标签点击处理函数
  const handleTagClick = (tag: string) => {
    if (selectedTag === tag) {
      setSelectedTag(null);
    } else {
      setSelectedTag(tag);
    }
  };

  // 过滤任务
  const filteredTasks = tasks.filter(task => {
    const matchesKeyword = searchKeyword 
      ? task.title.toLowerCase().includes(searchKeyword.toLowerCase()) || 
        task.description.toLowerCase().includes(searchKeyword.toLowerCase())
      : true;
    
    const matchesTag = selectedTag 
      ? task.tags && task.tags.includes(selectedTag) 
      : true;
    
    return matchesKeyword && matchesTag;
  });

  useEffect(() => {
    // 定义获取数据的异步函数
    const fetchTasks = async () => {
      const token = getToken();
      try {
        setLoading(true);
        setError(null);
        const headers: HeadersInit = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        // 获取所有任务
        const response = await fetch('/api/tasks', { headers });
        if (!response.ok) {
          throw new Error('获取任务列表失败');
        }
        const data = await response.json();

        let tasksData: Task[] = [];
        if (Array.isArray(data)) {
          tasksData = data;
        } else if (data && Array.isArray(data.tasks)) {
          tasksData = data.tasks;
        } else {
          console.error("API 返回的数据格式不符合预期:", data);
          throw new Error("获取任务列表失败：数据格式错误");
        }
        setTasks(tasksData);

        // 模拟推荐任务列表 (后续会根据用户标签进行真正的推荐)
        // 这里暂时随机选择3个任务作为推荐
        if (tasksData.length > 0) {
          const shuffled = [...tasksData].sort(() => 0.5 - Math.random());
          setRecommendedTasks(shuffled.slice(0, 3));
        }

        // 收集所有标签
        const tags = new Set<string>();
        tasksData.forEach(task => {
          if (task.tags && Array.isArray(task.tags)) {
            task.tags.forEach(tag => tags.add(tag));
          }
        });
        setAllTags(Array.from(tags));

      } catch (err) {
        if (err instanceof Error) {
            setError(err.message);
        } else {
            setError('发生未知错误');
        }
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [getToken]);

  // 处理加载状态
  if (loading) {
    return (
      <div style={{ textAlign: 'center', marginTop: '50px' }}>
        <Spin tip="加载中..." size="large" />
      </div>
    );
  }

  // 处理错误状态
  if (error) {
    return <div style={{ color: 'red', textAlign: 'center', marginTop: '50px' }}>错误: {error}</div>;
  }

  // 渲染任务卡片
  const renderTaskCard = (item: Task) => (
    <Card 
      hoverable
      className="task-card"
      style={{ marginBottom: 16 }}
      actions={[
        <span key="answers">{item?._count?.answers || 0} 个回答</span>,
        <Link href={`/task/${item.id}`} key="view" passHref>
          <Button type="primary">查看详情</Button>
        </Link>,
      ]}
    >
      <Card.Meta
        title={<Link href={`/task/${item.id}`}>{item.title}</Link>}
        description={
          <>
            <div style={{ marginBottom: 8 }}>{item.description}</div>
            <div>
              {item.tags && item.tags.map((tag: string) => (
                <Tag 
                  key={tag} 
                  color="blue" 
                  style={{ cursor: 'pointer', marginBottom: 5 }}
                  onClick={(e) => {
                    e.preventDefault();
                    handleTagClick(tag);
                  }}
                >
                  {tag}
                </Tag>
              ))}
            </div>
          </>
        }
      />
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        marginTop: 16,
        alignItems: 'center' 
      }}>
        <Text type="secondary">发布者: {item?.user?.username}</Text>
        <div className="points-badge" style={{ 
          backgroundColor: '#f9f0ff', 
          color: '#722ed1',
          padding: '4px 12px',
          borderRadius: 16,
          fontWeight: 'bold',
        }}>
          {item.points} 积分
        </div>
      </div>
    </Card>
  );

  return (
    <div className="task-page-container" style={{ padding: '24px' }}>
      <Row gutter={24}>
        {/* 左侧: 推荐任务 */}
        <Col xs={24} md={8} className="recommended-tasks-col">
          <Card 
            title={<Title level={4}>推荐任务</Title>} 
            className="recommended-tasks-card"
            style={{ marginBottom: 24 }}
          >
            {recommendedTasks.length > 0 ? (
              <List
                itemLayout="vertical"
                dataSource={recommendedTasks}
                renderItem={(item) => (
                  <List.Item key={item.id} style={{ padding: '12px 0' }}>
                    <div>
                      <Link href={`/task/${item.id}`}>
                        <Text strong style={{ fontSize: 16 }}>{item.title}</Text>
                      </Link>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        marginTop: 8,
                        alignItems: 'center'
                      }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {item?.user?.username} · {item?._count?.answers || 0} 个回答
                        </Text>
                        <Tag color="purple">{item.points} 积分</Tag>
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <Text type="secondary">暂无推荐任务</Text>
              </div>
            )}
          </Card>
          
          {/* 热门标签卡片 */}
          <Card title={<Title level={4}>热门标签</Title>} className="tags-card">
            <Space wrap>
              {allTags.map(tag => (
                <Tag 
                  key={tag} 
                  color={selectedTag === tag ? 'blue' : 'default'}
                  style={{ cursor: 'pointer', margin: '5px', fontSize: 14, padding: '4px 8px' }}
                  onClick={() => handleTagClick(tag)}
                >
                  {tag}
                </Tag>
              ))}
            </Space>
            {selectedTag && (
              <div style={{ marginTop: 12 }}>
                <Button 
                  type="link" 
                  onClick={() => setSelectedTag(null)}
                >
                  清除筛选
                </Button>
              </div>
            )}
          </Card>
        </Col>
        
        {/* 右侧: 任务列表 */}
        <Col xs={24} md={16} className="main-tasks-col">
          <Card className="tasks-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <Title level={2} style={{ margin: 0 }}>任务列表</Title>
              <Search
                placeholder="搜索任务标题或描述"
                onSearch={handleSearch}
                style={{ width: 300 }}
                allowClear
              />
            </div>
            
            <Divider style={{ margin: '0 0 16px 0' }} />
            
            <div style={{ height: '100%', overflowY: 'auto', paddingRight: '8px' }}>
              {filteredTasks.length > 0 ? (
                filteredTasks.map(task => renderTaskCard(task))
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <Text type="secondary">没有找到匹配的任务</Text>
                </div>
              )}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
