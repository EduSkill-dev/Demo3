"use client";

import { useEffect } from "react";

// Opens the print dialog once the page has rendered (Save as PDF lives there).
export default function AutoPrint() {
  useEffect(() => {
    const id = setTimeout(() => window.print(), 300);
    return () => clearTimeout(id);
  }, []);
  return null;
}
