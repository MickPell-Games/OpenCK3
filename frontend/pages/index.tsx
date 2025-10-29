import Head from "next/head";
import Link from "next/link";
import styles from "../styles/Layout.module.css";

export default function Home() {
  return (
    <div className={styles.container}>
      <Head>
        <title>OpenCK3 Modding Toolkit</title>
      </Head>
      <main className={styles.main}>
        <h1>Welcome to the OpenCK3 Modding Toolkit</h1>
        <p>Choose a workspace to get started:</p>
        <div className={styles.cardGrid}>
          <Link className={styles.card} href="/dashboard">
            <h2>Project Dashboard</h2>
            <p>Track progress, builds, and collaborators.</p>
          </Link>
          <Link className={styles.card} href="/mod-editor">
            <h2>Mod Editor</h2>
            <p>Edit configuration, scripts, and metadata.</p>
          </Link>
          <Link className={styles.card} href="/assets">
            <h2>Assets Manager</h2>
            <p>Upload and organize textures, audio, and localisation files.</p>
          </Link>
          <Link className={styles.card} href="/publishing">
            <h2>Publishing Workflow</h2>
            <p>Prepare release builds and push to distribution platforms.</p>
          </Link>
        </div>
      </main>
    </div>
  );
}
