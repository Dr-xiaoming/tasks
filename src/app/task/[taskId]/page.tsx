'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Typography, Tag, Divider, List, Avatar, Form, Input, Button, message, Space, Spin, Alert, App, ConfigProvider, Card, Checkbox, Progress, Modal } from 'antd';
import { UserOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

// 删除静态message配置
// message.config({
//   maxCount: 3,
//   top: 100,
//   duration: 2,
// });

// 任务需求接口
interface TaskRequirement {
  id: string;
  content: string;
  completed: boolean;
}

// 最终答案接口
interface FinalAnswer {
  id: string;
  content: string;
  timestamp: string;
  userId: string;
  user: {
    id: string;
    username: string;
  };
}

// 添加任务领取信息接口
interface TaskClaimInfo {
  claimId: number; // 认领记录的ID
  claimedBy: string; // 认领者用户名
  claimedById: number; // 认领者用户ID
  claimedAt: string; // 认领时间
  expiresAt: string | null; // 过期时间
  isClaimedByCurrentUser: boolean;
}

const TaskDetailPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const taskId = params.taskId as string;
  const [form] = Form.useForm();
  const [finalAnswerForm] = Form.useForm();
  const { getToken, logout, isLoggedIn, getUserId } = useAuth();
  const [task, setTask] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [finalAnswers, setFinalAnswers] = useState<FinalAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthor, setIsAuthor] = useState(false);
  const [hasSubmittedFinalAnswer, setHasSubmittedFinalAnswer] = useState(false);
  const [requirements, setRequirements] = useState<TaskRequirement[]>([]);
  const [loadingRequirements, setLoadingRequirements] = useState(false);
  const [loadingFinalAnswers, setLoadingFinalAnswers] = useState(false);
  // 新增状态
  const [claimLoading, setClaimLoading] = useState(false);
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [claimInfo, setClaimInfo] = useState<TaskClaimInfo | null>(null);
  const [activeClaimsCount, setActiveClaimsCount] = useState<number>(0);
  const [aiAssistLoading, setAiAssistLoading] = useState(false); // 新增AI辅助解答按钮加载状态
  // 使用useMessage钩子获取消息API
  const [messageApi, contextHolder] = message.useMessage();
  // 使用useModal钩子获取Modal API
  const [modal, modalContextHolder] = Modal.useModal();

  // 计算已完成的需求数量和百分比
  const completedCount = requirements.filter(req => req.completed).length;
  const completionPercentage = 
    requirements.length > 0 ? Math.round((completedCount / requirements.length) * 100) : 0;

  // 将fetchData移到useEffect外部，便于其他函数调用
  const fetchData = async () => {
    if (!taskId) return;

    setLoading(true);
    setError(null);
    const token = getToken();
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      // 1. 获取任务详情
      const taskRes = await fetch(`/api/tasks/${taskId}`, { headers });
      if (!taskRes.ok) {
        if (taskRes.status === 401) {
           logout();
           messageApi.info('请登录后查看任务详情');
        }
        throw new Error(`获取任务详情失败: ${taskRes.statusText}`);
      }
      const taskData = await taskRes.json();
      setTask(taskData);

      // 根据 taskData.activeClaim 设置 claimInfo
      if (taskData.activeClaim) {
        const currentAuthUserId = getUserId(); // 获取当前登录用户的ID
        const apiClaim = taskData.activeClaim; // 后端返回的 activeClaim 对象

        const newClaimInfoData: TaskClaimInfo = {
          claimId: apiClaim.claimId,
          claimedBy: apiClaim.claimedBy,
          claimedById: apiClaim.claimantUserId, // 后端字段是 claimantUserId
          claimedAt: apiClaim.claimedAt,
          expiresAt: apiClaim.expiresAt,
          isClaimedByCurrentUser: !!currentAuthUserId && currentAuthUserId === apiClaim.claimantUserId,
        };
        setClaimInfo(newClaimInfoData);
      } else {
        setClaimInfo(null); // 任务未被认领或非独占任务
      }

      // 使用后端返回的 isCurrentUserAuthor 字段
      setIsAuthor(taskData.isCurrentUserAuthor);

      // 如果用户已登录，获取他们当前已领取的任务数量
      if (token && isLoggedIn) {
        await fetchActiveClaimsCount();
      }

      // 2. 获取评论列表
      const commentsRes = await fetch(`/api/tasks/${taskId}/answers`, { headers });
      if (!commentsRes.ok) {
         if (commentsRes.status === 401) {
           messageApi.info('登录后才能查看完整评论列表');
           setComments([]);
        } else {
            throw new Error(`获取评论列表失败: ${commentsRes.statusText}`);
        }
      }
      const commentsData = await commentsRes.json();
      console.log('获取到的评论列表数据:', commentsData);
      if (commentsData && commentsData.length > 0) {
        console.log('评论示例:', commentsData[0]);
      }
      setComments(commentsData);

      // 3. 获取任务需求列表
      await fetchTaskRequirements(token);
      
      // 4. 获取最终答案
      await fetchFinalAnswers(token);

    } catch (err: any) {
      console.error("获取数据出错:", err);
      setError(err.message || '加载数据时发生错误');
    } finally {
      setLoading(false);
    }
  };

  // 获取任务需求列表
  const fetchTaskRequirements = async (token: string | null) => {
    if (!taskId) return;
    
    setLoadingRequirements(true);
    try {
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/tasks/${taskId}/requirements`, { headers });
      
      if (!response.ok) {
        if (response.status !== 401) { // 忽略未授权错误，因为游客也可以查看但不能修改
          console.error('获取任务需求失败:', response.statusText);
        }
        setRequirements([]);
        return;
      }
      
      const requirementsData = await response.json();
      setRequirements(requirementsData);
    } catch (error) {
      console.error('获取任务需求出错:', error);
      setRequirements([]);
    } finally {
      setLoadingRequirements(false);
    }
  };
  
  // 获取最终答案列表
  const fetchFinalAnswers = async (token: string | null) => {
    if (!taskId) return;
    
    setLoadingFinalAnswers(true);
    try {
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/tasks/${taskId}/final-answer`, { headers });
      
      if (!response.ok) {
        if (response.status === 404) {
          // 最终答案不存在，这是正常情况
          setFinalAnswers([]);
          setHasSubmittedFinalAnswer(false);
          return;
        }
        if (response.status !== 401) { // 忽略未授权错误
          console.error('获取最终答案失败:', response.statusText);
        }
        setFinalAnswers([]);
        setHasSubmittedFinalAnswer(false);
        return;
      }
      
      const finalAnswersData = await response.json();
      setFinalAnswers(Array.isArray(finalAnswersData) ? finalAnswersData : [finalAnswersData]);
      
      // 检查当前用户是否已提交过最终答案
      const currentUserId = getUserId();
      const hasSubmitted = Array.isArray(finalAnswersData) && finalAnswersData.some(
        answer => answer.userId === currentUserId || answer.user?.id === currentUserId
      );
      setHasSubmittedFinalAnswer(hasSubmitted);
      
    } catch (error) {
      console.error('获取最终答案出错:', error);
      setFinalAnswers([]);
      setHasSubmittedFinalAnswer(false);
    } finally {
      setLoadingFinalAnswers(false);
    }
  };

  // 提交最终答案
  const handleFinalAnswerSubmit = async (values: any) => {
    const token = getToken();
    if (!token) {
      messageApi.error('请先登录再提交最终答案');
      return;
    }
    
    try {
      const response = await fetch(`/api/tasks/${taskId}/final-answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: values.content })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '提交最终答案失败');
      }
      
      messageApi.success(hasSubmittedFinalAnswer ? '最终答案更新成功!' : '最终答案提交成功!');
      finalAnswerForm.resetFields();
      
      // 刷新最终答案
      await fetchFinalAnswers(token);
    } catch (error: any) {
      messageApi.error(error.message || '提交最终答案失败');
    }
  };

  // 判断当前用户是否可以查看特定的最终答案
  const canViewFinalAnswer = (finalAnswer: FinalAnswer) => {
    if (!finalAnswer) return false;
    
    // 任务发布者可以查看所有最终答案
    if (isAuthor) return true;
    
    // 答案提交者可以查看自己的最终答案
    const currentUserId = getUserId();
    if (currentUserId === null) return false;
    
    const answerUserId = typeof finalAnswer.userId === 'string' 
      ? parseInt(finalAnswer.userId, 10) 
      : finalAnswer.userId;
      
    const userIdFromUserObject = finalAnswer.user?.id 
      ? (typeof finalAnswer.user.id === 'string' ? parseInt(finalAnswer.user.id, 10) : finalAnswer.user.id)
      : null;
      
    return currentUserId === answerUserId || (userIdFromUserObject !== null && currentUserId === userIdFromUserObject);
  };

  // 更新任务需求状态
  const toggleRequirementStatus = async (requirementId: string, checked: boolean) => {
    if (!isAuthor) {
      messageApi.info('只有任务发布者才能更新需求状态');
      return;
    }
    
    try {
      const token = getToken();
      const response = await fetch(`/api/tasks/${taskId}/requirements/${requirementId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ completed: checked })
      });
      
      if (!response.ok) {
        throw new Error('更新需求状态失败');
      }
      
      // 更新本地状态
      setRequirements(prev => 
        prev.map(req => 
          req.id === requirementId ? { ...req, completed: checked } : req
        )
      );
      
      messageApi.success(checked ? '已标记为完成' : '已标记为未完成');
    } catch (error: any) {
      console.error('更新需求状态失败:', error);
      messageApi.error(error.message || '更新需求状态失败');
    }
  };

  // 获取用户当前已领取的任务数量
  const fetchActiveClaimsCount = async () => {
    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch('/api/tasks/my-claims/count', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setActiveClaimsCount(data.count || 0);
      }
    } catch (error) {
      console.error('获取已领取任务数量失败:', error);
    }
  };

  // 领取任务
  const handleClaimTask = async () => {
    if (!isLoggedIn) {
      messageApi.info('请先登录再领取任务');
      return;
    }

    if (activeClaimsCount >= 5) {
      Modal.warning({
        title: '领取失败',
        content: '您已领取的任务数量已达上限（5个），请先完成已领取的任务。'
      });
      return;
    }

    setClaimLoading(true);
    try {
      const token = getToken();
      const response = await fetch(`/api/tasks/${taskId}/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '领取任务失败');
      }

      const result = await response.json();
      messageApi.success(result.message || '任务领取成功！');
      
      // 刷新数据以更新UI
      await fetchData();
    } catch (error: any) {
      messageApi.error(error.message || '领取任务失败，请稍后再试');
    } finally {
      setClaimLoading(false);
    }
  };

  // 释放任务（任务发布者取消用户的任务领取）
  const handleReleaseTask = async () => {
    console.log('[handleReleaseTask] Initiated'); // 日志1: 函数开始
    console.log('[handleReleaseTask] isAuthor:', isAuthor); // 日志2: 检查是否为作者
    console.log('[handleReleaseTask] claimInfo:', JSON.stringify(claimInfo)); // 日志3: 检查 claimInfo 内容

    if (!isAuthor) {
      messageApi.info('只有任务发布者才能释放任务');
      console.warn('[handleReleaseTask] Blocked: Not author');
      return;
    }

    if (!claimInfo || claimInfo.claimId === undefined) { // 确保 claimInfo 和 claimId 存在
      messageApi.warning('该任务数据异常或未被领取，无法释放');
      console.warn('[handleReleaseTask] Blocked: claimInfo missing or claimId undefined. claimInfo:', JSON.stringify(claimInfo));
      return;
    }

    console.log('[handleReleaseTask] Proceeding to modal.confirm with claimId:', claimInfo.claimId);

    modal.confirm({ // 修改为使用 modal 实例
      title: '确认释放任务',
      content: `确定要取消"${claimInfo.claimedBy}"对此任务的领取吗？`,
      onOk: async () => {
        console.log('[handleReleaseTask Modal.onOk] Confirmed. Claim ID:', claimInfo.claimId); // 日志4: Modal确认
        setReleaseLoading(true);
        try {
          const token = getToken();
          console.log('[handleReleaseTask Modal.onOk] Fetching /api/tasks/${taskId}/release'); // 日志5: 准备API调用
          const response = await fetch(`/api/tasks/${taskId}/release`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              claimId: claimInfo.claimId // 现在这里应该有值了
            })
          });
          
          console.log('[handleReleaseTask Modal.onOk] API Response Status:', response.status); // 日志6: API响应状态

          if (!response.ok) {
            const errorData = await response.json();
            console.error('[handleReleaseTask Modal.onOk] API Error Data:', errorData); // 日志7: API错误数据
            throw new Error(errorData.message || '释放任务失败');
          }

          const result = await response.json();
          console.log('[handleReleaseTask Modal.onOk] API Success Data:', result); // 日志8: API成功数据
          messageApi.success(result.message || '已成功释放该任务');
          
          // 刷新数据以更新UI
          await fetchData();
        } catch (error: any) {
          console.error('[handleReleaseTask Modal.onOk] Catch Block Error:', error); // 日志9: 捕获到的错误
          messageApi.error(error.message || '释放任务失败，请稍后再试');
        } finally {
          setReleaseLoading(false);
        }
      },
      onCancel: () => {
        console.log('[handleReleaseTask Modal.onCancel] Release cancelled by user.'); // 日志10: 用户取消
      }
    });
  };

  // AI辅助解答处理函数
  const handleAIAssistedAnswer = async () => {
    if (!isLoggedIn) {
      messageApi.info('请先登录再使用AI辅助解答');
      return;
    }

    modal.confirm({
      title: '确认使用AI辅助解答',
      content: '此操作将消耗您5积分，确认继续吗？',
      onOk: async () => {
        setAiAssistLoading(true);
        const token = getToken();
        try {
          // 1. 调用扣除积分的API
          const deductResponse = await fetch('/api/user/points/update', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ points: -5 })
          });

          if (!deductResponse.ok) {
            const errorData = await deductResponse.json();
            // 优先处理后端可能返回的特定错误信息
            if (errorData.error === '积分不足') {
              messageApi.error('您的积分不足以完成此操作。');
            } else {
              messageApi.error(errorData.message || errorData.error || '积分扣除失败');
            }
            return; // 扣费失败则不继续执行
          }
          messageApi.success('积分扣除成功！');

          // 2. 获取跳转链接并打开新标签页
          const aiAssistUrl = process.env.NEXT_PUBLIC_AI_ASSIST_URL || 'https://www.baidu.com';
          window.open(aiAssistUrl, '_blank');

        } catch (error: any) {
          messageApi.error(error.message || 'AI辅助解答操作失败');
        } finally {
          setAiAssistLoading(false);
        }
      },
      onCancel: () => {
        // 用户取消操作
        setAiAssistLoading(false); // 如果用户取消，也应该停止loading状态
      }
    });
  };

  useEffect(() => {
    fetchData();
  }, [taskId]);

  const handleCommentSubmit = async (values: any) => {
    const token = getToken();
    if (!token) {
      messageApi.error('请先登录再提交评论');
      return;
    }
    console.log('Submit comment:', values);
    try {
       const response = await fetch(`/api/tasks/${taskId}/answers`, {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${token}`
         },
         body: JSON.stringify({ content: values.content })
       });
       if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || '提交评论失败');
       }
       messageApi.success('评论提交成功!');
       form.resetFields();
       // 刷新评论列表
       fetchData(); // 调用fetchData刷新数据
    } catch (error: any) {
        messageApi.error(error.message || '提交评论失败');
    }
  };

  const handleAdopt = async (answerId: string) => {
     const token = getToken();
    if (!token) {
      messageApi.error('请先登录再采纳评论');
      return;
    }
    
    // 检查任务需求是否全部完成
    if (requirements.length > 0 && !requirements.every(req => req.completed)) {
      messageApi.warning('请先完成所有任务需求再采纳评论');
      return;
    }
    
    console.log('Adopt comment:', answerId);
     try {
       const response = await fetch(`/api/tasks/${taskId}/answers/${answerId}/adopt`, {
         method: 'POST',
         headers: {
           'Authorization': `Bearer ${token}`
         }
       });
       if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || '采纳评论失败');
       }
       messageApi.success('评论已成功采纳，并已向评论者发送通知！');
       // 刷新任务和评论列表
       fetchData(); // 调用fetchData刷新数据
     } catch (error: any) {
        messageApi.error(error.message || '采纳评论失败');
    }
  };

  const handleChat = async (userId: string | number | undefined) => {
    console.log('handleChat函数接收到的userId:', userId, typeof userId);
    
    if (!isLoggedIn) {
      messageApi.info('请先登录后再发起私聊');
      return;
    }

    // 检查userId是否存在
    if (userId === undefined || userId === null) {
      messageApi.error('找不到用户ID，无法发起私聊');
      return;
    }
    
    // 将userId转换为字符串
    const userIdStr = String(userId);

    try {
      // 检查是否与自己私聊
      const token = getToken();
      const response = await fetch('/api/users/me', { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      
      if (!response.ok) {
        throw new Error('获取用户信息失败');
      }
      
      const userData = await response.json();
      console.log('当前用户数据:', userData);
      
      // 安全地进行字符串比较，避免undefined调用toString()
      if (userData && userData.id && userIdStr === String(userData.id)) {
        messageApi.warning('不能与自己私聊');
        return;
      }
      
      // 创建或获取与该用户的会话
      const chatResponse = await fetch('/api/conversations/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          targetUserId: userIdStr,
          taskId: taskId // 添加任务ID
        })
      });

      if (!chatResponse.ok) {
        const errorData = await chatResponse.json();
        throw new Error(errorData.error || '创建会话失败');
      }

      const data = await chatResponse.json();
      // 添加任务ID作为查询参数
      router.push(`/chat/${data.conversationId}?taskId=${taskId}`);
    } catch (error: any) {
      console.error('私聊错误:', error);
      messageApi.error(error.message || '无法开始聊天，请稍后再试');
    }
  };

  if (loading) {
    return (
      <ConfigProvider theme={{ hashed: false }}>
        <App>
          {contextHolder} {modalContextHolder}
          <div style={{ textAlign: 'center', marginTop: '50px' }}><Spin size="large" /></div>
        </App>
      </ConfigProvider>
    );
  }

  if (error) {
    return (
      <ConfigProvider theme={{ hashed: false }}>
        <App>
          {contextHolder} {modalContextHolder}
          <Alert message="错误" description={error} type="error" showIcon />
        </App>
      </ConfigProvider>
    );
  }

  if (!task) {
     return (
      <ConfigProvider theme={{ hashed: false }}>
        <App>
          {contextHolder} {modalContextHolder}
          <Alert message="信息" description="任务不存在或无法加载。" type="info" showIcon />
        </App>
      </ConfigProvider>
     );
  }

  return (
    <ConfigProvider theme={{ hashed: false }}>
      <App>
        {contextHolder} {modalContextHolder}
        <div>
          <Title level={2}>{task.title}</Title>
          <Space wrap style={{ marginBottom: '16px' }}>
            <Tag color="gold">{task.points} 积分</Tag>
            {task.isExclusive && <Tag color="purple" icon={<LockOutlined />}>独占式任务</Tag>}
            {task.tags && task.tags.map((tag: string) => (
              <Tag key={tag} color="blue">{tag}</Tag>
            ))}
            <Text type="secondary">发布者: {task?.user?.username}</Text>
            <Button size="small" onClick={() => handleChat(task?.user?.id)}>与发布者私聊</Button>
          </Space>
          <Paragraph>{task.description}</Paragraph>
          
          {/* 独占式任务信息和领取/释放按钮 */}
          {task.isExclusive && (
            <Card 
              style={{ marginBottom: '20px' }}
              title="独占式任务状态"
              extra={
                claimInfo ? (
                  // 如果任务已被领取
                  isAuthor ? (
                    // 任务发布者可以释放任务
                    <Button 
                      type="primary" 
                      danger 
                      icon={<UnlockOutlined />} 
                      onClick={handleReleaseTask} 
                      loading={releaseLoading}
                    >
                      释放任务
                    </Button>
                  ) : claimInfo.isClaimedByCurrentUser ? (
                    // 当前用户已领取，显示剩余时间
                    <Tag color="green">您已领取此任务</Tag>
                  ) : null
                ) : (
                  // 任务未被领取，显示领取按钮
                  !isAuthor && (
                    <Button 
                      type="primary" 
                      icon={<LockOutlined />} 
                      onClick={handleClaimTask} 
                      loading={claimLoading}
                    >
                      领取任务
                    </Button>
                  )
                )
              }
            >
              {claimInfo ? (
                <>
                  <p>当前状态：<Tag color="green">已被领取</Tag></p>
                  <p>领取者：{claimInfo.claimedBy || '信息暂无'}</p>
                  {claimInfo.claimedAt && (
                    <p>领取时间：{new Date(claimInfo.claimedAt).toLocaleString('zh-CN')}</p>
                  )}
                  {claimInfo.expiresAt && (
                    <p>到期时间：{new Date(claimInfo.expiresAt).toLocaleString('zh-CN')}</p>
                  )}
                </>
              ) : (
                <p>当前状态：<Tag color="blue">可被领取</Tag> 领取后，其他用户将无法看到此任务</p>
              )}
              <Divider />
              <Alert 
                message="独占式任务说明" 
                description={
                  <>
                    <p>1. 同一个任务最多只能由1个用户领取</p>
                    <p>2. 领取后其他用户将无法在大厅查看到该任务</p>
                    <p>3. 任务领取后保留3天，超时将自动变为未领取状态</p>
                    <p>4. 每个用户同时最多可领取5个任务</p>
                  </>
                }
                type="info" 
                showIcon 
              />
            </Card>
          )}

          <div style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
            {/* 任务需求列表 */}
            <div style={{ flex: 1 }}>
              {requirements.length > 0 && (
                <Card 
                  title="任务需求清单" 
                  bordered={true} 
                  loading={loadingRequirements}
                >
                  <List
                    dataSource={requirements}
                    renderItem={(item) => (
                      <List.Item>
                        <Text>{item.content}</Text>
                      </List.Item>
                    )}
                  />
                </Card>
              )}
            </div>
            
            {/* 最终答案区域 - 根据权限显示最终答案列表 */}
            <div style={{ flex: 1 }}>
              <Card 
                title="最终答案列表" 
                bordered={true} 
                loading={loadingFinalAnswers}
              >
                {finalAnswers.length > 0 ? (
                  <List
                    dataSource={finalAnswers}
                    renderItem={(item) => (
                      <List.Item>
                        {canViewFinalAnswer(item) ? (
                          <div style={{ width: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                              <Avatar icon={<UserOutlined />} style={{ marginRight: '8px' }} />
                              <Text strong>{item.user.username}</Text>
                              <Text type="secondary" style={{ marginLeft: '8px' }}>{item.timestamp}</Text>
                            </div>
                            <Paragraph>{item.content}</Paragraph>
                          </div>
                        ) : (
                          <Text type="secondary">
                            由 {item.user.username} 提交的最终答案仅对任务发布者和提交者可见
                          </Text>
                        )}
                      </List.Item>
                    )}
                  />
                ) : (
                  <Text type="secondary">尚未提交最终答案</Text>
                )}
              </Card>
            </div>
          </div>

          {/* 提交最终答案表单 - 仅对非发布者的登录用户显示 */}
          {task.status === 'open' && !isAuthor && isLoggedIn && (
            <>
              <Card 
                title={hasSubmittedFinalAnswer ? "更新你的最终答案" : "提交你的最终答案"} 
                bordered={true}
              >
                <Form form={finalAnswerForm} onFinish={handleFinalAnswerSubmit}>
                  <Form.Item name="content" rules={[{ required: true, message: '请输入最终答案内容!' }]}>
                    <TextArea rows={4} placeholder="提交你的最终解决方案..." />
                  </Form.Item>
                  <Form.Item>
                    <Button htmlType="submit" type="primary">
                      {hasSubmittedFinalAnswer ? "更新最终答案" : "提交最终答案"}
                    </Button>
                    <Button 
                      type="default" 
                      onClick={handleAIAssistedAnswer} 
                      loading={aiAssistLoading}
                      style={{ marginLeft: '8px' }}
                    >
                      AI 辅助解答 (消耗5积分)
                    </Button>
                  </Form.Item>
                  <Alert 
                    message="注意：最终答案仅对任务发布者和您自己可见，提交后将同步到私信对话中" 
                    type="info" 
                    showIcon 
                    style={{ marginTop: '12px' }}
                  />
                </Form>
              </Card>
              <Divider />
            </>
          )}

          <Title level={3}>评论列表 ({comments.length})</Title>
          <List
            className="comment-list"
            itemLayout="horizontal"
            dataSource={comments}
            renderItem={(item) => (
              <li>
                 <Comment
                    actions={isAuthor && !item.isAdopted && task.status === 'open' ? [
                        <Button key="adopt" type="primary" size="small" onClick={() => handleAdopt(item.id)}
                           disabled={requirements.length > 0 && !requirements.every(req => req.completed)}>
                          采纳此评论
                        </Button>,
                        <Button key="chat" size="small" onClick={() => handleChat(item.userId)}>与评论者私聊</Button>
                    ] : [
                        <Button key="chat" size="small" onClick={() => handleChat(item.userId)}>与评论者私聊</Button>
                    ]}
                    author={<a>{item.user.username}</a>}
                    avatar={<Avatar icon={<UserOutlined />} />}
                    content={<Paragraph>{item.content}</Paragraph>}
                    datetime={<Text type="secondary">{item.timestamp}</Text>}
                />
                {item.isAdopted && <Tag color="success">已采纳</Tag>}
              </li>
            )}
          />

          <Divider />

          {task.status === 'open' && !isAuthor && (
             <>
               <Title level={3}>提交评论</Title>
               <Form form={form} onFinish={handleCommentSubmit}>
                 <Form.Item name="content" rules={[{ required: true, message: '请输入评论内容!' }]}>
                   <TextArea rows={4} placeholder="写下你的想法或问题..." />
                 </Form.Item>
                 <Form.Item>
                   <Button htmlType="submit" type="primary">
                     提交评论
                   </Button>
                 </Form.Item>
               </Form>
             </>
           )}
           {task.status === 'closed' && <Text type="warning">此任务已关闭，无法提交新评论。</Text>}
           {isAuthor && <Text type="secondary">你是任务发布者，无法提交评论。</Text>}

        </div>
      </App>
    </ConfigProvider>
  );
};

interface CommentProps {
    actions?: React.ReactNode[];
    author?: React.ReactNode;
    avatar?: React.ReactNode;
    content?: React.ReactNode;
    datetime?: React.ReactNode;
}

const Comment: React.FC<CommentProps> = ({ actions, author, avatar, content, datetime }) => (
    <div style={{ display: 'flex', marginBottom: '16px' }}>
        <div style={{ marginRight: '12px' }}>{avatar}</div>
        <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold' }}>{author}</span>
                <span style={{ color: '#ccc' }}>{datetime}</span>
            </div>
            <div style={{ marginTop: '8px' }}>{content}</div>
            <div style={{ marginTop: '8px' }}>{actions}</div>
        </div>
    </div>
);

export default TaskDetailPage; 