export interface User {
  userId: string;
  employeeId: string;
  role: string;
  name?: string;
  email?: string;
  assignedLocationId?: string;
  permissions: string[];
  roles?: string[];
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

