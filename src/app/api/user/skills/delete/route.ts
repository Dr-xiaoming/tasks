import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/verifyAuth';

export async function DELETE(request: Request) {
  try {
    // 验证用户身份
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未授权访问' }, { status: 401 });
    }

    // 解析请求体
    const { skillId } = await request.json();

    // 验证输入
    if (!skillId || typeof skillId !== 'number') {
      return NextResponse.json({ success: false, error: '无效的技能ID' }, { status: 400 });
    }

    // 检查技能是否存在且属于该用户
    const skill = await prisma.userSkill.findFirst({
      where: {
        id: skillId,
        userId: user.id
      }
    });

    if (!skill) {
      return NextResponse.json({ success: false, error: '技能不存在或无权操作' }, { status: 404 });
    }

    // 删除技能
    await prisma.userSkill.delete({
      where: {
        id: skillId
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除技能时出错:', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
} 