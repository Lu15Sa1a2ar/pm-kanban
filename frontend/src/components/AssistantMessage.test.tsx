import { render, screen } from "@testing-library/react";
import { AssistantMessage } from "@/components/AssistantMessage";

describe("AssistantMessage", () => {
  it("renders paragraphs and list items as separate blocks", () => {
    const { container } = render(
      <AssistantMessage content={"First paragraph.\n\nSecond paragraph.\n\n- one\n- two"} />
    );

    expect(container.querySelectorAll("p")).toHaveLength(2);
    expect(screen.getByText("First paragraph.")).toBeInTheDocument();
    expect(container.querySelectorAll("li").length).toBe(2);
    expect(screen.getByText("two")).toBeInTheDocument();
  });

  it("does not render images", () => {
    const { container } = render(<AssistantMessage content="![x](https://example.invalid/a.png)" />);

    expect(container.querySelector("img")).toBeNull();
  });

  it("renders http links in a new tab and drops other schemes", () => {
    const { container } = render(
      <AssistantMessage content={"[safe](https://example.com) and [bad](javascript:alert(1))"} />
    );

    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "https://example.com");
    expect(links[0]).toHaveAttribute("target", "_blank");
    expect(links[0]).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("bad")).toBeInTheDocument();
  });

  it("does not execute or render raw HTML", () => {
    const { container } = render(
      <AssistantMessage content={"<script>window.__pwned = true</script><b>bold?</b> text"} />
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
  });
});
