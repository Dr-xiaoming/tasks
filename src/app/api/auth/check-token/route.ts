import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

// 支持GET方法检查令牌状态
export async function GET(req: NextRequest) {
  try {
    // 验证用户身份
    const authResult = await getAuthUser(req);
    
    // 如果令牌已过期
    if (authResult.tokenExpired) {
      return NextResponse.json({ 
        success: false, 
        tokenExpired: true,
        message: '令牌已过期，请重新登录'
      }, { status: 401 });
    }
    
    // 如果用户未认证（其他原因）
    if (!authResult.user) {
      return NextResponse.json({ 
        success: false, 
        message: '未授权访问'
      }, { status: 401 });
    }
    
    // 令牌有效
    return NextResponse.json({ 
      success: true, 
      message: '令牌有效'
    });
  } catch (error) {
    console.error('检查令牌时出错:', error);
    return NextResponse.json({ 
      success: false, 
      message: '服务器内部错误'
    }, { status: 500 });
  }
} 