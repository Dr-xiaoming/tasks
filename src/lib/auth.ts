import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

// 使用与登录相同的密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your_default_secret_key';

interface AuthUser {
  userId: number;
  username: string;
  id: number; // 为了保持向后兼容
}

interface AuthResult {
  user: AuthUser | null;
  tokenExpired?: boolean;
}

/**
 * 从请求头中提取并验证JWT令牌
 * @param req Next.js请求对象
 * @returns 认证结果，包含用户信息和令牌状态
 */
export async function getAuthUser(req: NextRequest): Promise<AuthResult> {
  try {
    // 从Authorization头中获取令牌
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { user: null };
    }

    // 提取令牌
    const token = authHeader.substring(7);
    
    // 验证令牌
    const decoded = jwt.verify(token, JWT_SECRET, {
      // 添加时间容差，允许±2小时的误差
      clockTolerance: 7200 // 秒，相当于2小时
    }) as any;
    
    if (!decoded || !decoded.userId) {
      return { user: null };
    }

    // 返回用户信息
    return {
      user: {
        userId: decoded.userId,
        username: decoded.username,
        id: decoded.userId // 为了与现有代码兼容
      }
    };
  } catch (error) {
    // 特殊处理令牌过期情况
    if (error instanceof jwt.TokenExpiredError) {
      console.error('令牌已过期:', error);
      return { user: null, tokenExpired: true };
    }
    
    console.error('验证令牌错误:', error);
    return { user: null };
  }
} 