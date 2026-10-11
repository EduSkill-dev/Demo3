"use client";

// A GET form that sends itself as soon as a filter changes. Without
// JavaScript the (visually hidden) submit button still works.
export default function AutoSubmitForm({ action, className, children }: { action: string; className?: string; children: React.ReactNode }) {
  return (
    <form action={action} method="get" className={className} onChange={(e) => e.currentTarget.requestSubmit()}>
      {children}
    </form>
  );
}
