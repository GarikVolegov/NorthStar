import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Test from "@/pages/test";
import Results from "@/pages/results";
import Sector from "@/pages/sector";
import Register from "@/pages/register";
import Premium from "@/pages/premium";
import PremiumSuccess from "@/pages/premium-success";
import News from "@/pages/news";
import ResetPassword from "@/pages/reset-password";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

const queryClient = new QueryClient();

function Router() {
  return (
    <div className="flex flex-col min-h-[100dvh]">
      <Navbar />
      <main className="flex-1">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/test" component={Test} />
          <Route path="/risultati/:id" component={Results} />
          <Route path="/settore/:id" component={Sector} />
          <Route path="/registra" component={Register} />
          <Route path="/premium" component={Premium} />
          <Route path="/premium/successo" component={PremiumSuccess} />
          <Route path="/news" component={News} />
          <Route path="/reset-password" component={ResetPassword} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
