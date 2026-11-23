/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, Crown, Zap, Star, X } from "lucide-react";
import Link from "next/link";
import { soft7AxiosInstance } from "@/lib/axiosInstance";

interface SubscriptionPlan {
  type: string;
  name: string;
  price: number;
  validity: number;
  features: string[];
  recommended?: boolean;
}

interface UserData {
  id: string;
  name: string;
  email: string;
  isPremium: boolean;
  subscriptionPlan?: string;
  subscriptionEnd?: string;
}

const plans: SubscriptionPlan[] = [
  {
    type: "starter",
    name: "Starter",
    price: 999,
    validity: 30,
    features: [
      "Up to 1,000 contacts",
      "5 campaigns/month",
      "Basic analytics",
      "Email support",
      "WhatsApp integration",
    ],
  },
  {
    type: "professional",
    name: "Professional",
    price: 2999,
    validity: 30,
    features: [
      "Up to 10,000 contacts",
      "Unlimited campaigns",
      "Advanced analytics",
      "Priority support",
      "WhatsApp + SMS integration",
      "Custom workflows",
      "Team collaboration",
    ],
    recommended: true,
  },
  {
    type: "enterprise",
    name: "Enterprise",
    price: 9999,
    validity: 30,
    features: [
      "Unlimited contacts",
      "Unlimited campaigns",
      "Real-time analytics",
      "24/7 dedicated support",
      "All integrations",
      "Advanced workflows",
      "Multi-team management",
      "Custom development",
      "SLA guarantee",
    ],
  },
];

export default function SubscriptionPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("user_data");
    if (savedUser) {
      try {
        setUserData(JSON.parse(savedUser));
      } catch (error) {
        console.error("Error parsing user_data from localStorage:", error);
      }
    }
    setLoading(false);
  }, []);

  const loadRazorpayScript = () => {
    return new Promise<boolean>((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    try {
      setProcessingPlan(plan.type);

      // Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Failed to load payment gateway");
      }

      // Create order
      const orderResponse = await fetch("/api/user/subscription/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType: plan.type }),
        credentials: "include",
      });

      if (!orderResponse.ok) {
        throw new Error("Failed to create order");
      }

      const orderData = await orderResponse.json();

      // Initialize Razorpay
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        order_id: orderData.orderId,
        name: "WhatsApp Dashboard",
        description: `${plan.name} Plan Subscription`,
        prefill: {
          name: orderData.userDetails.name,
          email: orderData.email,
          contact: orderData.contact,
        },
        handler: async (response: any) => {
          try {
            // Verify payment
            const verifyResponse = await fetch(
              "/api/user/subscription/verify",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                }),
                credentials: "include",
              }
            );

            if (verifyResponse.ok) {
              console.log("Success brother");
              const result = await verifyResponse.json();
              alert("Subscription activated successfully!");
              // Refresh user data (Local API removed)
              // Optionally fetch updated info from ngrok API and update localStorage
              await soft7AxiosInstance.post("/api/auth/refresh", {}, { withCredentials: true });
              router.push("/user/dashboard");
            } else {
              throw new Error("Payment verification failed");
            }
          } catch (error) {
            console.error("Payment verification error:", error);
            alert("Payment verification failed. Please contact support.");
            setProcessingPlan(null);
          }
        },
        modal: {
          ondismiss: () => {
            setProcessingPlan(null);
          },
        },
      };

      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();
    } catch (error) {
      console.error("Subscription error:", error);
      alert(
        error instanceof Error ? error.message : "Failed to process subscription"
      );
      setProcessingPlan(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading subscription plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/user/dashboard" className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-primary-text" />
            <span className="font-bold text-white text-xl">WA Dashboard</span>
          </Link>
          <Link
            href="/user/dashboard"
            className="text-muted-foreground hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Choose the perfect plan for your business needs
          </p>

          {/* Current Subscription Status */}
          {userData?.isPremium && (
            <div className="inline-block bg-[var(--color-success-light)]0/10 border border-primary rounded-lg px-6 py-3 mb-8">
              <p className="text-primary-text font-semibold">
                ✓ Currently subscribed to {userData.subscriptionPlan} plan
                {userData.subscriptionEnd && (
                  <span className="text-primary-text ml-2">
                    (Expires:{" "}
                    {new Date(userData.subscriptionEnd).toLocaleDateString()})
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.type}
              className={`relative rounded-2xl border transition-all duration-300 ${
                plan.recommended
                  ? "border-primary bg-surface shadow-xl md:scale-105 md:z-10"
                  : "border-border bg-surface hover:border-border-strong"
              }`}
            >
              {plan.recommended && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-[var(--color-primary)] text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    Recommended
                  </span>
                </div>
              )}

              <div className="p-8">
                {/* Plan Name */}
                <div className="flex items-center gap-2 mb-4">
                  {plan.type === "starter" && (
                    <Zap className="h-6 w-6 text-info" />
                  )}
                  {plan.type === "professional" && (
                    <Crown className="h-6 w-6 text-warning" />
                  )}
                  {plan.type === "enterprise" && (
                    <Star className="h-6 w-6 text-primary-text" />
                  )}
                  <h3 className="text-2xl font-bold text-white">
                    {plan.name}
                  </h3>
                </div>

                {/* Price */}
                <div className="mb-6">
                  <span className="text-5xl font-bold text-white">
                    ₹{plan.price}
                  </span>
                  <p className="text-muted-foreground text-sm mt-2">
                    per month for {plan.validity} days
                  </p>
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => handleSubscribe(plan)}
                  disabled={processingPlan !== null}
                  className={`w-full py-3 rounded-lg font-semibold mb-8 transition-all ${
                    plan.recommended
                      ? "bg-[var(--color-primary)] hover:bg-[var(--color-primary)] text-primary-foreground"
                      : "bg-surface-active hover:bg-surface-hover text-foreground"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {processingPlan === plan.type ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Processing...
                    </span>
                  ) : userData?.subscriptionPlan === plan.type &&
                    userData?.isPremium ? (
                    "Current Plan"
                  ) : (
                    `Subscribe to ${plan.name}`
                  )}
                </button>

                {/* Features */}
                <div className="space-y-4">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary-text shrink-0 mt-0.5" />
                      <span className="text-disabled-foreground">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto mt-16">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <div className="bg-surface border border-border rounded-lg p-6">
              <h4 className="text-lg font-semibold text-white mb-2">
                Can I upgrade or downgrade my plan?
              </h4>
              <p className="text-muted-foreground">
                Yes, you can upgrade or downgrade your plan anytime. Changes
                will take effect from your next billing cycle.
              </p>
            </div>
            <div className="bg-surface border border-border rounded-lg p-6">
              <h4 className="text-lg font-semibold text-white mb-2">
                What payment methods do you accept?
              </h4>
              <p className="text-muted-foreground">
                We accept all major credit and debit cards, UPI, and digital
                wallets via Razorpay.
              </p>
            </div>
            <div className="bg-surface border border-border rounded-lg p-6">
              <h4 className="text-lg font-semibold text-white mb-2">
                Is there a free trial?
              </h4>
              <p className="text-muted-foreground">
                Contact our sales team to discuss custom trial options for your
                organization.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
