import type { TemplateFormState } from "@/features/templates/components/TemplateForm";

export type ExampleCollection = "UTILITY" | "TRENDING" | "GENERAL" | "TOP_RATED";

export type ExampleIndustry =
  | "ECOMMERCE"
  | "EDUCATION"
  | "BANKING"
  | "WEBINAR"
  | "HEALTH_CARE"
  | "AUTO_MOBILE"
  | "REAL_ESTATE"
  | "SERVICES"
  | "NON_PROFIT";

/** Theme color token (without the --color- prefix) used for the artwork gradient. */
export type ArtTone = "primary" | "success" | "warning" | "error" | "info" | "chart-2" | "chart-3" | "chart-4" | "chart-5";

export interface ExampleButton {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
  text: string;
  url?: string;
  phoneNumber?: string;
}

export interface ExampleTemplate {
  id: string;
  title: string;
  name: string;
  category: "MARKETING" | "UTILITY";
  collections: ExampleCollection[];
  industries: ExampleIndustry[];
  /** Artwork shown in place of the media header on the card. */
  art?: { emoji: string; label: string; tone: ArtTone };
  headerType: "NONE" | "TEXT" | "IMAGE";
  headerText?: string;
  body: string;
  bodyExamples: Record<string, string>;
  footer?: string;
  buttons: ExampleButton[];
}

export const EXAMPLE_COLLECTIONS: { value: ExampleCollection; label: string }[] = [
  { value: "TRENDING", label: "Trending" },
  { value: "GENERAL", label: "General" },
  { value: "TOP_RATED", label: "Top Rated" },
];

export const EXAMPLE_INDUSTRIES: { value: ExampleIndustry; label: string }[] = [
  { value: "ECOMMERCE", label: "Ecommerce" },
  { value: "EDUCATION", label: "Education" },
  { value: "BANKING", label: "Banking" },
  { value: "WEBINAR", label: "Webinar" },
  { value: "HEALTH_CARE", label: "Health Care" },
  { value: "AUTO_MOBILE", label: "Auto Mobile" },
  { value: "REAL_ESTATE", label: "Real Estate" },
  { value: "SERVICES", label: "Services" },
  { value: "NON_PROFIT", label: "Non Profit" },
];

const WEBSITE = "https://doveknot.in";

/** Shown first under the Utility filter: order and service updates. */
const UTILITY_TEMPLATES: ExampleTemplate[] = [
  {
    id: "utility-request-details",
    title: "Request Details",
    name: "request_details_update",
    category: "UTILITY",
    collections: ["UTILITY"],
    industries: ["SERVICES"],
    art: { emoji: "📋", label: "Your Details", tone: "info" },
    headerType: "IMAGE",
    body:
      "Hello Sir\n{{1}}\n\n{{2}}\n\n{{3}}\n\n{{4}}\n\n{{5}}\n\n{{6}}\n\n{{7}}\n\nYou can check the details below for your convenience.\n{{8}}\n\n🙂 Thanks for taking a moment to read this message.",
    bodyExamples: {
      "1": "Rahul Sharma", "2": "Request ID: REQ-1024", "3": "Service: AC Installation", "4": "Date: 12 March",
      "5": "Time: 11 AM", "6": "Technician: Amit", "7": "Status: Scheduled", "8": "doveknot.in/track/REQ-1024",
    },
    buttons: [
      { type: "QUICK_REPLY", text: "Thank You" },
      { type: "URL", text: "Visit Website", url: WEBSITE },
    ],
  },
  {
    id: "utility-product-details",
    title: "Product Details",
    name: "product_order_details",
    category: "UTILITY",
    collections: ["UTILITY"],
    industries: ["ECOMMERCE"],
    art: { emoji: "📦", label: "Order Details", tone: "warning" },
    headerType: "IMAGE",
    body:
      "Hi {{1}}, \n\nProduct Details {{2}}\n\n✅{{3}}\n\n✅{{4}}\n\n✅ your {{5}} details are attached. and thanks for your order",
    bodyExamples: { "1": "Priya", "2": "Order No. 45821", "3": "Wireless Earbuds x 1", "4": "Amount: Rs 1,499", "5": "invoice" },
    buttons: [
      { type: "QUICK_REPLY", text: "Track Order" },
      { type: "URL", text: "Visit Website", url: WEBSITE },
    ],
  },
  {
    id: "utility-service-subject",
    title: "Service Details",
    name: "service_details_subject",
    category: "UTILITY",
    collections: ["UTILITY"],
    industries: ["SERVICES"],
    art: { emoji: "📌", label: "Service Details", tone: "primary" },
    headerType: "IMAGE",
    body:
      "Respected {{1}},\n\n📌 Subject: {{2}}\n\nPlease find below the service details:\n ✅ {{3}}\n\n ✅ {{4}}\n\n ✅ {{5}}\n\nYour {{6}} details have been attached with this message. Thanks for your order",
    bodyExamples: {
      "1": "Mr. Mehta", "2": "Annual Maintenance Service", "3": "Plan: Premium AMC", "4": "Valid till: 31 Dec",
      "5": "Visits: 4 per year", "6": "service agreement",
    },
    buttons: [
      { type: "QUICK_REPLY", text: "Got It" },
      { type: "URL", text: "Visit Website", url: WEBSITE },
    ],
  },
  {
    id: "utility-service-update",
    title: "Service Update",
    name: "service_details_update",
    category: "UTILITY",
    collections: ["UTILITY"],
    industries: ["SERVICES"],
    art: { emoji: "🛠️", label: "Service Update", tone: "chart-2" },
    headerType: "IMAGE",
    body:
      "Hello {{1}},\n\n📌 Subject: {{2}}\n\nHere are your service details:\n\n ✅ {{3}}\n\n ✅ {{4}}\n\n ✅ {{5}}\n\n ✅ {{6}}\n Your {{7}} details are attached below.\n Thank you for giving us the opportunity to serve you.",
    bodyExamples: {
      "1": "Anjali", "2": "Website Development", "3": "Pages: 8", "4": "Delivery: 15 days",
      "5": "Support: 6 months", "6": "Hosting: Included", "7": "quotation",
    },
    buttons: [
      { type: "QUICK_REPLY", text: "Contact Support" },
      { type: "URL", text: "Visit Website", url: WEBSITE },
    ],
  },
  {
    id: "utility-package-included",
    title: "Package Details",
    name: "package_included_details",
    category: "UTILITY",
    collections: ["UTILITY"],
    industries: ["SERVICES"],
    art: { emoji: "🌸", label: "What's Included", tone: "chart-4" },
    headerType: "IMAGE",
    body:
      "Hi {{1}}, 🌸\n📌 {{2}}\nHere’s what’s included:\n✅ {{3}}\n✅ {{4}}\n✅ {{5}}\n✅ {{6}}\n✅ {{7}}\nYour {{8}} details are attached below.\nThank you for trusting DoveKnot Technology",
    bodyExamples: {
      "1": "Karan", "2": "WhatsApp Business API Plan", "3": "Green tick assistance", "4": "Unlimited broadcasts",
      "5": "Chatbot builder", "6": "Team inbox", "7": "Priority support", "8": "plan",
    },
    buttons: [
      { type: "QUICK_REPLY", text: "Thank You" },
      { type: "URL", text: "Visit Website", url: WEBSITE },
    ],
  },
  {
    id: "utility-request-status",
    title: "Request Status",
    name: "request_status_details",
    category: "UTILITY",
    collections: ["UTILITY"],
    industries: ["SERVICES"],
    art: { emoji: "🧾", label: "Request Status", tone: "success" },
    headerType: "IMAGE",
    body:
      "Hello\n{{1}}\nHere are the details related to your request:\n{{2}}\n{{3}}\n{{4}}\n{{5}}\n{{6}}\n{{7}}\nFor your convenience, you can check the complete details below.\n{{8}}\n🙂 Thank you.",
    bodyExamples: {
      "1": "Sneha", "2": "Ticket: TCK-7781", "3": "Issue: Login problem", "4": "Priority: High",
      "5": "Assigned to: Support Team", "6": "Raised on: 10 March", "7": "Status: In Progress", "8": "doveknot.in/ticket/TCK-7781",
    },
    buttons: [
      { type: "QUICK_REPLY", text: "Need Help" },
      { type: "URL", text: "Visit Website", url: WEBSITE },
    ],
  },
  {
    id: "utility-feedback",
    title: "Feedback Request",
    name: "service_feedback_request",
    category: "UTILITY",
    collections: ["UTILITY"],
    industries: ["SERVICES"],
    art: { emoji: "⭐", label: "Share Feedback", tone: "chart-5" },
    headerType: "IMAGE",
    body:
      "Hi {{1}},\n\n{{2}}\n\n{{3}}\n\n{{4}}\n{{5}}\n\n{{6}}\n\n{{7}}\n\n{{8}}\n\nWe value your feedback and would appreciate you sharing more about your experience with us at the below Number.",
    bodyExamples: {
      "1": "Vikram", "2": "Your service request has been completed.", "3": "Service: Laptop Repair", "4": "Technician: Rohit",
      "5": "Completed on: 14 March", "6": "Amount paid: Rs 1,200", "7": "Warranty: 90 days", "8": "Rate us from 1 to 5",
    },
    buttons: [
      { type: "PHONE_NUMBER", text: "Call Us", phoneNumber: "+919999999999" },
      { type: "URL", text: "Visit Website", url: WEBSITE },
    ],
  },
];

export const EXAMPLE_TEMPLATES: ExampleTemplate[] = [
  ...UTILITY_TEMPLATES,
  {
    id: "first-message",
    title: "First Message",
    name: "first_order_offer",
    category: "MARKETING",
    collections: ["TRENDING", "TOP_RATED"],
    industries: ["ECOMMERCE"],
    art: { emoji: "🛒", label: "Your First Order", tone: "warning" },
    headerType: "IMAGE",
    body:
      "The firsts are always special, like your first salary, your first car & your first date 😉\n\nDo you know what's special for us? *YOUR FIRST ORDER* 😍\n\nWe want to make it special for you too - Get a FLAT DISCOUNT of *{{1}}* on your first order worth *{{2}}* or more.\n\nUse code *{{3}}* at checkout.",
    bodyExamples: { "1": "50%", "2": "Rs 999", "3": "FIRST50" },
    buttons: [{ type: "PHONE_NUMBER", text: "Buy NOW", phoneNumber: "+919999999999" }],
  },
  {
    id: "offer-message",
    title: "Offer Message",
    name: "final_hours_offer",
    category: "MARKETING",
    collections: ["TRENDING", "GENERAL"],
    industries: ["ECOMMERCE", "SERVICES"],
    art: { emoji: "🎁", label: "Offer Ends Soon", tone: "error" },
    headerType: "IMAGE",
    body:
      "*Final Hours to Go ! Offer Ends Soon* 👋\n\n{{1}} Discount on Any purchase | It's Time to Action 💥\n\nUse Discount Code 👉 {{2}} & Get *{{1}} Discount* Expires Tonight ❗\n\n👉 {{3}}\n👉 Zero EMI\n👉 1 Year Warranty\n\nHappy Shopping 🥳🥳",
    bodyExamples: { "1": "20%", "2": "20OFF", "3": "FREE Delivery" },
    buttons: [{ type: "URL", text: "Buy Now", url: "https://example.com/shop" }],
  },
  {
    id: "event-invite",
    title: "Event Invite",
    name: "event_invite",
    category: "MARKETING",
    collections: ["TRENDING", "GENERAL"],
    industries: ["WEBINAR", "SERVICES"],
    art: { emoji: "🎉", label: "You're Invited", tone: "chart-4" },
    headerType: "IMAGE",
    body:
      "Dear {{1}},\n\n{{2}} is back with another {{3}} event for you.\n\nEvent Details:\nDate - {{4}}\nTime - {{5}}\nLocation - {{6}}\n\nHurry, click the below button.\n\nLooking forward to seeing you!",
    bodyExamples: {
      "1": "Ayush",
      "2": "DoveKnot",
      "3": "WhatsApp Marketing",
      "4": "3rd December",
      "5": "3 PM - 6 PM",
      "6": "Meta Headquarters, Gurugram",
    },
    buttons: [{ type: "URL", text: "Book your Slot", url: "https://example.com/event" }],
  },
  {
    id: "cod-to-prepaid",
    title: "C.O.D to Prepaid",
    name: "cod_to_prepaid",
    category: "MARKETING",
    collections: ["TRENDING", "TOP_RATED"],
    industries: ["ECOMMERCE"],
    art: { emoji: "💸", label: "Pay Now & Save", tone: "success" },
    headerType: "IMAGE",
    body:
      "Hey {{1}}, your order for *{{2}}* is confirmed 🎉\n\nPay Now & Get Flat *{{3}}* off on your purchase. 🤑\n\nClick the below link & apply Coupon Code {{4}} 👇",
    bodyExamples: { "1": "Preeti", "2": "Basshead 446", "3": "10%", "4": "PREPAID10" },
    buttons: [{ type: "URL", text: "Pay Now", url: "https://example.com/pay" }],
  },
  {
    id: "birthday-promotion",
    title: "Birthday Promotion",
    name: "birthday_promotion",
    category: "MARKETING",
    collections: ["TRENDING", "GENERAL"],
    industries: ["ECOMMERCE", "SERVICES"],
    art: { emoji: "🎂", label: "Happy Birthday", tone: "error" },
    headerType: "IMAGE",
    body:
      "Happy birthday, {{1}}! 🎂🎉\n\nTo help you celebrate, here's an exciting offer. 😍\n\nEnjoy {{2}} off storewide this month. Use discount code {{3}} to avail the offer.",
    bodyExamples: { "1": "Ayush", "2": "40%", "3": "BDAY40" },
    buttons: [{ type: "URL", text: "Avail Offer", url: "https://example.com/birthday" }],
  },
  {
    id: "loyalty-program",
    title: "Loyalty Program",
    name: "loyalty_program",
    category: "MARKETING",
    collections: ["TRENDING", "TOP_RATED"],
    industries: ["ECOMMERCE", "SERVICES"],
    art: { emoji: "🛍️", label: "Loyalty Program", tone: "chart-5" },
    headerType: "IMAGE",
    body:
      "Hey {{1}},\n\nWe just wanted to say thanks for being a valued customer for over {{2}}! 😊✨\n\nAs a token of appreciation, get *{{3}} off* on your next purchase with us. 😍\n\nWith Love, {{4}}",
    bodyExamples: { "1": "Shivam", "2": "3 years", "3": "50%", "4": "Headway India" },
    buttons: [{ type: "URL", text: "Buy Now", url: "https://example.com/loyalty" }],
  },
  {
    id: "limited-time-sale",
    title: "Limited Time Sale",
    name: "limited_time_sale",
    category: "MARKETING",
    collections: ["TRENDING"],
    industries: ["ECOMMERCE"],
    art: { emoji: "⏱️", label: "Limited Offer", tone: "error" },
    headerType: "IMAGE",
    body:
      "{{1}}, here's a special E-Gift Voucher for you 😍\n\nApplicable on minimum purchase of *{{2}}*.\n\nApply Coupon Code *{{3}}* and get Flat *{{4}}* off. 🔥\n\nValid for Today only. Hurry Up!! ⏳ T&C Apply*",
    bodyExamples: { "1": "Shivam", "2": "Rs 500", "3": "DISC40", "4": "40%" },
    buttons: [{ type: "URL", text: "Buy Now", url: "https://example.com/sale" }],
  },
  {
    id: "cross-sell",
    title: "Cross Sell Message",
    name: "cross_sell_offer",
    category: "MARKETING",
    collections: ["TRENDING", "GENERAL"],
    industries: ["ECOMMERCE"],
    art: { emoji: "📈", label: "Cross-Selling", tone: "warning" },
    headerType: "IMAGE",
    body:
      "Hey {{1}} 👋😇\n\n*{{2}}* will be delivered soon. 🚚\n\nJust had a thought that you might like *{{3}}* with it 😉. Here's a special offer so that you can enjoy your purchase. 😍\n\nUse Code *{{4}}* at the checkout.",
    bodyExamples: { "1": "Mitul", "2": "Headway Bassheads 225", "3": "Headway Bassbeats", "4": "DISC40" },
    buttons: [{ type: "URL", text: "Buy Now", url: "https://example.com/cross-sell" }],
  },
  {
    id: "property-promotion",
    title: "Property Promotion",
    name: "property_promotion",
    category: "MARKETING",
    collections: ["TRENDING", "TOP_RATED"],
    industries: ["REAL_ESTATE"],
    art: { emoji: "🏡", label: "Dream Homes", tone: "info" },
    headerType: "IMAGE",
    body:
      "Hey {{1}},\n\nDid you like {{2}}?\n\nGet more information about similar homes in {{3}} by clicking the button below 👇",
    bodyExamples: { "1": "Rishi", "2": "73/37, Golf Course Road", "3": "Golf Course Road" },
    buttons: [{ type: "URL", text: "View Property", url: "https://example.com/property" }],
  },
  {
    id: "site-visit",
    title: "Site Visit Reminder",
    name: "site_visit_reminder",
    category: "UTILITY",
    collections: ["GENERAL"],
    industries: ["REAL_ESTATE"],
    art: { emoji: "🏢", label: "Site Visit", tone: "chart-2" },
    headerType: "IMAGE",
    body:
      "Hi {{1}},\n\nThis is a reminder for your site visit to *{{2}}* on *{{3}}* at *{{4}}*.\n\nOur executive will meet you at the entrance. Reply below to confirm.",
    bodyExamples: { "1": "Rahul", "2": "Green Valley Towers", "3": "12th March", "4": "11 AM" },
    buttons: [
      { type: "QUICK_REPLY", text: "Confirm Visit" },
      { type: "QUICK_REPLY", text: "Reschedule" },
    ],
  },
  {
    id: "loan-approved",
    title: "Loan Approval",
    name: "loan_approved",
    category: "UTILITY",
    collections: ["GENERAL", "TOP_RATED"],
    industries: ["BANKING"],
    art: { emoji: "🏦", label: "Loan Approved", tone: "chart-5" },
    headerType: "IMAGE",
    body:
      "Congratulations {{1}}! 🎉\n\nYour {{2}} of *{{3}}* has been approved.\n\nThe amount will be credited to your account ending *{{4}}* within 24 hours.",
    bodyExamples: { "1": "Neha", "2": "Personal Loan", "3": "Rs 2,00,000", "4": "4521" },
    buttons: [{ type: "URL", text: "View Details", url: "https://example.com/loan" }],
  },
  {
    id: "emi-reminder",
    title: "EMI Reminder",
    name: "emi_payment_reminder",
    category: "UTILITY",
    collections: ["GENERAL"],
    industries: ["BANKING", "AUTO_MOBILE"],
    art: { emoji: "💳", label: "Payment Due", tone: "chart-4" },
    headerType: "IMAGE",
    body:
      "Dear {{1}},\n\nYour EMI of *{{2}}* for loan account *{{3}}* is due on *{{4}}*.\n\nPlease keep sufficient balance to avoid late charges.",
    bodyExamples: { "1": "Amit", "2": "Rs 8,450", "3": "XXXX7788", "4": "5th April" },
    buttons: [{ type: "URL", text: "Pay Now", url: "https://example.com/emi" }],
  },
  {
    id: "webinar-registration",
    title: "Webinar Registration",
    name: "webinar_registration",
    category: "MARKETING",
    collections: ["TRENDING", "TOP_RATED"],
    industries: ["WEBINAR", "EDUCATION"],
    art: { emoji: "💻", label: "Live Webinar", tone: "chart-2" },
    headerType: "IMAGE",
    body:
      "Hi {{1}} 👋\n\nJoin our free live webinar on *{{2}}* with {{3}}.\n\n📅 {{4}}\n⏰ {{5}}\n\nSeats are limited — register now!",
    bodyExamples: {
      "1": "Kavya",
      "2": "Growing Sales with WhatsApp",
      "3": "industry experts",
      "4": "20th November",
      "5": "6 PM IST",
    },
    buttons: [{ type: "URL", text: "Register Now", url: "https://example.com/webinar" }],
  },
  {
    id: "webinar-reminder",
    title: "Webinar Reminder",
    name: "webinar_reminder",
    category: "UTILITY",
    collections: ["GENERAL"],
    industries: ["WEBINAR"],
    art: { emoji: "⏰", label: "Starting Soon", tone: "chart-3" },
    headerType: "IMAGE",
    body:
      "Hi {{1}},\n\nYour webinar *{{2}}* starts in *{{3}}*.\n\nClick the button below to join the session.",
    bodyExamples: { "1": "Kavya", "2": "Growing Sales with WhatsApp", "3": "30 minutes" },
    buttons: [{ type: "URL", text: "Join Now", url: "https://example.com/join" }],
  },
  {
    id: "course-admission",
    title: "Admission Open",
    name: "admission_open",
    category: "MARKETING",
    collections: ["TRENDING", "GENERAL"],
    industries: ["EDUCATION"],
    art: { emoji: "🎓", label: "Admissions Open", tone: "chart-5" },
    headerType: "IMAGE",
    body:
      "Hello {{1}},\n\nAdmissions are now open for *{{2}}* at {{3}}! 📚\n\nGet an early-bird scholarship of *{{4}}* if you enroll before {{5}}.",
    bodyExamples: {
      "1": "Riya",
      "2": "Full Stack Development",
      "3": "DoveKnot Academy",
      "4": "25%",
      "5": "30th June",
    },
    buttons: [
      { type: "URL", text: "Apply Now", url: "https://example.com/apply" },
      { type: "PHONE_NUMBER", text: "Talk to Counsellor", phoneNumber: "+919999999999" },
    ],
  },
  {
    id: "fee-reminder",
    title: "Fee Reminder",
    name: "fee_reminder",
    category: "UTILITY",
    collections: ["GENERAL"],
    industries: ["EDUCATION"],
    art: { emoji: "📝", label: "Fee Reminder", tone: "chart-4" },
    headerType: "NONE",
    body:
      "Dear Parent,\n\nThis is a gentle reminder that the {{1}} fee of *{{2}}* for {{3}} is due on *{{4}}*.\n\nKindly ignore if already paid.",
    bodyExamples: { "1": "term", "2": "Rs 15,000", "3": "Aarav", "4": "10th July" },
    buttons: [{ type: "URL", text: "Pay Fees", url: "https://example.com/fees" }],
  },
  {
    id: "appointment-reminder",
    title: "Appointment Reminder",
    name: "appointment_reminder",
    category: "UTILITY",
    collections: ["GENERAL", "TOP_RATED"],
    industries: ["HEALTH_CARE", "SERVICES"],
    art: { emoji: "🩺", label: "Appointment", tone: "success" },
    headerType: "IMAGE",
    body:
      "Hi {{1}},\n\nYour appointment with *{{2}}* is scheduled for *{{3}}* at *{{4}}*.\n\nPlease arrive 10 minutes early. Reply below to confirm.",
    bodyExamples: { "1": "Sanjay", "2": "Dr. Mehta", "3": "15th May", "4": "10:30 AM" },
    buttons: [
      { type: "QUICK_REPLY", text: "Confirm" },
      { type: "QUICK_REPLY", text: "Reschedule" },
    ],
  },
  {
    id: "health-checkup",
    title: "Health Checkup Offer",
    name: "health_checkup_offer",
    category: "MARKETING",
    collections: ["TRENDING"],
    industries: ["HEALTH_CARE"],
    art: { emoji: "❤️", label: "Full Body Checkup", tone: "error" },
    headerType: "IMAGE",
    body:
      "Hi {{1}} 👋\n\nYour health matters! Book a *{{2}}* at just *{{3}}* this month.\n\n✅ 60+ tests\n✅ Free home sample collection\n✅ Reports in 24 hrs",
    bodyExamples: { "1": "Pooja", "2": "Full Body Checkup", "3": "Rs 999" },
    buttons: [{ type: "URL", text: "Book Now", url: "https://example.com/checkup" }],
  },
  {
    id: "car-service",
    title: "Service Due Reminder",
    name: "vehicle_service_due",
    category: "UTILITY",
    collections: ["GENERAL"],
    industries: ["AUTO_MOBILE"],
    art: { emoji: "🚗", label: "Service Due", tone: "info" },
    headerType: "IMAGE",
    body:
      "Hi {{1}},\n\nYour {{2}} ({{3}}) is due for its next service on *{{4}}*.\n\nBook your slot now and get a free car wash! 🚿",
    bodyExamples: { "1": "Vikram", "2": "Hyundai Creta", "3": "DL 01 AB 1234", "4": "22nd August" },
    buttons: [{ type: "URL", text: "Book Service", url: "https://example.com/service" }],
  },
  {
    id: "test-drive",
    title: "Test Drive Invite",
    name: "test_drive_invite",
    category: "MARKETING",
    collections: ["TRENDING", "TOP_RATED"],
    industries: ["AUTO_MOBILE"],
    art: { emoji: "🏎️", label: "Book a Test Drive", tone: "chart-3" },
    headerType: "IMAGE",
    body:
      "Hey {{1}} 🚘\n\nThe all-new *{{2}}* is here!\n\nBook a test drive at your nearest showroom and get assured gifts worth *{{3}}*.",
    bodyExamples: { "1": "Arjun", "2": "Tata Nexon EV", "3": "Rs 5,000" },
    buttons: [{ type: "URL", text: "Book Test Drive", url: "https://example.com/test-drive" }],
  },
  {
    id: "order-confirmation",
    title: "Order Confirmation",
    name: "order_confirmation",
    category: "UTILITY",
    collections: ["GENERAL", "TOP_RATED"],
    industries: ["ECOMMERCE"],
    art: { emoji: "📦", label: "Order Confirmed", tone: "success" },
    headerType: "NONE",
    body:
      "Hi {{1}}, thank you for your order! 🙏\n\nOrder ID: *{{2}}*\nAmount: *{{3}}*\n\nWe'll notify you once it's shipped.",
    bodyExamples: { "1": "Meera", "2": "#SO7-10234", "3": "Rs 1,499" },
    buttons: [{ type: "URL", text: "Track Order", url: "https://example.com/track" }],
  },
  {
    id: "feedback-request",
    title: "Feedback Request",
    name: "feedback_request",
    category: "MARKETING",
    collections: ["GENERAL"],
    industries: ["SERVICES", "ECOMMERCE", "HEALTH_CARE"],
    art: { emoji: "⭐", label: "Rate Us", tone: "warning" },
    headerType: "NONE",
    body:
      "Hi {{1}},\n\nThank you for choosing {{2}}! How was your experience with us?\n\nYour feedback helps us serve you better. 😊",
    bodyExamples: { "1": "Karan", "2": "DoveKnot" },
    buttons: [
      { type: "QUICK_REPLY", text: "Loved it 😍" },
      { type: "QUICK_REPLY", text: "It was okay" },
      { type: "QUICK_REPLY", text: "Not happy" },
    ],
  },
  {
    id: "donation-appeal",
    title: "Donation Appeal",
    name: "donation_appeal",
    category: "MARKETING",
    collections: ["TRENDING", "GENERAL"],
    industries: ["NON_PROFIT"],
    art: { emoji: "🤝", label: "Support a Cause", tone: "error" },
    headerType: "IMAGE",
    body:
      "Dear {{1}},\n\nYour small contribution can help *{{2}}* get {{3}} this season. 💛\n\nEvery donation of {{4}} makes a difference.",
    bodyExamples: { "1": "Ananya", "2": "100 children", "3": "school supplies", "4": "Rs 500" },
    buttons: [{ type: "URL", text: "Donate Now", url: "https://example.com/donate" }],
  },
  {
    id: "volunteer-thanks",
    title: "Volunteer Thank You",
    name: "volunteer_thank_you",
    category: "UTILITY",
    collections: ["GENERAL"],
    industries: ["NON_PROFIT"],
    art: { emoji: "🌱", label: "Thank You", tone: "primary" },
    headerType: "NONE",
    body:
      "Hi {{1}},\n\nThank you for volunteering at *{{2}}* on {{3}}. 🙌\n\nTogether we reached {{4}} people. See you at the next drive!",
    bodyExamples: { "1": "Ishaan", "2": "Clean City Drive", "3": "Sunday", "4": "1,200" },
    buttons: [],
  },
];

/** Body text with {{n}} swapped for its sample value wrapped in brackets, e.g. "[Ayush]". */
export function renderExampleBody(template: ExampleTemplate): string {
  return template.body.replace(/\{\{([^}]+)\}\}/g, (match, key: string) => {
    const value = template.bodyExamples[key.trim()];
    return value ? `[${value}]` : match;
  });
}

/** Form state used to prefill the create-template screen from an example. */
export function exampleToFormState(template: ExampleTemplate): TemplateFormState {
  return {
    name: template.name,
    category: template.category,
    language: "en_US",
    headerType: template.headerType,
    headerText: template.headerText ?? "",
    bodyText: template.body,
    footerText: template.footer ?? "",
    buttons: template.buttons.map((b) => ({ ...b })),
    whatsappAccountId: null,
    whatsappPhoneNumberId: null,
    bodyExamples: { ...template.bodyExamples },
    headerExamples: {},
    buttonExamples: {},
    variableFormat: "positional",
    addSecurityRecommendation: true,
    addExpiration: false,
    expirationMinutes: 10,
    authButtonType: "COPY_CODE",
    authAutofillText: "Autofill",
    authCopyCodeText: "Copy Code",
    authZeroTapTermsAccepted: false,
  };
}

/** sessionStorage key used to hand an example template to the create screen. */
export const TEMPLATE_DRAFT_STORAGE_KEY = "soft7:template-draft";
