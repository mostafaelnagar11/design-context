import TokenList from "../_components/TokenList";

export default function RadiiPage({ params }: { params: { id: string } }) {
  return <TokenList systemId={params.id} category="radii" label="Radii" />;
}
