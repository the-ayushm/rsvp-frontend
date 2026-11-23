/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import { useAuthStore } from '@/store/auth';
import { Mail, Lock, Phone } from 'lucide-react';

interface LoginFormData {
  identifier: string;
  password: string;
}

export default function LoginForm() {
  const router = useRouter();
  const { login } = useAuthStore();

  const [loginType, setLoginType] = useState<'email' | 'phone'>('email');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>();

  const onSubmit = async (data: LoginFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      // ✅ 1. API CALL (login request)
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier: data.identifier,
          password: data.password,
        }),
      });

      if (!res.ok) {
        throw new Error('Invalid credentials');
      }

      const result = await res.json();

      // result should be like:
      // { user: {...}, token: "...", company: {...} }

      // ✅ 2. STORE AUTH DATA
      login({
        user: result.user,
        token: result.token,
        company: result.company,
      });

      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <Alert variant="error" message={error} onClose={() => setError(null)} />
      )}

      {/* Toggle */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
        <button
          type="button"
          onClick={() => setLoginType('email')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium ${
            loginType === 'email'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600'
          }`}
        >
          Email
        </button>

        <button
          type="button"
          onClick={() => setLoginType('phone')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium ${
            loginType === 'phone'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600'
          }`}
        >
          Phone
        </button>
      </div>

      {/* Identifier */}
      <Input
        label={loginType === 'email' ? 'Email Address' : 'Phone Number'}
        type={loginType === 'email' ? 'email' : 'tel'}
        placeholder={loginType === 'email' ? 'you@example.com' : '+91xxxxxxxxxx'}
        leftIcon={
          loginType === 'email' ? (
            <Mail className="h-5 w-5" />
          ) : (
            <Phone className="h-5 w-5" />
          )
        }
        error={errors.identifier?.message}
        {...register('identifier', {
          required: 'This field is required',
        })}
      />

      {/* Password */}
      <Input
        label="Password"
        type="password"
        placeholder="Enter your password"
        leftIcon={<Lock className="h-5 w-5" />}
        error={errors.password?.message}
        {...register('password', {
          required: 'Password is required',
          minLength: {
            value: 6,
            message: 'Minimum 6 characters required',
          },
        })}
      />

      {/* Forgot */}
      <div className="flex justify-end">
        <a href="/forgot-password" className="text-sm text-[var(--color-primary)]">
          Forgot password?
        </a>
      </div>

      {/* Submit */}
      <Button type="submit" variant="primary" fullWidth isLoading={isLoading}>
        Sign In
      </Button>

      {/* Register */}
      <p className="text-center text-sm text-gray-600">
        Don&apos;t have an account?{' '}
        <a href="/register" className="text-[var(--color-primary)] font-medium">
          Sign up
        </a>
      </p>
    </form>
  );
}