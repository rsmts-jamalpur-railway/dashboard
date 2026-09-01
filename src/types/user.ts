export interface User {
  userId: string;
  employeeId: string;
  role: string;
  assignedLocationId?: string;
  permissions: string[];
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
