'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Button,
  Input,
  Space,
  Typography,
  Form,
  Flex,
  Alert,
  message,
  Card,
  Divider
} from 'antd';
import { EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import styled, { keyframes } from 'styled-components';

const { Title, Text } = Typography;
const { Password } = Input;

// 定义动画
const floatAnimation = keyframes`
  0% { transform: translate(0, 0) rotate(-5deg); }
  100% { transform: translate(30px, 30px) rotate(5deg); }
`;

const floatAnimation2 = keyframes`
  0% { transform: translate(0, 0) rotate(5deg); }
  100% { transform: translate(-30px, -30px) rotate(-5deg); }
`;

// 样式化组件
const BackgroundGradient = styled.div`
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.5;
  z-index: 0;
`;

const TopLeftGradient = styled(BackgroundGradient)`
  top: -10%;
  left: -10%;
  width: 40%;
  height: 40%;
  background: linear-gradient(to bottom right, #4299e1, #9f7aea);
  animation: ${floatAnimation} 20s ease-in-out infinite alternate;
`;

const BottomRightGradient = styled(BackgroundGradient)`
  bottom: -15%;
  right: -15%;
  width: 50%;
  height: 50%;
  background: linear-gradient(to top left, #9f7aea, #ed64a6);
  animation: ${floatAnimation2} 25s ease-in-out infinite alternate;
`;

const TopRightGradient = styled(BackgroundGradient)`
  top: 20%;
  right: 10%;
  width: 20%;
  height: 20%;
  background: linear-gradient(to top right, #ed64a6, #9f7aea);
  opacity: 0.3;
  filter: blur(60px);
  animation: ${floatAnimation} 15s ease-in-out infinite alternate-reverse;
`;

const CardShadow = styled.div`
  position: absolute;
  bottom: -30px;
  left: 50%;
  transform: translateX(-50%);
  width: 80%;
  height: 15px;
  border-radius: 9999px;
  background: rgba(0, 0, 0, 0.2);
  filter: blur(10px);
  z-index: -1;
`;

const StyledCard = styled(Card)`
  border-radius: 16px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(16px);
  transition: all 0.4s ease;
  max-width: 450px;
  width: 100%;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 15px 30px rgba(0, 0, 0, 0.15);
  }
`;

const GradientButton = styled(Button)`
  background: linear-gradient(to right, #4299e1, #9f7aea);
  border: none;
  height: 50px;
  font-weight: bold;
  transition: all 0.3s ease;

  &:hover {
    background: linear-gradient(to right, #3182ce, #805ad5);
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
  }

  &:active {
    transform: translateY(0);
  }
`;

const StyledFormItem = styled(Form.Item)`
  margin-bottom: 24px;
`;

export default function RegisterPage() {
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const router = useRouter();

  const handleSubmit = async (values: any) => {
    setError(null);
    setIsLoading(true);

    const { email, password, confirmPassword } = values;

    if (password !== confirmPassword) {
      setError('密码和确认密码不匹配');
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('密码至少需要6位');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: email, // 使用邮箱作为用户名
          password,
          // name 字段在新数据库模型中已移除，不再传递
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '注册失败');
      }
      
      messageApi.success({
        content: '注册成功，请前往登录页面。',
        duration: 5,
      });
      
      // 清空表单
      form.resetFields();
      
      // 2秒后跳转到登录页面
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '发生未知错误';
      setError(errorMessage);
      console.error('注册出错:', err);
      messageApi.error({
        content: `注册失败: ${errorMessage}`,
        duration: 5,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      style={{ 
        minHeight: '100vh', 
        background: '#f5f5f5',
        backgroundImage: "url(/images/bg-pattern.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        position: "relative",
        overflow: "hidden"
      }}
    >
      {contextHolder}
      
      {/* 背景渐变效果 */}
      <TopLeftGradient />
      <BottomRightGradient />
      <TopRightGradient />

      <Flex
        justify="center"
        align="center"
        style={{ 
          minHeight: '100vh', 
          padding: '16px',
          position: 'relative',
          zIndex: 1
        }}
      >
        <div style={{ position: 'relative', width: '100%', maxWidth: '450px' }}>
          <StyledCard>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <Space direction="vertical" size="small" style={{ textAlign: 'center', width: '100%' }}>
                <Title level={2} style={{ 
                  background: 'linear-gradient(to right, #4299e1, #9f7aea, #ed64a6)', 
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontWeight: 800
                }}>
                  创建您的账户
                </Title>
                <Text type="secondary" style={{ fontSize: '16px', fontWeight: 500 }}>
                  加入我们，开启全新旅程
                </Text>
              </Space>

              <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                requiredMark={false}
                style={{ width: '100%' }}
                validateTrigger={['onBlur', 'onChange']}
              >
                <StyledFormItem
                  name="email"
                  label="电子邮箱"
                  rules={[
                    { required: true, message: '请输入您的电子邮箱' },
                    { type: 'email', message: '请输入有效的电子邮箱' }
                  ]}
                >
                  <Input 
                    size="large" 
                    placeholder="your@email.com" 
                    disabled={isLoading}
                    style={{ height: '50px', borderRadius: '8px' }}
                  />
                </StyledFormItem>

                <StyledFormItem
                  name="password"
                  label="密码"
                  rules={[
                    { required: true, message: '请输入密码' },
                    { min: 6, message: '密码至少需要6位' }
                  ]}
                >
                  <Password 
                    size="large" 
                    placeholder="请输入密码（至少6位）" 
                    disabled={isLoading}
                    iconRender={visible => (visible ? <EyeOutlined /> : <EyeInvisibleOutlined />)}
                    style={{ height: '50px', borderRadius: '8px' }}
                  />
                </StyledFormItem>

                <StyledFormItem
                  name="confirmPassword"
                  label="确认密码"
                  dependencies={['password']}
                  rules={[
                    { required: true, message: '请确认密码' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('password') === value) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error('两次输入的密码不匹配'));
                      },
                    }),
                  ]}
                >
                  <Password 
                    size="large" 
                    placeholder="请再次输入密码" 
                    disabled={isLoading}
                    iconRender={visible => (visible ? <EyeOutlined /> : <EyeInvisibleOutlined />)}
                    style={{ height: '50px', borderRadius: '8px' }}
                  />
                </StyledFormItem>

                {error && (
                  <Alert
                    message={error}
                    type="error"
                    showIcon
                    style={{ marginBottom: '24px' }}
                  />
                )}

                <Form.Item>
                  <GradientButton
                    type="primary"
                    htmlType="submit"
                    loading={isLoading}
                    block
                    size="large"
                  >
                    {isLoading ? '正在注册...' : '创建账户'}
                  </GradientButton>
                </Form.Item>
              </Form>

              <Divider plain style={{ margin: '8px 0' }} />

              <Flex justify="center" gap="small">
                <Text type="secondary">已有账户?</Text>
                <Link href="/login" passHref>
                  <Text style={{ color: '#805ad5', fontWeight: 600, cursor: 'pointer' }}>
                    立即登录
                  </Text>
                </Link>
              </Flex>
            </Space>
          </StyledCard>
          <CardShadow />
        </div>
      </Flex>
    </div>
  );
} 