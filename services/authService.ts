
import { AppUser, UserRole } from '../types';

const USERS_KEY = 'meditrack_users';
const CURRENT_KEY = 'meditrack_current_user';

const DEFAULT_ADMIN: AppUser = {
  id: 'USR-ADMIN',
  name: 'Administrator',
  role: 'ADMIN',
  pin: '1234',
};

export const getUsers = (): AppUser[] => {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* fall through to default */ }
  // First run — seed the default admin
  localStorage.setItem(USERS_KEY, JSON.stringify([DEFAULT_ADMIN]));
  return [DEFAULT_ADMIN];
};

export const saveUsers = (users: AppUser[]) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

export const addUser = (name: string, role: UserRole, pin: string): AppUser => {
  const users = getUsers();
  const user: AppUser = { id: `USR-${crypto.randomUUID().slice(0, 8)}`, name: name.trim(), role, pin };
  saveUsers([...users, user]);
  return user;
};

export const removeUser = (id: string) => {
  const users = getUsers().filter(u => u.id !== id);
  // Never delete the last admin
  if (!users.some(u => u.role === 'ADMIN')) return false;
  saveUsers(users);
  return true;
};

export const updateUser = (user: AppUser) => {
  saveUsers(getUsers().map(u => u.id === user.id ? user : u));
};

export const login = (userId: string, pin: string): AppUser | null => {
  const user = getUsers().find(u => u.id === userId);
  if (user && user.pin === pin) {
    localStorage.setItem(CURRENT_KEY, JSON.stringify({ id: user.id, ts: Date.now() }));
    return user;
  }
  return null;
};

export const logout = () => {
  localStorage.removeItem(CURRENT_KEY);
};

export const getCurrentUser = (): AppUser | null => {
  try {
    const raw = localStorage.getItem(CURRENT_KEY);
    if (!raw) return null;
    const { id } = JSON.parse(raw);
    return getUsers().find(u => u.id === id) || null;
  } catch {
    return null;
  }
};
