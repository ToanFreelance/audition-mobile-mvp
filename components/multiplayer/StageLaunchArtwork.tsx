import styles from "./StageLaunchArtwork.module.css";

/**
 * The approved DANCE UP / Yuna concept is the canonical presentation plate.
 * The lower loading card is rendered separately with live session data so
 * sketch-only values (e.g. 72%, 5/5) never leak into actual matches.
 */
export default function StageLaunchArtwork() {
  return <div className={styles.backdrop} data-testid="dance-up-launch-artwork" aria-hidden="true" />;
}
