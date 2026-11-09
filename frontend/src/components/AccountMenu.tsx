import LogoutIcon from "@mui/icons-material/Logout";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useId, useState } from "react";
import { meQuery, useLogout } from "../api/auth";
import { useT } from "../i18n";

// TEMPORARY: Log out lives here until the "My page" screen exists, then this menu is removed.
export function AccountMenu() {
  const t = useT();
  const navigate = useNavigate();
  const { data: user } = useQuery(meQuery);
  const logout = useLogout();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const menuId = useId();
  if (!user) return null;

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
      <Menu id={menuId} anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} slotProps={{ list: { role: "menu" } }}>
        <MenuItem
          disabled={logout.isPending}
          onClick={() => {
            setAnchor(null);
            logout.mutate(undefined, { onSuccess: () => navigate({ to: "/" }) });
          }}
          sx={{ minHeight: 44, minWidth: 180 }}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t("app.logout")} />
        </MenuItem>
      </Menu>
    </>
  );
}
