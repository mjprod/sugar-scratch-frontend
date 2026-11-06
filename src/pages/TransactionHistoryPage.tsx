import { useNavigate, useSearchParams } from "react-router-dom";
import { TransactionHistoryScreen } from "@/components/history/TransactionHistoryScreen";
import { useGoBack } from "@/hooks/useGoBack";
import { helpContactPath } from "@/content/helpCenter";
import { Paths } from "@/routes/Paths";

export function TransactionHistoryPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const goBack = useGoBack(Paths.profile);
  return (
    <TransactionHistoryScreen
      onBack={goBack}
      onVisitStore={() => navigate(Paths.store)}
      initialSelectedId={params.get("id")}
      onGetHelp={(transactionId) =>
        navigate(
          transactionId
            ? helpContactPath("missing-diamonds", transactionId)
            : Paths.help,
        )
      }
      onReportIssue={(transactionId) =>
        navigate(helpContactPath("refund", transactionId))
      }
      onOpenGameHistory={(purchaseTransactionId) => {
        if (purchaseTransactionId) {
          navigate(
            `${Paths.gameHistory}?purchase=${encodeURIComponent(purchaseTransactionId)}`,
          );
          return;
        }
        navigate(Paths.gameHistory);
      }}
    />
  );
}
