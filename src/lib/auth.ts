import type { AstroCookies } from "astro";
import {
  isCustomerAccountsEnabled,
  getCustomerAccountsCustomer,
  deleteCustomerAccountsTokens,
} from "./customer-accounts";

/**
 * Get the current customer using the Customer Accounts API (OAuth).
 * Returns null if not authenticated or if CA API is not configured.
 */
export async function getCustomer(cookies: AstroCookies) {
  if (!isCustomerAccountsEnabled()) return null;
  return getCustomerAccountsCustomer(cookies);
}

/**
 * Log out the customer by clearing all auth cookies.
 */
export function logout(cookies: AstroCookies): void {
  deleteCustomerAccountsTokens(cookies);
}
