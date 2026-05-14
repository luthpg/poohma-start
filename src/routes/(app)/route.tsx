import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)")({
  beforeLoad: async ({ context, location }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }

    if (!context.user.familyId && location.pathname !== "/family") {
      throw redirect({ to: "/family" });
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  return <Outlet />;
}
