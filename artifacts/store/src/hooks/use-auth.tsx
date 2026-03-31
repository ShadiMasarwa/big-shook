import { useState, useEffect, createContext, useContext } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { User } from "@workspace/api-zod/src/generated/types";
import { useGetCurrentUser, useLoginUser, useRegisterUser, useLogoutUser } from "@workspace/api-client-react";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: ReturnType<typeof useLoginUser>["mutateAsync"];
  register: ReturnType<typeof useRegisterUser>["mutateAsync"];
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
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

  const logout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // still clear locally even if the API call fails
    } finally {
      localStorage.removeItem("token");
      setToken(null);
      queryClient.removeQueries({ queryKey: ["/api/auth/me"] });
    }
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
