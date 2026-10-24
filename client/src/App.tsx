import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { useEffect, useRef } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import ProductPage from "./pages/ProductPage";
import CheckoutPage from "./pages/CheckoutPage";
import PayPalCheckoutPage from "./pages/PayPalCheckoutPage";
import VipPage from "./pages/VipPage";
import CartPage from "./pages/CartPage";
import { AdminCustomersPage, AdminOverviewPage, AdminVisitorsPage } from "./pages/AdminPage";
import { ExternalDashboardOrders, ExternalDashboardOverview, ExternalDashboardVisitors } from "./pages/ExternalDashboardPage";
import { trpc } from "./lib/trpc";
import { shouldTrackVisitorPath, VISITOR_HEARTBEAT_MS, VISITOR_SESSION_KEY } from "@shared/visitorPresence";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/product/:slug" component={ProductPage} />
      <Route path="/checkout/payment" component={PayPalCheckoutPage} />
      <Route path="/checkout/verify" component={PayPalCheckoutPage} />
      <Route path="/checkout/:step" component={CheckoutPage} />
      <Route path="/vip" component={VipPage} />
      <Route path="/cart" component={CartPage} />
      <Route path="/owner" component={AdminOverviewPage} />
      <Route path="/owner/visitors" component={AdminVisitorsPage} />
      <Route path="/owner/customers" component={AdminCustomersPage} />
      <Route path="/dashboard" component={ExternalDashboardOverview} />
      <Route path="/dashboard/orders" component={ExternalDashboardOrders} />
      <Route path="/dashboard/visitors" component={ExternalDashboardVisitors} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function VisitorHeartbeat() {
  const sessionKey = useRef<string | null>(null);
  const heartbeat = trpc.analytics.heartbeat.useMutation();
  const mutateHeartbeat = useRef(heartbeat.mutate);

  useEffect(() => {
    mutateHeartbeat.current = heartbeat.mutate;
  }, [heartbeat.mutate]);

  useEffect(() => {
    if (!shouldTrackVisitorPath(window.location.pathname)) return;
    const stored = sessionStorage.getItem(VISITOR_SESSION_KEY);
    sessionKey.current = stored ?? crypto.randomUUID();
    sessionStorage.setItem(VISITOR_SESSION_KEY, sessionKey.current);

    const leave = () => {
      if (!sessionKey.current) return;
      void fetch("/api/trpc/analytics.leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: { sessionKey: sessionKey.current } }),
        credentials: "include",
        keepalive: true,
      }).catch(() => undefined);
    };
    const send = () => {
      if (!shouldTrackVisitorPath(window.location.pathname)) {
        leave();
        return;
      }
      mutateHeartbeat.current({
        sessionKey: sessionKey.current!,
        currentPath: window.location.pathname,
        userAgent: navigator.userAgent,
      });
    };
    send();
    const timer = window.setInterval(send, VISITOR_HEARTBEAT_MS);
    window.addEventListener("pagehide", leave);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, []);

  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <VisitorHeartbeat />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
