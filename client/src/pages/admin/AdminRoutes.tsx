import { Route, Switch } from "wouter";
import { Empty } from "@/components/ui";
import { AdminLayout } from "./AdminLayout";
import { AdminDashboard } from "./Dashboard";
import { AdminTemplates, AdminTemplateEditor } from "./Templates";
import { AdminCategories, AdminPlans, AdminUsers, AdminGenerations, AdminOrders, AdminSettings } from "./Manage";

export default function AdminRoutes() {
  return (
    <AdminLayout>
      <Switch>
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/admin/templates" component={AdminTemplates} />
        <Route path="/admin/templates/:id" component={AdminTemplateEditor} />
        <Route path="/admin/categories" component={AdminCategories} />
        <Route path="/admin/plans" component={AdminPlans} />
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/admin/generations" component={AdminGenerations} />
        <Route path="/admin/orders" component={AdminOrders} />
        <Route path="/admin/settings" component={AdminSettings} />
        <Route><Empty title="Sahifa topilmadi" /></Route>
      </Switch>
    </AdminLayout>
  );
}
