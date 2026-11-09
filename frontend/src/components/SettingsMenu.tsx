import CheckIcon from "@mui/icons-material/Check";
import LogoutIcon from "@mui/icons-material/Logout";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { Divider, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useId, useState } from "react";
import { meQuery, useLogout } from "../api/auth";
import { useT } from "../i18n";
import { useMode } from "../theme";
import type { Mode } from "../theme";

const MODES: Mode[] = ["system", "light", "dark"];

/** One "more" button: colour theme for everyone, Log out when signed in. Keeps the top bar short. */
export function SettingsMenu() {
  const t = useT();
  const navigate = useNavigate();
  const { mode, setMode } = useMode();
  const { data: user } = useQuery(meQuery);
  const logout = useLogout();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const menuId = useId();
  const close = () => setAnchor(null);

  return (
    <>
      <IconButton
        aria-label={t("menu.label")}
        aria-haspopup="menu"
        aria-expanded={anchor ? true : undefined}
        aria-controls={anchor ? menuId : undefined}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ width: 44, height: 44 }}
      >
        <MoreVertIcon />
      </IconButton>
      <Menu id={menuId} anchorEl={anchor} open={!!anchor} onClose={close} slotProps={{ list: { role: "menu" } }}>
        <Typography variant="caption" color="text.secondary" sx={{ px: 4, py: 1, display: "block" }}>
          {t("theme.label")}
        </Typography>
        {MODES.map((m) => (
          <MenuItem
            key={m}
            role="menuitemradio"
            aria-checked={m === mode}
            selected={m === mode}
            onClick={() => {
              setMode(m);
              close();
            }}
            sx={{ minHeight: 44, minWidth: 200 }}
          >
            <ListItemText primary={t(`theme.${m}` as const)} />
            {m === mode && <CheckIcon fontSize="small" color="primary" />}
          </MenuItem>
        ))}
        {user && <Divider />}
        {user && (
          <MenuItem
            disabled={logout.isPending}
            onClick={() => {
              close();
              logout.mutate(undefined, { onSuccess: () => navigate({ to: "/" }) });
            }}
            sx={{ minHeight: 44 }}
          >
            <ListItemIcon>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={t("app.logout")} />
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
