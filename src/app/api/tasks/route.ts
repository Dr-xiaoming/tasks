import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { getAuthUser } from '@/lib/auth';
import { TaskClaimStatus } from '@prisma/client';

// 获取当前用户ID的函数
async function getCurrentUserId(req: NextRequest): Promise<number | null> {
  try {
    const authResult = await getAuthUser(req);
    if (!authResult.user) {
      return null;
    }
    return authResult.user.userId;
  } catch (error) {
    console.error('获取用户ID错误:', error);
    return null;
  }
}

// 定义输入数据的 schema 用于验证
const TaskSchema = z.object({
  title: z.string().min(1, '任务标题不能为空'),
  description: z.string().min(1, '任务描述不能为空'),
  points: z.number().int().positive('悬赏积分必须为正整数'),
  tags: z.string().optional(), // 标签是可选的字符串
  requirements: z.array(z.string()).optional(), // 任务需求列表是可选的字符串数组
  isExclusive: z.boolean().optional().default(false), // 是否为独占式任务
});

// 模拟数据库或其他数据存储
interface Task {
  id: number;
  title: string;
  description: string;
  points: number;
  tags: string[];
  createdAt: Date;
  status: 'open' | 'in_progress' | 'completed';
}

export async function POST(request: NextRequest) {
  try {
    // 0. 获取当前用户 ID
    const userId = await getCurrentUserId(request);
    if (!userId) {
      return NextResponse.json({ message: '用户未认证' }, { status: 401 });
    }

    const body = await request.json();

    // 1. 使用 Zod 验证数据
    const validationResult = TaskSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { message: '数据验证失败', errors: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { title, description, points, tags, requirements, isExclusive } = validationResult.data;

    // 2. 处理标签 - 将逗号分隔的字符串转为数组
    const tagList = tags
      ? tags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag)
      : [];

    // 3. 使用 Prisma 创建任务和任务需求
    const newTask = await prisma.$transaction(async (prisma) => {
      // 3.1 创建任务
      const task = await prisma.task.create({
        data: {
          title,
          description,
          points,
          userId,      // 关联用户
          status: 'open', // 默认状态
          isExclusive: isExclusive, // 是否为独占式任务
          // createdAt 会由 Prisma 自动处理
          // 使用嵌套写入处理 TaskTag 关系
          taskTags: {
            create: tagList.map(tagName => ({
              tag: { // 假设关联的 Tag 模型有 name 字段
                connectOrCreate: {
                  where: { name: tagName },
                  create: { name: tagName },
                },
              },
            })),
          },
        },
      });

      // 3.2 如果有任务需求，创建任务需求记录
      if (requirements && requirements.length > 0) {
        await Promise.all(
          requirements.map(content => 
            prisma.$queryRaw`INSERT INTO task_requirements (task_id, content, completed, created_at, updated_at) 
                            VALUES (${task.id}, ${content}, FALSE, NOW(), NOW())`
          )
        );
      }

      return task;
    });

    // 4. 返回成功响应
    return NextResponse.json({ message: '任务发布成功', task: newTask }, { status: 201 });

  } catch (error: unknown) { // 使用 unknown 类型捕获错误
    console.error('Error creating task:', error);

    if (error instanceof SyntaxError) {
      return NextResponse.json({ message: '无效的请求数据' }, { status: 400 });
    }
    
    // 可以添加 Prisma 特定的错误处理，例如唯一约束冲突
    // if (error instanceof Prisma.PrismaClientKnownRequestError) { ... }

    // 可以添加更具体的错误处理
    return NextResponse.json({ message: '创建任务时发生服务器错误' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    // 获取当前用户 ID（可能为 null）
    const currentUserId = await getCurrentUserId(req);

    // 获取查询参数，用于分页、过滤等 (示例)
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const skip = (page - 1) * limit;

    // TODO: 添加更多过滤、排序逻辑，例如按标签过滤

    // 查找任务
    const tasks = await prisma.task.findMany({
      where: {
        status: 'open',
        OR: [
          // 使用prisma.$queryRaw或原生SQL条件
          {
            // 非独占式任务 (is_exclusive = 0)
            isExclusive: false
          },
          {
            // 独占式但没有活跃claim
            isExclusive: true,
            NOT: {
              taskClaims: {
                some: {
                  status: TaskClaimStatus.active
                }
              }
            }
          },
          // 当前用户已领取
          ...(currentUserId ? [{
            isExclusive: true,
            taskClaims: {
              some: {
                userId: currentUserId,
                status: TaskClaimStatus.active
              }
            }
          }] : [])
        ]
      },
      orderBy: {
        createdAt: 'desc', // 按创建时间降序排序
      },
      skip: skip, // 分页：跳过的记录数
      take: limit, // 分页：每页的记录数
      include: {
        user: { // 包含提问者的部分信息
          select: {
            id: true,
            username: true, // 假设 User model 有 username 字段
            // avatarUrl: true, // 可以包含头像等更多信息
          },
        },
        _count: { // 计算回答数量
          select: { answers: true }, // 假设 Task model 有 answers 关联
        },
        taskTags: { // 包含任务标签关系
          include: {
            tag: true, // 包含标签信息
          }
        },
        taskClaims: {
          where: {
            status: TaskClaimStatus.active
          },
          include: {
            user: {
              select: {
                id: true,
                username: true
              }
            }
          },
          take: 1
        }
      },
    });

    // 获取总任务数，用于分页（需要使用相同的过滤条件）
    const totalTasks = await prisma.task.count({
      where: {
        status: 'open',
        OR: [
          { isExclusive: false },
          {
            isExclusive: true,
            NOT: {
              taskClaims: {
                some: {
                  status: TaskClaimStatus.active
                }
              }
            }
          },
          ...(currentUserId ? [{
            isExclusive: true,
            taskClaims: {
              some: {
                userId: currentUserId,
                status: TaskClaimStatus.active
              }
            }
          }] : [])
        ]
      },
    });

    // 处理返回的任务数据，添加标签数组和领取信息
    const tasksWithFormattedTags = tasks.map(task => {
      const tags = task.taskTags.map(taskTag => taskTag.tag.name);
      const activeClaim = task.taskClaims.length > 0 ? task.taskClaims[0] : null;
      const isClaimedByCurrentUser = activeClaim ? activeClaim.userId === currentUserId : false;
      const { taskTags, taskClaims, ...restTask } = task;
      
      return {
        ...restTask,
        tags,
        isExclusive: task.isExclusive,
        claimInfo: activeClaim ? {
          claimId: activeClaim.id,
          claimedBy: activeClaim.user.username,
          claimedById: activeClaim.userId,
          claimedAt: activeClaim.createdAt,
          expiresAt: activeClaim.expiresAt,
          isClaimedByCurrentUser
        } : null
      };
    });

    return NextResponse.json({
       tasks: tasksWithFormattedTags,
       totalPages: Math.ceil(totalTasks / limit),
       currentPage: page
    });

  } catch (error) {
    console.error('获取任务列表错误:', error);
    return NextResponse.json(
      { error: '获取任务列表过程中发生错误' },
      { status: 500 }
    );
  }
} 