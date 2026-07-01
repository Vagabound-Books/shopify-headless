import type { APIRoute } from "astro";
import { logout } from "../../lib/auth";

export const POST: APIRoute = async ({ cookies }) => {
  logout(cookies);
  return new Response(null, { status: 302, headers: { Location: "/account/login" } });
};
