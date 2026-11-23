// src/app/page.tsx
import AuthPage from '@/features/auth/screens/AuthScreen/AuthScreen'

export default function Home() {
  // We don't redirect automatically here.
  // AuthPage will handle login/signup.
  return <AuthPage />
}
