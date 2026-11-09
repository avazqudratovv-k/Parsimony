/** Where merchant logos come from. Used only for entries that carry a merchant_domain, which stays
 * empty until logos are switched on on the server. One place to change if the provider changes. */
export const logoUrl = (domain: string): string =>
  `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;

/** Providers answer an unknown site with a tiny generic icon. Anything that small is not a real logo. */
export const MIN_LOGO_SIZE = 32;
