export type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export const TicketStatus = { PENDING: 'PENDING', IN_PROGRESS: 'IN_PROGRESS', RESOLVED: 'RESOLVED' } as const;
export type TicketStatus = typeof TicketStatus[keyof typeof TicketStatus];

export const MessageStatus = { pending: 'pending', sent: 'sent', delivered: 'delivered', read: 'read', failed: 'failed' } as const;
export type MessageStatus = typeof MessageStatus[keyof typeof MessageStatus];

export const NotificationType = { INFO: 'INFO', SUCCESS: 'SUCCESS', WARNING: 'WARNING', ERROR: 'ERROR' } as const;
export type NotificationType = typeof NotificationType[keyof typeof NotificationType];

export const BillingCycle = { MONTHLY: 'MONTHLY', YEARLY: 'YEARLY' } as const;
export type BillingCycle = typeof BillingCycle[keyof typeof BillingCycle];

export const CompanyStatus = { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE', SUSPENDED: 'SUSPENDED', TRIAL: 'TRIAL' } as const;
export type CompanyStatus = typeof CompanyStatus[keyof typeof CompanyStatus];

export const SubscriptionStatus = { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE', EXPIRED: 'EXPIRED', CANCELLED: 'CANCELLED', TRIAL: 'TRIAL' } as const;
export type SubscriptionStatus = typeof SubscriptionStatus[keyof typeof SubscriptionStatus];

export const UserStatus = { ACTIVE: 'ACTIVE', REJECTED: 'REJECTED', APPROVED: 'APPROVED', PENDING: 'PENDING', SUSPENDED: 'SUSPENDED', DELETED: 'DELETED', RECEIVED: 'RECEIVED', ONLINE: 'ONLINE', SEND: 'SEND', PROCESSING: 'PROCESSING', FAILED: 'FAILED', PROCESSED: 'PROCESSED', COMPLETED: 'COMPLETED', DRAFT: 'DRAFT', READ: 'READ', CONNECTED: 'CONNECTED', SCHEDULE: 'SCHEDULE', INACTIVE: 'INACTIVE', PENDING_EMBEDDED_SIGNUP: 'PENDING_EMBEDDED_SIGNUP', DELIVERED: 'DELIVERED', RESOLVED: 'RESOLVED', IN_PROGRESS: 'IN_PROGRESS' } as const;
export type UserStatus = typeof UserStatus[keyof typeof UserStatus];

export interface BaseRows {
  contact: {
    id: number;
    phone: string | null;
    name: string;
    source: string | null;
    assignedTo: string | null;
    email: string | null;
    status: string | null;
    wabaPhone: string | null;
    interiorDesign: string | null;
    name1: string | null;
    test: string | null;
    importId: string | null;
    allowDuplicate: boolean;
    createdAt: Date;
    updatedAt: Date;
    userId: number;
  };
  contactTag: {
    id: number;
    contactId: number;
    tagId: number;
    createdAt: Date;
  };
  conversation: {
    id: string;
    phone: string;
    name: string | null;
    userId: number;
    contactId: number;
    lastInboundAt: Date | null;
    createdAt: Date;
    lastMessage: string | null;
    lastMessageAt: Date | null;
  };
  message: {
    id: number;
    conversationId: string;
    contactId: number;
    content: string | null;
    sentBy: string | null;
    from: string | null;
    text: string;
    senderId: string | null;
    receiverId: string | null;
    direction: string;
    mediaUrl: string | null;
    mediaType: string | null;
    caption: string | null;
    isTemplate: boolean;
    templateName: string | null;
    buttons: JsonValue | null;
    templateLanguage: string | null;
    templateParams: JsonValue | null;
    templateComponents: JsonValue | null;
    errorCode: string | null;
    errorMessage: string | null;
    error: string | null;
    sentAt: Date | null;
    deliveredAt: Date | null;
    readAt: Date | null;
    failedAt: Date | null;
    sentById: number | null;
    messageType: string;
    type: string;
    seen: boolean;
    createdAt: Date;
    updatedAt: Date;
    userId: number;
    status: UserStatus;
    whatsappMessageId: string | null;
    campaignId: string | null;
    waMessageId: string | null;
    reminderId: number | null;
  };
  user: {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    password: string;
    refreshToken: string | null;
    status: UserStatus;
    role: string;
    createdAt: Date;
    updatedAt: Date;
    image: string | null;
    memberSince: Date;
    plan: string | null;
    isPremium: boolean;
    subscriptionPlan: string | null;
    subscriptionId: string | null;
    subscriptionStart: Date | null;
    subscriptionEnd: Date | null;
    razorpayCustomerId: string | null;
    walletBalance: number;
    isActive: boolean;
    hasUsedTrial: boolean;
    trialEndAt: Date | null;
    trialStartAt: Date | null;
    companyId: number | null;
    createdBy: number | null;
    isPasswordSet: boolean;
    resetToken: string | null;
    resetTokenExpiry: Date | null;
  };
  teamMember: {
    id: number;
    userId: number | null;
    ownerId: number | null;
    role: string;
    email: string | null;
    phone: string | null;
    createdAt: Date;
    adminPerms: string;
    inviteExpiry: Date | null;
    inviteToken: string | null;
    name: string | null;
    navPerms: string;
    status: string;
  };
  lead: {
    id: number;
    name: string;
    createdAt: Date;
    source: string | null;
    userId: number;
  };
  campaign: {
    id: string;
    name: string;
    description: string | null;
    type: string;
    status: string;
    startDate: Date | null;
    leadsCount: number;
    delaySeconds: number;
    audienceData: JsonValue | null;
    userId: number;
    variableMapping: JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
    failedCount: number;
    sentCount: number;
    deliveredCount: number | null;
    endDate: Date | null;
    messageTemplate: string | null;
    readCount: number | null;
    selectedTemplate: string | null;
    headerMediaUrl: string | null;
    whatsappAccountId: number | null;
  };
  media: {
    id: number;
    name: string;
    fileName: string;
    type: string;
    size: string;
    url: string;
    createdAt: Date;
    userId: number;
  };
  whatsappFlow: {
    id: number;
    businessId: string;
    name: string;
    flowId: string;
    categories: string | null;
    status: string;
    validation: string | null;
    createdAt: Date;
    userId: number;
    endpointUri: string | null;
    flowJson: string | null;
    metaFlowId: string | null;
    updatedAt: Date;
  };
  chatbotFAQ: {
    id: number;
    phone: string;
    name: string;
    faqBotId: string;
    createdAt: Date;
    updatedAt: Date;
    userId: number;
  };
  tag: {
    id: number;
    name: string;
    group: string | null;
    createdAt: Date;
    updatedAt: Date;
    userId: number;
  };
  webhookEndpoint: {
    id: number;
    name: string;
    url: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    userId: number;
    status: boolean;
  };
  webhookSubscription: {
    id: number;
    endpointId: number;
    eventName: string;
    createdAt: Date;
  };
  column: {
    id: number;
    label: string;
    type: string;
    visible: boolean;
    createdAt: Date;
    userId: number;
  };
  optKeyword: {
    id: number;
    keyword: string;
    type: string;
    createdAt: Date;
    userId: number;
  };
  flow: {
    id: number;
    name: string;
    status: UserStatus;
    createdAt: Date;
    updatedAt: Date;
    edges: JsonValue | null;
    nodes: JsonValue | null;
    userId: number;
  };
  aiAssistant: {
    id: number;
    name: string;
    role: string;
    status: UserStatus;
    promptType: string;
    predefinedPrompt: string | null;
    customPrompt: string | null;
    provider: string;
    model: string;
    apiKey: string | null;
    createdAt: Date;
    updatedAt: Date;
    userId: number | null;
  };
  chatbot: {
    id: string;
    userId: number | null;
    name: string;
    description: string | null;
    status: UserStatus;
    published: boolean;
    createdAt: Date;
    updatedAt: Date;
    whatsappAccountId: number | null;
  };
  chatbotNode: {
    id: string;
    chatbotId: string;
    type: string;
    data: JsonValue;
    position: JsonValue;
    createdAt: Date;
  };
  chatbotEdge: {
    id: string;
    chatbotId: string;
    source: string;
    target: string;
    label: string | null;
    data: JsonValue | null;
  };
  chatSession: {
    id: string;
    chatbotId: string;
    userKey: string;
    memory: JsonValue | null;
    lastMessage: string | null;
    lastNodeId: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  notification: {
    id: string;
    title: string;
    message: string;
    isRead: boolean;
    userId: number;
    createdAt: Date;
    updatedAt: Date;
    type: string | null;
  };
  reminder: {
    id: string;
    note: string;
    date: string;
    time: string;
    triggered: boolean;
    createdAt: Date;
    updatedAt: Date;
    creatorId: number | null;
    assignedTo: number | null;
    userId: number;
  };
  contactReminder: {
    id: number;
    userId: number;
    contactId: number;
    message: string;
    scheduleType: string;
    startDate: string | null;
    startTime: string | null;
    onDate: string | null;
    fromTime: string | null;
    frequency: string | null;
    toTime: string | null;
    allDay: boolean | null;
    repeatEvery: number | null;
    repeatUnit: string | null;
    repeatCount: number | null;
    remainingCount: number | null;
    status: UserStatus;
    selectedDays: JsonValue | null;
    triggered: boolean | null;
    createdAt: Date;
    updatedAt: Date;
    delivered: boolean | null;
    conversationId: string | null;
    language: string | null;
    templateName: string | null;
    variables: JsonValue | null;
  };
  subscription: {
    id: string;
    userId: number;
    planType: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    razorpayOrderId: string | null;
    razorpayPaymentId: string | null;
    razorpaySignature: string | null;
    status: string;
    startDate: Date;
    endDate: Date;
    autoRenew: boolean;
    createdAt: Date;
    updatedAt: Date;
    razorpayFee: number | null;
    razorpayTax: number | null;
    bank: string | null;
    last4: string | null;
    rrn: string | null;
    vpa: string | null;
    wallet: string | null;
  };
  whatsAppAccount: {
    id: number;
    userId: number;
    wabaId: string | null;
    phoneNumberId: string | null;
    accessToken: string;
    verifyToken: string | null;
    phoneNumber: string | null;
    appId: string | null;
    appSecret: string | null;
    apiVersion: string | null;
    isActive: boolean;
    createdAt: Date;
    status: UserStatus;
    twoStepVerificationPin: string | null;
    flowEndpointPrivateKeyPem: string | null;
    flowEndpointPublicKeyPem: string | null;
  };
  whatsAppTemplate: {
    id: number;
    metaTemplateId: string | null;
    whatsappAccountId: number;
    name: string;
    language: string;
    category: string;
    isDefault: boolean;
    components: JsonValue | null;
    createdAt: Date;
    qualityRating: string | null;
    rejectionReason: string | null;
    status: UserStatus;
    headerMode: string | null;
    headerMediaUrl: string | null;
  };
  incomingWebhook: {
    id: number;
    payload: JsonValue;
    status: UserStatus;
    eventType: string | null;
    error: string | null;
    createdAt: Date;
    processedAt: Date | null;
  };
  companies: {
    id: number;
    name: string;
    domain: string | null;
    status: CompanyStatus;
    logo: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  features: {
    id: number;
    key: string;
    label: string;
    description: string | null;
    category: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  plan_features: {
    id: number;
    planId: number;
    featureId: number;
    isEnabled: boolean;
    limitValue: number | null;
    limitType: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  subscription_plans: {
    id: number;
    companyId: number;
    name: string;
    description: string | null;
    price: number;
    billingCycle: BillingCycle;
    isActive: boolean;
    isPopular: boolean;
    displayOrder: number;
    createdAt: Date;
    updatedAt: Date;
  };
  appConfig: {
    id: number;
    freeTrialDays: number;
    updatedAt: Date;
  };
  support_tickets: {
    id: number;
    name: string;
    email: string;
    phone: string;
    message: string;
    userId: number;
    createdAt: Date;
    updatedAt: Date;
    status: TicketStatus;
    repliedAt: Date | null;
    reply: string | null;
    resolvedAt: Date | null;
  };
  support_ticket_replies: {
    id: number;
    ticketId: number;
    message: string;
    createdAt: Date;
  };
  userSubscription: {
    id: number;
    userId: number;
    companyId: number;
    planId: number;
    startDate: Date;
    endDate: Date | null;
    status: SubscriptionStatus;
    autoRenew: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  walletTransaction: {
    userId: number;
    amount: number;
    messageId: string | null;
    type: string;
    createdAt: Date;
    id: number;
  };
  admin_profile_meta: {
    id: number;
    userId: number;
    bio: string | null;
    location: string | null;
    website: string | null;
    timezone: string | null;
    language: string | null;
    weekStart: string | null;
    emailNotifications: boolean;
    smsNotifications: boolean;
    darkMode: boolean;
    compactUI: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
}

export interface RelationRows {
  contact: {
    conversations: { model: 'conversation'; many: true; optional: false };
    messages: { model: 'message'; many: true; optional: false };
    contactReminders: { model: 'contactReminder'; many: true; optional: false };
    tags: { model: 'contactTag'; many: true; optional: false };
    user: { model: 'user'; many: false; optional: false };
  };
  contactTag: {
    contact: { model: 'contact'; many: false; optional: false };
    tag: { model: 'tag'; many: false; optional: false };
  };
  conversation: {
    contact: { model: 'contact'; many: false; optional: false };
    User: { model: 'user'; many: false; optional: false };
    messages: { model: 'message'; many: true; optional: false };
  };
  message: {
    campaign: { model: 'campaign'; many: false; optional: true };
    contact: { model: 'contact'; many: false; optional: false };
    conversation: { model: 'conversation'; many: false; optional: false };
    reminder: { model: 'contactReminder'; many: false; optional: true };
    user: { model: 'user'; many: false; optional: false };
  };
  user: {
    aiAssistants: { model: 'aiAssistant'; many: true; optional: false };
    campaigns: { model: 'campaign'; many: true; optional: false };
    chatbots: { model: 'chatbot'; many: true; optional: false };
    chatbotFAQs: { model: 'chatbotFAQ'; many: true; optional: false };
    columns: { model: 'column'; many: true; optional: false };
    Conversation: { model: 'conversation'; many: true; optional: false };
    flows: { model: 'flow'; many: true; optional: false };
    leads: { model: 'lead'; many: true; optional: false };
    media: { model: 'media'; many: true; optional: false };
    messages: { model: 'message'; many: true; optional: false };
    optKeywords: { model: 'optKeyword'; many: true; optional: false };
    tags: { model: 'tag'; many: true; optional: false };
    company: { model: 'companies'; many: false; optional: true };
    User: { model: 'user'; many: false; optional: true };
    other_User: { model: 'user'; many: true; optional: false };
    UserSubscription: { model: 'userSubscription'; many: true; optional: false };
    webhookEndpoints: { model: 'webhookEndpoint'; many: true; optional: false };
    WhatsAppAccount: { model: 'whatsAppAccount'; many: true; optional: false };
    whatsappFlows: { model: 'whatsappFlow'; many: true; optional: false };
    admin_profile_meta: { model: 'admin_profile_meta'; many: false; optional: true };
    contactReminders: { model: 'contactReminder'; many: true; optional: false };
    contacts: { model: 'contact'; many: true; optional: false };
    notifications: { model: 'notification'; many: true; optional: false };
    assignedReminders: { model: 'reminder'; many: true; optional: false };
    createdReminders: { model: 'reminder'; many: true; optional: false };
    ownedReminders: { model: 'reminder'; many: true; optional: false };
    subscriptions: { model: 'subscription'; many: true; optional: false };
    support_tickets: { model: 'support_tickets'; many: true; optional: false };
    ownedTeams: { model: 'teamMember'; many: true; optional: false };
    teamMembers: { model: 'teamMember'; many: true; optional: false };
    walletTransaction: { model: 'walletTransaction'; many: true; optional: false };
  };
  teamMember: {
    owner: { model: 'user'; many: false; optional: true };
    user: { model: 'user'; many: false; optional: true };
  };
  lead: {
    user: { model: 'user'; many: false; optional: false };
  };
  campaign: {
    user: { model: 'user'; many: false; optional: false };
    messages: { model: 'message'; many: true; optional: false };
  };
  media: {
    user: { model: 'user'; many: false; optional: false };
  };
  whatsappFlow: {
    user: { model: 'user'; many: false; optional: false };
  };
  chatbotFAQ: {
    user: { model: 'user'; many: false; optional: false };
  };
  tag: {
    user: { model: 'user'; many: false; optional: false };
    contacts: { model: 'contactTag'; many: true; optional: false };
  };
  webhookEndpoint: {
    user: { model: 'user'; many: false; optional: false };
    subscriptions: { model: 'webhookSubscription'; many: true; optional: false };
  };
  webhookSubscription: {
    endpoint: { model: 'webhookEndpoint'; many: false; optional: false };
  };
  column: {
    user: { model: 'user'; many: false; optional: false };
  };
  optKeyword: {
    user: { model: 'user'; many: false; optional: false };
  };
  flow: {
    user: { model: 'user'; many: false; optional: false };
  };
  aiAssistant: {
    user: { model: 'user'; many: false; optional: true };
  };
  chatbot: {
    sessions: { model: 'chatSession'; many: true; optional: false };
    user: { model: 'user'; many: false; optional: true };
    whatsappAccount: { model: 'whatsAppAccount'; many: false; optional: true };
    edges: { model: 'chatbotEdge'; many: true; optional: false };
    nodes: { model: 'chatbotNode'; many: true; optional: false };
  };
  chatbotNode: {
    chatbot: { model: 'chatbot'; many: false; optional: false };
  };
  chatbotEdge: {
    chatbot: { model: 'chatbot'; many: false; optional: false };
  };
  chatSession: {
    chatbot: { model: 'chatbot'; many: false; optional: false };
  };
  notification: {
    user: { model: 'user'; many: false; optional: false };
  };
  reminder: {
    assignee: { model: 'user'; many: false; optional: true };
    creator: { model: 'user'; many: false; optional: true };
    user: { model: 'user'; many: false; optional: false };
  };
  contactReminder: {
    messages: { model: 'message'; many: true; optional: false };
    contact: { model: 'contact'; many: false; optional: false };
    user: { model: 'user'; many: false; optional: false };
  };
  subscription: {
    user: { model: 'user'; many: false; optional: false };
  };
  whatsAppAccount: {
    chatbots: { model: 'chatbot'; many: true; optional: false };
    User: { model: 'user'; many: false; optional: false };
    templates: { model: 'whatsAppTemplate'; many: true; optional: false };
  };
  whatsAppTemplate: {
    whatsappAccount: { model: 'whatsAppAccount'; many: false; optional: false };
  };
  incomingWebhook: object;
  companies: {
    users: { model: 'user'; many: true; optional: false };
    UserSubscription: { model: 'userSubscription'; many: true; optional: false };
    subscription_plans: { model: 'subscription_plans'; many: true; optional: false };
  };
  features: {
    plan_features: { model: 'plan_features'; many: true; optional: false };
  };
  plan_features: {
    features: { model: 'features'; many: false; optional: false };
    subscription_plans: { model: 'subscription_plans'; many: false; optional: false };
  };
  subscription_plans: {
    UserSubscription: { model: 'userSubscription'; many: true; optional: false };
    plan_features: { model: 'plan_features'; many: true; optional: false };
    companies: { model: 'companies'; many: false; optional: false };
  };
  appConfig: object;
  support_tickets: {
    replies: { model: 'support_ticket_replies'; many: true; optional: false };
    User: { model: 'user'; many: false; optional: false };
  };
  support_ticket_replies: {
    support_tickets: { model: 'support_tickets'; many: false; optional: false };
  };
  userSubscription: {
    companies: { model: 'companies'; many: false; optional: false };
    subscription_plans: { model: 'subscription_plans'; many: false; optional: false };
    User: { model: 'user'; many: false; optional: false };
  };
  walletTransaction: {
    User: { model: 'user'; many: false; optional: false };
  };
  admin_profile_meta: {
    User: { model: 'user'; many: false; optional: false };
  };
}
