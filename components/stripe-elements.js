"use client";
import { useEffect, useState } from "react";
import {
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import LoadingDots from "@/components/icons/loading-dots";

export const StripeElements = ({ modal, fee, person }) => {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [message, setMessage] = useState({});
  const [paymentError, setPaymentError] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!stripe) return;

    const clientSecret = new URLSearchParams(window.location.search).get(
      "payment_intent_client_secret",
    );

    if (!clientSecret) return;

    stripe
      .retrievePaymentIntent(clientSecret)
      .then(({ paymentIntent }) => {
        if (paymentIntent.status === "succeeded") {
          setMessage({ type: "success", text: "Payment succeeded!" });
        } else if (paymentIntent.status === "processing") {
          setMessage({ type: "info", text: "Your payment is processing." });
        } else if (paymentIntent.status === "requires_payment_method") {
          setMessage({
            type: "error",
            text: "Your payment was not successful, please try again.",
          });
        } else {
          setMessage({ type: "error", text: "Something went wrong." });
        }
      })
      .catch((e) => {
        console.log(e);
        if (e.type === "StripeCardError") {
          stripe.charges
            .retrieve(e.payment_intent.latest_charge)
            .then((charge) => {
              if (charge.outcome.type === "blocked") {
                console.log("Payment blocked for suspected fraud.");
              } else if (e.code === "card_declined") {
                console.log("Payment declined by the issuer.");
              } else if (e.code === "expired_card") {
                console.log("Card expired.");
              } else {
                console.log("Other card error.");
              }
            });
        }
      });
  }, [stripe]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setMessage(null);
    setPaymentError(null);

    const paymentElement = elements.getElement(PaymentElement);
    const { error } = paymentElement.update();

    if (error) {
      setPaymentError(error.message);
      return;
    }

    setIsLoading(true);

    const confirmError = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: {
        return_url: "https://app.playerscrm.com",
      },
    });

    if (confirmError.error) {
      setMessage({ type: "error", text: confirmError.error.message });
      toast.success(confirmError.error.message);
    } else {
      setMessage({ type: "success", text: "Payment succeeded!" });
      setPaymentSuccess(true);
      // router.refresh();
      router.push("/portal/thank-you");
      modal.show(<LoadingDots color="#080808" />);
      toast.success("Payment successful!");
    }

    setIsLoading(false);
  };

  const paymentElementOptions = {
    layout: "tabs",
  };

  return (
    <form id="payment-form" onSubmit={handleSubmit}>
      {message && message.text && (
        <div
          id="message"
          className={`mb-5 rounded bg-${
            message.type === "error" ? "red-50" : "green-50"
          } border border-${
            message.type === "error" ? "red-100" : "green-100"
          } p-2 text-center text-${
            message.type === "error" ? "red-500" : "green-500"
          }`}
        >
          {message.text}
        </div>
      )}
      {paymentError && (
        <div id="payment-errors" className="text-red-500">
          {paymentError}
        </div>
      )}
      <PaymentElement id="payment-element" options={paymentElementOptions} />
      <div className="fixed inset-x-0 bottom-0 flex items-center justify-between border-t border-gray-200 bg-white p-5 shadow-sm">
        <div>
          <h3 className="text-base font-bold md:text-xl">{fee?.name}</h3>
          <span className="text-base font-light">{person?.name}</span>
        </div>

        <button
          disabled={isLoading || !stripe || !elements}
          id="submit"
          type="submit"
          className="rounded bg-black px-5 py-2 text-white"
        >
          <span id="button-text" className="whitespace-nowrap text-xl">
            {isLoading ? "Submitting..." : `Pay $${fee?.amount}`}
          </span>
        </button>
      </div>
    </form>
  );
};
