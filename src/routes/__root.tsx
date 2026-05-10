import { TanStackDevtools } from "@tanstack/react-devtools";
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { getAuthUser } from "@/services/auth.functions";
import "@fontsource/geist-sans/400.css";
import "@fontsource/geist-sans/500.css";
import "@fontsource/geist-sans/600.css";
import "@fontsource/geist-sans/700.css";
import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/500.css";
import "@fontsource/geist-mono/600.css";
import "@fontsource/geist-mono/700.css";
import { PasscodeProvider } from "@/components/PasscodeProvider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import appCss from "@/styles.css?url";

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "PoohMa",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),

  beforeLoad: async () => {
    const user = await getAuthUser();
    return { user };
  },

  errorComponent: (props) => {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <h1 className="mb-4 text-[32px] font-semibold tracking-geist-hero text-red-500">
          Error
        </h1>
        <p className="mb-8 text-[16px] text-muted-foreground">
          {props.error instanceof Error
            ? props.error.message
            : "予期せぬエラーが発生しました。"}
        </p>
        <button
          type="button"
          onClick={() => {
            window.location.href = "/";
          }}
          className="rounded-md bg-foreground px-6 py-2 text-[14px] font-medium text-background shadow-border transition hover:bg-gray-800"
        >
          トップページへ戻る
        </button>
      </div>
    );
  },
  notFoundComponent: () => {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <h1 className="mb-4 text-[32px] font-semibold tracking-geist-hero text-foreground">
          404 Not Found
        </h1>
        <p className="mb-8 text-[16px] text-muted-foreground">
          お探しのページは見つかりませんでした。
        </p>
        <button
          type="button"
          onClick={() => {
            window.location.href = "/";
          }}
          className="rounded-md bg-foreground px-6 py-2 text-[14px] font-medium text-background shadow-border transition hover:bg-gray-800"
        >
          トップページへ戻る
        </button>
      </div>
    );
  },
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={Route.useRouteContext().queryClient}>
          <ThemeProvider defaultTheme="system" storageKey="theme">
            <PasscodeProvider>
              <div className="min-h-screen bg-background text-foreground">
                {children}
                <TanStackDevtools
                  config={{
                    position: "bottom-right",
                  }}
                  plugins={[
                    {
                      name: "Tanstack Router",
                      render: <TanStackRouterDevtoolsPanel />,
                    },
                  ]}
                />
                <Toaster />
              </div>
            </PasscodeProvider>
          </ThemeProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
