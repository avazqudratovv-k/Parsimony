// Mirrors backend/app/schemas. Money is always a string ("6.50"), never a float.
export type User = {
  id: string;
  email: string;
  is_demo: boolean;
  default_currency: string;
  timezone: string;
  expires_at: string | null;
};
