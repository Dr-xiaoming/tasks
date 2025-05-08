import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    // 从请求中获取必要参数
    const userId = req.nextUrl.searchParams.get('id');
    const type = req.nextUrl.searchParams.get('type'); // 'tasks' 或 'answers'
    const page = parseInt(req.nextUrl.searchParams.get('page') || '1');
    const pageSize = parseInt(req.nextUrl.searchParams.get('pageSize') || '10');
    
    if (!userId) {
      return NextResponse.json(
        { error: '缺少用户ID参数' },
        { status: 400 }
      );
    }

    if (!type || (type !== 'tasks' && type !== 'answers')) {
      return NextResponse.json(
        { error: 'type参数必须为tasks或answers' },
        { status: 400 }
      );
    }

    const skip = (page - 1) * pageSize;
    
    if (type === 'tasks') {
      // 获取用户的所有任务
      const tasks = await prisma.task.findMany({
        where: {
          userId: parseInt(userId),
        },
        select: {
          id: true,
          title: true,
          description: true,
          points: true,
          status: true,
          createdAt: true,
          _count: {
            select: {
              answers: true,
            }
          }
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: pageSize,
      });

      // 获取任务总数用于分页
      const total = await prisma.task.count({
        where: {
          userId: parseInt(userId),
        },
      });

      return NextResponse.json({
        success: true,
        tasks,
        pagination: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        }
      });
    } else {
      // 获取用户的所有回答
      const answers = await prisma.answer.findMany({
        where: {
          userId: parseInt(userId),
        },
        select: {
          id: true,
          content: true,
          isAdopted: true,
          createdAt: true,
          task: {
            select: {
              id: true,
              title: true,
              status: true,
            }
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: pageSize,
      });

      // 获取回答总数用于分页
      const total = await prisma.answer.count({
        where: {
          userId: parseInt(userId),
        },
      });

      return NextResponse.json({
        success: true,
        answers,
        pagination: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        }
      });
    }
  } catch (error) {
    console.error('获取用户活动错误:', error);
    return NextResponse.json(
      { error: '获取用户活动过程中发生错误' },
      { status: 500 }
    );
  }
} 