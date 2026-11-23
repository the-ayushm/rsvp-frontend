import Link from "next/link";

export default function UserSidebar() {
  return (
    <nav className="p-4 space-y-2">
      <h2 className="text-lg font-bold mb-4">Dashboard</h2>

      <Link href="/user/dashboard" className="block p-2 rounded hover:bg-gray-100">
        Dashboard
      </Link>

      <Link href="/user/inbox" className="block p-2 rounded hover:bg-gray-100">
        Inbox
      </Link>

      <Link href="/user/campaigns" className="block p-2 rounded hover:bg-gray-100">
        Campaigns
      </Link>

      <Link href="/user/settings" className="block p-2 rounded hover:bg-gray-100">
        Settings
      </Link>
    </nav>
  );
}
