"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client"
import { useForm } from "react-hook-form";
import { v4 as uuidv4 } from "uuid";

const BasicEmailForm = ({
  accountId,
  title = "Subscribe and Stay Awhile",
  subtitle = "Subscribe to get notified of all my lastest videos, posts, and announcements",
  btnText = "Subscribe",
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [email, setEmail] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();
  const [currentUrl, setCurrentUrl] = useState("");

  const supabase = createClient();

  useEffect(() => {
    setCurrentUrl(window.location.href);
  }, []);

  const onSubmit = async (data) => {
    try {
      setIsSubmitting(true);

      setEmail(data.email);

      const { data: existingPerson, error: existingPersonError } =
        await supabase.from("people").select().eq("email", data.email).single();

      if (!existingPersonError && existingPerson) {
        setSubmitMessage("Email is already registered.");
      } else {
        const { data: formData, error: formError } = await supabase
          .from("people")
          .insert(
            [
              {
                account_id: accountId,
                email: data.email,
                email_confirmed: false,
              },
            ],
            { upsert: true },
          )
          .select("id")
          .single();

        if (formError) {
          throw formError;
        }

        // Dual-write: create account_people row
        if (formData?.id && accountId) {
          await supabase
            .from("account_people")
            .upsert(
              { account_id: accountId, person_id: formData.id },
              { onConflict: "account_id,person_id" }
            )
        }

        // generate a random code
        const { code, expirationDate } = getEmailConfirmData();

        const { data: emailData, error: emailError } = await supabase
          .from("email_confirm")
          .insert([
            {
              code: code,
              expiration_date: expirationDate.toISOString(),
              email: data.email,
            },
          ]);

        if (emailError) {
          console.log("emailError: ", JSON.stringify(emailError));
        }

        // send email
        const currentUrl = window.location.href;
        await sendEmailConfirmation(data.email, code, currentUrl);

        setSubmitMessage("Thank you! We send a confirmation email.");
      }
      reset();
    } catch (error) {
      setSubmitMessage(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  function getEmailConfirmData() {
    const code = uuidv4();
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 5);

    return { code, expirationDate };
  }

  async function sendEmailConfirmation(email, code, currentUrl) {
    return await fetch("/api/send-confirm-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        url: `${currentUrl}/api/confirm-email-callback?code=${code}`,
      }),
    });
  }

  return (
    <div className="h-full w-full">
      <h2 className="subtitle-sm mx-auto w-full text-center font-primary font-bold tracking-tight">
        {!email && !submitMessage && <span>{title}</span>}
        {email && <span>{submitMessage}</span>}
      </h2>
      {!email && !submitMessage && (
        <p className="mx-auto text-center font-secondary text-foreground">
          {subtitle}
        </p>
      )}
      {email && (
        <span className="mt-5 flex items-center justify-center rounded bg-zinc-700 px-3 py-2 first-letter:w-full">
          <span className="mx-auto max-w-xl text-center text-sm leading-6 text-gray-100">
            {isSubmitting ? "Submitting..." : email}
          </span>
        </span>
      )}

      {!email && (
        <>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="mx-auto mt-10 flex w-full max-w-md space-x-3"
            id="subscribe-form"
          >
            <div className="w-full">
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <input
                type="email"
                id="email"
                placeholder="Email Address"
                className="w-full flex-auto rounded border-0 bg-white/5 px-3.5 py-2 shadow-sm ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-inset focus:ring-black sm:text-sm sm:leading-6"
                {...register("email", { required: "Email is required" })}
              />
              {errors.email && <p>{errors.email.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded bg-primary px-3 py-2 text-primary-foreground"
            >
              {isSubmitting ? "Saving..." : btnText}
            </button>
          </form>
          {submitMessage && <p>{submitMessage}</p>}
        </>
      )}
    </div>
  );
};

export default BasicEmailForm;
