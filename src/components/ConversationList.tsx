'use client';

import React from 'react';
import { List, Avatar, Typography, Badge } from 'antd';
import Link from 'next/link';
import { UserOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface Conversation {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: string;
  avatar?: string;
  unreadCount?: number;
}

interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId?: string;
}

const ConversationList: React.FC<ConversationListProps> = ({ conversations, activeConversationId }) => {
  return (
    <div>
      <div style={{ padding: '16px 16px 8px', borderBottom: '1px solid #f0f0f0' }}>
        <Text strong style={{ fontSize: '16px' }}>对话列表</Text>
      </div>
      <List
        itemLayout="horizontal"
        dataSource={conversations}
        renderItem={(item) => (
          <Link href={`/chat/${item.id}`} passHref style={{ display: 'block' }}>
             <List.Item 
               style={{
                 padding: '12px 16px',
                 cursor: 'pointer',
                 backgroundColor: activeConversationId === item.id ? '#e6f7ff' : 'transparent',
                 borderLeft: activeConversationId === item.id ? '3px solid #1677ff' : 'none',
                 transition: 'all 0.3s',
                 margin: '4px 0',
                 borderRadius: '4px',
               }}
               className="conversation-list-item"
               key={item.id}
             >
              <List.Item.Meta
                avatar={
                  <Avatar 
                    size={46} 
                    src={item.avatar || '/user.jpg'}
                    style={{ border: '1px solid #eaeaea' }}
                  />
                }
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong>{item.name}</Text>
                    {item.unreadCount ? (
                      <Badge count={item.unreadCount} size="small" />
                    ) : null}
                  </div>
                }
                description={
                  <div>
                    <Text ellipsis style={{ maxWidth: '180px', display: 'block' }}>{item.lastMessage}</Text>
                    <Text type="secondary" style={{ fontSize: '12px', marginTop: '4px' }}>
                      {formatTimestamp(item.timestamp)}
                    </Text>
                  </div>
                }
              />
            </List.Item>
          </Link>
        )}
      />
    </div>
  );
};

// 格式化时间戳的辅助函数
const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  
  // 今天的消息只显示时间
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  }
  
  // 昨天的消息显示"昨天"
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return '昨天';
  }
  
  // 一周内的消息显示星期几
  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const dayDiff = Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (dayDiff < 7) {
    return weekDays[date.getDay()];
  }
  
  // 超过一周的消息显示日期
  return `${date.getMonth() + 1}月${date.getDate()}日`;
};

export default ConversationList; 