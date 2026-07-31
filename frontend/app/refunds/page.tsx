import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy",
  description:
    "How to cancel a YoTruck API subscription and when refunds are available.",
};

export default function RefundsPage() {
  return (
    <LegalPage
      label="Legal"
      title="Refund & Cancellation Policy"
      updated="July 31, 2026"
      intro="Short version: try it, and if the API does not work for you, email us within 14 days of a charge and we will refund it."
    >
      <h2>1. Try before you commit</h2>
      <p>
        Every endpoint is documented and browsable for free, and the public directory
        at yotruck.com shows exactly what data exists for any carrier. We encourage
        you to confirm the data covers your use case before subscribing.
      </p>

      <h2>2. 14-day refund</h2>
      <p>
        If you are not satisfied, email{" "}
        <a href="mailto:nuclealabs@gmail.com">nuclealabs@gmail.com</a> within{" "}
        <strong>14 days</strong> of a charge and we will refund that charge in full.
        You do not need to give a reason.
      </p>
      <p>
        This applies to your first payment and to any renewal. Refunds are returned to
        the original payment method.
      </p>

      <h2>3. Cancelling</h2>
      <p>
        You can cancel at any time by emailing us or by using the link in the receipt
        that Paddle sent you. On cancellation:
      </p>
      <ul>
        <li>your subscription stops renewing;</li>
        <li>
          your API key keeps working until the end of the period you already paid for;
        </li>
        <li>
          you are not charged again, and we do not prorate or refund the unused
          remainder of the current period unless the 14-day window above applies.
        </li>
      </ul>

      <h2>4. Exceptions</h2>
      <p>
        We may decline a refund where an account has been suspended for breaching the{" "}
        <Link href="/terms">Terms of Service</Link> — in particular the acceptable-use
        and FCRA restrictions — or where a plan has been used to make a substantial
        volume of requests and a refund is requested repeatedly across billing
        periods.
      </p>

      <h2>5. Service problems</h2>
      <p>
        If the API is unavailable or returns incorrect results for a sustained period,
        contact us regardless of the 14-day window. We would rather credit or refund
        you than have you pay for something that did not work.
      </p>
      <p>
        Note that we publish FMCSA data as it is published. Data being incomplete or
        outdated <em>at the source</em> is not a service fault — see{" "}
        <Link href="/terms">section 2 of the Terms</Link> — though we are always glad
        to hear about it.
      </p>

      <h2>6. How refunds are processed</h2>
      <p>
        Our order process is conducted by our online reseller{" "}
        <a href="https://www.paddle.com" target="_blank" rel="noopener noreferrer">
          Paddle.com
        </a>
        , the Merchant of Record for all our orders. Refunds are issued through
        Paddle, and the funds typically appear within 5–10 business days depending on
        your bank. You may also raise billing questions with Paddle directly.
      </p>

      <h2>7. Contact</h2>
      <p>
        For any refund or cancellation request:{" "}
        <a href="mailto:nuclealabs@gmail.com">nuclealabs@gmail.com</a>. Include the
        email address used at checkout so we can find the subscription.
      </p>
    </LegalPage>
  );
}
