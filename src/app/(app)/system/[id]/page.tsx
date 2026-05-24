import { redirect } from "next/navigation";

export default function SystemRoot({ params }: { params: { id: string } }) {
  redirect(`/system/${params.id}/colors`);
}
