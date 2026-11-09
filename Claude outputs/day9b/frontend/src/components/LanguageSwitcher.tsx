import CheckIcon from "@mui/icons-material/Check";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LanguageIcon from "@mui/icons-material/Language";
import { Button, ListItemText, Menu, MenuItem, Typography } from "@mui/material";
import { useId, useState } from "react";
import { LANGUAGES, useI18n } from "../i18n";

export function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const menuId = useId();
  const current = LANGUAGES.find((l) => l.code === lang)!;

  return (
    <>
      <Button
        color="inherit"
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-label={t("lang.label")}
        aria-haspopup="menu"
        aria-expanded={anchor ? true : undefined}
        aria-controls={anchor ? menuId : undefined}
        startIcon={<LanguageIcon />}
        endIcon={<ExpandMoreIcon />}
        sx={{ minWidth: 0, px: 3, color: "text.primary" }}
      >
        {current.short}
      </Button>
      <Menu id={menuId} anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} slotProps={{ list: { role: "menu" } }}>
        <Typography variant="caption" color="text.secondary" sx={{ px: 4, py: 1, display: "block" }}>
          {t("lang.heading")}
        </Typography>
        {LANGUAGES.map((l) => (
          <MenuItem
            key={l.code}
            role="menuitemradio"
            aria-checked={l.code === lang}
            selected={l.code === lang}
            onClick={() => {
              setLang(l.code);
              setAnchor(null);
            }}
            sx={{ minHeight: 44, minWidth: 200 }}
          >
            <ListItemText primary={l.native} secondary={l.code === "en" ? undefined : l.english} />
            {l.code === lang && <CheckIcon fontSize="small" color="primary" sx={{ ml: 3 }} />}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

