import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Stripe from "stripe";
import { calculateApplicationFeeFromDollars } from "@/lib/fees";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await req.json();
    const { rsvp, profile, person, fee, account } = body;

    console.log("PROFILE IN CHECKOUT", profile);
    let customer = null;

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2023-08-16",
      stripeAccount: account.stripe_id,
    });

    // search for customer
    const { data: customerData } = await stripe.customers.list(
      {
        email: profile.people.email,
        limit: 1,
      },
      {
        stripeAccount: account.stripe_id,
      },
    );

    if (customerData.length > 0) {
      customer = customerData[0];

      // update customer object
      customer = await stripe.customers.update(
        customer.id,
        {
          phone: profile.people.phone,
        },
        {
          stripeAccount: account.stripe_id,
        },
      );
    } else {
      // Create a new customer object
      customer = await stripe.customers.create(
        {
          email: profile.people.email,
          name: profile.people.name,
          phone: profile.people.phone,
        },
        {
          stripeAccount: account.stripe_id,
        },
      );
    }

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*")
      .eq("rsvp_id", rsvp.id)
      .eq("account_id", account.id)
      .eq("person_id", person.id)
      .eq("profile_id", profile.id)
      .eq("fee_id", fee.id)
      .neq("status", "succeeded");

    if (paymentError) console.log("PAYERROR: ", paymentError);

    if (payment && payment.length === 0) {
      // Create a PaymentIntent with the customers amount and currency
      const applicationFeeAmount = calculateApplicationFeeFromDollars(
        fee.amount,
        account,
      );
      const paymentIntentParams: any = {
        amount: fee.amount * 100,
        customer: customer.id,
        currency: "usd",
        setup_future_usage: "off_session",
        receipt_email: profile.email,
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          fee_id: fee.id,
          rsvp_id: rsvp.id,
          profile_id: profile.id,
          person_id: person.id,
        },
      };
      if (account.stripe_id && applicationFeeAmount > 0) {
        paymentIntentParams.application_fee_amount = applicationFeeAmount;
      }
      const paymentIntent = account.stripe_id
        ? await stripe.paymentIntents.create(paymentIntentParams, {
            stripeAccount: account.stripe_id,
          })
        : await stripe.paymentIntents.create(paymentIntentParams);

      if (!paymentIntent) throw new Error("paymentIntent could not be created");

      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .insert([
          {
            account_id: account.id,
            person_id: person.id,
            profile_id: profile.id,
            payment_intent_id: paymentIntent.id,
            rsvp_id: rsvp.id,
            fee_id: fee.id,
            amount: fee.amount,
            status: "pending",
          },
        ])
        .select("*");

      if (paymentError) {
        console.log("SUPABASE PAYMENT ERROR", paymentError);
      }

      if (!payment) throw new Error("payment could not be created");

      const { error: rsvpError } = await supabase
        .from("rsvp")
        .update({ payments_id: payment[0].id })
        .eq("id", rsvp.id);

      if (rsvpError) console.log("SUPABASE rsvp update error", rsvpError);

      return NextResponse.json({ clientSecret: paymentIntent.client_secret });
    } else if (payment && payment.length > 0) {
      console.log("------------ found payment intent");

      const paymentIntent = await stripe.paymentIntents.retrieve(
        payment[0].payment_intent_id,
        {
          stripeAccount: account.stripe_id,
        },
      );
      if (!paymentIntent)
        throw new Error("paymentIntent could not be retrieved");
      console.log(paymentIntent, "<< payment intent");

      return NextResponse.json({ clientSecret: paymentIntent.client_secret });
    }

    return NextResponse.json({});
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message, customMessage: "Error on checkout" },
      {
        status: 400,
      },
    );
  }
}
