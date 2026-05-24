import TokenList from "../_components/TokenList";

export default function ColorsPage({ params }: { params: { id: string } }) {
  return (
    <TokenList
      systemId={params.id}
      category="color"
      label="Colors"
      renderValue={(v) => (
        <div
          className="w-7 h-7 border-2 border-ink"
          style={{ background: typeof v === "string" ? v : "#ccc" }}
        />
      )}
    />
  );
}
