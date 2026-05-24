import TokenList from "../_components/TokenList";

export default function TypographyPage({ params }: { params: { id: string } }) {
  return (
    <TokenList
      systemId={params.id}
      category="typography"
      label="Typography"
      renderValue={(v) => {
        const t = (v ?? {}) as { size?: number; weight?: string };
        return (
          <div
            className="w-7 h-7 grid place-items-center text-ink"
            style={{
              fontSize: Math.min(t.size ?? 14, 18),
              fontWeight: t.weight === "bold" ? 700 : 400,
            }}
          >
            Aa
          </div>
        );
      }}
    />
  );
}
