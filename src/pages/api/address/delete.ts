import type { APIRoute } from "astro";
import { deleteCustomerAddress } from "../../../lib/customer-accounts";

export const POST: APIRoute = async ({ request, cookies }) => {
  const formData = await request.formData();
  const addressId = formData.get("addressId")?.toString();
  if (!addressId) {
    return new Response("Missing address ID", { status: 400 });
  }

  try {
    const result = await deleteCustomerAddress(cookies, addressId);
    if (result.userErrors?.length) {
      const msg = result.userErrors.map((e: any) => e.message).join("; ");
      return new Response(msg, { status: 400 });
    }
  } catch (err: any) {
    return new Response(err.message || "Failed to delete address", { status: 500 });
  }

  return new Response(null, {
    status: 302,
    headers: { Location: "/account/addresses/" },
  });
};
