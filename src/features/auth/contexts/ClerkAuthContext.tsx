import { createContext, useContext } from 'react';
import { useUser, useAuth as useClerkAuth } from '@clerk/react';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  user: {
    id: string;
    email: string;
    full_name: string;
  } | null;
  session: {
    user: unknown;
  } | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const { signOut: clerkSignOut } = useClerkAuth();
  const navigate = useNavigate();

  const signOut = async () => {
    await clerkSignOut();
    navigate('/');
  };

  const value = {
    user: user ? {
      id: user.id,
      email: user.primaryEmailAddress?.emailAddress || '',
      full_name: user.fullName || '',
    } : null,
    session: user ? { user } : null,
    loading: !isLoaded,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
