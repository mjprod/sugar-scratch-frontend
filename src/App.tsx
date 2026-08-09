import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { WalletProvider } from "@/contexts/WalletContext";
import { AppRoutes } from "@/routes/AppRoutes";

export default function App() {
  return (
    <BrowserRouter>
      <WalletProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </WalletProvider>
    </BrowserRouter>
  );
}
