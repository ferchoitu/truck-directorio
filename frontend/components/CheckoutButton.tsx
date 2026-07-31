"use client";

import { useCallback, useEffect, useState } from "react";

type PaddleEvent = { name?: string; data?: { transaction_id?: string } };

interface PaddleInstance {
  Environment: { set: (environment: string) => void };
  Initialize: (options: {
    token: string;
    eventCallback?: (event: PaddleEvent) => void;
  }) => void;
  Checkout: {
    open: (options: { items: { priceId: string; quantity: number }[] }) => void;
  };
}

declare global {
  interface Window {
    Paddle?: PaddleInstance;
  }
}

const TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
const ENVIRONMENT = process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT ?? "sandbox";
const PADDLE_SRC = "https://cdn.paddle.com/paddle/v2/paddle.js";

/**
 * Paddle.js must load and Initialize exactly once per page, no matter how many
 * checkout buttons are rendered.
 *
 * Using next/script inside the component looked fine with a single tier, but
 * Next dedupes <Script> by src: with three buttons only some onLoad callbacks
 * fire, leaving the rest stuck disabled. A module-scoped promise gives every
 * button the same instance instead.
 */
let paddleReady: Promise<PaddleInstance | null> | null = null;

function loadPaddle(): Promise<PaddleInstance | null> {
  if (paddleReady) return paddleReady;

  paddleReady = new Promise((resolve) => {
    if (!TOKEN) return resolve(null);
    if (window.Paddle) return resolve(window.Paddle);

    const script = document.createElement("script");
    script.src = PADDLE_SRC;
    script.async = true;
    script.onerror = () => resolve(null);
    script.onload = () => {
      const paddle = window.Paddle;
      if (!paddle) return resolve(null);
      // Paddle.js calls the live environment "production"; anything else is sandbox.
      if (ENVIRONMENT !== "production") {
        paddle.Environment.set("sandbox");
      }
      paddle.Initialize({
        token: TOKEN,
        eventCallback: (event) => {
          if (event.name === "checkout.completed") {
            const transactionId = event.data?.transaction_id;
            if (transactionId) {
              window.location.href = `/api-access/success?txn=${transactionId}`;
            }
          }
        },
      });
      resolve(paddle);
    };
    document.head.appendChild(script);
  });

  return paddleReady;
}

interface CheckoutButtonProps {
  label: string;
  /** Paddle price to check out. Absent means the tier is not configured yet. */
  priceId?: string;
  className?: string;
  /** Used until Paddle credentials are configured, so the CTA is never dead. */
  fallbackHref: string;
}

export default function CheckoutButton({
  label,
  priceId,
  className,
  fallbackHref,
}: CheckoutButtonProps) {
  const configured = Boolean(TOKEN && priceId);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    loadPaddle().then((paddle) => {
      if (active) setReady(Boolean(paddle));
    });
    return () => {
      active = false;
    };
  }, [configured]);

  const openCheckout = useCallback(() => {
    if (!priceId) return;
    window.Paddle?.Checkout.open({ items: [{ priceId, quantity: 1 }] });
  }, [priceId]);

  if (!configured) {
    return (
      <a href={fallbackHref} className={className}>
        {label}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={openCheckout}
      disabled={!ready}
      className={`${className ?? ""} disabled:opacity-60`}
    >
      {ready ? label : "Loading…"}
    </button>
  );
}
