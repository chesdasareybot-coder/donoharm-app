import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import RootError from "../error";

describe("RootError boundary", () => {
  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it("renders a friendly message and Reload button for stale deployment errors", () => {
    const error = new Error(
      'Failed to find Server Action "0088e7ab4ffd93ee42fb7a36096c81e2147601ec67". This request might be from an older or newer deployment.',
    );
    const reset = jest.fn();

    render(<RootError error={error} reset={reset} />);

    expect(screen.getByText("Update available")).toBeInTheDocument();
    expect(
      screen.getByText(
        "A new version of the app has been deployed. Please reload the page to continue.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reload Page" }),
    ).toBeInTheDocument();
    // For stale deployment, Retry is hidden to prevent looping on stale bundle
    expect(
      screen.queryByRole("button", { name: "Retry" }),
    ).not.toBeInTheDocument();
  });

  it("renders general error with both Reload and Retry buttons", () => {
    const error = new Error("Custom network glitch");
    const reset = jest.fn();

    render(<RootError error={error} reset={reset} />);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Custom network glitch")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reload Page" }),
    ).toBeInTheDocument();
    const retryBtn = screen.getByRole("button", { name: "Retry" });
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
