import { useUsers } from "@/api/hooks";
import { MultiSelect } from "@/components/ui/multi-select";

export const splitAssignees = (v: string) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);

/** Assignee picker: one or more real IT Manager users (active ones), stored as "Name A, Name B". */
export function AssigneeSelect({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const { data: users } = useUsers();
  const active = (users ?? []).filter((u) => u.active).sort((a, b) => a.name.localeCompare(b.name));
  const picked = splitAssignees(value);
  const options = [
    ...active.map((u) => ({ value: u.name, label: u.name, hint: u.role })),
    ...picked.filter((n) => !active.some((u) => u.name === n)).map((n) => ({ value: n, label: `${n} (not a user)` })),
  ];
  return <MultiSelect options={options} value={picked} onChange={(v) => onChange(v.join(", "))} placeholder="Unassigned" label="Assignees" className={className} />;
}

/** Names for filters: your users, in alphabetical order. */
export function useAssigneeNames() {
  const { data: users } = useUsers();
  return (users ?? []).filter((u) => u.active).map((u) => u.name).sort((a, b) => a.localeCompare(b));
}
