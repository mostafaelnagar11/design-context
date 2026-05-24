import TokenList from "../_components/TokenList";

export default function ColorsPage({ params }: { params: { id: string } }) {
  return <TokenList systemId={params.id} category="color" label="Colors" />;
}
