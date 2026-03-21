import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

export interface IronSessionData {
  address?: string;
  chainId?: number;
  nonce?: string;
  authenticated?: boolean;
}

export const sessionOptions = {
  password: process.env.SESSION_SECRET!, // min 32 chars
  cookieName: "network-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<IronSessionData>(cookieStore, sessionOptions);
}
