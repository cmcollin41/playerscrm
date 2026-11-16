import { NextResponse, NextRequest } from "next/server";
import { stripe } from "@/lib/stripe";
import { requireAccountAdminApi } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const auth = await requireAccountAdminApi();
  if (!auth.ok) return auth.response;
  const body = await req.json();
  try {
    const response = await stripe.oauth.token({
      grant_type: "authorization_code",
      code: body.code,
    });

    const connected_account_id = response.stripe_user_id;

    return NextResponse.json({ connected_account_id });
  } catch (error) {
    return NextResponse.json(
      { error },
      {
        status: 400,
      },
    );
  }
}
