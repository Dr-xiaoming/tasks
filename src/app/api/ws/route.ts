import { NextResponse } from 'next/server';

// 存储WebSocket连接的映射
const connectedClients = new Map<number, Set<WebSocket>>();

/**
 * 处理WebSocket连接
 */
export async function GET(request: Request) {
  // 获取用户ID查询参数
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  
  if (!userId || isNaN(Number(userId))) {
    return new NextResponse('无效的用户ID', { status: 400 });
  }

  const userIdNum = Number(userId);

  // 检查WebSocket支持
  if (!process.env.NEXT_RUNTIME) {
    const { WebSocketPair } = globalThis as any;
    const { 0: client, 1: server } = new WebSocketPair();

    // 建立连接时的处理
    server.accept();
    
    // 将用户的WebSocket连接存储起来
    if (!connectedClients.has(userIdNum)) {
      connectedClients.set(userIdNum, new Set<WebSocket>());
    }
    connectedClients.get(userIdNum)?.add(server);

    // 监听客户端断开连接
    server.addEventListener('close', () => {
      const userConnections = connectedClients.get(userIdNum);
      if (userConnections) {
        userConnections.delete(server);
        if (userConnections.size === 0) {
          connectedClients.delete(userIdNum);
        }
      }
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  return new NextResponse('WebSocket不支持', { status: 500 });
}

/**
 * 发送消息给特定用户
 * @param userId 接收消息的用户ID
 * @param message 要发送的消息对象
 * @returns 是否成功发送
 */
export function sendMessageToUser(userId: number, message: any): boolean {
  const userConnections = connectedClients.get(userId);
  
  if (!userConnections || userConnections.size === 0) {
    console.log(`用户 ${userId} 没有活跃的WebSocket连接`);
    return false;
  }

  let success = false;
  const messageStr = JSON.stringify(message);

  // 尝试向用户的所有连接发送消息
  for (const socket of userConnections) {
    try {
      socket.send(messageStr);
      success = true;
    } catch (error) {
      console.error(`向用户 ${userId} 发送消息失败:`, error);
      // 移除失效的连接
      userConnections.delete(socket);
    }
  }

  // 如果用户没有有效连接，从映射中移除
  if (userConnections.size === 0) {
    connectedClients.delete(userId);
  }

  return success;
} 