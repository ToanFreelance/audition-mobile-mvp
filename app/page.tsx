import GameShell from "@/components/GameShell";
import ConfigureLauncher from "@/components/ConfigureLauncher";
import LegacyAuthRedirectBridge from "@/components/entry/LegacyAuthRedirectBridge";

export default function Home() {
  return (
    <>
      <LegacyAuthRedirectBridge />
      <GameShell />
      <ConfigureLauncher />
    </>
  );
}
