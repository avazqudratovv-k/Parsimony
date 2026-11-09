import { Box } from "@mui/material";
import { useState } from "react";
import { logoUrl, MIN_LOGO_SIZE } from "../lib/logo";
import { tokens } from "../theme";
import { CategoryIcon } from "./CategoryIcon";

/** The round tile at the start of a row: the merchant's logo when there is one, otherwise the category icon.
 * Missing, broken or generic logos quietly fall back to the icon, so nothing ever looks empty. */
export function EntryAvatar({ category, domain }: { category: string; domain?: string | null }) {
  const [useIcon, setUseIcon] = useState(false);
  if (!domain || useIcon) return <CategoryIcon category={category} />;
  return (
    <Box
      aria-hidden
      sx={(theme) => ({
        width: 40, height: 40, borderRadius: 3, flexShrink: 0, display: "grid", placeItems: "center", overflow: "hidden",
        bgcolor: tokens[theme.palette.mode].sunken,
      })}
    >
      <img
        src={logoUrl(domain)} alt="" width={28} height={28} loading="lazy" referrerPolicy="no-referrer"
        onError={() => setUseIcon(true)}
        onLoad={(e) => { if (e.currentTarget.naturalWidth < MIN_LOGO_SIZE) setUseIcon(true); }}
        style={{ display: "block", borderRadius: 6 }}
      />
    </Box>
  );
}
