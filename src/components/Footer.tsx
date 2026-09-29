"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/about", label: "Մեր մասին" },
  { href: "/tours", label: "Արշավներ" },
  { href: "/clubs", label: "Ակումբներ" },
  { href: "/faq", label: "ՀՈՒՊ" },
];

function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const { error } = await supabase.from("newsletter_subscribers").insert({ email });
    setStatus(error ? "error" : "sent");
    if (!error) setEmail("");
  }

  if (status === "sent") {
    return <p className="text-sm text-white/80">Շնորհակալություն, բաժանորդագրված ես։</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
      <input
        required
        type="email"
        placeholder="Էլ. հասցե"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm text-white placeholder:text-white/50 sm:w-64"
      />
      <button type="submit" className="rounded-lg bg-apricot px-4 py-2 text-sm font-semibold text-white hover:bg-apricot-dark">
        Բաժանորդագրվել
      </button>
      {status === "error" && <p className="text-xs text-red-300">Չստացվեց, փորձիր նորից։</p>}
    </form>
  );
}

function ContactForm() {
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const { error } = await supabase.from("contact_messages").insert({ message, email, phone });
    setStatus(error ? "error" : "sent");
    if (!error) {
      setMessage("");
      setEmail("");
      setPhone("");
    }
  }

  if (status === "sent") {
    return <p className="text-sm text-white/80">Ստացանք, շուտով կպատասխանենք։</p>;
  }

  const input =
    "w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm text-white placeholder:text-white/50";
  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        required
        placeholder="Հայտ կամ առաջարկ..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        className={input}
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <input required type="email" placeholder="Էլ. հասցե" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
        <input required placeholder="Հեռախոս" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} />
      </div>
      <button type="submit" className="rounded-lg bg-apricot px-4 py-2 text-sm font-semibold text-white hover:bg-apricot-dark">
        Ուղարկել
      </button>
      {status === "error" && <p className="text-xs text-red-300">Չստացվեց, փորձիր նորից։</p>}
    </form>
  );
}

export default function Footer() {
  return (
    <footer className="bg-pine-dark text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2">
        <div>
          <h3 className="font-serif text-lg font-semibold">Բաժանորդագրվիր նորություններին</h3>
          <p className="mt-1 text-sm text-white/70">
            Իմացիր նոր արշավների մասին՝ առանց հաշիվ ստեղծելու։
          </p>
          <div className="mt-4">
            <NewsletterForm />
          </div>
        </div>
        <div>
          <h3 className="font-serif text-lg font-semibold">Հայտ կամ առաջարկ</h3>
          <p className="mt-1 text-sm text-white/70">Գրիր մեզ, մենք կկարդանք ու կպատասխանենք։</p>
          <div className="mt-4">
            <ContactForm />
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 px-6 py-6">
        <nav className="mx-auto flex max-w-6xl flex-wrap justify-center gap-6 text-sm text-white/70">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-white">
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="mt-4 text-center text-xs text-white/50">
          Made with 🩷 by Claude
        </p>
      </div>
    </footer>
  );
}
