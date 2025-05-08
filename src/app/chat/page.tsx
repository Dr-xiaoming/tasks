'use client';

import React from 'react';
import ChatLayout from '@/components/ChatLayout';
import { Empty } from 'antd';

const ChatPage: React.FC = () => {
  return (
    <ChatLayout>
      {/* 默认显示提示信息 */}
      <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Empty description="请选择一个对话开始聊天" />
      </div>
    </ChatLayout>
  );
};

export default ChatPage; 