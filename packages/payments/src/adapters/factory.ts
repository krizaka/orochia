import { PaymentGatewayAdapter, GatewayType } from "../types";
import { CCBillAdapter } from "./ccbill";
import { SegpayAdapter } from "./segpay";
import { CryptoGatewayAdapter } from "./crypto";
import { StripeAdapter } from "./stripe";

export function getPaymentGateway(preferredGateway?: GatewayType): PaymentGatewayAdapter {
  const gateway = preferredGateway || (process.env.PAYMENT_DEFAULT_GATEWAY?.toUpperCase() as GatewayType) || "CCBILL";

  switch (gateway) {
    case "CCBILL":
      return new CCBillAdapter({
        clientAccount: process.env.CCBILL_CLIENT_ACCOUNT || "950000",
        clientSubaccount: process.env.CCBILL_CLIENT_SUBACCOUNT || "0000",
        formName: process.env.CCBILL_FORM_NAME || "0000",
        salt: process.env.CCBILL_SALT || "demo_ccbill_salt_secret",
        flexFormId: process.env.CCBILL_FLEXFORM_ID,
      });

    case "SEGPAY":
      return new SegpayAdapter({
        merchantId: process.env.SEGPAY_MERCHANT_ID || "12345",
        packageId: process.env.SEGPAY_PACKAGE_ID || "67890",
        secretKey: process.env.SEGPAY_SECRET_KEY || "demo_segpay_secret",
      });

    case "CRYPTO":
      return new CryptoGatewayAdapter({
        apiKey: process.env.NOWPAYMENTS_API_KEY || "demo_crypto_key",
        ipnSecret: process.env.NOWPAYMENTS_IPN_SECRET || "demo_ipn_secret",
      });

    case "STRIPE":
      return new StripeAdapter({
        secretKey: process.env.STRIPE_SECRET_KEY || "sk_test_demo",
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "whsec_demo",
      });

    default:
      throw new Error(`Unsupported payment gateway: ${gateway}`);
  }
}
