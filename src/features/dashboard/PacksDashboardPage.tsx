import { DashboardShell } from "./DashboardShell";
import { OperatorGate } from "./OperatorGate";
import { PacksPage } from "./PacksPage";

export function PacksDashboardPage() {
  return (
    <DashboardShell>
      <OperatorGate>
        <PacksPage />
      </OperatorGate>
    </DashboardShell>
  );
}
