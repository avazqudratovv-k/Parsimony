import { Box } from "@mui/material";
import type { ReactNode } from "react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Wordmark } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

// Logo on the left; language and theme on the right. Log out lives on My page.
export function TopBar({ center }: { center?: ReactNode }) {
  return (
    <Box component="header" sx={{ display: "flex", alignItems: "center", gap: 1, px: { xs: 4, sm: 6 }, py: 3, borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}>
      <Wordmark size={32} />
      <Box sx={{ flex: 1 }} />
      {center}
      <Box sx={{ flex: 1 }} />
      <LanguageSwitcher />
      <ThemeToggle />
    </Box>
  );
}
