import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    // 从认证头中获取用户ID
    const authResult = await getAuthUser(req);
    
    if (!authResult.user) {
      if (authResult.tokenExpired) {
        return NextResponse.json(
          { error: '登录已过期，请重新登录', tokenExpired: true },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      );
    }

    const userId = authResult.user.id.toString();

    // 查询用户基本信息
    const user = await prisma.user.findUnique({
      where: {
        id: parseInt(userId),
      },
      select: {
        id: true,
        username: true,
        points: true,
        createdAt: true,
        _count: {
          select: {
            tasks: true,       // 任务数量
            answers: true,     // 回答数量
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    // 获取用户发布的任务
    const tasks = await prisma.task.findMany({
      where: {
        userId: parseInt(userId),
      },
      select: {
        id: true,
        title: true,
        points: true,
        status: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5, // 只返回最近5条
    });

    // 获取用户的回答
    const answers = await prisma.answer.findMany({
      where: {
        userId: parseInt(userId),
      },
      select: {
        id: true,
        isAdopted: true,
        createdAt: true,
        task: {
          select: {
            id: true,
            title: true,
          }
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5, // 只返回最近5条
    });

    // 获取用户的技能
    const skills = await prisma.userSkill.findMany({
      where: {
        userId: parseInt(userId),
      },
      select: {
        id: true,
        name: true,
        level: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 返回用户信息和相关数据
    return NextResponse.json({
      success: true,
      user: {
        ...user,
        tasks,
        answers,
        skills,
      }
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    return NextResponse.json(
      { error: '获取用户信息过程中发生错误' },
      { status: 500 }
    );
  }
} 