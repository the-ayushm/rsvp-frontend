'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import Spinner from '@/components/ui/Spinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export default function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const router = useRouter();

  // ✅ use existing store fields
  const { user, token } = useAuthStore();

  // ✅ derive instead of expecting from store
  const isAuthenticated = !!token && !!user;

  // ❌ no loading in store → assume false
  const loading = false;

  /* -----------------------------
     AUTH CHECK
  ----------------------------- */
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  /* -----------------------------
     ROLE CHECK
  ----------------------------- */
  useEffect(() => {
    if (!loading && isAuthenticated && allowedRoles && user) {
      const role = user.role ?? ''; // ✅ fix undefined issue
      const hasPermission = allowedRoles.includes(role);

      if (!hasPermission) {
        router.push('/');
      }
    }
  }, [isAuthenticated, loading, user, allowedRoles, router]);

  /* -----------------------------
     LOADING UI
  ----------------------------- */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  /* -----------------------------
     NOT AUTHENTICATED
  ----------------------------- */
  if (!isAuthenticated) {
    return null;
  }

  /* -----------------------------
     ACCESS DENIED UI
  ----------------------------- */
  if (allowedRoles && user) {
    const role = user.role ?? '';

    if (!allowedRoles.includes(role)) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Access Denied
            </h1>
            <p className="text-gray-600">
              You don&apos;t have permission to access this page.
            </p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}