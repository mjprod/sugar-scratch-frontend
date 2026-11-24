import { LoaderCircle } from "lucide-react";
import { Box, Flex, Text } from "@radix-ui/themes";
import { type ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { fetchOperatorSession } from "./operatorApi";

type Props = {
  children: ReactNode;
};

/**
 * Gates /dashboard/* behind an operator cookie (or optional VITE_DASHBOARD_TOKEN).
 * Login lives at /dashboard/login and is not wrapped.
 */
export function OperatorGate({ children }: Props) {
  const location = useLocation();
  const [state, setState] = useState<"checking" | "ok" | "denied">("checking");

  useEffect(() => {
    let cancelled = false;
    fetchOperatorSession()
      .then((ok) => {
        if (!cancelled) setState(ok ? "ok" : "denied");
      })
      .catch(() => {
        if (!cancelled) setState("denied");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "denied") {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/dashboard/login?next=${encodeURIComponent(next)}`} replace />;
  }

  if (state === "ok") return <>{children}</>;

  return (
    <main className="dashboard-root">
      <Flex align="center" justify="center" style={{ minHeight: "40vh" }}>
        <Box>
          <Flex align="center" gap="2">
            <LoaderCircle className="spin" size={16} strokeWidth={2} />
            <Text size="2" color="gray">
              Checking operator access…
            </Text>
          </Flex>
        </Box>
      </Flex>
    </main>
  );
}
