import { render, screen } from "@testing-library/react";

import { StatCard } from "./stat-card";

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="Active Trucks" value={24} />);

    expect(screen.getByText("Active Trucks")).toBeInTheDocument();
    expect(screen.getByText("24")).toBeInTheDocument();
  });
});
