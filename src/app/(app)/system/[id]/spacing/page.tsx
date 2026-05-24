import TokenList from "../_components/TokenList";

export default function SpacingPage({ params }: { params: { id: string } }) {
  return (
    <TokenList
      systemId={params.id}
      category="spacing"
      label="Spacing"
      renderValue={(v) => {
        const n = typeof v === "number" ? v : 0;
        return (
          <div
            className="h-3.5 bg-[#C8C4B8] border-[1.5px] border-ink"
            style={{ width: Math.min(Math.max(n, 2), 80) }}
          />
        );
      }}
    />
  );
}
