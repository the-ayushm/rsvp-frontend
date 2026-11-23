/*
 * Pre-approved chatbot flow templates.
 *
 * There is no backend API for templates yet, so the service functions below
 * resolve mock data. When the API is ready, replace the bodies of
 * fetchChatbotTemplateCategories / fetchChatbotTemplates with
 * soft7AxiosInstance calls - the UI only depends on these types.
 */

export type TemplateBadgeTone = "primary" | "info" | "success" | "warning";

export type TemplateFeature = {
  icon: string;
  label: string;
};

export type TemplateFlowStep = {
  type: "trigger" | "message" | "buttons" | "list" | "input" | "action";
  title: string;
  content: string;
  options?: string[];
};

export type TemplateDemoMessage = {
  from: "bot" | "user";
  text: string;
  options?: string[];
};

export type ChatbotTemplate = {
  id: string;
  name: string;
  subtitle: string;
  category: string;
  badge: string;
  badgeTone: TemplateBadgeTone;
  impact: number;
  impactLabel: string;
  description: string;
  tags: string[];
  features: TemplateFeature[];
  flow: TemplateFlowStep[];
  demo: TemplateDemoMessage[];
};

export type TemplateCategory = {
  id: string;
  label: string;
};

const CATEGORIES: TemplateCategory[] = [
  { id: "ecommerce", label: "Ecommerce" },
  { id: "education", label: "Education" },
  { id: "automotive", label: "Automotive" },
  { id: "it-services", label: "IT Services" },
  { id: "real-estate", label: "Real Estate" },
  { id: "saas", label: "SAAS/Apps" },
  { id: "gaming", label: "Gaming" },
  { id: "healthcare", label: "Healthcare" },
  { id: "travel", label: "Travel" },
  { id: "finance", label: "Finance" },
];

const TEMPLATES: ChatbotTemplate[] = [
  {
    id: "tech-support-assistant",
    name: "Tech Support Assistant",
    subtitle: "Increase Customer Support",
    category: "it-services",
    badge: "Support",
    badgeTone: "primary",
    impact: 45,
    impactLabel: "Increase Customer Support",
    description:
      "This bot helps to resolve customer queries and get IT Support services and resolves them",
    tags: ["IT", "Technology", "Support"],
    features: [
      { icon: "headset", label: "Live Support" },
      { icon: "bug", label: "Report Issue" },
      { icon: "settings", label: "Quick Fix" },
    ],
    flow: [
      { type: "trigger", title: "Trigger", content: "Customer sends \"Hi\", \"Help\" or \"Support\"" },
      {
        type: "buttons",
        title: "Welcome menu",
        content: "Hi! I'm your tech support assistant. How can I help you today?",
        options: ["Live Support", "Report Issue", "Quick Fix"],
      },
      { type: "input", title: "Collect issue", content: "Please describe the issue you are facing." },
      { type: "action", title: "Create ticket", content: "Ticket is created and the ticket number is shared." },
      { type: "message", title: "Handover", content: "Connecting you to a support agent..." },
    ],
    demo: [
      { from: "user", text: "Hi" },
      {
        from: "bot",
        text: "Hi! I'm your tech support assistant. How can I help you today?",
        options: ["Live Support", "Report Issue", "Quick Fix"],
      },
      { from: "user", text: "Report Issue" },
      { from: "bot", text: "Please describe the issue you are facing." },
      { from: "user", text: "My laptop is not connecting to Wi-Fi" },
      { from: "bot", text: "Thanks! Ticket #TS-1042 has been created. An engineer will reach out within 30 minutes." },
    ],
  },
  {
    id: "real-estate-helper",
    name: "Real Estate Helper",
    subtitle: "Improve buyer engagement",
    category: "real-estate",
    badge: "High Impact",
    badgeTone: "success",
    impact: 45,
    impactLabel: "Improve buyer engagement",
    description: "Assist buyers with property search",
    tags: ["Property", "Real Estate"],
    features: [
      { icon: "home", label: "Property Search" },
      { icon: "search", label: "Shortlist" },
      { icon: "phone", label: "Callback" },
    ],
    flow: [
      { type: "trigger", title: "Trigger", content: "Customer sends \"Property\" or clicks an ad" },
      {
        type: "buttons",
        title: "Looking for",
        content: "Are you looking to buy or rent?",
        options: ["Buy", "Rent"],
      },
      {
        type: "list",
        title: "Budget",
        content: "Select your budget range",
        options: ["Under 50L", "50L - 1Cr", "1Cr+"],
      },
      { type: "input", title: "Location", content: "Which area are you interested in?" },
      { type: "action", title: "Request callback", content: "Lead is saved and an agent callback is scheduled." },
    ],
    demo: [
      { from: "user", text: "Property" },
      { from: "bot", text: "Welcome! Are you looking to buy or rent?", options: ["Buy", "Rent"] },
      { from: "user", text: "Buy" },
      { from: "bot", text: "Great! Select your budget range", options: ["Under 50L", "50L - 1Cr", "1Cr+"] },
      { from: "user", text: "50L - 1Cr" },
      { from: "bot", text: "We found 12 properties for you. An agent will call you shortly to shortlist the best ones." },
    ],
  },
  {
    id: "real-estate-virtual-tour",
    name: "Real Estate Virtual Tour",
    subtitle: "Better property discovery",
    category: "real-estate",
    badge: "Useful",
    badgeTone: "info",
    impact: 44,
    impactLabel: "Better property discovery",
    description: "Book virtual tours",
    tags: ["Real Estate", "Tour"],
    features: [
      { icon: "building", label: "Property List" },
      { icon: "video", label: "Virtual Tour" },
      { icon: "calendar", label: "Book Slot" },
    ],
    flow: [
      { type: "trigger", title: "Trigger", content: "Customer sends \"Tour\"" },
      { type: "list", title: "Property list", content: "Choose a property", options: ["2BHK Andheri", "3BHK Powai", "Villa Lonavala"] },
      { type: "buttons", title: "Tour type", content: "How would you like to see it?", options: ["Virtual Tour", "Site Visit"] },
      { type: "list", title: "Book slot", content: "Pick a time slot", options: ["Today 5 PM", "Tomorrow 11 AM", "Tomorrow 4 PM"] },
      { type: "message", title: "Confirmation", content: "Your tour is booked! You will receive the link 10 minutes before." },
    ],
    demo: [
      { from: "user", text: "Tour" },
      { from: "bot", text: "Choose a property", options: ["2BHK Andheri", "3BHK Powai", "Villa Lonavala"] },
      { from: "user", text: "3BHK Powai" },
      { from: "bot", text: "How would you like to see it?", options: ["Virtual Tour", "Site Visit"] },
      { from: "user", text: "Virtual Tour" },
      { from: "bot", text: "Your virtual tour is booked for Tomorrow 11 AM. You will receive the link 10 minutes before." },
    ],
  },
  {
    id: "order-tracking",
    name: "Order Tracking Bot",
    subtitle: "Reduce support tickets",
    category: "ecommerce",
    badge: "Popular",
    badgeTone: "primary",
    impact: 52,
    impactLabel: "Fewer \"where is my order\" queries",
    description: "Let customers track orders, request returns and get delivery updates instantly",
    tags: ["Orders", "Shipping"],
    features: [
      { icon: "package", label: "Track Order" },
      { icon: "rotate", label: "Returns" },
      { icon: "truck", label: "Delivery" },
    ],
    flow: [
      { type: "trigger", title: "Trigger", content: "Customer sends \"Order\" or \"Track\"" },
      { type: "buttons", title: "Menu", content: "What would you like to do?", options: ["Track Order", "Return", "Talk to us"] },
      { type: "input", title: "Order ID", content: "Please share your order ID" },
      { type: "action", title: "Fetch status", content: "Order status is fetched and shared with the customer." },
    ],
    demo: [
      { from: "user", text: "Track" },
      { from: "bot", text: "What would you like to do?", options: ["Track Order", "Return", "Talk to us"] },
      { from: "user", text: "Track Order" },
      { from: "bot", text: "Please share your order ID" },
      { from: "user", text: "ORD-88213" },
      { from: "bot", text: "Your order ORD-88213 is out for delivery and will arrive today by 7 PM." },
    ],
  },
  {
    id: "abandoned-cart",
    name: "Cart Recovery",
    subtitle: "Recover lost sales",
    category: "ecommerce",
    badge: "High Impact",
    badgeTone: "success",
    impact: 38,
    impactLabel: "Recover abandoned carts",
    description: "Remind shoppers about items left in cart and offer a coupon to complete checkout",
    tags: ["Sales", "Coupons"],
    features: [
      { icon: "cart", label: "Cart Items" },
      { icon: "tag", label: "Coupon" },
      { icon: "card", label: "Checkout" },
    ],
    flow: [
      { type: "trigger", title: "Trigger", content: "Customer replies to a cart reminder" },
      { type: "buttons", title: "Offer", content: "You left items in your cart! Here's 10% off.", options: ["Checkout", "View Cart"] },
      { type: "action", title: "Send link", content: "Checkout link with coupon is shared." },
    ],
    demo: [
      { from: "bot", text: "You left items in your cart! Here's 10% off with code SAVE10.", options: ["Checkout", "View Cart"] },
      { from: "user", text: "Checkout" },
      { from: "bot", text: "Here is your checkout link with the coupon applied: shop.example.com/c/SAVE10" },
    ],
  },
  {
    id: "course-enquiry",
    name: "Course Enquiry",
    subtitle: "Convert more admissions",
    category: "education",
    badge: "Useful",
    badgeTone: "info",
    impact: 41,
    impactLabel: "More admission leads",
    description: "Share course details, fees and batch timings, and book counselling sessions",
    tags: ["Courses", "Admissions"],
    features: [
      { icon: "graduation", label: "Courses" },
      { icon: "book", label: "Brochure" },
      { icon: "calendar", label: "Counselling" },
    ],
    flow: [
      { type: "trigger", title: "Trigger", content: "Student sends \"Courses\" or \"Admission\"" },
      { type: "list", title: "Courses", content: "Which course are you interested in?", options: ["Web Development", "Data Science", "UI/UX Design"] },
      { type: "buttons", title: "Next step", content: "What would you like next?", options: ["Fees", "Brochure", "Book Counselling"] },
      { type: "action", title: "Save lead", content: "Lead is saved for the admissions team." },
    ],
    demo: [
      { from: "user", text: "Courses" },
      { from: "bot", text: "Which course are you interested in?", options: ["Web Development", "Data Science", "UI/UX Design"] },
      { from: "user", text: "Data Science" },
      { from: "bot", text: "What would you like next?", options: ["Fees", "Brochure", "Book Counselling"] },
      { from: "user", text: "Book Counselling" },
      { from: "bot", text: "Your counselling session is booked for tomorrow at 4 PM." },
    ],
  },
  {
    id: "test-drive-booking",
    name: "Test Drive Booking",
    subtitle: "Boost showroom visits",
    category: "automotive",
    badge: "Popular",
    badgeTone: "primary",
    impact: 36,
    impactLabel: "More test drives booked",
    description: "Help customers explore models, compare variants and book a test drive",
    tags: ["Cars", "Booking"],
    features: [
      { icon: "car", label: "Models" },
      { icon: "map", label: "Showroom" },
      { icon: "calendar", label: "Book Drive" },
    ],
    flow: [
      { type: "trigger", title: "Trigger", content: "Customer sends \"Test drive\"" },
      { type: "list", title: "Model", content: "Pick a model", options: ["Hatchback", "Sedan", "SUV"] },
      { type: "input", title: "City", content: "Which city are you in?" },
      { type: "action", title: "Book", content: "Test drive is booked at the nearest showroom." },
    ],
    demo: [
      { from: "user", text: "Test drive" },
      { from: "bot", text: "Pick a model", options: ["Hatchback", "Sedan", "SUV"] },
      { from: "user", text: "SUV" },
      { from: "bot", text: "Which city are you in?" },
      { from: "user", text: "Pune" },
      { from: "bot", text: "Done! Your SUV test drive is booked at our Baner showroom for Saturday 11 AM." },
    ],
  },
  {
    id: "saas-onboarding",
    name: "App Onboarding",
    subtitle: "Activate new users faster",
    category: "saas",
    badge: "Useful",
    badgeTone: "info",
    impact: 33,
    impactLabel: "Faster user activation",
    description: "Guide new sign-ups through setup, share tutorials and book a product demo",
    tags: ["SaaS", "Onboarding"],
    features: [
      { icon: "rocket", label: "Get Started" },
      { icon: "play", label: "Tutorials" },
      { icon: "calendar", label: "Book Demo" },
    ],
    flow: [
      { type: "trigger", title: "Trigger", content: "New user signs up" },
      { type: "buttons", title: "Welcome", content: "Welcome aboard! What would you like to do first?", options: ["Get Started", "Tutorials", "Book Demo"] },
      { type: "message", title: "Guide", content: "Step-by-step setup guide is shared." },
    ],
    demo: [
      { from: "bot", text: "Welcome aboard! What would you like to do first?", options: ["Get Started", "Tutorials", "Book Demo"] },
      { from: "user", text: "Book Demo" },
      { from: "bot", text: "Your product demo is booked for Monday 3 PM. See you there!" },
    ],
  },
  {
    id: "gaming-rewards",
    name: "Player Rewards",
    subtitle: "Increase player retention",
    category: "gaming",
    badge: "High Impact",
    badgeTone: "success",
    impact: 40,
    impactLabel: "Higher player retention",
    description: "Share daily rewards, tournament updates and resolve account issues",
    tags: ["Gaming", "Rewards"],
    features: [
      { icon: "gift", label: "Daily Reward" },
      { icon: "trophy", label: "Tournaments" },
      { icon: "headset", label: "Support" },
    ],
    flow: [
      { type: "trigger", title: "Trigger", content: "Player sends \"Rewards\"" },
      { type: "buttons", title: "Menu", content: "Hey champ! What do you need?", options: ["Daily Reward", "Tournaments", "Support"] },
      { type: "action", title: "Credit reward", content: "Reward is credited to the player's account." },
    ],
    demo: [
      { from: "user", text: "Rewards" },
      { from: "bot", text: "Hey champ! What do you need?", options: ["Daily Reward", "Tournaments", "Support"] },
      { from: "user", text: "Daily Reward" },
      { from: "bot", text: "100 coins have been credited to your account. Come back tomorrow for more!" },
    ],
  },
  {
    id: "clinic-appointment",
    name: "Clinic Appointment",
    subtitle: "Fewer missed appointments",
    category: "healthcare",
    badge: "Useful",
    badgeTone: "info",
    impact: 47,
    impactLabel: "Fewer no-shows",
    description: "Book, reschedule and get reminders for doctor appointments",
    tags: ["Healthcare", "Booking"],
    features: [
      { icon: "stethoscope", label: "Doctors" },
      { icon: "calendar", label: "Book Slot" },
      { icon: "bell", label: "Reminder" },
    ],
    flow: [
      { type: "trigger", title: "Trigger", content: "Patient sends \"Appointment\"" },
      { type: "list", title: "Department", content: "Choose a department", options: ["General", "Dental", "Pediatrics"] },
      { type: "list", title: "Slot", content: "Pick a slot", options: ["Today 6 PM", "Tomorrow 10 AM"] },
      { type: "message", title: "Confirmation", content: "Appointment confirmed with a reminder 2 hours before." },
    ],
    demo: [
      { from: "user", text: "Appointment" },
      { from: "bot", text: "Choose a department", options: ["General", "Dental", "Pediatrics"] },
      { from: "user", text: "Dental" },
      { from: "bot", text: "Pick a slot", options: ["Today 6 PM", "Tomorrow 10 AM"] },
      { from: "user", text: "Tomorrow 10 AM" },
      { from: "bot", text: "Your dental appointment is confirmed for tomorrow 10 AM. We'll remind you 2 hours before." },
    ],
  },
];

export async function fetchChatbotTemplateCategories(): Promise<TemplateCategory[]> {
  // TODO: replace with the categories API when available
  return CATEGORIES;
}

export async function fetchChatbotTemplates(): Promise<ChatbotTemplate[]> {
  // TODO: replace with the templates API when available
  return TEMPLATES;
}
