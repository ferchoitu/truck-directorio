import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms governing use of the YoTruck carrier directory and Carrier Data API.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage
      label="Legal"
      title="Terms of Service"
      updated="July 31, 2026"
      intro="These terms govern your use of yotruck.com and the YoTruck Carrier Data API. By using the site or the API, you agree to them."
    >
      <h2>1. What YoTruck is</h2>
      <p>
        YoTruck is a searchable directory of United States motor carriers built from
        public records published by the Federal Motor Carrier Safety Administration
        (FMCSA), including registration data, Safety Measurement System (SMS) BASIC
        measures, roadside inspections, and violations. We also offer paid
        programmatic access to that data through the Carrier Data API.
      </p>
      <p>
        <strong>
          YoTruck is not affiliated with, endorsed by, or operated by the FMCSA, the
          United States Department of Transportation, or any government agency.
        </strong>
      </p>

      <h2>2. Accuracy and the nature of the data</h2>
      <p>
        The data originates with FMCSA and is largely self-reported by carriers. It
        may be incomplete, outdated, or incorrect at the source, and we reproduce it
        as published without independently verifying it. Fleet-size figures in
        particular are self-reported on form MCS-150 and are frequently wrong.
      </p>
      <p>
        The service and all data are provided <strong>&quot;as is&quot;</strong> and
        <strong> &quot;as available&quot;</strong>, without warranties of any kind,
        express or implied, including accuracy, completeness, merchantability, or
        fitness for a particular purpose. Always confirm against the official FMCSA
        sources linked on every carrier profile before relying on anything you find
        here.
      </p>

      <h2>3. Permitted use — this is not a consumer report</h2>
      <p>
        <strong>
          YoTruck is not a consumer reporting agency and this data is not a consumer
          report as defined by the Fair Credit Reporting Act (FCRA), 15 U.S.C. § 1681
          et seq.
        </strong>{" "}
        You may not use the site or the API, in whole or in part, as a factor in
        establishing any individual&apos;s eligibility for:
      </p>
      <ul>
        <li>credit, insurance, or any financial product;</li>
        <li>employment, contracting, or retention as an employee or contractor;</li>
        <li>housing or tenancy;</li>
        <li>
          any other purpose regulated by the FCRA or comparable state legislation.
        </li>
      </ul>
      <p>
        The information here describes registered commercial motor carriers as
        business entities. If you need data for any FCRA-regulated purpose, obtain it
        from a properly licensed consumer reporting agency instead.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>
          scrape, crawl, or bulk-download the website in order to reconstruct the
          underlying dataset — the API exists for programmatic access;
        </li>
        <li>
          circumvent, disable, or attempt to exceed API rate limits or quotas, or
          create multiple accounts to do so;
        </li>
        <li>
          resell, sublicense, or redistribute API responses as a competing bulk data
          product;
        </li>
        <li>use the service to send unsolicited commercial messages;</li>
        <li>
          interfere with the operation or security of the service, or attempt to
          access accounts or data that are not yours.
        </li>
      </ul>
      <p>
        The underlying FMCSA records are public and we claim no ownership over them.
        These restrictions concern our service, compilation, and infrastructure.
      </p>

      <h2>5. API access and keys</h2>
      <p>
        Paid plans grant a monthly allowance of API requests on a rolling 30-day
        period, as described on the{" "}
        <Link href="/api-access">API access page</Link>. Requests beyond your
        allowance are rejected until the period resets or you move to a higher plan.
      </p>
      <p>
        Your API key authenticates every request and is your responsibility to keep
        secret. We store only a cryptographic hash of it and cannot recover the
        original — if you lose it you must issue a new one, which invalidates the
        previous key. You are responsible for all activity carried out with your key.
      </p>

      <h2>6. Subscriptions, billing, and taxes</h2>
      <p>
        Our order process is conducted by our online reseller{" "}
        <a href="https://www.paddle.com" target="_blank" rel="noopener noreferrer">
          Paddle.com
        </a>
        . <strong>Paddle.com is the Merchant of Record</strong> for all our orders and
        handles payment, billing enquiries, and the collection and remittance of
        applicable taxes. Paddle&apos;s buyer terms apply to the transaction in
        addition to these terms.
      </p>
      <p>
        Paid plans renew automatically each month at the price shown at the time of
        purchase until cancelled. Refunds and cancellations are covered by our{" "}
        <Link href="/refunds">Refund Policy</Link>.
      </p>

      <h2>7. Availability and changes</h2>
      <p>
        We do not guarantee uninterrupted availability. We may modify, suspend, or
        discontinue any part of the service, and may change API endpoints or response
        shapes. For breaking API changes affecting paying subscribers we will give
        reasonable advance notice by email where practicable.
      </p>

      <h2>8. Suspension and termination</h2>
      <p>
        We may suspend or terminate access if these terms are breached, particularly
        the acceptable-use and FCRA restrictions above. You may cancel at any time as
        described in the Refund Policy. Sections 2, 3, 9, and 10 survive termination.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, YoTruck is not liable for indirect,
        incidental, special, consequential, or punitive damages, or for lost profits,
        revenue, or data, arising from your use of the service or reliance on its
        data. Our total aggregate liability for any claim is limited to the amount you
        paid us in the twelve months preceding the event giving rise to the claim.
      </p>
      <p>
        Nothing here excludes liability that cannot lawfully be excluded, including
        for fraud.
      </p>

      <h2>10. Governing law</h2>
      <p>
        These terms are governed by the laws of the jurisdiction in which the operator
        of YoTruck is established, without regard to conflict-of-law rules. Mandatory
        consumer protections available to you in your country of residence are
        unaffected.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions about these terms:{" "}
        <a href="mailto:nuclealabs@gmail.com">nuclealabs@gmail.com</a>.
      </p>
    </LegalPage>
  );
}
