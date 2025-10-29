import Head from "next/head";
import Layout from "../components/Layout";

export default function Assets() {
  return (
    <Layout title="Assets Manager">
      <Head>
        <title>Assets Manager | OpenCK3</title>
      </Head>
      <section>
        <h2>Uploads</h2>
        <p>Drag-and-drop interface for textures, audio, and localisation packs.</p>
      </section>
      <section>
        <h2>Version Control</h2>
        <p>
          Track asset revisions, diff imagery, and associate assets with release
          builds.
        </p>
      </section>
    </Layout>
  );
}
