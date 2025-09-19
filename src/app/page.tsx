import ChunkSceneWrapper from "@/components/ChunkSceneWrapper";

export default function Home() {
  return (
    <main style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 20 }}>
      <h1>Mirage MVP</h1>
      <ChunkSceneWrapper />
    </main>
  );
}
