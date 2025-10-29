import Head from "next/head";
import Layout from "../components/Layout";

export default function Publishing() {
  return (
    <Layout title="Publishing Workflow">
      <Head>
        <title>Publishing Workflow | OpenCK3</title>
      </Head>
      <section>
        <h2>Release Checklist</h2>
        <p>
          Validate mod metadata, dependency versions, and localisation coverage.
        </p>
      </section>
      <section>
        <h2>Distribution</h2>
        <p>
          Configure Steam Workshop, Paradox Mods, and other distribution targets
          with build artifacts.
        </p>
      </section>
    </Layout>
  );
}
