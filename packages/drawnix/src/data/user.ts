import { useSyncExternalStore } from 'react';

export type UserInfo = {
  name: string;
  avatarUrl?: string;
};

// 当前登录用户（模块级 store）。登录功能暂未接入真实认证，
// 登录成功后通过 setUser 写入，侧边栏据此显示头像。
let user: UserInfo | null = null;

const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getUser = (): UserInfo | null => user;

export const useUser = (): UserInfo | null => {
  return useSyncExternalStore(subscribe, getUser);
};

export const setUser = (nextUser: UserInfo | null) => {
  user = nextUser;
  emit();
};
