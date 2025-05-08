import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';

// !! 确保 JWT_SECRET 与登录时使用的密钥一致，并从环境变量读取 !!
const JWT_SECRET = process.env.JWT_SECRET || 'your_default_secret_key';

// 定义 JWT Payload 接口 (根据你的实际 payload 调整)
interface JwtPayload {
  userId: number;
  // username?: string; // 可能有其他字段
  // iat?: number;
  // exp?: number;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let currentUserId: number | null = null;

  // 1. 尝试从 token 获取用户 ID
  try {
    const authHeader = req.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7); // 移除 "Bearer " 前缀
      // 验证 token 并解码
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      currentUserId = decoded.userId;
    }
  } catch (error) {
    // Token 无效、过期或不存在，忽略错误，currentUserId 保持 null
    // 这允许未登录用户也能查看任务详情，但 isCurrentUserAuthor 会是 false
    console.warn('JWT verification failed or token not provided for GET /api/tasks/[id]:', error);
  }

  try {
    const { id } = params;
    const taskIdInt = parseInt(id, 10);

    if (isNaN(taskIdInt)) {
      return NextResponse.json({ error: '无效的任务 ID' }, { status: 400 });
    }

    const task = await prisma.task.findUnique({
      where: {
        id: taskIdInt,
      },
      include: {
        user: { // 包含提问者信息
          select: {
            id: true,
            username: true,
          },
        },
        answers: { // 包含所有回答
          orderBy: {
            createdAt: 'asc', // 回答按时间升序
          },
          include: {
            user: { // 包含回答者信息
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
        adoptedAnswer: { // 如果有采纳的答案，也包含它
           include: {
             user: {
               select: {
                 id: true,
                 username: true,
               }
             }
           }
        },
        taskTags: { // 包含任务标签关系
          include: {
            tag: true, // 包含标签信息
          }
        },
        taskClaims: {
          where: {
            status: 'active', // 只选择状态为 active 的抢占记录
          },
          select: {
            id: true,         // 认领记录的 ID (claimId)
            userId: true,     // 认领者的 userId
            createdAt: true,  // 认领时间
            expiresAt: true,  // 过期时间
            user: {           // 包含认领者用户信息
              select: {
                username: true // 认领者用户名
              }
            }
          }
        }
      },
    });

    if (!task) {
      return NextResponse.json({ error: '任务未找到' }, { status: 404 });
    }

    // 2. 判断当前用户是否为作者
    const isCurrentUserAuthor = !!currentUserId && task.userId === currentUserId;

    // 格式化标签
    const tags = task.taskTags.map(taskTag => taskTag.tag.name);

    // 构建 activeClaim 对象
    let activeClaimFullInfo: {
      claimId: number;
      claimedBy: string;
      claimantUserId: number;
      claimedAt: string;
      expiresAt: string | null;
    } | null = null;

    if (task.isExclusive && task.taskClaims && task.taskClaims.length > 0) {
      const dbClaim = task.taskClaims[0]; // 假设独占任务只有一个活跃的认领记录
      activeClaimFullInfo = {
        claimId: dbClaim.id,
        claimedBy: dbClaim.user.username,
        claimantUserId: dbClaim.userId,
        claimedAt: dbClaim.createdAt.toISOString(),
        expiresAt: dbClaim.expiresAt ? dbClaim.expiresAt.toISOString() : null,
      };
    }

    // 解构任务数据，移除已处理或不需要直接返回的关联字段
    const { taskTags: _taskTags, taskClaims: _taskClaims, ...restTask } = task;

    // 3. 返回包含 isCurrentUserAuthor, 格式化标签和整理后的认领信息的数据
    return NextResponse.json({
      ...restTask,
      tags,
      isCurrentUserAuthor: isCurrentUserAuthor,
      activeClaim: activeClaimFullInfo, // 替换之前的 exclusiveClaimantId
    });

  } catch (error) {
    console.error('获取任务详情错误:', error);
    return NextResponse.json(
      { error: '获取任务详情过程中发生错误' },
      { status: 500 }
    );
  }
} 