import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { PaginationBar } from "./PaginationBar";
import { noop } from "./storyFixtures";

const meta = {
  title: "Components/PaginationBar",
  component: PaginationBar,
  args: { currentPage: 1, maxNumberPages: 5, onChange: noop },
  render: function Render(args) {
    const [page, setPage] = useState(args.currentPage);
    return <PaginationBar {...args} currentPage={page} onChange={setPage} />;
  },
} satisfies Meta<typeof PaginationBar>;
export default meta;
type Story = StoryObj<typeof meta>;
export const First: Story = {};
export const Middle: Story = { args: { currentPage: 3 } };
export const Last: Story = { args: { currentPage: 5 } };
export const SinglePage: Story = { args: { maxNumberPages: 1 } };
