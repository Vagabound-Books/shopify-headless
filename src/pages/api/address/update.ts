import type { APIRoute } from "astro";
import { updateCustomerAddress } from "../../../lib/customer-accounts";

export const POST: APIRoute = async ({ request, cookies }) => {
  const formData = await request.formData();
  const addressId = formData.get("addressId")?.toString();
  if (!addressId) {
    return new Response("Missing address ID", { status: 400 });
  }

  const address = {
    address1: formData.get("address1")?.toString() || "",
    address2: formData.get("address2")?.toString() || undefined,
    city: formData.get("city")?.toString() || "",
    province: formData.get("province")?.toString() || "",
    country: formData.get("country")?.toString() || "",
    zip: formData.get("zip")?.toString() || "",
    phone: formData.get("phone")?.toString() || undefined,
    name: formData.get("name")?.toString() || undefined,
  };

  try {
    const result = await updateCustomerAddress(cookies, addressId, address);
    if (result.userErrors?.length) {
      const msg = result.userErrors.map((e: any) => e.message).join("; ");
      return new Response(msg, { status: 400 });
    }
  } catch (err: any) {
    return new Response(err.message || "Failed to update address", { status: 500 });
  }

  return new Response(null, {
    status: 302,
    headers: { Location: "/account/addresses/" },
  });
};
