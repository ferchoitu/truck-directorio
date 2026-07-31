import type { Metadata } from "next";
import { Suspense } from "react";
import ClaimKey from "@/components/ClaimKey";
import SectionLabel from "@/components/SectionLabel";

export const metadata: Metadata = {
  title: "Your API key",
  description: "Retrieve the API key for your YoTruck carrier data subscription.",
  robots: { index: false, follow: false },
};

export default function ApiAccessSuccessPage() {
  return (
    <div className="mx-auto max-w-3xl py-12">
      <SectionLabel>Subscription active</SectionLabel>
      <h1 className="font-heading mt-4 text-4xl font-medium leading-tight">
        You&apos;re in. <em className="italic text-lime-600">Here is your key.</em>
      </h1>
      <Suspense
        fallback={<p className="mt-6 text-sm text-zinc-500">Loading…</p>}
      >
        <ClaimKey />
      </Suspense>
    </div>
  );
}
