// src/lib/admin-auth.ts

import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { database } from './database';

const ACCESS_SECRET = new TextEncoder().encode(
  process.env.ACCESS_TOKEN_SECRET || 'access_secret'
);

interface TokenPayload {
  id: string;
  email: string;
  role: string;
}

const ADMIN_ROLES = [
  'ADMIN',
  'SUPER_ADMIN',
  'MODERATOR',
  'SUPPORT',
];

export async function verifyAdminToken(request: NextRequest) {
  try {
    const token = request.cookies.get('accessToken')?.value;

    if (!token) return null;

    const { payload } = await jwtVerify(token, ACCESS_SECRET);

    const decoded = payload as unknown as TokenPayload;

    // ✅ allow all admin-side roles
    if (!ADMIN_ROLES.includes(decoded.role)) {
      return null;
    }

    const admin = await database.user.findUnique({
      where: { id: Number(decoded.id) }, // <-- important fix (your id is Int)
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!admin) return null;

    return admin;
  } catch (error) {
    console.error('Admin token verification error:', error);
    return null;
  }
}

export async function requireAdmin(request: NextRequest) {
  const admin = await verifyAdminToken(request);

  if (!admin) {
    throw new Error('Unauthorized');
  }

  return admin;
}
