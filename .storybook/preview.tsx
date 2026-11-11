import type { Preview } from "@storybook/react";
import { MemoryRouter } from "react-router-dom";
import "../src/main.css";
import "bootstrap/dist/css/bootstrap.css";

const preview: Preview = {
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="container p-4">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
};
export default preview;
