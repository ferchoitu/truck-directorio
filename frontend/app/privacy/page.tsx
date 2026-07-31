import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What data YoTruck collects, how payment data is handled, and how to exercise your privacy rights.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      label="Legal"
      title="Privacy Policy"
      updated="July 31, 2026"
      intro="YoTruck collects very little about visitors. This page explains exactly what is collected, why, and how to get it removed."
    >
      <h2>1. Who we are</h2>
      <p>
        YoTruck operates yotruck.com and the Carrier Data API. For privacy questions
        or requests, contact{" "}
        <a href="mailto:nuclealabs@gmail.com">nuclealabs@gmail.com</a>.
      </p>

      <h2>2. Browsing the site</h2>
      <p>
        You can search the directory and read carrier profiles without an account. We
        do not require registration, and we do not set advertising or tracking cookies
        of our own.
      </p>
      <p>
        Our hosting providers automatically process standard server and request data —
        IP address, user agent, requested URL, timestamp — to serve pages, prevent
        abuse, and keep the service secure. This is handled by Vercel (frontend) and
        Railway (backend and database) acting as our infrastructure providers.
      </p>

      <h2>3. Buying an API plan</h2>
      <p>
        Our order process is conducted by our online reseller{" "}
        <a href="https://www.paddle.com" target="_blank" rel="noopener noreferrer">
          Paddle.com
        </a>
        , which is the Merchant of Record. When you subscribe, Paddle collects the
        information needed to take payment and meet tax obligations — name, email,
        billing address, country, and payment details.
      </p>
      <p>
        <strong>
          We never see or store your card number or any payment credentials.
        </strong>{" "}
        From Paddle we receive only what is needed to provision and support your
        subscription: your email address, customer and subscription identifiers, the
        plan purchased, and its status. See{" "}
        <a
          href="https://www.paddle.com/legal/privacy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Paddle&apos;s privacy notice
        </a>{" "}
        for how they handle your data.
      </p>
      <p>
        Paddle&apos;s checkout runs in your browser on our API access page and may set
        cookies or load related scripts from Paddle. Those are governed by
        Paddle&apos;s policies.
      </p>

      <h2>4. Your API key</h2>
      <p>
        We store a SHA-256 hash of your API key, never the key itself, together with
        your monthly request count so we can enforce your plan allowance. We do not
        log the contents of your API queries against your identity for any purpose
        beyond operating and securing the service.
      </p>

      <h2>5. Carrier data on this site</h2>
      <p>
        Carrier profiles are compiled from public records published by the FMCSA about
        registered commercial motor carriers. This is business information — company
        name, USDOT and MC numbers, business address, business phone, fleet size,
        inspections, and violations.
      </p>
      <p>
        Some carriers are sole proprietors whose business name, address, or phone
        number is also personal information. That data is published by FMCSA as a
        public record and we reproduce it as published. If you are such a carrier and
        want your profile removed from YoTruck, email us and we will remove it from
        this site — note that we cannot change the underlying government record, which
        remains available from FMCSA.
      </p>
      <p>
        We do not publish personal information about drivers.
      </p>

      <h2>6. Affiliate links</h2>
      <p>
        Some carrier profiles include clearly labelled sponsored links to third-party
        services such as insurance, factoring, or compliance providers. If you follow
        one, that provider&apos;s own privacy policy governs what they collect. We may
        receive a commission. We do not sell or share your personal data with these
        partners.
      </p>

      <h2>7. Retention</h2>
      <p>
        Subscriber records are kept while your subscription is active and afterwards
        only as long as needed for legal, tax, and accounting obligations. Server logs
        are kept for a short period for security and troubleshooting.
      </p>

      <h2>8. Your rights</h2>
      <p>
        Depending on where you live — including under the GDPR in the EU and UK, and
        the CCPA/CPRA in California — you may have the right to access, correct,
        delete, or port your personal data, to object to or restrict certain
        processing, and to withdraw consent. <strong>We do not sell personal
        information.</strong>
      </p>
      <p>
        To exercise any of these, email{" "}
        <a href="mailto:nuclealabs@gmail.com">nuclealabs@gmail.com</a>. For data held
        by Paddle as Merchant of Record, you may also contact Paddle directly. If you
        are in the EU or UK you have the right to complain to your local data
        protection authority.
      </p>

      <h2>9. International transfers</h2>
      <p>
        Our infrastructure and our payment processor operate in the United States and
        other countries, so your data may be processed outside your country of
        residence, with appropriate safeguards where required by law.
      </p>

      <h2>10. Changes</h2>
      <p>
        We will update this page when our practices change and revise the date above.
        Material changes affecting subscribers will be notified by email. See also our{" "}
        <Link href="/terms">Terms of Service</Link>.
      </p>
    </LegalPage>
  );
}
