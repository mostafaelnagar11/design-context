import TokenList from "../_components/TokenList";

export default function ShadowsPage({ params }: { params: { id: string } }) {
  return <TokenList systemId={params.id} category="shadow" label="Shadows" />;
}
