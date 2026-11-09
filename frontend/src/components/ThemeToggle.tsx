import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import { IconButton, Tooltip } from "@mui/material";
import { useT } from "../i18n";
import { useMode } from "../theme";

/** Light or dark, nothing else. The first visit follows the device; one tap picks a side and it is remembered. */
export function ThemeToggle() {
  const t = useT();
  const { scheme, setMode } = useMode();
  const label = t(scheme === "dark" ? "theme.toLight" : "theme.toDark");
  return (
    <Tooltip title={label}>
      <IconButton aria-label={label} onClick={() => setMode(scheme === "dark" ? "light" : "dark")} sx={{ width: 44, height: 44 }}>
        {scheme === "dark" ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
      </IconButton>
    </Tooltip>
  );
}
