import { NextResponse } from "next/server";
import { sendTransactionalEmail } from "@/lib/email-service";
import { BasicTemplate } from "@/components/emails/basic-template";
import { render } from "@react-email/render";

const domain =
  process.env.NODE_ENV === "production"
    ? "https://app.playerscrm.com"
    : "http://app.localhost:3000";
const sign_in =
  process.env.NODE_ENV === "production"
    ? "https://app.playerscrm.com/login"
    : "http://app.localhost:3000/login";

/**
 * Invite person endpoint
 * Migrated to use unified email service
 */
export async function POST(req) {
  try {
    // Get body data
    const data = await req.json();
    const account = data?.account;
    const person = data?.person;
    const subject = data?.subject;
    const email = data?.email;
    const encryptedEmail = data?.encryptedEmail;
    
    const message = `You've been invited to join ${account.name} on PlayersCRM. If you have a PlayersCRM account please sign in at ${sign_in}. If you don't click this link to get access to your account. ${domain}/login?email=${encryptedEmail}&account_id=${account.id}&people_id=${person.id}&sign_up=true`;

    // Validation
    if (!person) {
      return NextResponse.json(
        { error: "Person is required" },
        { status: 400 }
      );
    }

    if (!account?.id) {
      return NextResponse.json(
        { error: "Account ID is required" },
        { status: 400 }
      );
    }

    // Determine recipient email
    let recipientEmail = email;
    if (!recipientEmail && person.primary_contacts && person.primary_contacts[0]) {
      recipientEmail = person.primary_contacts[0].email;
    }

    if (!recipientEmail) {
      return NextResponse.json(
        { error: "No email address found for recipient" },
        { status: 400 }
      );
    }

    // Determine sender
    const sender = account.senders?.[2]?.email
      ? `${account.name} <${account.senders[2].email}>`
      : account.senders?.[0]?.email
      ? `${account.name} <${account.senders[0].email}>`
      : null;

    if (!sender) {
      return NextResponse.json(
        { error: "No sender email configured for account" },
        { status: 400 }
      );
    }

    // Render email template
    const emailHtml = await render(
      BasicTemplate({ 
        message: message,
        account: account,
        preview: subject || `You're invited to join ${account.name}`,
      })
    );

    // Send via unified email service
    const result = await sendTransactionalEmail({
      sender,
      to: recipientEmail,
      subject: subject || `You're invited to join ${account.name}`,
      html: emailHtml,
      text: message,
      account_id: account.id,
      person_id: person.id,
      metadata: {
        type: "invite",
        encrypted_email: encryptedEmail,
      },
    });

    if (!result.success) {
      return NextResponse.json(
        { error: "Failed to send invite email", details: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.log("invite-person error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
