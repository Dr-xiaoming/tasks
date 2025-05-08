import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // 验证用户登录状态
    const authResult = await getAuthUser(request);
    
    if (!authResult.user) {
      if (authResult.tokenExpired) {
        return NextResponse.json(
          { success: false, error: '登录已过期，请重新登录', tokenExpired: true },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const userId = authResult.user.userId;

    // 解析请求体
    const body = await request.json();
    const { amount, paymentMethod } = body;

    // 验证充值金额
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: '充值金额必须大于0' },
        { status: 400 }
      );
    }

    // 验证支付方式
    if (!paymentMethod || !['wechat', 'alipay'].includes(paymentMethod)) {
      return NextResponse.json(
        { success: false, error: '无效的支付方式' },
        { status: 400 }
      );
    }

    // 这里应该有真实的支付处理逻辑
    // 目前使用模拟支付，直接添加积分

    // 使用原始SQL执行充值操作
    await prisma.$transaction(async (tx) => {
      // 1. 更新用户积分
      const updateUser = await tx.user.update({
        where: {
          id: userId
        },
        data: {
          points: {
            increment: amount
          }
        }
      });
      
      // 2. 直接执行SQL插入交易记录
      await tx.$executeRaw`
        INSERT INTO transactions (user_id, type, amount, status, payment_method, created_at, updated_at)
        VALUES (${userId}, 'RECHARGE', ${amount}, 'COMPLETED', ${paymentMethod}, NOW(), NOW())
      `;
      
      return updateUser;
    });
    
    // 获取更新后的用户信息
    const updatedUser = await prisma.user.findUnique({
      where: {
        id: userId
      },
      select: {
        points: true
      }
    });

    return NextResponse.json({
      success: true,
      message: '充值成功',
      user: {
        points: updatedUser?.points || 0
      }
    });
  } catch (error) {
    console.error('充值失败:', error);
    return NextResponse.json(
      { success: false, error: '充值处理失败，请重试' },
      { status: 500 }
    );
  }
} 