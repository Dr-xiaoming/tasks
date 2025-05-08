import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/verifyAuth';

export async function POST(request: Request) {
  try {
    // 验证用户身份
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未授权访问' }, { status: 401 });
    }

    // 解析请求体
    const { name, level } = await request.json();

    // 验证输入
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ success: false, error: '技能名称不能为空且至少2个字符' }, { status: 400 });
    }

    if (!['beginner', 'intermediate', 'expert'].includes(level)) {
      return NextResponse.json({ success: false, error: '无效的技能等级' }, { status: 400 });
    }

    // 检查技能是否已存在
    const existingSkill = await prisma.userSkill.findFirst({
      where: {
        userId: user.id,
        name: name.trim()
      }
    });

    if (existingSkill) {
      return NextResponse.json({ success: false, error: '该技能已存在' }, { status: 400 });
    }

    // 创建新技能
    const skill = await prisma.userSkill.create({
      data: {
        userId: user.id,
        name: name.trim(),
        level: level
      }
    });

    return NextResponse.json({ success: true, skill });
  } catch (error) {
    console.error('添加技能时出错:', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
} 