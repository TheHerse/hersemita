"use client";

export default function PhoneNumberInput({
  name,
  placeholder,
  defaultValue,
}: {
  name: string;
  placeholder?: string;
  defaultValue?: string | null;
}) {
  return (
    <input
      name={name}
      type="text"
      inputMode="numeric"
      autoComplete="tel"
      maxLength={10}
      pattern="[0-9]{10}"
      placeholder={placeholder}
      defaultValue={defaultValue || ""}
      onChange={(event) => {
        event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "").slice(0, 10);
      }}
      className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-[#00a7ff] transition-colors"
    />
  );
}
