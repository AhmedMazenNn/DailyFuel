export interface AdminUser {
  id: string; email: string; name: string; isActive: boolean; isAdmin: boolean;
  joinedAt: string; lastLogin: string | null; timezone: string;
  language: 'en' | 'ar'; weightUnit: 'kg' | 'lb'; version: string;
}
export interface AdminUserDetail extends AdminUser {
  activity: { meals: number; foods: number; weeks: number; photos: number };
  history: { id: number; action: string; at: string; actor: string; description: string }[];
}
export interface AdminUsersPage {
  results: AdminUser[]; count: number; page: number; pages: number;
  summary: { total: number; active: number; inactive: number; admins: number };
}
