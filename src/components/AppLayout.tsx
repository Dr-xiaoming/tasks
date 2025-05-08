'use client';

import React from 'react';
import { Layout, Button, Space, Dropdown, Avatar, Menu, Badge } from 'antd';
import Link from 'next/link';
import { PlusOutlined, UserOutlined, LogoutOutlined, BellOutlined } from '@ant-design/icons';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import type { MenuProps } from 'antd';
import NotificationPoller, { useNotifications } from './NotificationPoller';

const { Header, Content } = Layout;

interface AppLayoutProps {
  children: React.ReactNode;
}

const NavBarContent = () => {
  const { user, isLoggedIn, logout } = useAuth();
  const router = useRouter();
  const { unreadCount, fetchNotifications } = useNotifications();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  // 用户菜单选项
  const userMenuItems: MenuProps['items'] = [
    {
      key: '1',
      icon: <UserOutlined />,
      label: <Link href="/profile">个人中心</Link>,
    },
    {
      key: '2',
      icon: <LogoutOutlined />,
      label: <a onClick={handleLogout}>退出登录</a>,
    },
  ];

  // 通知菜单
  const notificationMenuItems: MenuProps['items'] = [
    {
      key: 'refreshNotifications',
      label: <a onClick={() => fetchNotifications()}>刷新通知</a>,
    },
    {
      key: 'viewAll',
      label: <Link href="/notifications">查看所有通知</Link>,
    },
  ];

  return (
    <>
      <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
        <Link href="/" style={{ color: 'inherit', fontWeight: 'bold', fontSize: '18px', marginRight: '24px' }}>
          任务平台
        </Link>
        <div className="nav-links" style={{ display: 'flex', gap: '24px' }}>
          <Link href="/" style={{ color: 'inherit' }}>
            首页
          </Link>
          <Link href="/users" style={{ color: 'inherit' }}>
            用户列表
          </Link>
          <Link href="/chat" style={{ color: 'inherit' }}>
            我的私信
          </Link>
        </div>
      </div>
      <Space>
        {isLoggedIn && (
          <>
            <Dropdown menu={{ items: notificationMenuItems }} placement="bottomRight">
              <Badge count={unreadCount} size="small">
                <Button 
                  type="text" 
                  icon={<BellOutlined style={{ fontSize: '18px' }} />} 
                  style={{ marginRight: 8 }}
                />
              </Badge>
            </Dropdown>
            
            <Link href="/publish" passHref>
              <Button type="primary" icon={<PlusOutlined />}>
                发布任务
              </Button>
            </Link>
          </>
        )}
        
        {isLoggedIn ? (
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div style={{ cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} />
              <span style={{ marginLeft: 8 }}>{user?.username}</span>
            </div>
          </Dropdown>
        ) : (
          <Space>
            <Link href="/login" passHref>
              <Button>登录</Button>
            </Link>
            <Link href="/register" passHref>
              <Button>注册</Button>
            </Link>
          </Space>
        )}
      </Space>
    </>
  );
};

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <AuthProvider>
      <NotificationPoller>
        <Layout style={{ minHeight: '100vh' }}>
          <Header style={{ display: 'flex', alignItems: 'center', background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0' }}>
            <NavBarContent />
          </Header>
          <Content style={{ padding: '24px', background: '#f5f5f5' }}>
            <div style={{ background: '#fff', padding: 24, minHeight: 280 }}>
               {children}
            </div>
          </Content>
        </Layout>
      </NotificationPoller>
    </AuthProvider>
  );
};

export default AppLayout; 