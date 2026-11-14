import { NavigationResult } from "./NavigationResult";
import type { Preview } from "@storybook/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
// The app's fonts, as in src/main.tsx, so stories render with Inter too.
import "@fontsource/inter/latin-300.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "../src/main.css";
import "bootstrap/dist/css/bootstrap.css";
import "../src/css/App.css";

const preview: Preview = {
  decorators: [
    (Story, context) => {
      const route = (context.parameters.route as string | undefined) ?? "/";
      const path = (context.parameters.routePath as string | undefined) ?? "/";
      return (
        <MemoryRouter initialEntries={[route]}>
          <div className={context.parameters.fullScreen ? "" : "container p-4"}>
            <Routes>
              <Route path={path} element={<Story />} />
              <Route path="*" element={<NavigationResult back={route} />} />
            </Routes>
          </div>
        </MemoryRouter>
      );
    },
  ],
};
export default preview;
