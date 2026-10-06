import { NavLink } from "react-router-dom";
import { useCalculationTools } from "@/context/CalculationToolsContext";
import logoUrl from "@/assets/logo.png";
import { dispatchToolAction, NAV_GROUPS, type ToolAction } from "./nav";
import styles from "./Sidebar.module.css";

type Props = {
  mockLicense: boolean;
};

export function Sidebar({ mockLicense }: Props) {
  const tools = useCalculationTools();

  const runToolAction = (action: ToolAction) => {
    dispatchToolAction(action, tools);
  };

  return (
    <aside className={styles.sidebar} aria-label="Ana menü">
      <div className={styles.brand}>
        <img className={styles.mark} src={logoUrl} alt="" />
        <div className={styles.brandText}>
          <div className={styles.brandName}>Bilirkişi Hesap</div>
          <div className={styles.brandHint}>Masaüstü</div>
        </div>
      </div>

      <nav className={styles.nav}>
        {NAV_GROUPS.map((group) => (
          <section key={group.id} className={styles.group}>
            <div className={styles.groupLabel}>{group.label}</div>
            {group.items.map((item) => {
              const Icon = item.icon;
              if (item.action) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`${styles.link} ${styles.action}`}
                    onClick={() => runToolAction(item.action!)}
                  >
                    <Icon size={16} strokeWidth={1.9} />
                    <span className={styles.linkLabel}>{item.label}</span>
                  </button>
                );
              }
              return (
                <NavLink
                  key={item.id}
                  to={item.path!}
                  end={item.path === "/"}
                  className={({ isActive }) =>
                    isActive ? `${styles.link} ${styles.linkActive}` : styles.link
                  }
                >
                  <Icon size={16} strokeWidth={1.9} />
                  <span className={styles.linkLabel}>{item.label}</span>
                  {item.badge ? <span className={styles.badge}>{item.badge}</span> : null}
                </NavLink>
              );
            })}
          </section>
        ))}
      </nav>

      <div className={styles.footer}>
        {mockLicense ? <span className={styles.mockBadge}>Mock lisans / geliştirme</span> : null}
      </div>
    </aside>
  );
}
