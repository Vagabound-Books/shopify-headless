import type { APIRoute } from "astro";
import { logout } from "../../lib/auth";

const doLogout = async ({ cookies }: { cookies: any }) => {
  logout(cookies);
  return new Response(null, { status: 302, headers: { Location: "/account/login/" } });
};

export const GET: APIRoute = doLogout;
export const POST: APIRoute = doLogout;
