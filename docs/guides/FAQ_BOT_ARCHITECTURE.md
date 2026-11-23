# FAQ Bot System Architecture & Flow

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    WA DASHBOARD                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐          ┌──────────────────┐         │
│  │  Chatbot         │          │  Chatbot FAQ     │         │
│  │  Manager         │          │  Manager         │         │
│  │ (/chatbot)       │          │ (/chatbot-faq)   │         │
│  └────────┬─────────┘          └────────┬─────────┘         │
│           │                             │                    │
│           │ Create/Manage              │ Create/Manage      │
│           │ Complex Bots               │ FAQ Bots            │
│           │                             │                    │
│           └────────────────┬────────────┘                    │
│                            │                                 │
│                    ┌───────▼────────┐                       │
│                    │  Inbox         │                       │
│                    │  (/inbox)      │                       │
│                    └───────┬────────┘                       │
│                            │                                 │
│          ┌─────────────────┼─────────────────┐              │
│          │                 │                 │              │
│     ┌────▼─────┐    ┌──────▼──────┐  ┌──────▼──────┐       │
│     │ Contacts │    │ Messages    │  │ FAQ Flow    │       │
│     │ List     │    │ (Chat)      │  │ (Automated) │       │
│     └──────────┘    └─────────────┘  └─────────────┘       │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## User Journey

### Journey 1: FAQ Bot Creation

```
┌─────────────┐
│ User        │
│ navigates   │
│ to FAQ      │
│ Manager     │
└──────┬──────┘
       │
       ▼
┌──────────────────────┐
│ FAQ Manager Page     │
│ (/chatbot-faq)       │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Click "Create New    │
│ FAQ Bot"             │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Fill Form:           │
│ - Bot Name           │
│ - Phone Number       │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Click "Create"       │
│ Sends POST request   │
│ to API               │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Bot Created!         │
│ Bot ID: bot_xxx      │
│ Status: LIVE         │
└──────────────────────┘
```

### Journey 2: Using FAQ in Messaging

```
┌─────────────────┐
│ Open Inbox      │
│ (/inbox)        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Click on a      │
│ Contact        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Chat loads      │
│ (messages show) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ In chat header  │
│ find 💬 icon   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Click 💬 icon   │
│ FAQ popup opens │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│ Select bot from     │
│ dropdown list       │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ FAQ Flow Starts!    │
│ Bot greets user     │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ User sends message  │
│ (customer response) │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Bot responds with   │
│ next question       │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Conversation loop   │
│ repeats 3-4x        │
└────────┬────────────┘
         │
         ▼
┌──────────────────────────┐
│ Final Message:           │
│ "Will contact shortly"   │
└──────────────────────────┘
```

---

## FAQ Flow in Conversation

```
┌─────────────────────────────────────────┐
│          FAQ Bot Window (Floating)      │
├─────────────────────────────────────────┤
│  [FAQ Assistant] ─ [Hide] [Close X]     │
├─────────────────────────────────────────┤
│  12:00 PM                               │
│  🤖 Hello! I'm Support Assistant...     │
│  I'm here to help you. Let me ask       │
│  you a few questions.                   │
│                                         │
│  12:01 PM                               │
│  🤖 What is your main concern today?    │
│                                         │
│  12:01 PM                               │
│  👤 I need help with my order           │
│                                         │
│  12:02 PM                               │
│  🤖 Thank you for that information.     │
│  Can you provide your order number?     │
│                                         │
│  12:02 PM                               │
│  👤 ORDER-12345                         │
│                                         │
│  12:03 PM                               │
│  🤖 Perfect! Do you have any other      │
│  concerns?                              │
│                                         │
│  12:03 PM                               │
│  👤 No, that's all                      │
│                                         │
│  12:04 PM                               │
│  🤖 📞 We will contact you shortly.     │
│  Please keep your phone available!      │
│                                         │
├─────────────────────────────────────────┤
│  [Type your response...]  [Send]        │
└─────────────────────────────────────────┘
```

---

## Database Structure

```
FAQ Bots Table:
┌─────────────────────────────────┐
│ ID    │ Name           │ Status  │
├───────┼────────────────┼─────────┤
│ 1     │ Support Bot    │ LIVE    │
│ 2     │ Sales Bot      │ LIVE    │
│ 3     │ Billing Bot    │ LIVE    │
└─────────────────────────────────┘

Bot Instance (During Chat):
┌──────────────────────────────────────┐
│ Bot ID   │ Contact │ Started │ Status │
├──────────┼─────────┼─────────┼────────┤
│ 1        │ 42      │ 12:00   │ Active │
│ 2        │ 43      │ 12:05   │ Closed │
│ 3        │ 44      │ 12:10   │ Active │
└──────────────────────────────────────┘
```

---

## API Flow

```
CLIENT (Browser)
    │
    ├─ GET /api/user/chatbot-faq
    │  (Fetch list of bots)
    │  ▼
    │  ┌─────────────────────┐
    │  │ Response:           │
    │  │ [{ id, name, ... }] │
    │  └─────────────────────┘
    │
    ├─ POST /api/user/chatbot-faq/create
    │  (Create new bot)
    │  ▼
    │  ┌──────────────────┐
    │  │ Bot Created!     │
    │  │ Response: { id } │
    │  └──────────────────┘
    │
    ├─ POST /api/user/chatbot-faq/update
    │  (Update bot config)
    │  ▼
    │  ┌──────────────────┐
    │  │ Bot Updated!     │
    │  └──────────────────┘
    │
    └─ POST /api/user/chatbot-faq/delete
       (Delete bot)
       ▼
       ┌──────────────────┐
       │ Bot Deleted!     │
       └──────────────────┘
```

---

## Component Hierarchy

```
InboxPage (Main Component)
│
├─ Sidebar
│  ├─ Icon Sidebar (CRM, Calendar, Group, Tag, Reminder)
│  └─ Contacts List
│     └─ ContactItem (with Reminders)
│
├─ Chat Area
│  ├─ Chat Header (with FAQ Button 💬)
│  ├─ Messages Display
│  └─ Message Input
│
└─ FAQFlow (Floating Component)
   ├─ Bot Selection
   ├─ Message Display
   └─ Response Input
```

---

## State Management

```
InboxPage States:
├─ contacts: Contact[]          (All contacts)
├─ filteredContacts: Contact[]  (Filtered results)
├─ selectedContact: Contact     (Current chat)
├─ messages: Message[]          (Chat history)
├─ reminders: Reminder[]        (Contact reminders)
├─ showFAQFlow: boolean         (FAQ visible?)
└─ selectedBotForFAQ: string    (Which bot?)

FAQFlow States:
├─ messages: FAQMessage[]       (Bot conversation)
├─ userInput: string            (User typing)
├─ bots: FAQBot[]               (Available bots)
├─ selectedBot: FAQBot          (Active bot)
├─ flowStarted: boolean         (Bot active?)
└─ isMinimized: boolean         (Hidden?)
```

---

## Lifecycle

### Single Chat Session

```
1. User opens Inbox
   └─ Load contacts from API

2. User selects Contact
   └─ Load messages for contact

3. User clicks FAQ icon
   └─ Load available FAQ bots

4. User selects a bot
   └─ Initialize FAQFlow component
   └─ Send first bot message

5. User types response
   └─ Add message to FAQFlow
   └─ Simulate bot response

6. Loop back to step 5 until:
   └─ Bot sends final message
   └─ User closes popup

7. Popup closes
   └─ Chat messages still visible
   └─ Can reopen FAQ with same/different bot
```

---

## Performance Considerations

- **Lazy Loading**: FAQ bots loaded only when needed
- **Floating Component**: Doesn't block main chat
- **Local State**: FAQ messages stored locally
- **Minimize Button**: Hide FAQ without closing it
- **Message History**: Preserved across minimize/show

---

## Security

- Authentication required for all API calls
- User can only see their own bots
- Bot data validated before storage
- Phone numbers encrypted in transit

---

**This is your complete FAQ Bot system! 🎉**
