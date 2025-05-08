'use client';

import React, { useState, useEffect } from 'react';
import { Card, List, Checkbox, Typography, Progress, Button, Space, Divider, message, Modal } from 'antd';
import { useAuth } from '@/contexts/AuthContext';
import { ExclamationCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface TaskRequirement {
  id: string;
  content: string;
  completed: boolean;
}

interface TaskRequirementsProps {
  taskId: string;
  isTaskPublisher: boolean; // 是否是任务发布者
  onAllCompleted?: () => void; // 所有需求完成时的回调
  conversationId?: string; // 新增：当在聊天页面使用时的对话ID
  initialRequirements?: TaskRequirement[]; // 新增：初始需求列表，用于聊天页面
}

const TaskRequirements: React.FC<TaskRequirementsProps> = ({ 
  taskId, 
  isTaskPublisher,
  onAllCompleted,
  conversationId,
  initialRequirements 
}) => {
  const { getToken } = useAuth();
  const [requirements, setRequirements] = useState<TaskRequirement[]>(initialRequirements || []);
  const [loading, setLoading] = useState(!initialRequirements);
  const [error, setError] = useState<string | null>(null);
  const [allCompleted, setAllCompleted] = useState(false);
  
  // 新增：确认对话框相关状态
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [currentRequirement, setCurrentRequirement] = useState<{id: string, checked: boolean} | null>(null);

  // 计算已完成的需求数量和百分比
  const completedCount = requirements.filter(req => req.completed).length;
  const completionPercentage = 
    requirements.length > 0 ? Math.round((completedCount / requirements.length) * 100) : 0;

  // 获取任务需求列表
  useEffect(() => {
    // 如果有初始需求列表，直接使用而不需要获取
    if (initialRequirements && initialRequirements.length > 0) {
      setRequirements(initialRequirements);
      const completed = initialRequirements.every(req => req.completed);
      setAllCompleted(completed);
      setLoading(false);
      return;
    }

    const fetchRequirements = async () => {
      if (!taskId) return;
      
      setLoading(true);
      try {
        const token = getToken();
        
        // 如果有对话ID，使用新的API获取任务需求
        if (conversationId) {
          const response = await fetch(`/api/chat/requirements`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ conversationId, taskId })
          });
          
          if (!response.ok) {
            throw new Error('获取任务需求失败');
          }
          
          const data = await response.json();
          if (data.requirements) {
            setRequirements(data.requirements);
            
            // 检查是否所有需求都已完成
            const completed = data.requirements.every((req: TaskRequirement) => req.completed);
            setAllCompleted(completed);
          }
        } 
        // 否则使用原有API获取任务需求
        else {
          const response = await fetch(`/api/tasks/${taskId}/requirements`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          
          if (!response.ok) {
            throw new Error('获取任务需求失败');
          }
          
          const data = await response.json();
          setRequirements(data);

          // 检查是否所有需求都已完成
          const completed = data.every((req: TaskRequirement) => req.completed);
          setAllCompleted(completed);
        }
      } catch (error: any) {
        console.error('获取任务需求出错:', error);
        setError(error.message || '加载任务需求时发生错误');
      } finally {
        setLoading(false);
      }
    };
    
    fetchRequirements();
  }, [taskId, getToken, conversationId, initialRequirements]);

  // 当完成状态变化时
  useEffect(() => {
    const completed = requirements.every(req => req.completed);
    setAllCompleted(completed);
    
    if (completed && requirements.length > 0 && onAllCompleted) {
      onAllCompleted();
    }
  }, [requirements, onAllCompleted]);

  // 显示确认对话框
  const showConfirmModal = (requirementId: string, checked: boolean) => {
    if (!isTaskPublisher) {
      message.info('只有任务发布者才能更新需求状态');
      return;
    }
    
    console.log('准备显示确认框:', requirementId, checked);
    setCurrentRequirement({ id: requirementId, checked });
    setConfirmModalVisible(true);
  };

  // 处理确认操作
  const handleConfirm = async () => {
    if (!currentRequirement) return;
    
    const { id: requirementId, checked } = currentRequirement;
    
    try {
      const token = getToken();
      
      // 根据是否在聊天界面使用不同的API
      if (conversationId) {
        console.log('调用聊天页面API:', conversationId, taskId, requirementId, checked);
        const response = await fetch(`/api/chat/requirements/update`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ 
            conversationId, 
            taskId, 
            requirementId, 
            completed: checked 
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('API错误:', errorData);
          throw new Error(errorData.error || '更新需求状态失败');
        }
      } else {
        // 原有的任务界面API调用
        console.log('调用任务页面API:', taskId, requirementId, checked);
        const response = await fetch(`/api/tasks/${taskId}/requirements/${requirementId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ completed: checked })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('API错误:', errorData);
          throw new Error(errorData.error || '更新需求状态失败');
        }
      }
      
      // 更新本地状态
      setRequirements(prev => 
        prev.map(req => 
          req.id === requirementId ? { ...req, completed: checked } : req
        )
      );
      
      message.success(`需求已${checked ? '完成' : '取消完成'}`);
    } catch (error: any) {
      console.error('更新需求状态失败:', error);
      message.error(error.message || '更新需求状态失败');
    } finally {
      setConfirmModalVisible(false);
      setCurrentRequirement(null);
    }
  };
  
  // 处理取消操作
  const handleCancel = () => {
    setConfirmModalVisible(false);
    setCurrentRequirement(null);
  };

  if (loading) {
    return <Card loading style={{ marginBottom: 16 }} />;
  }

  if (error) {
    return (
      <Card style={{ marginBottom: 16 }}>
        <Text type="danger">{error}</Text>
      </Card>
    );
  }

  if (requirements.length === 0) {
    return (
      <Card style={{ marginBottom: 16 }}>
        <Text type="secondary">该任务没有详细需求清单</Text>
      </Card>
    );
  }

  return (
    <>
      <Card 
        title="任务需求清单" 
        bordered={true} 
        style={{ marginBottom: 16 }}
        extra={
          <Space>
            <Progress 
              type="circle" 
              percent={completionPercentage} 
              size={24} 
              status={allCompleted ? "success" : "active"}
            />
            <Text>{completedCount}/{requirements.length}</Text>
          </Space>
        }
      >
        <List
          dataSource={requirements}
          renderItem={(item) => (
            <List.Item>
              <Space>
                <Checkbox 
                  checked={item.completed} 
                  onChange={(e) => showConfirmModal(item.id, e.target.checked)}
                  disabled={!isTaskPublisher}
                />
                <Text delete={item.completed}>{item.content}</Text>
              </Space>
            </List.Item>
          )}
        />
        
        {allCompleted && isTaskPublisher && (
          <>
            <Divider />
            <Text type="success" style={{ fontWeight: 'bold' }}>
              所有需求已完成，您现在可以采纳该回答
            </Text>
          </>
        )}
      </Card>
      
      {/* 确认对话框 */}
      <Modal
        title="确认更新需求状态"
        open={confirmModalVisible}
        onOk={handleConfirm}
        onCancel={handleCancel}
        okText="确认"
        cancelText="取消"
      >
        <p>确定要将此需求标记为{currentRequirement?.checked ? '已完成' : '未完成'}吗？</p>
      </Modal>
    </>
  );
};

export default TaskRequirements; 