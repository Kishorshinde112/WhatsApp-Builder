import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { Layout } from "@/components/layout";
import { setBaseUrl } from "@/lib/api-client";
import Dashboard from "@/pages/dashboard";
import Campaigns from "@/pages/campaigns";
import CampaignNew from "@/pages/campaign-new";
import CampaignDetail from "@/pages/campaign-detail";
import Contacts from "@/pages/contacts";
import ContactsImport from "@/pages/contacts-import";
import Tracking from "@/pages/tracking";
import MessageDetail from "@/pages/message-detail";
import SettingsProviders from "@/pages/settings-providers";
import NotFound from "@/pages/not-found";

// Set the API base URL - use environment variable or default to same origin
const apiBaseUrl = import.meta.env.VITE_API_URL || "";
setBaseUrl(apiBaseUrl);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/campaigns/new" component={CampaignNew} />
        <Route path="/campaigns/:id" component={CampaignDetail} />
        <Route path="/campaigns" component={Campaigns} />
        <Route path="/contacts/import" component={ContactsImport} />
        <Route path="/contacts" component={Contacts} />
        <Route path="/tracking/messages/:id" component={MessageDetail} />
        <Route path="/tracking" component={Tracking} />
        <Route path="/settings/providers" component={SettingsProviders} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="whatsapp-ops-theme">
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
