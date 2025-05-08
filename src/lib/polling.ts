// 聊天消息轮询服务

// 保存轮询定时器的引用
let pollingInterval: NodeJS.Timeout | null = null;
let pollingDelay = 3000; // 默认3秒轮询一次

// 消息回调函数
type MessageCallback = (messages: any[]) => void;
let messageCallback: MessageCallback | null = null;

// 令牌过期回调函数
type TokenExpiredCallback = () => void;
let tokenExpiredCallback: TokenExpiredCallback | null = null;

// 最新消息的时间戳，用于只获取新消息
let lastMessageTimestamp: string | null = null;

/**
 * 启动消息轮询
 * @param token 用户认证令牌
 * @param conversationId 会话ID
 * @param callback 收到新消息的回调函数
 * @param onTokenExpired 令牌过期的回调函数
 * @param delay 轮询间隔(毫秒)
 * @param taskId 可选的任务ID
 */
export function startPolling(
  token: string,
  conversationId: string | null | undefined,
  callback: MessageCallback,
  onTokenExpired: TokenExpiredCallback,
  delay = 3000,
  taskId: string | null = null
) {
  // 确保conversationId存在
  if (!conversationId) {
    console.error('启动轮询失败：缺少会话ID');
    return;
  }

  // 如果已经有轮询，先停止
  stopPolling();
  
  // 保存回调函数和轮询延迟
  messageCallback = callback;
  tokenExpiredCallback = onTokenExpired;
  pollingDelay = delay;
  
  // 定义轮询函数
  const poll = async () => {
    try {
      // 构建URL，包含上次消息时间戳参数和任务ID
      let url = `/api/conversations/${conversationId}/messages/poll`;
      const params = new URLSearchParams();
      
      if (lastMessageTimestamp) {
        params.append('since', lastMessageTimestamp);
      }
      
      if (taskId) {
        params.append('taskId', taskId);
      }
      
      // 如果有参数，添加到URL
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      // 发送请求
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // 处理响应
      if (!response.ok) {
        const data = await response.json();
        if (response.status === 401 && data.tokenExpired) {
          console.log('令牌已过期，停止轮询');
          if (tokenExpiredCallback) {
            tokenExpiredCallback();
          }
          stopPolling();
          return;
        }
        throw new Error(data.error || '获取消息失败');
      }
      
      // 解析新消息
      const data = await response.json();
      
      // 如果有新消息
      if (data.messages && data.messages.length > 0) {
        // 更新最新消息时间戳
        const latestMessage = data.messages[data.messages.length - 1];
        lastMessageTimestamp = latestMessage.timestamp;
        
        // 调用回调函数处理新消息
        if (messageCallback) {
          messageCallback(data.messages);
        }
      }
    } catch (error) {
      console.error('轮询消息时出错:', error);
    } finally {
      // 设置下一次轮询
      pollingInterval = setTimeout(poll, pollingDelay);
    }
  };
  
  // 立即执行一次轮询，之后定时执行
  poll();
}

/**
 * 停止消息轮询
 */
export function stopPolling() {
  if (pollingInterval) {
    clearTimeout(pollingInterval);
    pollingInterval = null;
  }
  lastMessageTimestamp = null;
}

/**
 * 发送消息
 * @param token 用户认证令牌
 * @param conversationId 会话ID
 * @param content 消息内容
 * @param type 消息类型
 */
export async function sendMessage(
  token: string, 
  conversationId: string | null | undefined, 
  content: string,
  type = 'text'
) {
  // 确保conversationId存在
  if (!conversationId) {
    console.error('发送消息失败：缺少会话ID');
    return null;
  }

  try {
    const response = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ content, type })
    });
    
    if (!response.ok) {
      const data = await response.json();
      if (response.status === 401 && data.tokenExpired) {
        if (tokenExpiredCallback) {
          tokenExpiredCallback();
        }
        return null;
      }
      throw new Error(data.error || '发送消息失败');
    }
    
    return await response.json();
  } catch (error) {
    console.error('发送消息失败:', error);
    return null;
  }
}

/**
 * 重置轮询状态
 */
export function resetPollingState() {
  lastMessageTimestamp = null;
} 