import BrightnessAutoIcon from "@mui/icons-material/BrightnessAuto";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import { IconButton, Tooltip } from "@mui/material";
import { useT } from "../i18n";
import { useMode } from "../theme";
import type { Mode } from "../theme";

const NEXT: Record<Mode, Mode> = { system: "light", light: "dark", dark: "system" };

/** One button cycling system -> light -> dark. Tooltip and label say the current choice. */
export function ThemeToggle() {
  const t = useT();
  const { mode, setMode } = useMode();
  const label = `${t("theme.label")}: ${t(`theme.${mode}` as const)}`;
  const Icon = mode === "light" ? LightModeIcon : mode === "dark" ? DarkModeIcon : BrightnessAutoIcon;
  return (
    <Tooltip title={label}>
      <IconButton aria-label={label} onClick={() => setMode(NEXT[mode])} sx={{ width: 44, height: 44 }}>
        <Icon />
      </IconButton>
    </Tooltip>
  );
}
