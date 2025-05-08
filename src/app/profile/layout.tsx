import React from 'react';
import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';

export const metadata: Metadata = {
  title: '个人中心 - 任务平台',
  description: '查看和管理您的个人信息、任务和回答',
};

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <main>
        {children}
      </main>
    </AuthProvider>
  );
} 