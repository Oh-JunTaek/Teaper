import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "@/components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Admin from "./pages/Admin";
import Approved from "./pages/Approved";
import Generate from "./pages/Generate";
import Home from "./pages/Home";
import Materials from "./pages/Materials";
import NotFound from "./pages/NotFound";
import References from "./pages/References";
import Review from "./pages/Review";
import { Route, Switch } from "wouter";

function Workspace({ children }: { children: React.ReactNode }) { return <DashboardLayout>{children}</DashboardLayout>; }
function Router() { return <Switch><Route path="/"><Workspace><Home /></Workspace></Route><Route path="/materials"><Workspace><Materials /></Workspace></Route><Route path="/references"><Workspace><References /></Workspace></Route><Route path="/generate"><Workspace><Generate /></Workspace></Route><Route path="/review"><Workspace><Review /></Workspace></Route><Route path="/approved"><Workspace><Approved /></Workspace></Route><Route path="/admin"><Workspace><Admin /></Workspace></Route><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>; }
export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster richColors position="top-center" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>; }
