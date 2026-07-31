"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// The webhook that provisions the subscription can land a moment after checkout.
const RETRY_LIMIT = 5;
const RETRY_DELAY_MS = 2000;

type State =
  | { status: "loading" }
  | { status: "ready"; apiKey: string; quota: number }
  | { status: "error"; message: string };

export default function ClaimKey() {
  const params = useSearchParams();
  const transactionId = params.get("txn");
  const [state, setState] = useState<State>({ status: "loading" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!transactionId) {
      setState({
        status: "error",
        message: "This link is missing its transaction reference.",
      });
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function claim(attempt: number): Promise<void> {
      try {
        const response = await fetch(`${API_URL}/api/billing/claim`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transaction_id: transactionId }),
        });

        if (response.status === 409 && attempt < RETRY_LIMIT) {
          timer = setTimeout(() => claim(attempt + 1), RETRY_DELAY_MS);
          return;
        }

        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.detail ?? "We could not issue your API key.");
        }
        if (!cancelled) {
          setState({
            status: "ready",
            apiKey: data.api_key,
            quota: data.monthly_quota,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "We could not issue your API key.",
          });
        }
      }
    }

    claim(0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [transactionId]);

  const copy = useCallback(() => {
    if (state.status !== "ready") return;
    navigator.clipboard.writeText(state.apiKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [state]);

  if (state.status === "loading") {
    return (
      <p className="mt-6 text-sm text-zinc-500">
        Confirming your subscription and issuing your key…
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
        <p className="text-sm font-medium text-zinc-900">{state.message}</p>
        <p className="mt-2 text-sm text-zinc-600">
          If you were charged, email{" "}
          <a
            className="font-semibold text-lime-700 underline"
            href="mailto:nuclealabs@gmail.com?subject=YoTruck%20API%20key"
          >
            nuclealabs@gmail.com
          </a>{" "}
          and we will sort it out.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="rounded-xl border border-lime-400 bg-white p-5">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-500">
          Your API key
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <code className="flex-1 overflow-x-auto rounded-lg bg-zinc-950 px-4 py-3 font-mono text-sm text-lime-300">
            {state.apiKey}
          </code>
          <button
            type="button"
            onClick={copy}
            className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="mt-4 text-sm text-zinc-600">
          Copy it now — this is the only time it is shown. We store only a hash, so
          it cannot be recovered later. Reloading this page issues a{" "}
          <em>new</em> key and retires this one.
        </p>
      </div>

      <div className="mt-6">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-500">
          First call
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-zinc-100">
          {`curl -H "Authorization: Bearer ${state.apiKey}" \\
  "${API_URL}/api/v1/carriers/86876/safety"`}
        </pre>
        <p className="mt-3 text-sm text-zinc-600">
          Your plan includes {state.quota.toLocaleString()} requests per month.
          Check consumption any time at{" "}
          <code className="font-mono text-xs">/api/v1/usage</code>.
        </p>
      </div>
    </div>
  );
}
