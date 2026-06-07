import { useUser } from '@clerk/react';

/**
 * Hook to get the current Clerk user ID
 * This must be called from within a React component that has access to Clerk context
 */
export function useClerkUserId(): string | null {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return null;
  }

  return user?.id || null;
}

/**
 * Hook to require authentication - throws error if not authenticated
 * This must be called from within a React component that has access to Clerk context
 */
export function useRequireAuth(): { userId: string; isLoading: boolean } {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return { userId: '', isLoading: true };
  }

  if (!user) {
    throw new Error('User not authenticated. Please log in.');
  }

  return { userId: user.id, isLoading: false };
}
