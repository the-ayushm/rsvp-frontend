// /* eslint-disable @typescript-eslint/no-explicit-any */
// import { MessageService } from "../src/services/message.service";
// import { database } from "../src/lib/database";

// async function simulateMediaWebhook() {
//   console.log("🚀 Simulating Incoming Media Webhook...");

//   const payload = {
//     contacts: [{
//       wa_id: "919662065537",
//       profile: { name: "Harshul Patel" }
//     }],
//     messages: [{
//       id: "test_media_wamid_" + Date.now(),
//       from: "919662065537",
//       type: "image",
//       image: {
//         id: "2710933332574102",
//         mime_type: "image/jpeg",
//         sha256: "lxhTht4PoxZhQn6fkfjQ0aRHo0WAnHajDnkRiuDUQ7M=",
//         caption: "This is a test image caption"
//       },
//       timestamp: Math.floor(Date.now() / 1000).toString()
//     }],
//     metadata: {
//       phone_number_id: "233945809799030",
//       display_phone_number: "15551339735"
//     }
//   };

//   const message = payload.messages[0];
//   const contact = payload.contacts[0];
//   const metadata = payload.metadata;

//   try {
//     const acc = await database.whatsAppAccount.findFirst({
//       where: { phoneNumberId: metadata.phone_number_id }
//     });

//     if (!acc) {
//       console.error(
//         "❌ Error: No WhatsApp Account found with phoneNumberId " +
//         metadata.phone_number_id
//       );
//       process.exit(1);
//     }

//     const savedMsg = await MessageService.handleInbound(
//       message,
//       contact,
//       metadata
//     );

//     // ✅ TYPE GUARD (THIS FIXES THE BUILD)
//     if (!savedMsg) {
//       console.error("❌ Message was not saved");
//       return;
//     }

//     console.log("✅ Message processed!");
//     console.log("Stored Content:", savedMsg.content);
//     console.log("Media ID:", savedMsg.mediaUrl);
//     console.log("Caption:", savedMsg.caption);
//     console.log(
//       "Phone Number (Normalized):",
//       savedMsg.whatsappMessageId
//     );

//     const storedContact = await database.contact.findUnique({
//       where: { id: savedMsg.contactId }
//     });

//     console.log("Contact Phone:", storedContact?.phone);

//   } catch (error: any) {
//     console.error("❌ Simulation failed:", error.message);
//   } finally {
//     process.exit(0);
//   }
// }

// simulateMediaWebhook();
