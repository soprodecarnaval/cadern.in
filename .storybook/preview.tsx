import type { Preview } from "@storybook/react";
import { MemoryRouter } from "react-router-dom";
import "../src/main.css";
import "bootstrap/dist/css/bootstrap.css";

// Stories can start at a URL with `parameters.router.initialEntries` (e.g. a
// query string a screen reads), and skip the padded container with
// `parameters.layout: "fullscreen"`.
const preview: Preview = {
  decorators: [
    (Story, { parameters }) => (
      <MemoryRouter initialEntries={parameters.router?.initialEntries}>
        {parameters.layout === "fullscreen" ? (
          <Story />
        ) : (
          <div className="container p-4">
            <Story />
          </div>
        )}
      </MemoryRouter>
    ),
  ],
};
export default preview;
