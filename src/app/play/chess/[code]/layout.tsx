import type { Metadata } from "next";

type Props = {
  params: Promise<{ code: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `Chess ${code.toUpperCase()}`,
  };
}

export default function ChessRoomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
