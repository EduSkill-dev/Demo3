import PasswordForm from "@/components/admin/PasswordForm";

export default function AdminPasswordPage() {
  return (
    <div>
      <h2 className="mb-6 font-serif text-xl font-semibold text-heading">Փոխել գաղտնաբառը</h2>
      <PasswordForm forced={false} />
    </div>
  );
}
