import TokenList from "../_components/TokenList";

export default function SpacingPage({ params }: { params: { id: string } }) {
  return <TokenList systemId={params.id} category="spacing" label="Spacing" />;
}
