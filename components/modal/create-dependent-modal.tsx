"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client"
import { useForm, useFieldArray } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";
import LoadingDots from "@/components/icons/loading-dots";
import { useModal } from "./provider";

export default function CreateDependentModal({
  person,
  dependent,
  modalUpdate,
}: {
  person: any;
  dependent?: boolean;
  modalUpdate?: any;
}) {
  const { push } = useRouter();
  const modal = useModal();
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data: any) => {
    const accountId = person?.accounts?.id || person?.account_id;

    // Create a new person
    const { data: newPerson, error: newPersonError } = await supabase
      .from("people")
      .insert([
        {
          account_id: accountId,
          name: `${data.first_name} ${data.last_name}`,
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone: data.phone,
          birthdate: data.birthdate === "" ? null : data.birthdate,
          grade: data.grade,
          dependent: dependent ? true : false,
        },
      ])
      .select("id")
      .single();

    if (newPersonError) {
      console.log("ADD DEPENDENT FORM ERRORS: ", newPersonError);
      return;
    }

    // Dual-write: create account_people row
    if (accountId && newPerson) {
      await supabase
        .from("account_people")
        .upsert(
          { account_id: accountId, person_id: newPerson.id },
          { onConflict: "account_id,person_id" }
        )
    }

    // Add guardians to the new person
    const { error: addRelationshipError } = await supabase
      .from("relationships")
      .insert([
        {
          person_id: person.id,
          relation_id: newPerson.id,
          name: "Parent",
          primary: true,
        },
      ]);

    if (addRelationshipError) {
      console.log("Failed to add relationship: ", addRelationshipError);
    }

    if (modalUpdate) modalUpdate(true);

    push(`/portal/${newPerson.id}`);
    modal?.hide();
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="w-full rounded-md bg-white dark:bg-black md:max-w-md md:border md:border-stone-200 md:shadow dark:md:border-stone-700"
    >
      <div className="relative flex flex-col space-y-4 p-5 md:p-10">
        <h2 className="font-cal text-2xl dark:text-white">New Dependant</h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-1 flex flex-col space-y-2">
            <label
              htmlFor="first_name"
              className="text-sm font-medium text-gray-700 dark:text-stone-300"
            >
              First Name*
            </label>
            <input
              type="text"
              id="first_name"
              className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600 focus:border-stone-300 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:focus:border-stone-300"
              {...register("first_name", { required: true })}
            />
            {errors.first_name && (
              <span className="text-sm text-red-500">
                This field is required
              </span>
            )}
          </div>

          <div className="col-span-1 flex flex-col space-y-2">
            <label
              htmlFor="last_name"
              className="text-sm font-medium text-gray-700 dark:text-stone-300"
            >
              Last Name*
            </label>
            <input
              type="text"
              id="last_name"
              className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600 focus:border-stone-300 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:focus:border-stone-300"
              {...register("last_name", { required: true })}
            />
            {errors.last_name && (
              <span className="text-sm text-red-500">
                This field is required
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col space-y-2">
          <label
            htmlFor="email"
            className="text-sm font-medium text-gray-700 dark:text-stone-300"
          >
            Email*
          </label>
          <input
            type="email"
            id="email"
            className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600 focus:border-stone-300 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:focus:border-stone-300"
            {...register("email", { required: false })}
          />
          {errors.email && (
            <span className="text-sm text-red-500">This field is required</span>
          )}
        </div>

        <div className="flex flex-col space-y-2">
          <label
            htmlFor="phone"
            className="text-sm font-medium text-gray-700 dark:text-stone-300"
          >
            Phone
          </label>
          <input
            type="text"
            id="phone"
            className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600 focus:border-stone-300 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:focus:border-stone-300"
            {...register("phone", { required: false })}
          />
          {errors.phone && (
            <span className="text-sm text-red-500">This field is required</span>
          )}
        </div>

        <div className="flex flex-col space-y-2">
          <label
            htmlFor="birthdate"
            className="text-sm font-medium text-gray-700 dark:text-stone-300"
          >
            Birthdate
          </label>
          <input
            type="date"
            id="birthdate"
            className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600 focus:border-stone-300 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:focus:border-stone-300"
            {...register("birthdate")}
          />
          {errors.birthdate && (
            <span className="text-sm text-red-500">This field is required</span>
          )}
        </div>

        <div className="flex flex-col space-y-2">
          <label
            htmlFor="grade"
            className="text-sm font-medium text-gray-700 dark:text-stone-300"
          >
            Grade (1 thru 12)
          </label>
          <select
            id="grade"
            className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600 focus:border-stone-300 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:focus:border-stone-300"
            {...register("grade")}
          >
            {[...Array(12)].map((_, i) => (
              <option key={i} value={i + 1}>
                {i + 1}
              </option>
            ))}
            <option value="Graduated">Graduated</option>
          </select>
          {errors.grade && (
            <span className="text-sm text-red-500">This field is required</span>
          )}
        </div>
      </div>
      <div className="flex items-center justify-end rounded-b-lg border-t border-stone-200 bg-stone-50 p-3 dark:border-stone-700 dark:bg-stone-800 md:px-10">
        <CreateSiteFormButton />
      </div>
    </form>
  );
}
function CreateSiteFormButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className={cn(
        "flex h-10 w-full items-center justify-center space-x-2 rounded-md border text-sm transition-all focus:outline-none",
        pending
          ? "cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300"
          : "border-black bg-black text-white hover:bg-white hover:text-black dark:border-stone-700 dark:hover:border-stone-200 dark:hover:bg-black dark:hover:text-white dark:active:bg-stone-800",
      )}
      disabled={pending}
    >
      {pending ? <LoadingDots color="#808080" /> : <p>Create Dependant</p>}
    </button>
  );
}
