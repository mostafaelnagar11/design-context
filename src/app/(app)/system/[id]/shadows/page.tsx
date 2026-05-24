import TokenList from "../_components/TokenList";

export default function ShadowsPage({ params }: { params: { id: string } }) {
  return (
    <TokenList
      systemId={params.id}
      category="shadow"
      label="Shadows"
      renderValue={(v) => (
        <div
          className="w-7 h-7 bg-white border-2 border-ink"
          style={{ boxShadow: typeof v === "string" ? v : undefined }}
        />
      )}
    />
  );
}
