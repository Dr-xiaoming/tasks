'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
// 导入jwt-decode来验证token
import { jwtDecode } from 'jwt-decode';

// 解码后的Payload接口
interface DecodedToken {
  userId: number;
  username: string;
  iat: number;
  exp: number;
}

// 用户信息接口
interface User {
  userId: number;
  username: string;
}

interface AuthContextType {
  token: string | null; // 新增 token 状态
  isLoading: boolean;
  login: (token: string) => void; // 修改 login 参数为 token
  logout: () => void;
  getToken: () => string | null; // 新增 getToken 方法
  getUserId: () => number | null; // 新增 getUserId 方法
  isLoggedIn: boolean;
  user: User | null; // 添加用户信息
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_STORAGE_KEY = 'authToken'; // 定义存储键

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null); // 存储 token
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null); // 添加用户状态

  useEffect(() => {
    const loadTokenFromLocalStorage = () => {
      try {
        const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
        if (storedToken) {
          // 解码token并验证是否过期
          try {
            const decoded = jwtDecode<DecodedToken>(storedToken);
            // 检查token是否过期 (exp字段是Unix时间戳，单位为秒)
            if (decoded.exp * 1000 > Date.now()) { 
              setToken(storedToken);
              // 设置用户信息
              setUser({
                userId: decoded.userId,
                username: decoded.username
              });
            } else {
              // Token 过期，清除
              console.log('Token已过期，正在清除');
              localStorage.removeItem(TOKEN_STORAGE_KEY);
              setToken(null);
              setUser(null);
            }
          } catch (decodeError) {
            console.error('Token解析失败:', decodeError);
            localStorage.removeItem(TOKEN_STORAGE_KEY);
            setToken(null);
            setUser(null);
          }
        }
      } catch (error) {
        console.error('加载认证 token 失败:', error);
        localStorage.removeItem(TOKEN_STORAGE_KEY); // 出错时清除
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadTokenFromLocalStorage();
  }, []);

  const login = (newToken: string) => {
    try {
      // 解码验证token
      const decoded = jwtDecode<DecodedToken>(newToken);
      if (decoded.exp * 1000 <= Date.now()) {
        throw new Error('收到的token已过期');
      }
      setToken(newToken);
      // 设置用户信息
      setUser({
        userId: decoded.userId,
        username: decoded.username
      });
      localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    } catch (error) {
      console.error("Token无效:", error);
      setToken(null);
      setUser(null);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      throw error; // 向上传递错误，让调用方知道登录失败
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  };

  const getToken = (): string | null => {
    try {
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (storedToken) {
        try {
          // 验证token是否过期
          const decoded = jwtDecode<DecodedToken>(storedToken);
          if (decoded.exp * 1000 > Date.now()) {
            // 令牌有效
            return storedToken;
          } else {
            // 令牌过期，清除状态
            console.log('Token已过期，正在清除');
            localStorage.removeItem(TOKEN_STORAGE_KEY);
            // 同步更新状态
            setToken(null);
            setUser(null);
            return null;
          }
        } catch (error) {
          // token解析失败，清除
          console.error('Token解析失败:', error);
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          // 同步更新状态
          setToken(null);
          setUser(null);
          return null;
        }
      }
      return null;
    } catch (error) {
      console.error('获取Token错误:', error);
      return null;
    }
  };

  const getUserId = (): number | null => {
    try {
      // 先检查内存中的user对象
      if (user && user.userId) {
        return user.userId;
      }
      
      // 如果内存中没有，检查本地存储中的token
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (storedToken) {
        try {
          const decoded = jwtDecode<DecodedToken>(storedToken);
          if (decoded.exp * 1000 > Date.now()) {
            // 令牌有效，返回userId
            return decoded.userId;
          }
        } catch (error) {
          console.error('获取用户ID时解析Token失败:', error);
        }
      }
      return null;
    } catch (error) {
      console.error('获取用户ID错误:', error);
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        isLoading,
        login,
        logout,
        getToken,
        getUserId,
        isLoggedIn: !!token,
        user
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth必须在AuthProvider内部使用');
  }
  return context;
} 