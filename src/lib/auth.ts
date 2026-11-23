/* eslint-disable @typescript-eslint/no-explicit-any */
import { decodeJwt, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { database } from "@/lib/database";

const ACCESS_SECRET = new TextEncoder().encode(
  process.env.ACCESS_TOKEN_SECRET || "access_secret",
);

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;
  const externalAccessToken = cookieStore.get("consoleAccessToken")?.value;

  if (!accessToken && !externalAccessToken) return null;

  try {
    if (accessToken) {
      const { payload } = await jwtVerify(accessToken, ACCESS_SECRET);
      return payload as {
        id: number | string;
        email: string;
        role: string;
        companyId?: number | string;
      };
    }

    const payload = decodeJwt(externalAccessToken as string) as Record<string, any>;

    const rawId = payload.id ?? payload.userId ?? payload.user_id ?? payload.sub;
    const normalizedId =
      typeof rawId === "string" && /^\d+$/.test(rawId) ? Number(rawId) : rawId;

    const normalizedRole = String(
      payload.role ?? payload.userRole ?? payload.user_role ?? "USER",
    ).toUpperCase();

    const normalizedEmail = String(
      payload.email ?? payload.userEmail ?? payload.user_email ?? "",
    );

    const rawCompanyId =
      payload.companyId ?? payload.company_id ?? payload.company ?? undefined;
    const normalizedCompanyId =
      typeof rawCompanyId === "string" && /^\d+$/.test(rawCompanyId)
        ? Number(rawCompanyId)
        : rawCompanyId;

    if (!normalizedId) return null;

    let internalUserId: number | string = normalizedId;

    if (typeof normalizedId !== "number") {
      if (!normalizedEmail) return null;

      const internalUser = await database.user.findUnique({
        where: { email: normalizedEmail.toLowerCase().trim() },
        select: { id: true, role: true, companyId: true, email: true },
      });

      if (!internalUser) return null;

      internalUserId = internalUser.id;

      return {
        ...payload,
        id: internalUser.id,
        role: String(normalizedRole || internalUser.role).toUpperCase(),
        email: internalUser.email,
        companyId: internalUser.companyId,
      } as {
        id: number | string;
        email: string;
        role: string;
        companyId?: number | string;
      };
    }

    return {
      ...payload,
      id: internalUserId,
      role: normalizedRole,
      email: normalizedEmail,
      companyId: normalizedCompanyId,
    } as {
      id: number | string;
      email: string;
      role: string;
      companyId?: number | string;
    };
  } catch(error) {
    console.error("Token verification failed:", error);
    return null;
  }
}
