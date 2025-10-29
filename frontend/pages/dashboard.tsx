import Head from "next/head";
import Layout from "../components/Layout";

export default function Dashboard() {
  return (
    <Layout title="Project Dashboard">
      <Head>
        <title>Project Dashboard | OpenCK3</title>
      </Head>
      <section>
        <h2>Active Projects</h2>
        <p>
          Monitor build history, assigned contributors, and recent activity for
          each mod project.
        </p>
      </section>
      <section>
        <h2>Build Pipelines</h2>
        <p>
          View current build status, configure build targets, and rerun failed
          jobs.
        </p>
      </section>
    </Layout>
  );
}
