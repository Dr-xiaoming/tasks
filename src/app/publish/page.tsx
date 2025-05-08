'use client';

import React, { useState } from 'react';
import { Form, Input, InputNumber, Button, message, Space, Row, Col, Divider, List, Checkbox } from 'antd';
import { useAuth } from '@/contexts/AuthContext';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

const { TextArea } = Input;

const PublishTaskPage: React.FC = () => {
  const { getToken } = useAuth();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [tagLoading, setTagLoading] = useState(false);
  const [requirements, setRequirements] = useState<string[]>(['']);
  const [isExclusiveTask, setIsExclusiveTask] = useState(false);

  const onFinish = async (values: any) => {
    console.log('Received values of form: ', values);
    setLoading(true);
    const token = getToken();

    if (!token) {
      message.error('请先登录再发布任务');
      setLoading(false);
      return;
    }

    // 过滤掉空的需求项
    const filteredRequirements = requirements.filter(req => req.trim() !== '');
    if (filteredRequirements.length === 0) {
      message.error('请至少添加一条任务需求');
      setLoading(false);
      return;
    }

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      // 将需求列表添加到提交数据中
      const submitData = {
        ...values,
        points: isExclusiveTask ? values.points : values.points + 5,
        requirements: filteredRequirements,
        isExclusive: isExclusiveTask
      };

      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '任务发布失败');
      }

      const result = await response.json();
      console.log('API response:', result);
      message.success('任务发布成功!');
      form.resetFields();
      setRequirements(['']);
      setIsExclusiveTask(false);
    } catch (error: any) {
      console.error('Failed to publish task:', error);
      message.error(error.message || '任务发布时发生错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const generateTags = async () => {
    try {
      const title = form.getFieldValue('title');
      const description = form.getFieldValue('description');
      
      if (!title || !description) {
        return message.warning('请先填写任务标题和描述');
      }

      setTagLoading(true);
      
      const apiKey = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;
      if (!apiKey) {
        message.error('未找到 API Key，请检查环境变量配置');
        setTagLoading(false);
        return;
      }
      const messages = [
        {
          role: "user", 
          content: `请为以下任务生成3-5个合适的标签，每个标签不超过4个字，以逗号分隔。任务标题: ${title}, 任务描述: ${description}`
        }
      ];

      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: messages
        })
      });

      if (!response.ok) {
        throw new Error('标签生成失败');
      }

      const data = await response.json();
      const generatedTags = data.choices[0].message.content.trim();
      
      // 更新表单中的标签字段
      form.setFieldsValue({ tags: generatedTags });
      message.success('标签生成成功');
    } catch (error: any) {
      console.error('生成标签时出错:', error);
      message.error('生成标签失败: ' + (error.message || '未知错误'));
    } finally {
      setTagLoading(false);
    }
  };

  const handleRequirementChange = (index: number, value: string) => {
    const newRequirements = [...requirements];
    newRequirements[index] = value;
    setRequirements(newRequirements);
  };

  const addRequirement = () => {
    if (requirements.length >= 10) {
      message.warning('最多只能添加10条任务需求');
      return;
    }
    setRequirements([...requirements, '']);
  };

  const removeRequirement = (index: number) => {
    if (requirements.length <= 1) {
      message.warning('至少需要保留一条任务需求');
      return;
    }
    const newRequirements = requirements.filter((_, i) => i !== index);
    setRequirements(newRequirements);
  };

  return (
    <div>
      <h1>发布新任务</h1>
      <Form
        form={form}
        layout="vertical"
        name="publish_task_form"
        onFinish={onFinish}
        style={{ maxWidth: 600 }}
      >
        <Form.Item
          name="title"
          label="任务标题"
          rules={[{ required: true, message: '请输入任务标题!' }]}
        >
          <Input placeholder="例如：需要一个网站 Logo 设计" />
        </Form.Item>

        <Form.Item
          name="description"
          label="任务描述"
          rules={[{ required: true, message: '请输入详细的任务描述!' }]}
        >
          <TextArea rows={4} placeholder="详细说明任务需求、背景、交付物等" />
        </Form.Item>

        <Form.Item
          name="points"
          label="悬赏积分"
          rules={[
            { required: true, message: '请输入悬赏积分!' },
            { type: 'number', min: 1, message: '积分必须大于 0' }
          ]}
        >
          <InputNumber min={1} style={{ width: '100%' }} placeholder="输入悬赏的积分数量" />
        </Form.Item>

        <Divider orientation="left">任务需求清单</Divider>
        <div className="requirements-list">
          {requirements.map((req, index) => (
            <Row key={index} gutter={8} style={{ marginBottom: '8px' }}>
              <Col flex="auto">
                <Input
                  placeholder={`需求项 ${index + 1}`}
                  value={req}
                  onChange={(e) => handleRequirementChange(index, e.target.value)}
                  maxLength={100}
                />
              </Col>
              <Col>
                <Button 
                  icon={<DeleteOutlined />} 
                  onClick={() => removeRequirement(index)}
                  type="text"
                  danger
                />
              </Col>
            </Row>
          ))}
          <Button 
            type="dashed" 
            onClick={addRequirement} 
            block 
            icon={<PlusOutlined />}
            disabled={requirements.length >= 10}
            style={{ marginBottom: '20px' }}
          >
            添加需求项（最多10条）
          </Button>
        </div>

        <Form.Item
          name="tags"
          label="标签（可选，用逗号分隔）"
        >
          <Input placeholder="例如：设计, Logo, 前端, React" />
        </Form.Item>
        
        <Form.Item>
          <Row gutter={8}>
            <Col span={24} style={{ textAlign: 'right' }}>
              <Button onClick={generateTags} loading={tagLoading}>
                AI生成标签
              </Button>
            </Col>
          </Row>
        </Form.Item>

        <Form.Item name="isExclusive" valuePropName="checked">
          <Checkbox onChange={(e) => setIsExclusiveTask(e.target.checked)}>
            开启独占式任务领取
          </Checkbox>
        </Form.Item>

        {!isExclusiveTask && (
          <p style={{ color: 'orange', marginTop: '-10px', marginBottom: '20px' }}>
            提示：当前为非独占任务，发布将额外消耗 5 积分，用于任务推广。
          </p>
        )}
        
        {isExclusiveTask && (
          <div className="exclusive-task-info" style={{ backgroundColor: '#f5f5f5', padding: '12px', borderRadius: '4px', marginBottom: '20px' }}>
            <p style={{ margin: 0 }}>开启后将具有以下特性：</p>
            <ul style={{ marginBottom: 0, paddingLeft: '20px' }}>
              <li>同一个任务最多只能由1个用户领取</li>
              <li>领取后其他用户将无法在大厅查看到该任务</li>
              <li>您可以选择关闭领取者对此任务的领取状态</li>
              <li>每个用户同时最多可领取5个任务</li>
              <li>任务领取后保留3天，超时将自动变为未领取状态</li>
            </ul>
          </div>
        )}

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            发布任务
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default PublishTaskPage; 