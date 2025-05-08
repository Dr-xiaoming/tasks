'use client';

import React from 'react';
import { Tooltip, Typography, Avatar, Tag } from 'antd';
import { NotificationOutlined, TrophyOutlined, SafetyCertificateOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface MessageBubbleProps {
  content: string;
  isMe: boolean;
  timestamp: string;
  sender: string;
  type?: 'text' | 'system' | 'reward' | 'notification';
  rewardPoints?: number;
  taskId?: string;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ 
  content, 
  isMe, 
  timestamp, 
  sender, 
  type = 'text',
  rewardPoints,
  taskId
}) => {
  // 系统通知消息样式 - 专门用于采纳回答的系统通知
  if (type === 'notification') {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '16px',
        width: '100%',
      }}>
        <div style={{
          backgroundColor: '#e6f7ff',
          padding: '12px 20px',
          borderRadius: '8px',
          maxWidth: '85%',
          textAlign: 'center',
          color: '#1677ff',
          border: '1px solid #91caff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}>
          <SafetyCertificateOutlined style={{ marginRight: '8px', fontSize: '16px' }} />
          <span style={{ fontWeight: 'bold' }}>系统通知：</span> {content}
          {rewardPoints && (
            <Tag color="blue" style={{ marginLeft: '8px', borderRadius: '10px' }}>+{rewardPoints} 积分</Tag>
          )}
          <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
            {new Date(timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </div>
        </div>
      </div>
    );
  }
  
  // 系统消息和奖励消息样式
  if (type === 'system' || type === 'reward') {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '16px',
        width: '100%',
      }}>
        <div style={{
          backgroundColor: type === 'reward' ? '#fffbe6' : '#f0f0f0',
          padding: '8px 16px',
          borderRadius: '4px',
          maxWidth: '80%',
          textAlign: 'center',
          color: type === 'reward' ? '#faad14' : '#666',
          border: type === 'reward' ? '1px solid #ffe58f' : '1px solid #e0e0e0'
        }}>
          {type === 'reward' && (
            <TrophyOutlined style={{ marginRight: '8px', color: '#faad14' }} />
          )}
          {type === 'system' && (
            <NotificationOutlined style={{ marginRight: '8px' }} />
          )}
          <span>{content}</span>
          {type === 'reward' && rewardPoints && (
            <Tag color="gold" style={{ marginLeft: '8px' }}>+{rewardPoints} 积分</Tag>
          )}
          <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
            {new Date(timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </div>
        </div>
      </div>
    );
  }

  // 普通消息样式
  const bubbleStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '10px 16px',
    borderRadius: isMe ? '8px 8px 0 8px' : '8px 8px 8px 0',
    maxWidth: '100%',
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
    backgroundColor: isMe ? '#1677ff' : '#fff',
    color: isMe ? '#fff' : '#333',
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
    marginTop: '4px',
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: isMe ? 'flex-end' : 'flex-start',
    marginBottom: '16px',
    width: '100%',
  };

  const timeStyle: React.CSSProperties = {
    fontSize: '11px',
    color: '#999',
    marginTop: '4px',
    textAlign: isMe ? 'right' : 'left',
  };

  const messageContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: isMe ? 'row-reverse' : 'row',
    alignItems: 'flex-start',
    gap: '8px',
    maxWidth: '80%',
  };

  const senderStyle: React.CSSProperties = {
    fontSize: '13px',
    color: '#666',
    marginBottom: '2px',
    textAlign: isMe ? 'right' : 'left',
  };

  return (
    <div style={containerStyle}>
      <div style={messageContainerStyle}>
        <Avatar 
          size={36} 
          src={isMe ? undefined : '/user.jpg'} 
        />
        <div style={{ maxWidth: 'calc(100% - 44px)' }}>
          {!isMe && <div style={senderStyle}>{sender}</div>}
          {type === 'text' ? (
            <div 
              style={bubbleStyle}
              dangerouslySetInnerHTML={{ __html: content }}
            />
          ) : (
            <div style={bubbleStyle}>
              {content}
            </div>
          )}
          <div style={timeStyle}>
            {new Date(timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble; 