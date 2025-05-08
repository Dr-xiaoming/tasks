'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Input, Button, Form, List, Typography, Divider, Avatar, message, Upload } from 'antd';
import { SendOutlined, CheckCircleOutlined, PaperClipOutlined } from '@ant-design/icons';
import MessageBubble from './MessageBubble'; // 先引入，稍后创建
import TaskRequirements from './TaskRequirements';
import { useAuth } from '@/contexts/AuthContext';

const { Text } = Typography;

interface Message {
  id: string;
  sender: string;
  senderId: number; // 添加发送者ID字段
  content: string;
  timestamp: string;
  isMe: boolean;
  type?: 'text' | 'system' | 'reward' | 'notification'; // 添加消息类型
  taskId?: string; // 相关任务ID
  rewardPoints?: number; // 奖励积分数量
}

interface ChatWindowProps {
  conversationId: string;
  messages: Message[];
  partnerName: string;
  onSendMessage: (content: string) => void;
  onFileUpload: (file: File) => void; // 添加文件上传回调
  taskInfo?: {
    id: string;
    title: string;
    isPublisher: boolean;
    isCompleted: boolean;
    requirements?: {
      id: string;
      content: string;
      completed: boolean;
    }[];
  };
}

const ChatWindow: React.FC<ChatWindowProps> = ({ 
  conversationId, 
  messages, 
  partnerName, 
  onSendMessage,
  onFileUpload, // 接收文件上传回调
  taskInfo 
}) => {
  const [form] = Form.useForm();
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const inputRef = useRef<any>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [requirementsCompleted, setRequirementsCompleted] = useState(false);
  const [adopting, setAdopting] = useState(false);
  const [taskRequirements, setTaskRequirements] = useState<any[]>([]);
  const [loadingRequirements, setLoadingRequirements] = useState(false);
  const { getToken } = useAuth();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages]); // 当消息列表变化时滚动到底部

  useEffect(() => {
    // 聊天窗口加载后自动聚焦输入框
    if (inputRef.current) {
      setTimeout(() => {
        inputRef.current.focus();
      }, 100);
    }
  }, []);


  // 获取任务需求
  useEffect(() => {
    // 如果taskInfo中已有requirements，直接使用
    
    if (taskInfo?.requirements) {
      setTaskRequirements(taskInfo.requirements);
      // 检查是否所有需求都已完成
      const completed = taskInfo.requirements.every(req => req.completed);
      setRequirementsCompleted(completed);
      return;
    }

    // 如果没有taskInfo或没有任务ID，不需要获取需求
    if (!taskInfo?.id) return;

    const fetchRequirements = async () => {
      setLoadingRequirements(true);
      try {
        const token = getToken();
        const response = await fetch(`/api/chat/requirements`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ 
            conversationId,
            taskId: taskInfo.id 
          })
        });
        
        if (!response.ok) {
          throw new Error('获取任务需求失败');
        }
        
        const data = await response.json();
        if (data.requirements) {
          setTaskRequirements(data.requirements);
          // 检查是否所有需求都已完成
          const completed = data.requirements.every((req: any) => req.completed);
          setRequirementsCompleted(completed);
        }
      } catch (error: any) {
        console.error('获取任务需求失败:', error);
        message.error('获取任务需求失败: ' + (error.message || '未知错误'));
      } finally {
        setLoadingRequirements(false);
      }
    };

    fetchRequirements();
  }, [taskInfo, conversationId, getToken]);

  const handleSendMessage = (values: { message: string }) => {
    if (!values.message || values.message.trim() === '') return;
    onSendMessage(values.message);
    form.resetFields();
    
    // 发送后再次聚焦输入框
    if (inputRef.current) {
      setTimeout(() => {
        inputRef.current.focus();
      }, 100);
    }
  };

  const handleAdoptAnswer = async () => {
    if (!taskInfo || !taskInfo.id) {
      message.error('无法确定任务信息');
      return;
    }

    if (!requirementsCompleted && taskInfo.isPublisher) {
      message.warning('请先完成所有任务需求再采纳回答');
      return;
    }

    try {
      setAdopting(true);
      
      // 获取回答ID（而不是用户ID）
      const token = getToken();
      
      // 先获取任务的所有回答
      const answersResponse = await fetch(`/api/tasks/${taskInfo.id}/answers`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!answersResponse.ok) {
        throw new Error('获取任务回答列表失败');
      }
      
      const answersData = await answersResponse.json();
      
      // 在控制台输出回答数据，帮助调试
      console.log('任务回答数据:', answersData);
      
      // 确保answersData本身是一个数组 (可以是空数组)
      if (!Array.isArray(answersData)) { 
        console.error("从API获取的任务回答数据结构无效，期望是一个数组，实际是:", answersData);
        throw new Error('获取到的任务回答数据格式不正确，期望是一个数组');
      }
      
      // 获取聊天对方的用户ID
      let partnerId = messages.find(m => !m.isMe)?.senderId;
      console.log('从消息中获取的partnerId:', partnerId);
      console.log('对话用户名:', partnerName);
      
      // 如果从消息中未找到 partnerId，立即尝试通过 partnerName 从后端获取
      if (!partnerId && partnerName) {
        try {
          message.info(`正在尝试通过用户名 ${partnerName} 获取用户ID...`);
          const userResponse = await fetch(`/api/users/by-username?username=${encodeURIComponent(partnerName)}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (userResponse.ok) {
            const userData = await userResponse.json();
            if (userData && userData.id) {
              partnerId = userData.id;
              message.success(`成功获取到用户 ${partnerName} (ID: ${partnerId}) 的信息。`);
            } else {
              throw new Error('未找到用户或用户数据无效');
            }
          } else {
            const errorData = await userResponse.json().catch(() => ({ message: '查询用户信息失败，且无法解析错误详情' }));
            throw new Error(errorData.message || `通过用户名获取用户ID失败，状态码: ${userResponse.status}`);
          }
        } catch (e: any) {
          console.error('通过用户名获取用户ID失败:', e);
          message.error(`无法通过用户名 ${partnerName} 确定回答者ID: ${e.message}`);
          throw new Error(`无法确定回答者ID: 通过用户名 ${partnerName} 查询失败。`);
        }
      }

      if (!partnerId) {
        throw new Error('无法确定回答者ID，且无法通过用户名获取。');
      }

      // 从回答列表中找到该用户的回答
      // 直接使用 answersData，因为它本身就是回答数组
      const userAnswers = answersData.filter((a: any) => a.userId === partnerId);
      console.log('用户回答列表:', userAnswers);
      
      if (!userAnswers || userAnswers.length === 0) {
        message.error(`未找到用户 ${partnerName} 对该任务的回答`);
        setAdopting(false);
        return;
      }
      
      // 按创建时间排序获取最新回答
      const answer = userAnswers.sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      
      if (!answer || !answer.id) {
        throw new Error('未找到该用户对此任务的回答');
      }
      
      // 调用采纳API，使用回答ID
      const response = await fetch(`/api/tasks/${taskInfo.id}/answers/${answer.id}/adopt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '采纳回答失败');
      }

      message.success('已成功采纳回答！');
      // 可以在这里更新任务状态或者刷新页面
      if (taskInfo) {
        taskInfo.isCompleted = true;
      }
    } catch (error: any) {
      console.error('采纳回答失败:', error);
      message.error(error.message || '采纳回答失败，请稍后重试');
    } finally {
      setAdopting(false);
    }
  };

  const handleRequirementsCompleted = () => {
    setRequirementsCompleted(true);
    message.success('所有需求已完成，可以采纳回答了！');
  };

  const handleBeforeUpload = (file: File) => {
    onFileUpload(file);
    return false; // 阻止 antd Upload 组件的默认上传行为
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#fff' }}>
      {/* 聊天窗口头部 */}
      <div style={{ 
        padding: '16px 20px', 
        borderBottom: '1px solid #eaeaea', 
        backgroundColor: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Avatar src="/user.jpg" style={{ marginRight: 12 }} />
          <div>
            <Text strong style={{ fontSize: '16px' }}>{partnerName}</Text>
            <div style={{ fontSize: '12px', color: '#999' }}>在线</div>
          </div>
        </div>
        
        {/* 如果有任务信息且是发布者且任务未完成，显示采纳按钮 */}
        {taskInfo && taskInfo.isPublisher && !taskInfo.isCompleted && (
          <Button 
            type="primary" 
            icon={<CheckCircleOutlined />} 
            onClick={handleAdoptAnswer}
            loading={adopting}
            disabled={!requirementsCompleted}
          >
            采纳回答
          </Button>
        )}
      </div>
      
      {/* 任务需求列表 */}
      {taskInfo && (
        <div style={{ padding: '0 20px' }}>
          <TaskRequirements 
            taskId={taskInfo.id}
            isTaskPublisher={taskInfo.isPublisher}
            onAllCompleted={handleRequirementsCompleted}
            conversationId={conversationId}
            initialRequirements={taskRequirements.length > 0 ? taskRequirements : undefined}
          />
        </div>
      )}
      
      {/* 聊天消息列表 */}
      <div 
        ref={messagesContainerRef}
        style={{ 
          flexGrow: 1, 
          overflowY: 'auto', 
          padding: '10px 0',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#f0f2f5',
        }}
      >
        <List
          style={{ width: '100%' }}
          dataSource={messages}
          renderItem={message => (
            <List.Item style={{ 
              border: 'none', 
              padding: '0px 20px',
              width: '100%',
              display: 'flex', 
              justifyContent: 'center'
            }}>
              <div style={{ width: '100%', maxWidth: '900px' }}>
                <MessageBubble 
                  key={message.id}
                  content={message.content}
                  isMe={message.isMe}
                  timestamp={message.timestamp}
                  sender={message.sender}
                  type={message.type}
                  rewardPoints={message.rewardPoints}
                  taskId={message.taskId}
                />
              </div>
            </List.Item>
          )}
        />
        <div ref={messagesEndRef} />
      </div>

      {/* 消息输入区域 */}
      <div style={{ 
        padding: '12px 20px', 
        borderTop: '1px solid #eaeaea', 
        backgroundColor: '#fff',
        boxShadow: '0 -1px 3px rgba(0,0,0,0.05)'
      }}>
        <Form 
          form={form} 
          onFinish={handleSendMessage} 
          style={{ 
            display: 'flex', 
            alignItems: 'center',
            maxWidth: '900px',
            margin: '0 auto',
            width: '100%'
          }}
        >
          <Form.Item name="message" style={{ flexGrow: 1, marginBottom: 0, marginRight: 8 }}>
            <Input 
              placeholder="输入消息..." 
              autoComplete="off" 
              ref={inputRef}
              size="large"
              bordered
              style={{ borderRadius: '4px', padding: '8px 16px' }}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  form.submit();
                  e.preventDefault();
                }
              }}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, marginRight: 8 }}>
            <Upload
              beforeUpload={handleBeforeUpload}
              showUploadList={false}
            >
              <Button 
                icon={<PaperClipOutlined />} 
                size="large" 
                shape="circle" 
              />
            </Upload>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button 
              type="primary" 
              htmlType="submit" 
              shape="circle" 
              icon={<SendOutlined />} 
              size="large"
            />
          </Form.Item>
        </Form>
      </div>
    </div>
  );
};

export default ChatWindow; 