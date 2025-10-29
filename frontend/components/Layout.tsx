import Link from "next/link";
import { ReactNode } from "react";
import styles from "../styles/Layout.module.css";

interface LayoutProps {
  children: ReactNode;
  title: string;
}

const navigation = [
  { href: "/dashboard", label: "Project Dashboard" },
  { href: "/mod-editor", label: "Mod Editor" },
  { href: "/assets", label: "Assets Manager" },
  { href: "/publishing", label: "Publishing" }
];

export function Layout({ children, title }: LayoutProps) {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>{title}</h1>
        <nav>
          <ul className={styles.navList}>
            {navigation.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}

export default Layout;
