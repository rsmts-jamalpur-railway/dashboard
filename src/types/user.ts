export interface User {
  id: string;
  employee_id: string;
  full_name: string;
  department: string;
  role: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
