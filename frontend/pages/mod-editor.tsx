import Head from "next/head";
import Layout from "../components/Layout";

export default function ModEditor() {
  return (
    <Layout title="Mod Editor">
      <Head>
        <title>Mod Editor | OpenCK3</title>
      </Head>
      <section>
        <h2>Metadata</h2>
        <p>Update descriptions, categories, compatibility tags, and localisation.</p>
      </section>
      <section>
        <h2>Script Workspace</h2>
        <p>
          Manage scripted triggers, events, and balance tweaks with versioned
          history.
        </p>
      </section>
    </Layout>
  );
}
