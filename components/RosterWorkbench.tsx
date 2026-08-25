"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DEFAULT_RUNNER_GROUP_NAMES, getSolidGroupStyle, getStripedGroupStyle } from "@/lib/runner-groups";

type RunnerGroup = {
  id: string;
  name: string;
  color: string;
};

type RunnerRow = {
  id: string;
  first_name: string;
  last_name: string;
  grade: number | string | null;
  parent_phone: string | null;
  username: string | null;
  groups: RunnerGroup[];
};

type SortMode = "name" | "grade" | "missing_phone";

export default function RosterWorkbench({
  runners,
  groups,
}: {
  runners: RunnerRow[];
  groups: RunnerGroup[];
}) {
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("all");
  const [groupId, setGroupId] = useState("all");
  const [sort, setSort] = useState<SortMode>("name");

  const grades = useMemo(() => {
    return Array.from(new Set(runners.map((runner) => runner.grade).filter(Boolean).map(String))).sort((a, b) => Number(a) - Number(b));
  }, [runners]);

  const filteredRunners = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const rows = runners.filter((runner) => {
      const fullName = `${runner.first_name} ${runner.last_name}`.toLowerCase();
      const credentials = `${runner.username || ""}`.toLowerCase();
      const groupNames = runner.groups.map((group) => group.name.toLowerCase()).join(" ");
      const matchesQuery = !normalizedQuery || `${fullName} ${credentials} ${groupNames}`.includes(normalizedQuery);
      const matchesGrade = grade === "all" || String(runner.grade) === grade;
      const matchesGroup = groupId === "all" || runner.groups.some((group) => group.id === groupId);
      return matchesQuery && matchesGrade && matchesGroup;
    });

    return [...rows].sort((a, b) => {
      if (sort === "grade") {
        const gradeDiff = Number(a.grade || 99) - Number(b.grade || 99);
        if (gradeDiff !== 0) return gradeDiff;
      }
      if (sort === "missing_phone") {
        const phoneDiff = Number(Boolean(a.parent_phone)) - Number(Boolean(b.parent_phone));
        if (phoneDiff !== 0) return phoneDiff;
      }
      return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
    });
  }, [grade, groupId, query, runners, sort]);


  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/10 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="border-b border-white/10 bg-white/[0.06] px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Team Roster</h3>
            <p className="mt-1 text-sm text-[#94a3b8]">Search athletes, filter groups, and copy runner portal credentials.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[220px_140px_160px_160px]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search roster"
              className="rounded-lg border border-white/15 bg-[#0f172a] px-3 py-2 text-sm text-white placeholder:text-[#64748b] focus:border-[#00a7ff] focus:outline-none"
            />
            <select
              value={grade}
              onChange={(event) => setGrade(event.target.value)}
              className="rounded-lg border border-white/15 bg-[#0f172a] px-3 py-2 text-sm text-white focus:border-[#00a7ff] focus:outline-none"
            >
              <option value="all">All grades</option>
              {grades.map((value) => (
                <option key={value} value={value}>Grade {value}</option>
              ))}
            </select>
            <select
              value={groupId}
              onChange={(event) => setGroupId(event.target.value)}
              className="rounded-lg border border-white/15 bg-[#0f172a] px-3 py-2 text-sm text-white focus:border-[#00a7ff] focus:outline-none"
            >
              <option value="all">All groups</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortMode)}
              className="rounded-lg border border-white/15 bg-[#0f172a] px-3 py-2 text-sm text-white focus:border-[#00a7ff] focus:outline-none"
            >
              <option value="name">Sort by name</option>
              <option value="grade">Sort by grade</option>
              <option value="missing_phone">Missing phones first</option>
            </select>
          </div>
        </div>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">
          Showing {filteredRunners.length} of {runners.length}
        </p>
      </div>

      {filteredRunners.length === 0 ? (
        <div className="p-8 text-center text-sm text-[#cbd5e1]">No runners match those filters.</div>
      ) : (
        <>
          <div className="space-y-4 p-4 md:hidden">
            {filteredRunners.map((runner) => (
              <RunnerCard key={runner.id} runner={runner} />
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[980px]">
              <thead className="border-b border-white/10 bg-[#111827]">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-[#94a3b8]">Runner</th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-[#94a3b8]">Grade</th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-[#94a3b8]">Groups</th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-[#94a3b8]">Credentials</th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-[#94a3b8]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredRunners.map((runner) => (
                  <tr key={runner.id} className="transition hover:bg-white/[0.04]">
                    <td className="px-6 py-4">
                      <Link href={`/runners/${runner.id}`} className="font-bold text-white transition hover:text-[#7dd3fc]">{runner.first_name} {runner.last_name}</Link>
                      <div className="mt-1 text-xs text-[#94a3b8]">{runner.parent_phone ? `Parent: ${runner.parent_phone}` : "No parent phone"}</div>
                    </td>
                    <td className="px-6 py-4 text-[#cbd5e1]">{runner.grade ? `${runner.grade}th` : "--"}</td>
                    <td className="px-6 py-4"><GroupPills groups={runner.groups} /></td>
                    <td className="px-6 py-4">
                      <CredentialStatus runner={runner} />
                    </td>
                    <td className="px-6 py-4">
                      <ActionButtons runner={runner} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function RunnerCard({ runner }: { runner: RunnerRow }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#111827] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/runners/${runner.id}`} className="font-bold text-white transition hover:text-[#7dd3fc]">{runner.first_name} {runner.last_name}</Link>
          <div className="mt-1 text-sm text-[#94a3b8]">Grade {runner.grade || "--"}</div>
        </div>
        <CredentialStatus runner={runner} compact />
      </div>
      <div className="mt-4">
        <GroupPills groups={runner.groups} />
      </div>
      <div className="mt-4">
        <ActionButtons runner={runner} />
      </div>
      <div className="mt-3 text-xs text-[#94a3b8]">
        {runner.parent_phone ? `Parent: ${runner.parent_phone}` : "No parent phone"}
      </div>
    </div>
  );
}

function GroupPills({ groups }: { groups: RunnerGroup[] }) {
  if (groups.length === 0) {
    return (
      <span className="rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-xs font-semibold text-orange-300">
        Ungrouped
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {groups.map((group) => (
        <span
          key={group.id}
          className="rounded-full border px-3 py-1 text-xs font-bold text-white"
          style={DEFAULT_RUNNER_GROUP_NAMES.includes(group.name) ? getStripedGroupStyle(group.color) : getSolidGroupStyle(group.color)}
        >
          {group.name}
        </span>
      ))}
    </div>
  );
}

function ActionButtons({ runner }: { runner: RunnerRow }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/runners/${runner.id}`} className="rounded-lg border border-[#00a7ff]/40 bg-[#00a7ff]/10 px-3 py-2 text-sm font-bold text-[#7dd3fc] transition hover:bg-[#00a7ff]/20">
        Profile
      </Link>
      <Link href={`/runners/upload/${runner.id}`} className="rounded-lg bg-[#008cff] px-3 py-2 text-sm font-bold text-white shadow-sm shadow-[#008cff]/20 transition hover:bg-[#00a7ff]">
        Upload
      </Link>
      <Link href={`/runner/login?username=${encodeURIComponent(runner.username || "")}`} className="rounded-lg bg-[#00d95a] px-3 py-2 text-sm font-bold text-white shadow-sm shadow-[#00d95a]/20 transition hover:bg-[#00ff67]">
        Portal
      </Link>
      <Link href={`/runners/${runner.id}/edit`} className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-white/15">
        Edit
      </Link>
      <Link href={`/runners/${runner.id}/delete`} className="rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600">
        Delete
      </Link>
    </div>
  );
}

function CredentialStatus({
  runner,
  compact = false,
}: {
  runner: RunnerRow;
  compact?: boolean;
}) {
  return (
    <Link
      href={`/runners/${runner.id}/edit`}
      title="Manage runner login"
      className={`inline-flex max-w-full flex-col rounded-md border border-[#00a7ff]/30 bg-[#00a7ff]/10 px-3 py-2 text-left font-bold text-[#7dd3fc] transition hover:border-[#00a7ff] hover:bg-[#00a7ff]/15 ${compact ? "text-xs" : "text-sm"}`}
    >
      <span className="truncate font-mono">{runner.username || "No username"}</span>
      <span className="truncate text-[#cbd5e1]">Passcode hidden</span>
    </Link>
  );
}
