import { Navbar } from "@/components/layout/navbar";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-navy">
      <Navbar />
      {children}
    </div>
  );
}
