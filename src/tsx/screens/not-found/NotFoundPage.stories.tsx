import type { Meta, StoryObj } from "@storybook/react";
import { NotFoundPage } from "./NotFoundPage";
const meta = {
  title: "Screens/NotFoundPage",
  component: NotFoundPage,
} satisfies Meta<typeof NotFoundPage>;
export default meta;
export const NotFound: StoryObj<typeof meta> = {};
