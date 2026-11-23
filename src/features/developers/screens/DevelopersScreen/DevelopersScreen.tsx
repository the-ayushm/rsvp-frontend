"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Code,
  BookOpen,
  Zap,
  ExternalLink,
  FileText,
  Webhook,
  Terminal,
  Key,
} from "lucide-react";

export default function DevelopersPage() {
  const router = useRouter();

  const resources = [
    {
      title: "WhatsApp Business API",
      description: "Official WhatsApp Business API documentation and guides",
      icon: Code,
      colorClass: "bg-primary text-primary-foreground shadow-xs",
      onClick: () => router.push("/developers/api_generation"),
    },
    {
      title: "Getting Started Guide",
      description: "Step-by-step tutorial to integrate WhatsApp",
      href: "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started",
      icon: BookOpen,
      colorClass: "bg-[var(--neutral-500)] text-white shadow-xs",
    },
    {
      title: "API Reference",
      description: "Complete API endpoints and parameters documentation",
      href: "https://developers.facebook.com/docs/whatsapp/cloud-api/reference",
      icon: FileText,
      colorClass: "bg-warning text-white shadow-xs",
    },
    {
      title: "Webhooks",
      description: "Set up webhooks to receive real-time notifications",
      href: "https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks",
      icon: Webhook,
      colorClass: "bg-primary text-primary-foreground shadow-xs",
    },
  ];

  const quickLinks = [
    {
      title: "Authentication",
      href: "https://developers.facebook.com/docs/whatsapp/business-management-api/get-started",
      icon: Key,
    },
    {
      title: "Message Templates",
      href: "https://developers.facebook.com/docs/whatsapp/message-templates",
      icon: FileText,
    },
    {
      title: "API Console",
      href: "https://developers.facebook.com/apps",
      icon: Terminal,
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground p-6 lg:p-10 transition-colors">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 text-primary border border-primary/20 rounded-2xl mb-3 shadow-xs">
            <Code className="w-7 h-7" />
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">
            Developer Resources
          </h1>
          <p className="text-xs text-muted-foreground max-w-xl mx-auto">
            Everything you need to integrate and build with WhatsApp Business API
          </p>
        </div>

        {/* Main Resources */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {resources.map((resource, idx) => {
            const Icon = resource.icon;

            const content = (
              <div className="flex items-start gap-3.5">
                <div className={`p-3 rounded-xl shrink-0 ${resource.colorClass} group-hover:scale-110 group-hover:rotate-1 transition-transform duration-300`}>
                  <Icon className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {resource.title}
                    </h3>
                    <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200 shrink-0" />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {resource.description}
                  </p>
                </div>
              </div>
            );

            if (resource.onClick) {
              return (
                <button
                  key={idx}
                  onClick={resource.onClick}
                  className="group bg-card rounded-2xl p-4 sm:p-5 border border-border hover:border-primary shadow-xs hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1.5 transition-all duration-300 text-left cursor-pointer"
                >
                  {content}
                </button>
              );
            }

            return (
              <a
                key={idx}
                href={resource.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-card rounded-2xl p-4 sm:p-5 border border-border hover:border-primary shadow-xs hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1.5 transition-all duration-300 text-left block"
              >
                {content}
              </a>
            );
          })}
        </div>

        {/* Quick Links */}
        <div className="bg-card rounded-2xl p-5 sm:p-6 border border-border shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-warning" />
            <h2 className="text-sm font-bold text-foreground">
              Quick Links
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {quickLinks.map((link, idx) => {
              const Icon = link.icon;
              return (
                <Link
                  key={idx}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-2.5 p-3 rounded-xl border border-border bg-muted/40 hover:bg-card hover:border-primary hover:shadow-md hover:-translate-y-1 transition-all duration-300 shadow-2xs"
                >
                  <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20 group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-105 transition-all duration-200 shrink-0">
                    <Icon className="w-4 h-4 stroke-[2]" />
                  </div>

                  <span className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                    {link.title}
                  </span>

                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200 ml-auto shrink-0" />
                </Link>
              );
            })}
          </div>
        </div>

        {/* Help Section */}
        <div className="text-center bg-gradient-to-r from-primary to-primary rounded-2xl p-6 sm:p-8 shadow-sm">
          <h3 className="text-xl font-bold !text-white mb-2" style={{ color: 'var(--color-primary-foreground)' }}>
            Need Help?
          </h3>
          <p className="text-xs !text-white/95 mb-5 max-w-xl mx-auto leading-relaxed" style={{ color: 'color-mix(in oklab, var(--color-primary-foreground) 95%, transparent)' }}>
            Join the developer community or contact support for assistance with your integration
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="https://developers.facebook.com/community"
              target="_blank"
              className="px-4.5 py-2 bg-surface hover:bg-surface/90 !text-primary font-semibold text-xs rounded-lg transition shadow-xs"
              style={{ color: 'var(--color-primary-text)' }}
            >
              Developer Community
            </Link>
            <Link
              href="https://developers.facebook.com/support"
              target="_blank"
              className="px-4.5 py-2 bg-surface/15 hover:bg-surface/25 border border-white/40 !text-white font-medium text-xs rounded-lg transition shadow-xs backdrop-blur-xs"
              style={{ color: 'var(--color-primary-foreground)' }}
            >
              Contact Support
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
