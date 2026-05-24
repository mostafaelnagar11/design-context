import TokenList from "../_components/TokenList";

export default function TypographyPage({ params }: { params: { id: string } }) {
  return <TokenList systemId={params.id} category="typography" label="Typography" />;
}
