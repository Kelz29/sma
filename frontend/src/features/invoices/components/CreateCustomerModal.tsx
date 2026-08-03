import { useState } from "react";

export type CustomerType = "individual" | "company";

export interface CustomerPayload {
  customer_type: CustomerType;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  contact_name?: string;
  registration_number?: string;
  vat_number?: string;
  id_number?: string;
}

export interface CustomerOption {
  id: number;
  customer_type?: CustomerType;
  name: string;
  email: string | null;
  phone?: string | null;
  address: string | null;
  contact_name?: string | null;
  registration_number?: string | null;
  vat_number?: string | null;
  id_number?: string | null;
}

interface CreateCustomerModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (customer: CustomerOption) => void;
  createCustomer: (data: CustomerPayload) => Promise<CustomerOption>;
}

const inputClass =
  "w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500";

export function CreateCustomerModal({
  open,
  onClose,
  onCreated,
  createCustomer,
}: CreateCustomerModalProps) {
  const [customerType, setCustomerType] = useState<CustomerType>("company");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setCustomerType("company");
    setName("");
    setEmail("");
    setPhone("");
    setAddress("");
    setContactName("");
    setRegistrationNumber("");
    setVatNumber("");
    setIdNumber("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(customerType === "company" ? "Company name is required." : "Full name is required.");
      return;
    }
    setSaving(true);
    try {
      const customer = await createCustomer({
        customer_type: customerType,
        name: trimmedName,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        contact_name: customerType === "company" ? contactName.trim() || undefined : undefined,
        registration_number:
          customerType === "company" ? registrationNumber.trim() || undefined : undefined,
        vat_number: vatNumber.trim() || undefined,
        id_number: customerType === "individual" ? idNumber.trim() || undefined : undefined,
      });
      onCreated(customer);
      reset();
      onClose();
    } catch {
      setError("Could not create customer. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const isCompany = customerType === "company";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 dark:border dark:border-slate-600 rounded-xl shadow-apple-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">New customer</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{error}</p>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Billed as *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCustomerType("company")}
                className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                  isCompany
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                    : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                }`}
              >
                Company
              </button>
              <button
                type="button"
                onClick={() => setCustomerType("individual")}
                className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                  !isCompany
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                    : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                }`}
              >
                Individual
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {isCompany ? "Company name *" : "Full name *"}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isCompany ? "Acme (Pty) Ltd" : "Jane Smith"}
              className={inputClass}
              autoFocus
            />
          </div>

          {isCompany && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Contact person</label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Accounts payable contact"
                className={inputClass}
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isCompany ? "billing@acme.com" : "jane@email.com"}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+27 …"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Billing address</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, city, postal code"
              rows={2}
              className={inputClass}
            />
          </div>

          {isCompany ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Registration number
                </label>
                <input
                  type="text"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                  placeholder="CIPC / company reg."
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">VAT number</label>
                <input
                  type="text"
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                  placeholder="VAT / tax number"
                  className={inputClass}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  ID / passport number
                </label>
                <input
                  type="text"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="National ID or passport"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">VAT number</label>
                <input
                  type="text"
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                  placeholder="If VAT-registered"
                  className={inputClass}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
            >
              {saving ? "Saving…" : "Create customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
