import ComingSoon from "@/components/shared/ComingSoon";

export const metadata = {
  title: "WhatsApp API Generation - Coming Soon | Soft7",
  description: "WhatsApp Business API key generation and token management portal",
};

export default function UserApiGenerationPage() {
  return (
    <ComingSoon
      badge="WhatsApp Messaging API"
      title="Coming Soon"
      description="We're currently building the API generation and token management portal. You will soon be able to generate API keys, associate WhatsApp phone numbers, and manage webhooks."
      backHref="/user/developers"
      backLabel="Back to Developer Resources"
      externalDocsHref="https://developers.facebook.com/docs/whatsapp"
      externalDocsLabel="Official WhatsApp API Docs"
    />
  );
}