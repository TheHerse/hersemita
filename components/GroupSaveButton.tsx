"use client";

import { useEffect, useRef, useState } from "react";

function currentSignature(form: HTMLFormElement) {
  const data = new FormData(form);
  const values = [
    `grade:${data.get("gradeGroup") || ""}`,
    `division:${data.get("divisionGroup") || ""}`,
    ...data.getAll("groups").map((value) => `group:${value}`),
  ];
  return values.sort().join("|");
}

export default function GroupSaveButton({ initialSignature }: { initialSignature: string }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [changed, setChanged] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    const form = buttonRef.current?.closest("form");
    if (!form) return;
    formRef.current = form;

    const update = () => setChanged(currentSignature(form) !== initialSignature);
    update();
    form.addEventListener("change", update);
    form.addEventListener("input", update);

    return () => {
      form.removeEventListener("change", update);
      form.removeEventListener("input", update);
    };
  }, [initialSignature]);

  function cancelChanges() {
    const form = formRef.current;
    if (!form) return;
    form.reset();
    window.requestAnimationFrame(() => setChanged(currentSignature(form) !== initialSignature));
  }

  return (
    <div className="flex w-full flex-col gap-2 xl:w-auto xl:flex-row">
      {changed && (
        <button
          type="button"
          onClick={cancelChanges}
          className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:border-red-300/50 hover:bg-red-500/15 hover:text-red-100"
        >
          Cancel
        </button>
      )}
      <button
        ref={buttonRef}
        type="submit"
        disabled={!changed}
        className="rounded-lg bg-gradient-to-r from-[#00ff67] to-[#00a7ff] px-4 py-2 text-sm font-black text-white shadow-lg shadow-[#00a7ff]/25 transition hover:shadow-xl hover:shadow-[#00a7ff]/35 disabled:cursor-not-allowed disabled:bg-none disabled:bg-slate-500 disabled:text-white disabled:opacity-55 disabled:shadow-none"
      >
        Save Groups
      </button>
    </div>
  );
}
