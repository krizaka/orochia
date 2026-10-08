import { PaymentGatewayAdapter, GatewayType, GatewayConfigurationError } from "../types";
import { CCBillAdapter } from "./ccbill";
import { SegpayAdapter } from "./segpay";
import { CryptoGatewayAdapter } from "./crypto";
import { StripeAdapter } from "./stripe";

type Env = Record<string, string | undefined>;

function required(env: Env, gateway: GatewayType, names: string[]): Record<string, string> {
  const missing = names.filter((n) => !env[n] || !env[n]!.trim());
  if (missing.length) throw new GatewayConfigurationError(gateway, missing);
  return Object.fromEntries(names.map((n) => [n, env[n]!.trim()]));
}

/**
 * The adapter for a gateway, configured from the environment. There are no placeholder
 * credentials: a gateway whose secrets are missing is not offered, and asking for it throws.
 */
export function getPaymentGateway(gateway: GatewayType, env: Env = process.env): PaymentGatewayAdapter {
  switch (gateway) {
    case "CCBILL": {
      const c = required(env, gateway, [
        "CCBILL_CLIENT_ACCOUNT",
        "CCBILL_CLIENT_SUBACCOUNT",
        "CCBILL_FORM_NAME",
        "CCBILL_SALT",
        "CCBILL_WEBHOOK_SECRET",
      ]);
      return new CCBillAdapter({
        clientAccount: c.CCBILL_CLIENT_ACCOUNT,
        clientSubaccount: c.CCBILL_CLIENT_SUBACCOUNT,
        formName: c.CCBILL_FORM_NAME,
        salt: c.CCBILL_SALT,
        webhookSecret: c.CCBILL_WEBHOOK_SECRET,
      });
    }
    case "SEGPAY": {
      const c = required(env, gateway, ["SEGPAY_MERCHANT_ID", "SEGPAY_PACKAGE_ID", "SEGPAY_SECRET_KEY"]);
      return new SegpayAdapter({
        merchantId: c.SEGPAY_MERCHANT_ID,
        packageId: c.SEGPAY_PACKAGE_ID,
        secretKey: c.SEGPAY_SECRET_KEY,
      });
    }
    case "CRYPTO": {
      const c = required(env, gateway, ["NOWPAYMENTS_API_KEY", "NOWPAYMENTS_IPN_SECRET", "NEXT_PUBLIC_APP_URL"]);
      return new CryptoGatewayAdapter({
        apiKey: c.NOWPAYMENTS_API_KEY,
        ipnSecret: c.NOWPAYMENTS_IPN_SECRET,
        callbackUrl: `${c.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/webhooks/payments/crypto`,
      });
    }
    case "STRIPE": {
      const c = required(env, gateway, ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]);
      return new StripeAdapter({ secretKey: c.STRIPE_SECRET_KEY, webhookSecret: c.STRIPE_WEBHOOK_SECRET });
    }
    case "CREDITS":
      // Credits have no checkout page and no webhook: they settle in-house (credits.ts).
      throw new GatewayConfigurationError(gateway, ["no external checkout"]);
    default:
      throw new GatewayConfigurationError(String(gateway), ["unsupported gateway"]);
  }
}

/** The external gateways (hosted checkout + signed webhook) this deployment can charge through, in display order. */
export function configuredGateways(env: Env = process.env): GatewayType[] {
  return (["CCBILL", "SEGPAY", "CRYPTO", "STRIPE"] as GatewayType[]).filter((g) => {
    try {
      getPaymentGateway(g, env);
      return true;
    } catch {
      return false;
    }
  });
}

/** Every way a buyer can pay a tip or an unlock: Orochia credits (the wallet) first, then the external gateways. */
export function paymentMethods(env: Env = process.env): GatewayType[] {
  return ["CREDITS", ...configuredGateways(env)];
}
