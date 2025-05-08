'use client';

import React, { useEffect, useState } from 'react';
import { Typography, Card, Tabs, List, Tag, Statistic, Row, Col, Button, Modal, Form, Input, message, Skeleton, Empty, Avatar, Radio, InputNumber } from 'antd';
import { UserOutlined, EditOutlined, CheckCircleOutlined, ClockCircleOutlined, RightOutlined, WalletOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

interface UserProfile {
  id: number;
  username: string;
  points: number;
  createdAt: string;
  _count: {
    tasks: number;
    answers: number;
  };
  tasks: Array<{
    id: number;
    title: string;
    points: number;
    status: string;
    createdAt: string;
  }>;
  answers: Array<{
    id: number;
    isAdopted: boolean;
    createdAt: string;
    task: {
      id: number;
      title: string;
    }
  }>;
  skills: Array<{
    id: number;
    name: string;
    level: 'beginner' | 'intermediate' | 'expert';
  }>;
}

const ProfilePage: React.FC = () => {
  const { isLoggedIn, login, getToken, logout } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isRechargeModalVisible, setIsRechargeModalVisible] = useState(false);
  const [isSkillModalVisible, setIsSkillModalVisible] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'wechat' | 'alipay'>('wechat');
  const [rechargeAmount, setRechargeAmount] = useState<number>(50);
  const [rechargingStatus, setRechargingStatus] = useState<'initial' | 'processing' | 'success'>('initial');
  const [activeTabKey, setActiveTabKey] = useState('1');
  const [newSkill, setNewSkill] = useState('');
  const [skillLevel, setSkillLevel] = useState<'beginner' | 'intermediate' | 'expert'>('intermediate');
  const [form] = Form.useForm();
  const [skillForm] = Form.useForm();

  useEffect(() => {
    if (!isLoggedIn && !loading) {
      router.push('/login');
    }
  }, [isLoggedIn, loading, router]);

  useEffect(() => {
    const fetchUserProfile = async () => {
      const token = getToken();
      if (token) {
        try {
          setLoading(true);
          const headers: HeadersInit = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          };
          const response = await fetch(`/api/user/profile`, { headers });
          const data = await response.json();

          if (response.ok && data.success) {
            setProfile(data.user);
          } else {
            message.error(data.error || '获取用户信息失败');
            if (response.status === 401) {
              logout();
              message.info('登录状态已过期，请重新登录');
            }
          }
        } catch (error) {
          console.error('获取用户资料错误:', error);
          message.error('获取用户资料失败，请重试');
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [isLoggedIn, getToken, logout]);

  const handleEdit = () => {
    form.setFieldsValue({
      username: profile?.username,
    });
    setIsEditModalVisible(true);
  };

  const handleSkillsEdit = () => {
    skillForm.resetFields();
    setIsSkillModalVisible(true);
  };

  const handleUpdate = async (values: any) => {
    const token = getToken();
    if (!token) {
      message.error('请先登录');
      return;
    }
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      const response = await fetch('/api/user/update', {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify({
          username: values.username,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        message.success('用户信息更新成功');
        setIsEditModalVisible(false);
        
        if (profile) {
          setProfile({
            ...profile,
            username: values.username,
          });
        }
      } else {
        message.error(data.error || '更新用户信息失败');
        if (response.status === 401) {
          logout();
          message.info('登录状态已过期，请重新登录');
        }
      }
    } catch (error) {
      console.error('更新用户信息错误:', error);
      message.error('更新用户信息失败，请重试');
    }
  };

  const handleRecharge = () => {
    setRechargingStatus('initial');
    setIsRechargeModalVisible(true);
  };

  const handleSubmitRecharge = async () => {
    if (rechargeAmount <= 0) {
      message.error('充值金额必须大于0');
      return;
    }

    try {
      setRechargingStatus('processing');
      
      // 模拟支付过程
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 模拟调用支付API
      const token = getToken();
      if (!token) {
        message.error('请先登录');
        return;
      }

      const response = await fetch('/api/user/recharge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: rechargeAmount,
          paymentMethod: paymentMethod,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setRechargingStatus('success');
        message.success(`充值成功，积分增加${rechargeAmount}`);
        
        // 更新用户积分
        if (profile) {
          setProfile({
            ...profile,
            points: profile.points + rechargeAmount,
          });
        }
        
        // 3秒后关闭模态框
        setTimeout(() => {
          setIsRechargeModalVisible(false);
          setRechargingStatus('initial');
        }, 3000);
      } else {
        message.error(data.error || '充值失败');
        setRechargingStatus('initial');
      }
    } catch (error) {
      console.error('充值错误:', error);
      message.error('充值失败，请重试');
      setRechargingStatus('initial');
    }
  };

  const handleSkillAdd = async (values: any) => {
    const token = getToken();
    if (!token || !profile) {
      message.error('请先登录');
      return;
    }

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      
      const response = await fetch('/api/user/skills/add', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          name: values.name,
          level: values.level,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        message.success('技能添加成功');
        
        // 更新本地用户技能数据
        if (profile) {
          setProfile({
            ...profile,
            skills: [...profile.skills, data.skill],
          });
        }
        
        skillForm.resetFields();
      } else {
        message.error(data.error || '添加技能失败');
        if (response.status === 401) {
          logout();
          message.info('登录状态已过期，请重新登录');
        }
      }
    } catch (error) {
      console.error('添加技能错误:', error);
      message.error('添加技能失败，请重试');
    }
  };

  const handleSkillDelete = async (skillId: number) => {
    const token = getToken();
    if (!token || !profile) {
      message.error('请先登录');
      return;
    }

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      
      const response = await fetch(`/api/user/skills/delete`, {
        method: 'DELETE',
        headers: headers,
        body: JSON.stringify({
          skillId: skillId,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        message.success('技能删除成功');
        
        // 更新本地用户技能数据
        if (profile) {
          setProfile({
            ...profile,
            skills: profile.skills.filter(skill => skill.id !== skillId),
          });
        }
      } else {
        message.error(data.error || '删除技能失败');
        if (response.status === 401) {
          logout();
          message.info('登录状态已过期，请重新登录');
        }
      }
    } catch (error) {
      console.error('删除技能错误:', error);
      message.error('删除技能失败，请重试');
    }
  };

  if (!isLoggedIn && !loading) {
    return null;
  }

  if (loading) {
    return (
      <div style={{ padding: '24px' }}>
        <Skeleton active avatar paragraph={{ rows: 4 }} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ padding: '24px' }}>
        <Empty description="无法加载用户信息" />
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN');
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'beginner':
        return 'blue';
      case 'intermediate':
        return 'green';
      case 'expert':
        return 'purple';
      default:
        return 'default';
    }
  };

  const getLevelText = (level: string) => {
    switch (level) {
      case 'beginner':
        return '初级';
      case 'intermediate':
        return '中级';
      case 'expert':
        return '高级';
      default:
        return level;
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Row gutter={[24, 24]} align="middle">
          <Col xs={24} sm={8} md={6} lg={4} style={{ textAlign: 'center' }}>
            <Avatar size={100} icon={<UserOutlined />} />
          </Col>
          <Col xs={24} sm={16} md={18} lg={20}>
            <Row gutter={[24, 24]}>
              <Col xs={24} style={{ textAlign: 'left', marginBottom: '8px' }}>
                <svg width="180" height="50" xmlns="http://www.w3.org/2000/svg">
                  <text x="0" y="35" fontFamily="Arial, Helvetica, sans-serif" fontSize="36" fontWeight="bold" fill="#1890ff">
                    X
                  </text>
                  <text x="30" y="35" fontFamily="Arial, Helvetica, sans-serif" fontSize="28" fontWeight="500" fill="#000000">
                    river
                  </text>
                </svg>
              </Col>
            </Row>
            <Row gutter={[24, 24]} align="middle">
              <Col xs={24} md={18}>
                <Title level={2}>
                  {profile.username}
                  <Button 
                    icon={<EditOutlined />} 
                    type="link" 
                    onClick={handleEdit}
                    style={{ marginLeft: '8px', fontSize: '16px' }}
                  />
                </Title>
                <Text type="secondary">注册时间: {formatDate(profile.createdAt)}</Text>
              </Col>
              <Col xs={24} md={6}>
                <Statistic title="积分" value={profile.points} />
                <Button 
                  type="primary" 
                  icon={<WalletOutlined />}
                  onClick={handleRecharge}
                  style={{ marginTop: '8px' }}
                >
                  充值
                </Button>
              </Col>
            </Row>
            <Row gutter={[24, 24]} style={{ marginTop: '16px' }}>
              <Col span={8}>
                <Statistic title="已发布任务" value={profile._count.tasks} />
              </Col>
              <Col span={8}>
                <Statistic title="已回答问题" value={profile._count.answers} />
              </Col>
              <Col span={8}>
                <Statistic title="技能数量" value={profile.skills?.length || 0} />
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      <Card style={{ marginTop: '24px' }}>
        <Tabs 
          defaultActiveKey="1"
          activeKey={activeTabKey}
          onChange={setActiveTabKey}
          tabBarExtraContent={
            activeTabKey === '1' && profile._count.tasks > 0 ? (
              <Link href="/profile/tasks">
                <Button type="link" icon={<RightOutlined />}>
                  查看全部
                </Button>
              </Link>
            ) : activeTabKey === '2' && profile._count.answers > 0 ? (
              <Link href="/profile/answers">
                <Button type="link" icon={<RightOutlined />}>
                  查看全部
                </Button>
              </Link>
            ) : activeTabKey === '3' ? (
              <Button type="link" icon={<EditOutlined />} onClick={handleSkillsEdit}>
                添加技能
              </Button>
            ) : null
          }
        >
          <TabPane 
            tab="我的任务" 
            key="1"
          >
            <List
              itemLayout="horizontal"
              dataSource={profile.tasks}
              locale={{ emptyText: '暂无任务' }}
              renderItem={item => (
                <List.Item
                  actions={[
                    <Link href={`/task/${item.id}`} key="list-more">
                      查看详情
                    </Link>,
                  ]}
                >
                  <List.Item.Meta
                    title={<Link href={`/task/${item.id}`}>{item.title}</Link>}
                    description={`发布时间: ${formatDate(item.createdAt)}`}
                  />
                  <div>
                    <Tag color="gold">{item.points} 积分</Tag>
                    {item.status === 'open' ? (
                      <Tag icon={<ClockCircleOutlined />} color="processing">进行中</Tag>
                    ) : (
                      <Tag icon={<CheckCircleOutlined />} color="success">已完成</Tag>
                    )}
                  </div>
                </List.Item>
              )}
            />
            {profile._count.tasks > 5 && (
              <div style={{ textAlign: 'center', margin: '20px 0' }}>
                <Link href="/profile/tasks">
                  <Button type="primary">查看更多任务</Button>
                </Link>
              </div>
            )}
          </TabPane>
          <TabPane 
            tab="我的回答" 
            key="2"
          >
            <List
              itemLayout="horizontal"
              dataSource={profile.answers}
              locale={{ emptyText: '暂无回答' }}
              renderItem={item => (
                <List.Item
                  actions={[
                    <Link href={`/task/${item.task.id}`} key="list-more">
                      查看详情
                    </Link>,
                  ]}
                >
                  <List.Item.Meta
                    title={<Link href={`/task/${item.task.id}`}>{item.task.title}</Link>}
                    description={`回答时间: ${formatDate(item.createdAt)}`}
                  />
                  {item.isAdopted && (
                    <Tag icon={<CheckCircleOutlined />} color="success">已采纳</Tag>
                  )}
                </List.Item>
              )}
            />
            {profile._count.answers > 5 && (
              <div style={{ textAlign: 'center', margin: '20px 0' }}>
                <Link href="/profile/answers">
                  <Button type="primary">查看更多回答</Button>
                </Link>
              </div>
            )}
          </TabPane>
          <TabPane 
            tab="我的技能" 
            key="3"
          >
            {profile.skills && profile.skills.length > 0 ? (
              <List
                grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 4, xl: 6, xxl: 8 }}
                dataSource={profile.skills}
                renderItem={skill => (
                  <List.Item>
                    <Card 
                      size="small" 
                      title={skill.name}
                      extra={
                        <Button 
                          type="text" 
                          danger 
                          size="small"
                          onClick={() => handleSkillDelete(skill.id)}
                        >
                          删除
                        </Button>
                      }
                    >
                      <Tag color={getLevelColor(skill.level)}>
                        {getLevelText(skill.level)}
                      </Tag>
                    </Card>
                  </List.Item>
                )}
              />
            ) : (
              <Empty 
                description="暂无技能标签" 
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button type="primary" onClick={handleSkillsEdit}>添加技能</Button>
              </Empty>
            )}
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title="编辑个人信息"
        open={isEditModalVisible}
        onCancel={() => setIsEditModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleUpdate}
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少3个字符' },
            ]}
          >
            <Input prefix={<UserOutlined />} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              保存
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="积分充值"
        open={isRechargeModalVisible}
        onCancel={() => {
          if (rechargingStatus !== 'processing') {
            setIsRechargeModalVisible(false);
          }
        }}
        footer={null}
      >
        {rechargingStatus === 'success' ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <CheckCircleOutlined style={{ fontSize: '48px', color: '#52c41a' }} />
            <p style={{ fontSize: '16px', marginTop: '16px' }}>充值成功！</p>
            <p>您已成功充值 {rechargeAmount} 积分</p>
          </div>
        ) : (
          <Form layout="vertical">
            <Form.Item label="充值金额">
              <InputNumber
                min={1}
                value={rechargeAmount}
                onChange={(value) => setRechargeAmount(value as number)}
                style={{ width: '100%' }}
                addonAfter="积分"
                disabled={rechargingStatus === 'processing'}
              />
            </Form.Item>
            <Form.Item label="支付方式">
              <Radio.Group
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                disabled={rechargingStatus === 'processing'}
              >
                <Radio.Button value="wechat">微信支付</Radio.Button>
                <Radio.Button value="alipay">支付宝</Radio.Button>
              </Radio.Group>
            </Form.Item>
            <Form.Item>
              <Button
                type="primary"
                onClick={handleSubmitRecharge}
                loading={rechargingStatus === 'processing'}
                block
              >
                {rechargingStatus === 'processing' ? '处理中...' : '确认充值'}
              </Button>
              <div style={{ marginTop: '12px', color: '#999', fontSize: '12px' }}>
                注：当前为模拟支付环境，点击确认后将直接增加积分
              </div>
            </Form.Item>
          </Form>
        )}
      </Modal>

      <Modal
        title="添加技能标签"
        open={isSkillModalVisible}
        onCancel={() => setIsSkillModalVisible(false)}
        footer={null}
      >
        <Form
          form={skillForm}
          layout="vertical"
          onFinish={handleSkillAdd}
        >
          <Form.Item
            name="name"
            label="技能名称"
            rules={[
              { required: true, message: '请输入技能名称' },
              { min: 2, message: '技能名称至少2个字符' },
            ]}
          >
            <Input placeholder="例如：React、Java、AI、UI设计" />
          </Form.Item>
          <Form.Item
            name="level"
            label="熟练度"
            initialValue="intermediate"
            rules={[{ required: true, message: '请选择熟练度' }]}
          >
            <Radio.Group>
              <Radio.Button value="beginner">初级</Radio.Button>
              <Radio.Button value="intermediate">中级</Radio.Button>
              <Radio.Button value="expert">高级</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              添加
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProfilePage; 