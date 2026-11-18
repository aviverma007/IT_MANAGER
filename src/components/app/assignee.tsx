import { useUsers } from "@/api/hooks";
import { Select } from "@/components/ui/field";

/** Assignee picker: only real IT Manager users (active ones), stored by full name. */
export function AssigneeSelect({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const { data: users } = useUsers();
  const active = (users ?? []).filter((u) => u.active).sort((a, b) => a.name.localeCompare(b.name));
  const known = !value || active.some((u) => u.name === value);
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} className={className}>
      <option value="">Unassigned</option>
      {active.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
      {!known && <option value={value}>{value} (not a user)</option>}
    </Select>
  );
}

/** Names for filters: your users, in alphabetical order. */
export function useAssigneeNames() {
  const { data: users } = useUsers();
  return (users ?? []).filter((u) => u.active).map((u) => u.name).sort((a, b) => a.localeCompare(b));
}
