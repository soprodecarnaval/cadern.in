import { NavigationResult } from "./NavigationResult";
import type { Preview } from "@storybook/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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
