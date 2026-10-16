import styles from "./StageLaunchArtwork.module.css";

/** One lightweight CSS stage visual across preload, shared epoch and scene handoff. */
export default function StageLaunchArtwork() {
  return (
    <div className={styles.backdrop} aria-hidden="true">
      <div className={styles.aura} />
      <div className={styles.truss} />
      <div className={styles.spotlightLeft} />
      <div className={styles.spotlightRight} />
      <div className={styles.ledWall}><span>AUDITION</span><small>MOBILE STAGE</small></div>
      <div className={styles.riser} />
      <div className={styles.danceFloor} />
      <div className={styles.floorRing} />
      <div className={styles.vignette} />
    </div>
  );
}
