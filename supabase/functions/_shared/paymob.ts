export const PAYMOB_INTENTION_URL = "https://accept.paymob.com/v1/intention";

export function parseIntegrationIds(raw: string | null | undefined): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
}

export function buildCheckoutUrl(
  publicKey: string,
  clientSecret: string,
  baseUrl = "https://accept.paymob.com",
): string {
  const base = baseUrl.replace(/\/+$/, "");
  const params = new URLSearchParams({ publicKey, clientSecret });
  return `${base}/unifiedcheckout/?${params.toString()}`;
}

export type PaymobIntentionOptions = {
  amountCents: number;
  planName: string;
  integrationIds: number[];
  customer: { first_name: string; last_name: string; email: string };
  reference: string;
  userId: string;
  planSlug: string;
  supabaseUrl: string;
  siteUrl: string;
};

export function buildIntentionPayload(options: PaymobIntentionOptions) {
  const {
    amountCents,
    planName,
    integrationIds,
    customer,
    reference,
    userId,
    planSlug,
    supabaseUrl,
    siteUrl,
  } = options;

  return {
    amount: amountCents,
    currency: "EGP",
    payment_methods: integrationIds,
    items: [
      {
        name: `MailCraft ${planName}`,
        amount: amountCents,
        description: `${planName} monthly plan`,
        quantity: 1,
      },
    ],
    billing_data: {
      ...customer,
      phone_number: "NA",
      street: "NA",
      city: "Cairo",
      country: "EG",
      state: "Cairo",
      postal_code: "00000",
    },
    customer,
    special_reference: reference,
    extras: {
      merchant_order_id: reference,
      user_id: userId,
      plan_slug: planSlug,
    },
    notification_url: `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/paymob-webhook`,
    redirection_url: `${siteUrl.replace(/\/+$/, "")}/pricing?payment=pending`,
  };
}
