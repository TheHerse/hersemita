"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type RunnerOption = {
  id: string;
  first_name: string;
  last_name: string;
  grade: number;
  parent_phone: string | null;
};

type MessageParentsFormProps = {
  runnersWithPhone: RunnerOption[];
  runnersWithoutPhone: RunnerOption[];
  action: (formData: FormData) => void;
};

export default function MessageParentsForm({
  runnersWithPhone,
  runnersWithoutPhone,
  action,
}: MessageParentsFormProps) {
  const defaultSelectedIds = useMemo(() => runnersWithPhone.map((runner) => runner.id), [runnersWithPhone]);
  const [selectedIds, setSelectedIds] = useState(defaultSelectedIds);

  const selectedSet = new Set(selectedIds);
  const hasRecipients = runnersWithPhone.length > 0;
  const allSelected = hasRecipients && selectedIds.length === runnersWithPhone.length;

  function toggleAll() {
    setSelectedIds(allSelected ? [] : defaultSelectedIds);
  }

  function toggleRunner(runnerId: string) {
    setSelectedIds((current) =>
      current.includes(runnerId) ? current.filter((id) => id !== runnerId) : [...current, runnerId]
    );
  }

  return (
    <form action={action} className="space-y-6">
      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700">Message Type</label>
        <select
          name="type"
          className="w-full rounded-lg border-2 border-slate-200 bg-white px-4 py-2 text-slate-900 transition-colors focus:border-[#00a7ff] focus:outline-none"
        >
          <option value="general">General Update</option>
          <option value="schedule">Schedule Change</option>
          <option value="weekly">Weekly Report</option>
          <option value="meet">Meet Day Info</option>
        </select>
      </div>

      <div>
        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label className="block text-sm font-semibold text-slate-700">Select Runners</label>
          <span className="text-xs font-semibold text-slate-500">
            {selectedIds.length} selected
          </span>
        </div>

        <div className="max-h-72 overflow-y-auto rounded-xl border-2 border-slate-200">
          <div className="sticky top-0 flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <input
              type="checkbox"
              id="select-all"
              checked={allSelected}
              disabled={!hasRecipients}
              onChange={toggleAll}
              className="h-4 w-4 rounded border-slate-300 text-[#00a7ff] focus:ring-[#00a7ff]"
            />
            <label htmlFor="select-all" className="cursor-pointer text-sm font-semibold text-slate-700">
              Select All
            </label>
          </div>

          {runnersWithPhone.map((runner) => (
            <div
              key={runner.id}
              className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 transition-colors last:border-b-0 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                name="runners"
                value={runner.id}
                id={`runner-${runner.id}`}
                checked={selectedSet.has(runner.id)}
                onChange={() => toggleRunner(runner.id)}
                className="h-4 w-4 rounded border-slate-300 text-[#00a7ff] focus:ring-[#00a7ff]"
              />
              <label htmlFor={`runner-${runner.id}`} className="flex-1 cursor-pointer">
                <span className="font-medium text-slate-900">
                  {runner.last_name}, {runner.first_name}
                </span>
                <span className="ml-2 text-sm text-slate-500">Grade {runner.grade}</span>
              </label>
            </div>
          ))}

          {!hasRecipients && (
            <div className="px-4 py-5 text-sm text-slate-600">
              No runners have parent phone numbers yet.
            </div>
          )}

          {runnersWithoutPhone.length > 0 && (
            <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
              <p className="mb-2 text-xs font-semibold text-slate-500">No parent phone on file:</p>
              {runnersWithoutPhone.map((runner) => (
                <div key={runner.id} className="flex items-center gap-2 py-1 text-sm text-slate-400">
                  <input type="checkbox" disabled className="h-4 w-4 rounded opacity-50" />
                  {runner.last_name}, {runner.first_name} (Grade {runner.grade})
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700">Message</label>
        <textarea
          name="message"
          required
          maxLength={320}
          placeholder="Practice moved to 4pm today due to weather..."
          className="h-32 w-full resize-none rounded-lg border-2 border-slate-200 p-4 text-slate-900 transition-colors focus:border-[#00a7ff] focus:outline-none"
        />
        <p className="mt-1 text-xs text-slate-500">320 character limit for SMS</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={selectedIds.length === 0}
          className="flex-1 rounded-lg bg-gradient-to-r from-[#00ff67] to-[#00a7ff] py-3 font-bold text-white transition-all hover:shadow-lg hover:shadow-[#00a7ff]/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send to Selected Parents
        </button>
        <Link
          href="/dashboard"
          className="rounded-lg border-2 border-slate-200 px-6 py-3 text-center font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
