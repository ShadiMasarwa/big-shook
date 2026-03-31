import { useState, useEffect, createContext, useContext } from "react";
import { User } from "@workspace/api-zod/src/generated/types";
import { useGetCurrentUser, useLoginUser, useRegisterUser, useLogoutUser } from "@workspace/api-client-react";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: ReturnType<typeof useLoginUser>["mutateAsync"];
  register: ReturnType<typeof useRegisterUser>["mutateAsync"];
  logout: ReturnType<typeof useLogoutUser>["mutateAsync"];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  
  const { data: user, isLoading, refetch } = useGetCurrentUser({
    query: {
      enabled: !!token,
      retry: false,
    }
  });

  const loginMutation = useLoginUser();
  const registerMutation = useRegisterUser();
  const logoutMutation = useLogoutUser();

  const login = async (data: any, options?: any) => {
    const res = await loginMutation.mutateAsync(data, options);
    if (res.token) {
      localStorage.setItem("token", res.token);
      setToken(res.token);
      refetch();
    }
    return res;
  };

  const register = async (data: any, options?: any) => {
    const res = await registerMutation.mutateAsync(data, options);
    if (res.token) {
      localStorage.setItem("token", res.token);
      setToken(res.token);
      refetch();
    }
    return res;
  };

  const logout = async (data?: any, options?: any) => {
    await logoutMutation.mutateAsync(data, options);
    localStorage.removeItem("token");
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{
      user: user || null,
      isLoading,
      login,
      register,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
