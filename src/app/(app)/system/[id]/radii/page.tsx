import TokenList from "../_components/TokenList";

export default function RadiiPage({ params }: { params: { id: string } }) {
  return (
    <TokenList
      systemId={params.id}
      category="radii"
      label="Radii"
      renderValue={(v) => {
        const n = typeof v === "number" ? v : 0;
        return (
          <div
            className="w-7 h-7 bg-[#C8C4B8] border-2 border-ink"
            style={{ borderRadius: Math.min(n, 14) }}
          />
        );
      }}
    />
  );
}
